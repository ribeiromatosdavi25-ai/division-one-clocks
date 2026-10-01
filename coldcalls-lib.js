// Cold call counter in #weekly-numbers. Shared by the Vercel endpoint (logging) and the GitHub reset job.
// Keep both copies identical: nexo-discord/interactions/lib/coldcalls.js == division-one-clocks/coldcalls-lib.js
// The counts live inside the pinned card itself (one "`N` · <@id>" line per person), so no database is needed.
export const COLD = {
  channel: '1554911210045177996', // 📊-weekly-numbers
  title: 'Cold calls',
};

const MEDALS = ['🥇', '🥈', '🥉'];

// Monday of the current week in London, as "28 Sep".
export function weekLabel(now = new Date()) {
  const london = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const back = (london.getDay() + 6) % 7; // days since Monday
  london.setDate(london.getDate() - back);
  return london.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Read the counts back out of a rendered card.
export function parseBoard(message) {
  const text = JSON.stringify(message?.components || []);
  const week = (text.match(/Cold calls · week of ([^\\"]+?)(?:\\n|")/) || [])[1] || null;
  const counts = {};
  for (const [, n, id] of text.matchAll(/`(-?\d+)` · <@(\d+)>/g)) counts[id] = Number(n);
  return { week, counts };
}

export function renderBoard(counts, week) {
  const rows = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  const lines = rows.length
    ? rows.map(([id, n], i) => `${MEDALS[i] || '▫️'} \`${n}\` · <@${id}>`).join('\n')
    : 'No calls logged yet this week. Be the first.';
  return [{
    type: 17,
    accent_color: 0x0075ff,
    components: [
      { type: 10, content: `## 📞 ${COLD.title} · week of ${week}\n-# Log your calls after every session. Resets Monday 00:00 UK.` },
      { type: 14, divider: true, spacing: 2 },
      { type: 10, content: lines },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: `**Team total:** ${total} calls` },
      { type: 1, components: [{ type: 2, style: 1, label: 'Log calls', emoji: { name: '📞' }, custom_id: 'cold_log' }] },
    ],
  }];
}

// The final scoreboard posted when the week resets.
export function renderFinal(counts, week) {
  const rows = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return [{
    type: 17,
    accent_color: 0x0075ff,
    components: [
      { type: 10, content: `### 🏁 Final · cold calls · week of ${week}` },
      { type: 10, content: rows.length ? rows.map(([id, n], i) => `${MEDALS[i] || '▫️'} \`${n}\` · <@${id}>`).join('\n') + `\n\n**Team total:** ${total}` : 'No calls logged that week.' },
    ],
  }];
}
