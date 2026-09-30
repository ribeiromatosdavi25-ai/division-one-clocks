// Every morning: roll the "Weekly calls" board forward one day, refresh the "Next call" card under it,
// and add Discord events for any recurring calls in calls.json. Booking itself happens from the board's
// buttons (Vercel endpoint). calls-lib.js is a copy of nexo-discord/interactions/lib/calls.js: keep both identical.
import { readFileSync } from 'node:fs';
import { NEXO_ID, discord } from './lib.js';
import { CALLS, londonTime, weekDates, bookedCalls, syncCallsChannel } from './calls-lib.js';

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
await syncCallsChannel(discord, events, NEXO_ID, now);
console.log('✅ board and next-call card synced');
