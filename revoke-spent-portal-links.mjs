/*
  Deletes every portal link that was already marked `usedAt`.

  READ THIS BEFORE DEPLOYING, because the code change has an effect this script exists to undo.

    Portal links are now reusable until `expiresAt`, so redemption no longer reads `usedAt`. That
    is the intended change. What is *not* intended is what it does to the rows already in the
    database: `usedAt` was carrying two different meanings, and only one of them was "spent".

      - A patient opened the link. Harmless if it comes back to life — they can open it again, and
        under the new rule they are meant to be able to.
      - A CLINIC REVOKED THE PATIENT'S ACCESS. Revocation used to work by setting `usedAt` on every
        link in that patient's inbox. Those rows coming back to life re-grants exactly the access
        somebody deliberately withdrew, silently, to every reminder email still in that mailbox.

    The two are indistinguishable in the data — same field, same value shape — so this deletes
    both. That is the safe direction: a patient whose link is deleted asks for another and gets one
    within a minute, and a patient whose revocation quietly lapsed has no idea it happened.

  Run it as part of the deploy, not days later. Between the code landing and this running, revoked
  links are live.

  Revocation now deletes rows outright, so this is a one-off — there is nothing for it to do on a
  second run.

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
const links = db.collection('patientportallinks');

const total = await links.countDocuments({});
const spent = await links.countDocuments({ usedAt: { $ne: null } });
const live = await links.countDocuments({
  usedAt: { $ne: null },
  expiresAt: { $gt: new Date() },
});

console.log(`portal links total              : ${total}`);
console.log(`carrying usedAt                 : ${spent}`);
console.log(`of those, not yet expired       : ${live}   <- these would come back to life\n`);

/*
  The patients behind the still-live rows, listed before anything is written. Any of them who were
  revoked rather than merely active is the reason this script exists, and the count alone does not
  say which — the clinic has to be the one to look.
*/
const affected = await links.distinct('patientId', {
  usedAt: { $ne: null },
  expiresAt: { $gt: new Date() },
});
console.log(`patients affected               : ${affected.length}`);
if (affected.length > 0) {
  console.log(affected.map(id => `  ${id.toString()}`).join('\n'));
}

if (!APPLY) {
  console.log('\ndry run — pass --apply to delete');
  await mongoose.disconnect();
  process.exit(0);
}

const result = await links.deleteMany({ usedAt: { $ne: null } });
console.log(`\ndeleted                         : ${result.deletedCount}`);

await mongoose.disconnect();
