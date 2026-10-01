// Cold call counter in #weekly-numbers. Shared by the Vercel endpoint (buttons) and the GitHub reset job.
// Keep both copies identical: nexo-discord/interactions/lib/coldcalls.js == division-one-clocks/coldcalls-lib.js
// The counts live inside the pinned card itself (one "`N` ... <@id>" line per person), so no database is needed.
export const COLD = {
  channel: '1554911210045177996', // 📊-weekly-numbers
  steps: [1, 5, 10, 25],
};

const MEDALS = ['🥇', '🥈', '🥉'];
const BAR = 10;

// Monday of the current week in London, as "28 Sept".
export function weekLabel(now = new Date()) {
  const london = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const back = (london.getDay() + 6) % 7; // days since Monday
  london.setDate(london.getDate() - back);
  return london.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Read the counts back out of a rendered card (also understands the first version of the card).
export function parseBoard(message) {
  const text = JSON.stringify(message?.components || []);
  const week = (text.match(/[Ww]eek of ([^·\\"]+?)\s*(?:·|\\n|")/) || [])[1]?.trim() || null;
  const counts = {};
  for (const [, n, id] of text.matchAll(/`(-?\d+)`[^`<]*?<@(\d+)>/g)) counts[id] = Number(n);
  return { week, counts };
}

const ranked = (counts) => Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
const bar = (n, max) => { const full = Math.max(1, Math.round((n / max) * BAR)); return '▰'.repeat(full) + '▱'.repeat(BAR - full); };
const rows = (list) => {
  const max = list[0]?.[1] || 1;
  return list.map(([id, n], i) => `${MEDALS[i] || '▫️'} \`${n}\`  ${bar(n, max)}  <@${id}>`).join('\n');
};

export function renderBoard(counts, week, last = null) {
  const list = ranked(counts);
  const total = list.reduce((s, [, n]) => s + n, 0);
  return [{
    type: 17,
    accent_color: 0x0075ff,
    components: [
      { type: 10, content: `## 📞 Cold calls\n-# Week of ${week} · resets Monday 00:00 UK` },
      { type: 14, divider: true, spacing: 2 },
      { type: 10, content: `# ${total}\n-# team calls this week` },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: list.length ? rows(list) : 'No calls yet this week. Hit a button after your session.' },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: `-# ${last ? `Last: <@${last.id}> ${last.n > 0 ? '+' : ''}${last.n}` : 'Tap how many calls you just made.'}` },
      { type: 1, components: [
        ...COLD.steps.map(s => ({ type: 2, style: 1, label: `+${s}`, custom_id: `cold_add:${s}` })),
        { type: 2, style: 2, label: '−1', emoji: { name: '↩️' }, custom_id: 'cold_add:-1' },
      ] },
    ],
  }];
}

// The final scoreboard posted when the week resets.
export function renderFinal(counts, week) {
  const list = ranked(counts);
  const total = list.reduce((s, [, n]) => s + n, 0);
  return [{
    type: 17,
    accent_color: 0x0075ff,
    components: [
      { type: 10, content: `### 🏁 Final · cold calls · week of ${week}` },
      { type: 10, content: list.length ? `${rows(list)}\n\n**Team total:** ${total}` : 'No calls logged that week.' },
    ],
  }];
}
