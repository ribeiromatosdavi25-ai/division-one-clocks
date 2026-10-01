// The one job that runs every 10 minutes (triggered by cron-job.org, GitHub's own schedule is only a fallback).
// It always updates the clocks, then runs whatever else is due in this 10-minute window (UTC).
// Posting jobs guard themselves against duplicates, so an extra tick never posts twice.
import { spawnSync } from 'node:child_process';

const now = new Date();
const h = now.getUTCHours();
const m = now.getUTCMinutes();
const day = now.getUTCDay(); // 0 Sunday … 6 Saturday
const window = (hour) => h === hour && m < 10; // the first tick of that hour

const due = [
  ['clocks', true],
  ['ai-news', m < 10],                       // hourly
  ['bump-reminder', h % 2 === 0 && m < 10],  // every 2 hours
  ['calls-board', window(6)],                // daily 07:00 UK (summer time)
  ['daily-goals', window(8)],                // daily 09:00 UK
  ['weekly-numbers', day === 5 && window(16)], // Friday 17:00 UK
  ['trending', day === 1 && window(9)],      // Monday 10:00 UK
  ['weekly-report', day === 0 && window(18)], // Sunday 19:00 UK
].filter(([, isDue]) => isDue || process.env.FORCE === '1').map(([job]) => job);

console.log(`tick ${now.toISOString()} → ${due.join(', ')}`);
let failed = 0;
for (const job of due) {
  const r = spawnSync(process.execPath, [`${job}.js`], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) { failed++; console.log(`❌ ${job} exited ${r.status}`); }
}
process.exit(failed ? 1 : 0);
