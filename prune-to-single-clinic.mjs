/*
  Destructive prune: reduce the database to one clinic plus the platform admin.

  KEEPS
    - clinic `info@gaguaclinic.ge` (გაგუას კლინიკა) and everything scoped to it
    - its owner user, without which the clinic would have no way to sign in
    - the platform admin `mariamiamilakhvari@gmail.com`
    - the 36 platform-default recovery guides, which carry no `clinicId` and belong to nobody

  DELETES everything else, including real patient health records.

  TRANSITIVE LINKS — the reason this is not five deleteMany calls.

    Two collections carry no `clinicId` at all: `pushsubscriptions` links only by `patientId`, and
    `passwordresettokens` only by `userId`. A prune written around `clinicId` alone leaves both
    behind as orphans pointing at patients and users that no longer exist — which is worse than
    not pruning, because the rows are then invisible to every clinic-scoped query in the app while
    still holding personal data.

  Dry run by default. Pass --apply to delete. There is no undo.
*/
import { readFileSync, writeFileSync } from 'node:fs';

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = !process.argv.includes('--no-snapshot');
const KEEP_CLINIC_EMAIL = 'info@gaguaclinic.ge';
const KEEP_ADMIN_EMAIL = 'mariamiamilakhvari@gmail.com';

const env = readFileSync('.env', 'utf8');
const uri = env
  .split('\n')
  .find(line => line.startsWith('MONGO_URI'))
  .split('=')
  .slice(1)
  .join('=')
  .trim()
  .replace(/^"|"$/g, '');

await mongoose.connect(uri);
const db = mongoose.connection.db;

const clinic = await db.collection('clinics').findOne({ email: KEEP_CLINIC_EMAIL });
if (!clinic) throw new Error(`clinic ${KEEP_CLINIC_EMAIL} not found — refusing to run`);

const admin = await db.collection('users').findOne({ email: KEEP_ADMIN_EMAIL });
if (!admin) throw new Error(`admin ${KEEP_ADMIN_EMAIL} not found — refusing to run`);

const clinicId = clinic._id;

const keptUsers = await db
  .collection('users')
  .find({ $or: [{ clinicId }, { _id: admin._id }] })
  .toArray();
const keptUserIds = keptUsers.map(user => user._id);

const keptPatientIds = (
  await db.collection('patients').find({ clinicId }, { projection: { _id: 1 } }).toArray()
).map(patient => patient._id);

console.log(`KEEP clinic  : ${clinic.name} (${clinicId})`);
console.log(`KEEP users   : ${keptUsers.map(u => u.email).join(', ')}`);
console.log(`KEEP patients: ${keptPatientIds.length}\n`);

/*
  Each entry is the filter for rows to REMOVE. Scoped collections go by `clinicId`; the two that
  have no clinic go by the ids resolved above; recovery guides keep anything with no owner.
*/
const targets = [
  ['patients', { clinicId: { $ne: clinicId } }],
  ['procedures', { clinicId: { $ne: clinicId } }],
  ['careplans', { clinicId: { $ne: clinicId } }],
  ['reminderoccurrences', { clinicId: { $ne: clinicId } }],
  ['patientaccesstokens', { clinicId: { $ne: clinicId } }],
  ['patientportallinks', { clinicId: { $ne: clinicId } }],
  ['ratings', { clinicId: { $ne: clinicId } }],
  ['symptomreports', { clinicId: { $ne: clinicId } }],
  ['recoverylogs', { clinicId: { $ne: clinicId } }],
  ['emailevents', { clinicId: { $ne: clinicId } }],
  ['consentrecords', { clinicId: { $ne: clinicId } }],
  ['datarequests', { clinicId: { $ne: clinicId } }],
  ['files', { clinicId: { $ne: clinicId } }],
  ['patientphotos', { patientId: { $nin: keptPatientIds } }],
  ['photoaccessevents', { patientId: { $nin: keptPatientIds } }],
  // No clinicId on either of these — see the header.
  ['pushsubscriptions', { patientId: { $nin: keptPatientIds } }],
  ['passwordresettokens', { userId: { $nin: keptUserIds } }],
  // Platform defaults carry no clinicId and are shared reference content: never delete them.
  ['recoveryguides', { clinicId: { $exists: true, $ne: null, $not: { $eq: clinicId } } }],
  ['users', { _id: { $nin: keptUserIds } }],
  ['clinics', { _id: { $ne: clinicId } }],
];

let total = 0;
console.log('collection                 delete / total');
for (const [name, filter] of targets) {
  const doomed = await db.collection(name).countDocuments(filter);
  const all = await db.collection(name).countDocuments();
  total += doomed;
  const flag = doomed > 0 ? '' : '  (nothing)';
  console.log(`  ${name.padEnd(24)} ${String(doomed).padStart(5)} / ${String(all).padStart(5)}${flag}`);
}

console.log(`\nTOTAL DOCUMENTS TO DELETE: ${total}`);

if (!APPLY) {
  console.log('\nDRY RUN — nothing deleted. Re-run with --apply. There is no undo.');
  await mongoose.disconnect();
  process.exit(0);
}

/*
  Snapshot before deletion, not after — obviously — and covering the exact filters about to run, so
  the file is a faithful record of what was removed rather than an approximation of it. It holds
  patient health data in the clear, which is why `.gitignore` carries a rule for it: this is a
  recovery artefact for one operation, not something to keep or ever commit.
*/
if (SNAPSHOT) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `prune-backup-${stamp}.json`;
  const dump = {};
  for (const [name, filter] of targets) {
    dump[name] = await db.collection(name).find(filter).toArray();
  }
  writeFileSync(file, JSON.stringify(dump, null, 2));
  const rows = Object.values(dump).reduce((sum, list) => sum + list.length, 0);
  console.log(`\nSnapshot written: ${file} (${rows} documents)`);
}

console.log('\nApplying…');
for (const [name, filter] of targets) {
  const result = await db.collection(name).deleteMany(filter);
  if (result.deletedCount > 0) console.log(`  ${name.padEnd(24)} deleted ${result.deletedCount}`);
}

await db.collection('migrations').updateOne(
  { _id: 'prune-to-single-clinic' },
  { $set: { ranAt: new Date(), keptClinic: clinicId, keptUsers: keptUserIds, deleted: total } },
  { upsert: true }
);

console.log('\nDone.');
await mongoose.disconnect();
