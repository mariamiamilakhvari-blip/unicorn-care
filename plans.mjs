import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
const env = readFileSync('.env','utf8');
const uri = env.split('\n').find(l=>l.startsWith('MONGO_URI')).split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');
await mongoose.connect(uri);
const db = mongoose.connection.db;
const now = new Date();
const trigger = new Date(now.getTime() + 14*24*3600*1000);

const plans = await db.collection('careplans').find({ status: 'active' }).toArray();
console.log(`active plans: ${plans.length}\n`);
for (const p of plans) {
  const ended = p.rehabEndsAt && p.rehabEndsAt < now;
  const canReachTrigger = p.rehabEndsAt && p.rehabEndsAt > trigger;
  const mine = await db.collection('reminderoccurrences').countDocuments({ carePlanId: p._id });
  console.log(`plan ${String(p._id).slice(-6)}  starts ${p.startsAt?.toISOString().slice(0,10)}  rehabEnds ${p.rehabEndsAt?.toISOString().slice(0,10)}`);
  console.log(`   window already ended: ${ended}   can ever generate past the 14d trigger: ${canReachTrigger}`);
  console.log(`   occurrences: ${mine}`);
}
