// Every 2 hours: remind the team in #staff-chat to /bump on DISBOARD.
// Only a reminder. The bump itself stays manual, because DISBOARD bans automated bumps.
import { CH, NEXO_ID, discord } from './lib.js';

// Remove the previous reminder so the channel does not fill up with them.
const recent = await discord('GET', `/channels/${CH.staff}/messages?limit=30`);
for (const m of recent.filter(m => m.author.id === NEXO_ID && m.content.startsWith('🔔 Time to /bump'))) {
  await discord('DELETE', `/channels/${CH.staff}/messages/${m.id}`);
}

await discord('POST', `/channels/${CH.staff}/messages`, {
  content: '🔔 Time to /bump\n-# Type `/bump` (DISBOARD) here. If DISBOARD says to wait, someone already did it.',
  allowed_mentions: { parse: [] },
});
console.log('✅ bump reminder posted');
