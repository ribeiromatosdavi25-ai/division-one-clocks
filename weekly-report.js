// Every Sunday: a report for the Founders in #staff-chat. Members, applications, activity, invites.
import { GUILD, CH, NEXO_ID, discord, card, text, sep, snowflakeTime, alreadyPosted } from './lib.js';

if (await alreadyPosted(CH.staff, 'Weekly report', 48)) { console.log('already posted, skipping'); process.exit(0); }

const WEEK = 7 * 864e5;
const since = Date.now() - WEEK;

const [members, channels, invites, roles] = await Promise.all([
  discord('GET', `/guilds/${GUILD}/members?limit=1000`),
  discord('GET', `/guilds/${GUILD}/channels`),
  discord('GET', `/guilds/${GUILD}/invites`),
  discord('GET', `/guilds/${GUILD}/roles`),
]);
const humans = members.filter(m => !m.user.bot);
const joined = humans.filter(m => new Date(m.joined_at).getTime() > since);
const d1 = roles.find(r => r.name === 'Division One');
const d1Count = d1 ? humans.filter(m => m.roles.includes(d1.id)).length : 0;
const notAccepted = humans.filter(m => m.roles.length === 0).length;

// Applications: NEXO's cards in #applications from the last 7 days.
const apps = (await discord('GET', `/channels/${CH.applications}/messages?limit=100`))
  .filter(m => m.author.id === NEXO_ID && snowflakeTime(m.id) > since);
const appText = apps.map(m => JSON.stringify(m.components));
const approved = appText.filter(t => t.includes('Approved by')).length;
const declined = appText.filter(t => t.includes('Declined by')).length;

// Activity: messages from people (not bots) per text channel in the last 7 days.
const activity = [];
for (const c of channels.filter(c => c.type === 0)) {
  try {
    const msgs = await discord('GET', `/channels/${c.id}/messages?limit=100`);
    const n = msgs.filter(m => !m.author.bot && snowflakeTime(m.id) > since).length;
    if (n) activity.push([c.name, n]);
  } catch { /* channel the bot cannot read */ }
}
activity.sort((a, b) => b[1] - a[1]);

const inviteLines = invites
  .filter(i => i.uses > 0)
  .sort((a, b) => b.uses - a.uses)
  .slice(0, 5)
  .map(i => `\`${i.code}\` · ${i.uses} joins · #${i.channel?.name || '?'}${i.inviter ? ` · by ${i.inviter.username}` : ''}`);

await discord('POST', `/channels/${CH.staff}/messages`, card([
  text('## 📋 Weekly report'),
  sep(),
  text([
    `**👥 Members:** ${humans.length} (${joined.length ? `+${joined.length}` : 'no new'} this week)`,
    `**💎 Division One:** ${d1Count}`,
    `**🚪 Joined but no rules accepted yet:** ${notAccepted}`,
    `**📥 Applications this week:** ${apps.length} (${approved} approved · ${declined} declined · ${apps.length - approved - declined} pending)`,
  ].join('\n')),
  sep(),
  text(`**🔥 Most active channels (messages from people)**\n${activity.slice(0, 5).map(([n, c]) => `#${n} · ${c}`).join('\n') || 'Quiet week. Nobody wrote.'}`),
  sep(),
  text(`**🔗 Invites that brought people in**\n${inviteLines.join('\n') || 'No invite uses yet.'}`),
]));
console.log('✅ weekly report posted');
