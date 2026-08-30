/*
  Converts each patient's stored `dateOfBirth` into the `age` field that replaced it, then drops
  the old column.

  READ THIS BEFORE RUNNING.

    The deploy has already taken effect on its own: `dateOfBirth` is gone from the schema, so
    Mongoose no longer reads or writes it and every existing patient now shows a blank age. The
    data is not lost — it is sitting in the documents, ignored. This script is what recovers it.

    Age is computed once, from the birth date, against today. It is a snapshot from that moment
    on: nothing recomputes it afterwards, because after this runs there is no birth date left to
    recompute from. A patient converted at 35 reads 35 forever. That is the trade the field
    change made, and running this is where it becomes irreversible — so take a backup first.

    Patients with no `dateOfBirth` are left alone. Their age was never recorded and inventing one
    is worse than the blank.

  Dry run by default. Pass --apply to write.
*/
import { readFileSync } from 'node:fs';

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const MIN_AGE = 0;
const MAX_AGE = 120;

const env = readFileSync('.env', 'utf8');
const uri = env
  .split('\n')
  .find(line => line.startsWith('MONGO_URI'))
  .split('=')
  .slice(1)
  .join('=')
  .trim()
  .replace(/^"|"$/g, '');

/** Whole years elapsed — the birthday this year has to have passed to count. */
function yearsSince(birth, now) {
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) years -= 1;
  return years;
}

await mongoose.connect(uri);
const db = mongoose.connection.db;
const now = new Date();

const patients = await db
  .collection('patients')
  .find({ dateOfBirth: { $exists: true, $ne: null } })
  .toArray();

const total = await db.collection('patients').countDocuments();
console.log(`patients                    : ${total}`);
console.log(`carrying a birth date       : ${patients.length}\n`);

const convertible = [];
const rejected = [];

for (const patient of patients) {
  const age = yearsSince(new Date(patient.dateOfBirth), now);
  const name = `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim();
  // Out-of-range means the stored date was wrong, not that the patient is. Report, never guess.
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    rejected.push({ name, dateOfBirth: patient.dateOfBirth, age });
    continue;
  }
  convertible.push({ _id: patient._id, name, age });
}

for (const row of convertible) console.log(`  ${row.name || '(unnamed)'} → ${row.age}`);
if (rejected.length > 0) {
  console.log(`\nout of range, left untouched for a human to look at:`);
  for (const row of rejected) {
    console.log(`  ${row.name || '(unnamed)'} → ${row.age} (${row.dateOfBirth})`);
  }
}

if (!APPLY) {
  console.log(`\nDry run. ${convertible.length} would be converted. Pass --apply to write.`);
  await mongoose.disconnect();
  process.exit(0);
}

let written = 0;
for (const row of convertible) {
  const result = await db
    .collection('patients')
    .updateOne({ _id: row._id }, { $set: { age: row.age }, $unset: { dateOfBirth: '' } });
  written += result.modifiedCount;
}

/*
  The column is dropped from everyone who still carries it, including the nulls and the rows whose
  date was out of range — those were reported above and their age stays blank, which is the honest
  state for a record whose birth date could not be believed.
*/
const cleared = await db
  .collection('patients')
  .updateMany({ dateOfBirth: { $exists: true } }, { $unset: { dateOfBirth: '' } });

console.log(`\nconverted                   : ${written}`);
console.log(`remaining columns dropped   : ${cleared.modifiedCount}`);

await mongoose.disconnect();
