// Shared by the Vercel interactions endpoint and the GitHub calls-board job. Keep both copies identical.
// Bookings live as Discord scheduled events in the War Room VC: they are the only source of truth.
export const CALLS = {
  guild: '1515535079886163978',
  channel: '1554911212872011867', // 📅-calls
  voice: '1523536629728280637', // 🔊 War Room VC
  hours: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'],
  minutes: 60,
  title: 'Weekly calls',
};

const ZONES = [['ET', 'America/New_York'], ['AZ', 'America/Phoenix'], ['UK', 'Europe/London'], ['Dubai', 'Asia/Dubai']];

export function londonParts(d) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
      .formatToParts(d).map(p => [p.type, p.value]),
  );
}

// 'YYYY-MM-DD' of a moment, in London.
export const londonDate = (d) => { const p = londonParts(d); return `${p.year}-${p.month}-${p.day}`; };

// The UTC instant when London's clock shows `hhmm` on London date `iso`.
export function londonTime(iso, hhmm) {
  const [y, mo, d] = iso.split('-').map(Number);
  const [h, m] = hhmm.split(':').map(Number);
  let t = Date.UTC(y, mo - 1, d, h, m);
  for (let i = 0; i < 3; i++) {
    const q = londonParts(new Date(t));
    const diff = (Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour % 24, +q.minute) - Date.UTC(y, mo - 1, d, h, m)) / 60e3;
    if (!diff) break;
    t -= diff * 60e3;
  }
  return new Date(t);
}

// The next 7 London dates, today first.
export function weekDates(now = new Date()) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const iso = londonDate(new Date(now.getTime() + i * 864e5));
    if (!out.includes(iso)) out.push(iso);
  }
  return out;
}

const hourIn = (d, zone) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

// One dropdown option per bookable hour on `iso`, labelled in all four zones.
export function hourOptions(iso, now = new Date()) {
  return CALLS.hours
    .map(h => ({ h, at: londonTime(iso, h) }))
    .filter(({ at }) => at.getTime() > now.getTime() + 15 * 60e3)
    .map(({ h, at }) => {
      const local = ZONES.map(([name, zone]) => [name, hourIn(at, zone)]);
      const daytime = local.every(([, t]) => { const x = Number(t.slice(0, 2)); return x >= 9 && x <= 20; });
      return {
        label: `${h} UK${daytime ? '  ⭐ everyone in daytime' : ''}`,
        value: h,
        description: local.filter(([n]) => n !== 'UK').map(([n, t]) => `${t} ${n}`).join(' · '),
      };
    });
}

// Booked calls = scheduled events in the War Room VC that have not ended.
export function bookedCalls(events, now = new Date()) {
  return (events || [])
    .filter(e => e.channel_id === CALLS.voice && [1, 2].includes(e.status))
    .filter(e => new Date(e.scheduled_end_time || new Date(e.scheduled_start_time).getTime() + CALLS.minutes * 60e3) > now)
    .map(e => ({ ...e, start: new Date(e.scheduled_start_time), date: londonDate(new Date(e.scheduled_start_time)) }))
    .sort((a, b) => a.start - b.start);
}

// "Booked by name · ref 123" lives in the event description, so we know who can cancel.
export const bookerOf = (event) => (event.description || '').match(/ref (\d+)/)?.[1] || null;
export const bookerName = (event) => (event.description || '').match(/Booked by ([^·]+)/)?.[1]?.trim() || 'the team';

const ts = (d, style) => `<t:${Math.floor(d.getTime() / 1000)}:${style}>`;
// Fixed English day names, so the board reads the same for everyone. Hours stay as Discord timestamps (local time).
const dayHeading = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }).format(londonTime(iso, '12:00'));

// The "Next call" card that sits under the board.
export function renderNext(events, now = new Date()) {
  const next = bookedCalls(events, now)[0];
  const body = next
    ? [
      { type: 10, content: `## ⏭️ Next call\n### ${next.name}\n${ts(next.start, 'F')} · ${ts(next.start, 'R')}` },
      { type: 10, content: `-# Booked by ${bookerName(next)} · in <#${CALLS.voice}>` },
      { type: 1, components: [
        { type: 2, style: 5, label: 'Event & reminder', emoji: { name: '🔔' }, url: `https://discord.com/events/${CALLS.guild}/${next.id}` },
        { type: 2, style: 5, label: 'Join the VC', emoji: { name: '🔊' }, url: `https://discord.com/channels/${CALLS.guild}/${CALLS.voice}` },
      ] },
    ]
    : [
      { type: 10, content: '## ⏭️ Next call\nNothing booked yet.' },
      { type: 10, content: '-# Book a day on the board above and it shows up here.' },
    ];
  return [{ type: 17, accent_color: 0x0075ff, components: body }];
}

// Find NEXO's board and next-call card in the channel, update both, create whatever is missing.
export async function syncCallsChannel(api, events, nexoId, now = new Date()) {
  const recent = await api('GET', `/channels/${CALLS.channel}/messages?limit=50`);
  const mine = (recent || []).filter(m => m.author?.id === nexoId);
  const find = (re) => mine.find(m => re.test(JSON.stringify(m.components || [])));
  for (const [re, components] of [[/Weekly calls|This week's calls/, renderBoard(events, now)], [/Next call/, renderNext(events, now)]]) {
    const msg = find(re);
    if (msg) await api('PATCH', `/channels/${CALLS.channel}/messages/${msg.id}`, { components });
    else await api('POST', `/channels/${CALLS.channel}/messages`, { flags: 1 << 15, allowed_mentions: { parse: [] }, components });
  }
}

// The full board: one line per day, in order, each with its own button on the right.
export function renderBoard(events, now = new Date()) {
  const booked = bookedCalls(events, now);
  const days = weekDates(now).map(iso => {
    const calls = booked.filter(c => c.date === iso);
    const detail = calls.length
      ? calls.map(c => `🔒 **${c.name}** at ${ts(c.start, 't')} (${ts(c.start, 'R')}) · booked by ${bookerName(c)}`).join('\n')
      : '-# free';
    return {
      type: 9,
      components: [{ type: 10, content: `**${dayHeading(iso)}**\n${detail}` }],
      accessory: calls.length
        ? { type: 2, style: 2, label: 'Booked', emoji: { name: '🔒' }, custom_id: `cal_day:${iso}` }
        : { type: 2, style: 1, label: 'Book', emoji: { name: '📅' }, custom_id: `cal_day:${iso}` },
    };
  });
  return [{
    type: 17,
    accent_color: 0x0075ff,
    components: [
      { type: 10, content: `## 📅 ${CALLS.title}\n-# Pick a free day, choose the hour, it is locked for everyone. Times show in **your** time zone.` },
      { type: 14, divider: true, spacing: 2 },
      ...days,
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: '-# Every booked call becomes a Discord event in the War Room VC. Click **Interested** for a reminder.' },
    ],
  }];
}
