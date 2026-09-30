// Division One global time clocks + member counter. Renames voice channels in GLOBAL TIME.
// Runs on GitHub Actions every 10 minutes. Discord allows 2 renames per channel per 10 minutes.
// Env: DISCORD_TOKEN (GitHub secret)
import { discord, GUILD, CH } from './lib.js';

const CLOCKS = [
  { channel: '1554930928399417518', label: '🇺🇸 East Coast', zone: 'America/New_York' }, // Pennsylvania, Florida, New York
  { channel: '1554930932807639090', label: '🇺🇸 Arizona', zone: 'America/Phoenix' },
  { channel: '1554930936876113940', label: '🇬🇧 UK', zone: 'Europe/London' },
  { channel: '1554930940139147314', label: '🇦🇪 Dubai', zone: 'Asia/Dubai' },
];

const time = (zone) => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date());

let failed = 0;
async function rename(channel, name) {
  try {
    await discord('PATCH', `/channels/${channel}`, { name });
    console.log('✅', name);
  } catch (e) {
    failed++;
    console.log('❌', name, e.message);
  }
}

for (const c of CLOCKS) await rename(c.channel, `${c.label} · ${time(c.zone)}`);

// Members = humans only. Only rename when the number changed, to stay far from the rename limit.
const members = await discord('GET', `/guilds/${GUILD}/members?limit=1000`);
const humans = members.filter(m => !m.user.bot).length;
const current = await discord('GET', `/channels/${CH.members}`);
const name = `👥 Members · ${humans}`;
if (current.name !== name) await rename(CH.members, name);
else console.log('=', name);

if (failed === CLOCKS.length) process.exit(1);
