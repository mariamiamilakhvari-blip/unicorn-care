/*
  Secondary backfill for the occurrence-copy defect (P2), and for anything else the generator has
  learned since a plan's pending rows were written.

  `title` and `body` are rendered once, at generation time, and stored on the row — that is what
  keeps dispatch a pure read. The upside is speed; the cost is that fixing the generator does not
  fix rows that already exist. Every pending occurrence in the database was written by the English
  table, so a Georgian patient keeps reading `Take with food. 08:00` until their plan is rebuilt,
  which otherwise only happens when a clinic edits it or the rolling extension fires.

  This rebuilds those rows the way the application does: same generator, same translator, same
  timezone rules, same guide lookup, same `dueAt >= now` filter.

  WHY IT LOADS THE APP INSTEAD OF REIMPLEMENTING IT

    `buildOccurrences` is ~200 lines deciding, across DST boundaries and per-patient timezones,
    the exact instants at which someone takes medication. A second copy of that in a migration
    script would be the most dangerous code in the repository — correct on the day it was written
    and silently divergent forever after. So the script drives the real modules through Vite's SSR
    loader (already present as vitest's dependency) rather than restating any of their logic.

  WHAT IT PRESERVES

    Only `pending` rows are touched. `sent` / `done` / `skipped` / `missed` record what actually
    happened and are never regenerated — a patient's adherence history is not a rendering concern.

  Dry run by default. Pass --apply to write.
*/
import { readFileSync } from 'node:fs';

import mongoose from 'mongoose';
import { createServer } from 'vite';

const APPLY = process.argv.includes('--apply');
const LEDGER = 'migrations';
const MIGRATION_ID = 'occurrence-copy-rebuild-p2';

/* The app's own `mongo` singleton reads this, so it has to exist before any app module loads. */
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  /*
    Mongoose stays external, and must. It is CommonJS, so Vite's SSR transform cannot evaluate it —
    and more importantly the app's schema modules register their models on whichever mongoose
    instance they import. A second, transformed copy would register models the connection below
    knows nothing about.
  */
  ssr: { external: ['mongoose'] },
});

const load = path => vite.ssrLoadModule(path);

const { buildOccurrences, DEFAULT_HORIZON_DAYS } = await load(
  '/src/features/care-plan/service/occurrence-generator.service.ts'
);
const { occurrenceTranslator } = await load('/src/shared/const/occurrence-copy.const.ts');
const { effectiveTimeZone } = await load('/src/shared/const/timezone.const.ts');
const { resolveGuideForProcedure } = await load(
  '/src/features/recovery-guide/service/resolve-guide.service.ts'
);
const { mongo } = await load('/src/shared/lib/mongo.ts');

await mongo.connect();
const db = mongoose.connection.db;

const now = new Date();

const clinics = new Map(
  (await db.collection('clinics').find({}).toArray()).map(clinic => [String(clinic._id), clinic])
);
const patients = new Map(
  (await db.collection('patients').find({}).toArray()).map(p => [String(p._id), p])
);

/*
  Not just `status: 'active'`.

  A pending row is dispatched on its own merits — `findDueForDispatch` filters on the row's status
  and its due window, and never looks at the plan behind it. A completed plan can therefore still
  own a live future reminder, which is correct: a follow-up appointment three weeks after the
  rehab window closes is ordinary practice, and the patient should still be reminded of it.

  It also means those rows are exactly the ones this script exists for, and scoping to active
  plans would have skipped every one of them. On the production data at the time of writing, all
  the stale rows belonged to completed plans and an active-only run was a no-op.
*/
const withPending = await db
  .collection('reminderoccurrences')
  .distinct('carePlanId', { status: 'pending' });

const plans = await db
  .collection('careplans')
  .find({ $or: [{ status: 'active' }, { _id: { $in: withPending } }] })
  .toArray();

console.log(
  `plans to rebuild: ${plans.length} ` +
  `(active, plus any plan still owning a pending row)\n`
);

const report = [];
let skipped = 0;

for (const plan of plans) {
  const clinic = clinics.get(String(plan.clinicId));
  if (!clinic) {
    console.log(`  SKIP plan ${String(plan._id).slice(-6)}: clinic not readable`);
    skipped += 1;
    continue;
  }

  const patient = patients.get(String(plan.patientId)) ?? null;

  // Exactly the rules `rebuildPlanOccurrences` applies: the patient's zone and language win, the
  // clinic's are the fallback for a record written before those fields existed.
  const timezone = effectiveTimeZone(patient?.timezone ?? '', clinic.timezone);
  const locale = patient?.locale ?? clinic.locale;

  const guide = await resolveGuideForProcedure(
    String(plan.procedureId),
    String(plan.clinicId),
    locale
  );

  const drafts = buildOccurrences(
    plan,
    timezone,
    DEFAULT_HORIZON_DAYS,
    occurrenceTranslator(locale),
    now,
    guide
  ).filter(draft => draft.dueAt.getTime() >= now.getTime());

  const existing = await db
    .collection('reminderoccurrences')
    .countDocuments({ carePlanId: plan._id, status: 'pending' });

  const sample = drafts.find(d => d.kind === 'medication') ?? drafts[0];

  report.push({ plan, clinic, patient, timezone, locale, guide, drafts, existing });

  console.log(
    `  ${clinic.name} · plan ${String(plan._id).slice(-6)} [${locale}, ${timezone}]\n` +
    `    pending now: ${existing}  ->  regenerated: ${drafts.length}` +
    `${guide ? `  (guide: ${guide.expected.length} expected sign(s))` : '  (no guide)'}\n` +
    `    sample body: ${sample ? JSON.stringify(sample.body || sample.title) : '—'}\n`
  );
}

const totalBefore = report.reduce((sum, row) => sum + row.existing, 0);
const totalAfter = report.reduce((sum, row) => sum + row.drafts.length, 0);
console.log(`plans: ${report.length} (skipped ${skipped})`);
console.log(`pending rows: ${totalBefore} -> ${totalAfter}`);

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.');
  await vite.close();
  await mongo.disconnect();
  process.exit(0);
}

let rewritten = 0;
let deleted = 0;

for (const row of report) {
  /*
    Delete then insert, in that order and per plan, mirroring `rebuildPlanOccurrences`. Scoped to
    one plan's `pending` rows so a failure part-way through leaves every other plan untouched and
    the script can simply be run again.
  */
  const removal = await db
    .collection('reminderoccurrences')
    .deleteMany({ carePlanId: row.plan._id, status: 'pending' });
  deleted += removal.deletedCount;

  if (row.drafts.length > 0) {
    await db.collection('reminderoccurrences').insertMany(
      row.drafts.map(draft => ({
        ...draft,
        carePlanId: row.plan._id,
        patientId: row.plan.patientId,
        clinicId: row.plan.clinicId,
        claimId: null,
        claimedAt: null,
        pushDelivered: null,
        emailDelivered: null,
      }))
    );
    rewritten += row.drafts.length;
  }
}

await db.collection(LEDGER).updateOne(
  { _id: MIGRATION_ID },
  {
    $set: { ranAt: new Date() },
    $push: {
      runs: {
        at: new Date(),
        plans: report.length,
        deleted,
        inserted: rewritten,
        locales: [...new Set(report.map(r => r.locale))],
      },
    },
  },
  { upsert: true }
);

console.log(`\nAPPLIED — ${deleted} pending row(s) removed, ${rewritten} regenerated.`);
console.log('History (sent / done / skipped / missed) was not touched.');

await vite.close();
await mongo.disconnect();
