// Every morning: rebuild the pinned "This week's calls" board in #calls and create a Discord event
// for every call in the next 7 days. The schedule lives in calls.json, in UK time.
// Times on the board use Discord timestamps, so everyone sees them in their own time zone.
import { readFileSync } from 'node:fs';
import { GUILD, NEXO_ID, discord, card, text, sep } from './lib.js';

const CALLS_CHANNEL = '1554911212872011867'; // 📅-calls
const { calls } = JSON.parse(readFileSync(process.env.CALLS_FILE || new URL('./calls.json', import.meta.url), 'utf8'));
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const londonParts = (d) => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long', hour12: false })
    .formatToParts(d).map(p => [p.type, p.value]),
);

// The UTC instant when London's clock shows `hhmm` on the London date of `day`.
function londonTime(day, hhmm) {
  const p = londonParts(day);
  const [h, m] = hhmm.split(':').map(Number);
  let t = Date.UTC(+p.year, +p.month - 1, +p.day, h, m);
  for (let i = 0; i < 3; i++) {
    const q = londonParts(new Date(t));
    const diff = (h * 60 + m) - (+q.hour % 24 * 60 + +q.minute);
    if (!diff) break;
    t += diff * 60e3;
  }
  return new Date(t);
}

// Every call in the next 7 days, today included.
const now = new Date();
const week = [];
for (let i = 0; i < 7; i++) {
  const day = new Date(now.getTime() + i * 864e5);
  const weekday = londonParts(day).weekday.toLowerCase();
  const occurrences = calls
    .filter(c => c.days.map(d => d.toLowerCase()).includes(weekday))
    .map(c => ({ ...c, start: londonTime(day, c.time) }))
    .filter(o => o.start.getTime() + (o.minutes || 60) * 60e3 > now.getTime())
    .sort((a, b) => a.start - b.start);
  week.push({ day, occurrences });
}

const ts = (d, style) => `<t:${Math.floor(d.getTime() / 1000)}:${style}>`;
const rows = week.map(({ day, occurrences }) => {
  const label = `**${ts(londonTime(day, '12:00'), 'D')}**`;
  if (!occurrences.length) return `${label}\n-# no calls`;
  return `${label}\n` + occurrences.map(o => `${o.emoji || '📞'} **${o.name}** · ${ts(o.start, 't')} (${ts(o.start, 'R')}) · ${o.minutes || 60} min · <#${o.channel}>`).join('\n');
});

const board = card([
  text("## 📅 This week's calls\n-# Times show in **your** time zone. Updated every morning."),
  sep(2),
  ...(calls.length
    ? [text(rows.join('\n\n'))]
    : [text('No calls scheduled yet.\nVote in the polls below and the schedule shows up here by itself.')]),
  sep(),
  text('-# Every call is also a Discord event at the top of the channel list. Click **Interested** to get a reminder.'),
]);

// Update the pinned board, or create and pin it the first time.
const pins = await discord('GET', `/channels/${CALLS_CHANNEL}/pins`);
const existing = (pins || []).find(m => m.author?.id === NEXO_ID && JSON.stringify(m.components || []).includes("This week's calls"));
if (existing) {
  await discord('PATCH', `/channels/${CALLS_CHANNEL}/messages/${existing.id}`, { components: board.components });
  console.log('✅ board updated');
} else {
  const msg = await discord('POST', `/channels/${CALLS_CHANNEL}/messages`, board);
  if (msg.id) {
    await discord('PUT', `/channels/${CALLS_CHANNEL}/messages/pins/${msg.id}`);
    await new Promise(r => setTimeout(r, 800));
    const notices = (await discord('GET', `/channels/${CALLS_CHANNEL}/messages?limit=5`)).filter(m => m.type === 6);
    for (const n of notices) await discord('DELETE', `/channels/${CALLS_CHANNEL}/messages/${n.id}`);
  }
  console.log('✅ board created and pinned');
}

// A Discord event for every call this week, unless it already exists.
const events = await discord('GET', `/guilds/${GUILD}/scheduled-events`);
for (const { occurrences } of week) {
  for (const o of occurrences) {
    const dup = (events || []).some(e => e.name === o.name && Math.abs(new Date(e.scheduled_start_time) - o.start) < 60e3);
    if (dup || o.start < now) continue;
    await discord('POST', `/guilds/${GUILD}/scheduled-events`, {
      name: o.name,
      description: o.description || 'Team call. Click Interested to get a reminder.',
      privacy_level: 2,
      entity_type: 2,
      channel_id: o.channel,
      scheduled_start_time: o.start.toISOString(),
      scheduled_end_time: new Date(o.start.getTime() + (o.minutes || 60) * 60e3).toISOString(),
    });
    console.log('✅ event created:', o.name, o.start.toISOString());
  }
}
