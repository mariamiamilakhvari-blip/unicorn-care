/*
  One-shot backfill for the checkup timezone defect (P1).

  Until `fix(care-plan): anchor checkups in the clinic zone`, a checkup's `scheduledAt` arrived from
  `<input type="datetime-local">` as a zoneless `"YYYY-MM-DDTHH:mm"` and was parsed by
  `z.coerce.date()` against the *server process* zone — UTC on Vercel. The stored instant was
  therefore the clinician's wall clock read as if it were UTC, so every patient-facing surface
  printed the appointment late by the clinic's offset (four hours for Asia/Tbilisi).

  That stored value is exactly the "civil carrier" the new `clock.zonedCivilToUtc` takes, so the
  correction is the same function the application now applies on write.

  ORDERING — read this before running.

    The corrected write path and the old one produce different instants from the same input, and a
    stored row carries no record of which wrote it. This script therefore assumes EVERY checkup it
    finds was written by the old path, which is true only while the fix is undeployed. Run it
    BEFORE the fix reaches production, or it will shift correctly-stored rows a second time.

    The `migrations` ledger below makes re-runs safe: each checkup it rewrites is recorded with its
    before and after value, and a second run skips anything already recorded. That protects against
    double-shifting what this script has touched. It cannot protect against rows the *application*
    wrote correctly after deploy, which is why the ordering above is a requirement and not advice.

  Dry run by default. Pass --apply to write.
*/
import { readFileSync } from 'node:fs';

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const LEDGER = 'migrations';
const MIGRATION_ID = 'checkup-zone-anchor-p1';

const env = readFileSync('.env', 'utf8');
const uri = env
  .split('\n')
  .find(line => line.startsWith('MONGO_URI'))
  .split('=')
  .slice(1)
  .join('=')
  .trim()
  .replace(/^"|"$/g, '');

/* ---- the zone maths, mirroring src/shared/lib/clock.ts exactly ---- */

const formatters = new Map();

function formatter(timeZone) {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timeZone, created);
  return created;
}

