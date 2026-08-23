/*
  Finds — and on --apply, deletes — clinic-authored recovery-guide rows carrying legacy text that
  should never have reached a patient.

  Deletes the row rather than editing it, so the guide falls back to the platform default the
  resolver already serves. Editing would leave a clinic-owned row that outranks the default for
  ever, and the point is to stop this clinic's copy overriding reviewed content.

  Platform defaults (clinicId: null) are reported and never touched: refreshing those is the
  seeder's job, via POST /api/admin/recovery-guides/seed?refresh=1.

  Dry run by default. Pass --apply to delete.
*/
import mongoose from 'mongoose';
import { readFileSync, writeFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const uri = env
  .split('\n')
  .find(line => line.startsWith('MONGO_URI'))
  .split('=')
  .slice(1)
  .join('=')
  .trim()
  .replace(/^"|"$/g, '');

/* Distinctive fragments of the reported line, not whole sentences: it was quoted two ways. */
const NEEDLES = ['შუბლ', 'კომპრეს', 'კომინპრეს'];

const apply = process.argv.includes('--apply');

await mongoose.connect(uri);
const guides = mongoose.connection.db.collection('recoveryguides');

const rows = await guides.find({}).toArray();

const hit = row => {
  const text = [...(row.expected ?? []), ...(row.warning ?? [])]
    .flatMap(item => [item.title ?? '', item.description ?? ''])
    .join(' ');
  return NEEDLES.filter(needle => text.includes(needle));
};

const matches = rows
  .map(row => ({ row, needles: hit(row) }))
  .filter(entry => entry.needles.length > 0);

console.log(`scanned ${rows.length} guide rows, ${matches.length} match\n`);

for (const { row, needles } of matches) {
  const owner = row.clinicId ? `clinic ${row.clinicId}` : 'PLATFORM DEFAULT';
  console.log(`- ${row.manipulationType} / ${row.locale}  [${owner}]  matched: ${needles.join(', ')}`);
  for (const item of [...(row.expected ?? []), ...(row.warning ?? [])]) {
    const text = `${item.title ?? ''} ${item.description ?? ''}`;
    if (NEEDLES.some(needle => text.includes(needle))) {
      console.log(`    title: ${item.title}`);
      console.log(`    body : ${item.description}`);
    }
  }
}

const deletable = matches.filter(entry => entry.row.clinicId);
const defaults = matches.filter(entry => !entry.row.clinicId);

if (defaults.length > 0) {
  console.log(`\n${defaults.length} platform default(s) matched — not touched here.`);
  console.log('Refresh those with: POST /api/admin/recovery-guides/seed?refresh=1');
}

if (!apply) {
  console.log(`\nDRY RUN. ${deletable.length} clinic-authored row(s) would be deleted.`);
  console.log('Re-run with --apply to delete them.');
} else {
  /* The row goes to a file first. It is clinical text a clinician typed, and this is irreversible. */
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `guide-backup-${stamp}.json`;
  writeFileSync(backup, JSON.stringify(deletable.map(entry => entry.row), null, 2));
  console.log(`\nbacked up ${deletable.length} row(s) to ${backup}`);

  for (const { row } of deletable) {
    await guides.deleteOne({ _id: row._id });
    console.log(`\ndeleted ${row.manipulationType}/${row.locale} for clinic ${row.clinicId}`);
  }
  console.log(`\n${deletable.length} row(s) deleted. They now fall back to the platform default.`);
}

await mongoose.disconnect();
