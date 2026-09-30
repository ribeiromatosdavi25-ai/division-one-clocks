// Division One global time clocks. Renames voice channels to the current local time.
// Runs on GitHub Actions every 10 minutes. Discord allows 2 renames per channel per 10 minutes.
// Env: DISCORD_TOKEN (GitHub secret)

const CLOCKS = [
  { channel: '1554930928399417518', label: '🇺🇸 East Coast', zone: 'America/New_York' }, // Pennsylvania, Florida, New York
  { channel: '1554930932807639090', label: '🇺🇸 Arizona', zone: 'America/Phoenix' },
  { channel: '1554930936876113940', label: '🇬🇧 UK', zone: 'Europe/London' },
  { channel: '1554930940139147314', label: '🇦🇪 Dubai', zone: 'Asia/Dubai' },
];

const time = (zone) => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date());

(async () => {
  let failed = 0;
  for (const c of CLOCKS) {
    const name = `${c.label} · ${time(c.zone)}`;
    const res = await fetch(`https://discord.com/api/v10/channels/${c.channel}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) console.log('✅', name);
    else { failed++; console.log('❌', name, res.status, await res.text()); }
  }
  if (failed === CLOCKS.length) process.exit(1);
})();