function partsInZone(date, timeZone) {
  const values = new Map(formatter(timeZone).formatToParts(date).map(p => [p.type, p.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

function offsetMs(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Two passes so a DST transition between guess and result is picked up. */
function resolve(year, month, day, hour, minute, timeZone) {
  const civil = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = civil - offsetMs(new Date(civil), timeZone);
  return new Date(civil - offsetMs(new Date(firstPass), timeZone));
}

function zonedCivilToUtc(civil, timeZone) {
  return resolve(
    civil.getUTCFullYear(),
    civil.getUTCMonth() + 1,
    civil.getUTCDate(),
    civil.getUTCHours(),
    civil.getUTCMinutes(),
    timeZone
  );
}

function civilInZone(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const pad = n => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function isValidTimeZone(value) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/*
  A reimplementation that silently disagreed with the application's would corrupt every row it
  touched, so it is checked against known-good values before a single document is read. These are
  the same cases asserted in `clock.spec.ts`.
*/
function selfCheck() {
  const cases = [
    ['2026-08-22T13:00:00.000Z', 'Asia/Tbilisi', '2026-08-22T09:00:00.000Z'],
    ['2026-08-22T13:00:00.000Z', 'UTC', '2026-08-22T13:00:00.000Z'],
    ['2026-08-22T01:00:00.000Z', 'America/New_York', '2026-08-22T05:00:00.000Z'],
    ['2026-08-22T13:00:00.000Z', 'Europe/London', '2026-08-22T12:00:00.000Z'],
    ['2026-01-22T13:00:00.000Z', 'Europe/London', '2026-01-22T13:00:00.000Z'],
  ];
  for (const [civil, zone, expected] of cases) {
    const actual = zonedCivilToUtc(new Date(civil), zone).toISOString();
    if (actual !== expected) {
      throw new Error(`zone maths self-check failed: ${civil} ${zone} -> ${actual}, want ${expected}`);
    }
  }
  console.log('zone maths self-check: ok\n');
}

/* ---- the backfill ---- */

selfCheck();

await mongoose.connect(uri);
const db = mongoose.connection.db;

const previous = await db.collection(LEDGER).findOne({ _id: MIGRATION_ID });
const alreadyDone = new Set((previous?.checkups ?? []).map(entry => entry.key));
if (previous) {
  console.log(
    `ledger: a previous run on ${previous.ranAt.toISOString()} rewrote ${alreadyDone.size} checkup(s); those will be skipped\n`
  );
}

const clinics = new Map(
  (await db.collection('clinics').find({}, { projection: { timezone: 1, name: 1 } }).toArray()).map(
    clinic => [String(clinic._id), clinic]
  )
);

const plans = await db.collection('careplans').find({ 'checkups.0': { $exists: true } }).toArray();

const changes = [];
const skipped = [];

for (const plan of plans) {
  const clinic = clinics.get(String(plan.clinicId));
  const zone = clinic?.timezone;

  if (!isValidTimeZone(zone)) {
    skipped.push({ plan: String(plan._id), reason: `unusable clinic zone: ${zone ?? 'none'}` });
    continue;
  }

  for (const [index, checkup] of plan.checkups.entries()) {
    const key = `${plan._id}:${checkup._id}`;
    if (alreadyDone.has(key)) continue;
    if (!(checkup.scheduledAt instanceof Date)) {
      skipped.push({ plan: String(plan._id), reason: `checkup ${index} has no date` });
      continue;
    }

    const corrected = zonedCivilToUtc(checkup.scheduledAt, zone);
    // A clinic on UTC was never affected: the civil carrier and the true instant coincide.
    if (corrected.getTime() === checkup.scheduledAt.getTime()) continue;

    changes.push({
      key,
      planId: plan._id,
      index,
      clinic: clinic.name,
      zone,
      title: checkup.title,
      from: checkup.scheduledAt,
      to: corrected,
      shownBefore: civilInZone(checkup.scheduledAt, zone),
      shownAfter: civilInZone(corrected, zone),
    });
  }
}

console.log(`plans with checkups: ${plans.length}`);
console.log(`checkups needing correction: ${changes.length}`);
console.log(`skipped: ${skipped.length}\n`);

for (const change of changes) {
  console.log(
    `  ${change.clinic} [${change.zone}] "${change.title}"\n` +
    `    stored ${change.from.toISOString()} -> ${change.to.toISOString()}\n` +
    `    patient saw ${change.shownBefore.replace('T', ' ')}, will now see ${change.shownAfter.replace('T', ' ')}\n`
  );
}

for (const skip of skipped) console.log(`  SKIPPED plan ${skip.plan}: ${skip.reason}`);

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to commit these changes.');
  await mongoose.disconnect();
  process.exit(0);
}

if (changes.length === 0) {
  console.log('\nNothing to do.');
  await mongoose.disconnect();
  process.exit(0);
}

let written = 0;
for (const change of changes) {
  const result = await db
    .collection('careplans')
    .updateOne(
      { _id: change.planId },
      { $set: { [`checkups.${change.index}.scheduledAt`]: change.to } }
    );
  if (result.modifiedCount > 0) written += 1;
}

await db.collection(LEDGER).updateOne(
  { _id: MIGRATION_ID },
  {
    $set: { ranAt: new Date() },
    $push: {
      checkups: {
        $each: changes.map(change => ({
          key: change.key,
          from: change.from,
          to: change.to,
          zone: change.zone,
        })),
      },
    },
  },
  { upsert: true }
);

console.log(`\nAPPLIED — ${written} checkup(s) rewritten, recorded in \`${LEDGER}\`.`);
console.log(
  'Reminder occurrences are NOT touched: the next rebuild regenerates them from the plan.\n' +
  'Any active plan with a corrected checkup should be re-saved (or left to the rolling\n' +
  'extension) so its pending checkup reminder moves with the appointment.'
);

await mongoose.disconnect();
