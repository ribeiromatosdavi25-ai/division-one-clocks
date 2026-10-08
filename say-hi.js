// One-off (2026-10-08, his call): NEXO says hi to everyone new in #general, now the server is open to all.
import { discord, DRY_RUN, alreadyPosted } from './lib.js';

const GENERAL = '1523536618017783930';
const MARKER = 'Welcome to everyone new';

if (await alreadyPosted(GENERAL, MARKER, 24)) { console.log('already posted, skipping'); process.exit(0); }

await discord('POST', `/channels/${GENERAL}/messages`, {
  content: [
    `👋 **${MARKER} in Division One!**`,
    'The whole server is open to you now. No buttons, no waiting.',
    '',
    '📜 Have a read of <#1554918893787807794>',
    '🙋 Tell us who you are and what you are building in <#1523536616893976763>',
    '🎯 Set your goal for today in <#1554911200154747041>',
    '',
    'Then say hi right here. Glad you made it.',
  ].join('\n'),
  allowed_mentions: { parse: [] },
});
console.log(DRY_RUN ? 'would post' : '✅ posted in #general');
