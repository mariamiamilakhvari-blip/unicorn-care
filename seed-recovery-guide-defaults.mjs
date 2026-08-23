/*
  Runs the platform recovery-guide seed against the database.

  Same work `POST /api/admin/recovery-guides/seed` does, and deliberately the same code: it loads
  `seedDefaultRecoveryGuidesService` rather than restating the template mapping, so the rows written
  here are byte for byte the rows the endpoint would write. The endpoint is behind `adminGuard` and
  needs a browser session; this is the route in from a terminal.

  What it writes: one unpublished draft per procedure type per language, `clinicId: null`, into
  slots that are empty. It cannot overwrite — `refresh` is not passed, so an existing default is
  skipped, edits and all — and it cannot reach a clinic's own guide, which lives under its own
  `clinicId`. Nothing it writes is visible to a patient: `isPublished: false` means a clinician has
  to read the draft before it goes anywhere near one.

  Dry run by default. Pass --apply to write.
*/
import { readFileSync } from 'node:fs';

import mongoose from 'mongoose';
import { createServer } from 'vite';

const APPLY = process.argv.includes('--apply');

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
  // CommonJS, and the schema modules must register models on the same instance the app connects on.
  ssr: { external: ['mongoose'] },
});

const load = path => vite.ssrLoadModule(path);

const { SEED_PROCEDURE_KEYS } = await load('/src/shared/const/recovery-guide-seed.const.ts');
const { LOCALE_OPTIONS } = await load('/src/shared/const/locale.const.ts');

const slots = SEED_PROCEDURE_KEYS.length * LOCALE_OPTIONS.length;

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

const existing = await db.collection('recoveryguides').countDocuments({ clinicId: null });
const known = await db
  .collection('recoveryguides')
  .distinct('manipulationType', { clinicId: null });
const retired = known.filter(key => !SEED_PROCEDURE_KEYS.includes(key));

console.log(`procedure types      : ${SEED_PROCEDURE_KEYS.length}`);
console.log(`languages            : ${LOCALE_OPTIONS.length}`);
console.log(`slots to fill        : ${slots}`);
console.log(`platform defaults now: ${existing}`);
console.log(`retired keys present : ${retired.length ? retired.join(', ') : 'none'}\n`);

if (!APPLY) {
  console.log(`DRY RUN — would insert up to ${slots - existing} rows. Pass --apply to write.`);
  await mongoose.disconnect();
  await vite.close();
  process.exit(0);
}

const { seedDefaultRecoveryGuidesService } = await load(
  '/src/features/recovery-guide/service/recovery-guide-seed.service.ts'
);

const { data, status } = await seedDefaultRecoveryGuidesService();
console.log(`status   : ${status}`);
console.log(`inserted : ${data.inserted}`);
console.log(`skipped  : ${data.skipped}`);
console.log(`refreshed: ${data.refreshed}`);

const after = await db.collection('recoveryguides').countDocuments({ clinicId: null });
const published = await db
  .collection('recoveryguides')
  .countDocuments({ clinicId: null, isPublished: true });
console.log(`\nplatform defaults after: ${after}`);
console.log(`of those published     : ${published}`);

await mongoose.disconnect();
await vite.close();
