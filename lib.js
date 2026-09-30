// Shared helpers for the Division One automations.
export const GUILD = '1515535079886163978';
export const NEXO_ID = '1488909251630993578';
export const CH = {
  dailyGoals: '1554911200154747041',
  weeklyNumbers: '1554911210045177996',
  aiNews: '1554912467509837874',
  aiResources: '1554911190839463968',
  staff: '1523536633994018898',
  applications: '1554911218257502218',
  members: '1554937920945914008',
};
export const ACCENT = 0x0075ff;
export const DRY_RUN = process.env.DRY_RUN === '1';

// Discord REST with rate-limit retries. In DRY_RUN, writes are printed instead of sent.
export async function discord(method, route, body) {
  if (DRY_RUN && method !== 'GET') {
    console.log(`[dry run] ${method} ${route}`, body ? JSON.stringify(body).slice(0, 300) : '');
    return {};
  }
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`https://discord.com/api/v10${route}`, {
      method,
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      const { retry_after = 1 } = await res.json();
      await new Promise(r => setTimeout(r, retry_after * 1000 + 250));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${route} -> ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  throw new Error(`rate limited: ${route}`);
}

// A single NEXO card (Components V2).
export const card = (components) => ({
  flags: 1 << 15,
  allowed_mentions: { parse: [] },
  components: [{ type: 17, accent_color: ACCENT, components }],
});
export const text = (content) => ({ type: 10, content });
export const sep = (spacing = 1) => ({ type: 14, divider: true, spacing });

export async function postWithThread(channel, message, threadName) {
  const msg = await discord('POST', `/channels/${channel}/messages`, message);
  if (msg.id) await discord('POST', `/channels/${channel}/messages/${msg.id}/threads`, { name: threadName, auto_archive_duration: 1440 });
  return msg;
}

export const snowflakeTime = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);
