// Monday 00:00 UK: post the final cold call scoreboard of last week, then reset the pinned counter to zero.
// coldcalls-lib.js is a copy of nexo-discord/interactions/lib/coldcalls.js: keep both identical.
import { NEXO_ID, discord } from './lib.js';
import { COLD, weekLabel, parseBoard, renderBoard, renderFinal } from './coldcalls-lib.js';

const pins = await discord('GET', `/channels/${COLD.channel}/pins`);
const board = (pins || []).find(m => m.author?.id === NEXO_ID && /Cold calls/.test(JSON.stringify(m.components || [])) && /[Ww]eek of/.test(JSON.stringify(m.components || [])));
if (!board) { console.log('no counter found'); process.exit(0); }

const thisWeek = weekLabel();
const { week, counts } = parseBoard(board);
if (week === thisWeek) { console.log('already reset for', thisWeek); process.exit(0); }

await discord('POST', `/channels/${COLD.channel}/messages`, { flags: 1 << 15, allowed_mentions: { parse: [] }, components: renderFinal(counts, week) });
await discord('PATCH', `/channels/${COLD.channel}/messages/${board.id}`, { components: renderBoard({}, thisWeek) });
console.log(`✅ final posted for ${week}, counter reset for ${thisWeek}`);
