/*
  Drops the deprecated `isArchived` field from every patient document.

  Archiving is gone: the same button now erases the record outright, so `isArchived` was removed
  from the schema, from the list query that filtered on it, from the seat count, from the two email
  paths that skipped archived patients, and from the portal-link checks. Mongoose ignores fields it
  has no schema for, so the leftover column is inert — this is tidiness, not a fix.

  READ THIS BEFORE RUNNING, because the code change already had an effect the data change does not.

    Removing the filters means a patient who was archived is visible and active again. That is a
    consequence of the deploy, not of this script, and it cannot be undone by declining to run it.
    Anyone still carrying `isArchived: true` should be looked at first: under the new model the
    clinic's intent — "end this relationship" — is expressed by deletion, so the question is
    whether each of them should be erased rather than quietly reactivated.

    The script reports them before touching anything.

  Dry run by default. Pass --apply to write.
*/
import { readFileSync } from 'node:fs';

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');

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

const withField = await db.collection('patients').countDocuments({ isArchived: { $exists: true } });
const archived = await db.collection('patients').find({ isArchived: true }).toArray();

console.log(`patients carrying the field : ${withField}`);
console.log(`of those, archived          : ${archived.length}\n`);

/*
  Each archived patient is listed with the two things that decide whether reactivating them
  actually reaches anybody: an active plan and a pending reminder. A patient with neither cannot be
  emailed by the sweep whatever their flag said.
*/
for (const patient of archived) {
  const activePlans = await db
    .collection('careplans')
    .countDocuments({ patientId: patient._id, status: 'active' });
  const pending = await db
    .collection('reminderoccurrences')
    .countDocuments({ patientId: patient._id, status: 'pending' });

  console.log(
    `  WAS ARCHIVED: ${patient.firstName} ${patient.lastName} <${patient.email ?? 'no email'}>\n` +
    `    active plans: ${activePlans}   pending reminders: ${pending}\n` +
    `    ${activePlans === 0 && pending === 0
      ? 'Nothing scheduled — reactivating them sends no mail.'
      : 'REACHABLE — this patient will receive mail again. Decide before deploying.'}\n`
  );
}

if (!APPLY) {
  console.log('DRY RUN — nothing written. Re-run with --apply to drop the field.');
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db
  .collection('patients')
  .updateMany({ isArchived: { $exists: true } }, { $unset: { isArchived: '' } });

console.log(`APPLIED — field dropped from ${result.modifiedCount} patient document(s).`);

await mongoose.disconnect();
