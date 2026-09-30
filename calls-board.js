// Every morning: roll the pinned "Weekly calls" board forward one day and add Discord events for any
// recurring calls in calls.json. Booking itself happens from the board's buttons (Vercel endpoint).
// calls-lib.js is a copy of nexo-discord/interactions/lib/calls.js: keep both identical.
import { readFileSync } from 'node:fs';
import { NEXO_ID, discord } from './lib.js';
import { CALLS, londonTime, weekDates, bookedCalls, renderBoard } from './calls-lib.js';

const { calls } = JSON.parse(readFileSync(process.env.CALLS_FILE || new URL('./calls.json', import.meta.url), 'utf8'));
const now = new Date();
let events = await discord('GET', `/guilds/${CALLS.guild}/scheduled-events`);

// Recurring calls from calls.json become events, unless that day is already booked.
for (const iso of weekDates(now)) {
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long' }).format(londonTime(iso, '12:00')).toLowerCase();
  for (const c of calls.filter(c => c.days.map(d => d.toLowerCase()).includes(weekday))) {
    const start = londonTime(iso, c.time);
    if (start < now || bookedCalls(events, now).some(b => b.date === iso)) continue;
    await discord('POST', `/guilds/${CALLS.guild}/scheduled-events`, {
      name: c.name || 'Weekly call',
      description: 'Booked by the team schedule · ref 0',
      privacy_level: 2,
      entity_type: 2,
      channel_id: CALLS.voice,
      scheduled_start_time: start.toISOString(),
      scheduled_end_time: new Date(start.getTime() + (c.minutes || CALLS.minutes) * 60e3).toISOString(),
    });
    console.log('✅ recurring call added:', iso, c.time);
  }
}
events = await discord('GET', `/guilds/${CALLS.guild}/scheduled-events`);

// Update the pinned board (old or new title), or create and pin it the first time.
const components = renderBoard(events, now);
const pins = await discord('GET', `/channels/${CALLS.channel}/pins`);
const board = (pins || []).find(m => m.author?.id === NEXO_ID && /Weekly calls|This week's calls/.test(JSON.stringify(m.components || [])));
if (board) {
  await discord('PATCH', `/channels/${CALLS.channel}/messages/${board.id}`, { components });
  console.log('✅ board rolled forward');
} else {
  const msg = await discord('POST', `/channels/${CALLS.channel}/messages`, { flags: 1 << 15, allowed_mentions: { parse: [] }, components });
  if (msg.id) {
    await discord('PUT', `/channels/${CALLS.channel}/messages/pins/${msg.id}`);
    await new Promise(r => setTimeout(r, 800));
    for (const n of (await discord('GET', `/channels/${CALLS.channel}/messages?limit=5`)).filter(m => m.type === 6)) await discord('DELETE', `/channels/${CALLS.channel}/messages/${n.id}`);
  }
  console.log('✅ board created and pinned');
}
