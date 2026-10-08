// One-off (2026-10-08, his call): no more rules gate. Reading the rules is enough.
// 1. Whatever the Member role allows (server-wide and per channel) is given to @everyone, so someone who just
//    joined, with no role, sees exactly what a Member sees. People who already have Member see no change.
// 2. The "I accept the rules" button (and its line) comes off NEXO's post in #rules.
// DRY_RUN=1 prints the plan plus a backup of the current @everyone settings; without it the changes are made.
import { discord, GUILD, NEXO_ID, DRY_RUN } from './lib.js';

const RULES_CHANNEL = '1554918893787807794';

const FLAGS = {
  CREATE_INSTANT_INVITE: 0, KICK_MEMBERS: 1, BAN_MEMBERS: 2, ADMINISTRATOR: 3, MANAGE_CHANNELS: 4, MANAGE_GUILD: 5,
  ADD_REACTIONS: 6, VIEW_AUDIT_LOG: 7, PRIORITY_SPEAKER: 8, STREAM: 9, VIEW_CHANNEL: 10, SEND_MESSAGES: 11,
  SEND_TTS_MESSAGES: 12, MANAGE_MESSAGES: 13, EMBED_LINKS: 14, ATTACH_FILES: 15, READ_MESSAGE_HISTORY: 16,
  MENTION_EVERYONE: 17, USE_EXTERNAL_EMOJIS: 18, VIEW_GUILD_INSIGHTS: 19, CONNECT: 20, SPEAK: 21, MUTE_MEMBERS: 22,
  DEAFEN_MEMBERS: 23, MOVE_MEMBERS: 24, USE_VAD: 25, CHANGE_NICKNAME: 26, MANAGE_NICKNAMES: 27, MANAGE_ROLES: 28,
  MANAGE_WEBHOOKS: 29, MANAGE_EXPRESSIONS: 30, USE_APPLICATION_COMMANDS: 31, REQUEST_TO_SPEAK: 32, MANAGE_EVENTS: 33,
  MANAGE_THREADS: 34, CREATE_PUBLIC_THREADS: 35, CREATE_PRIVATE_THREADS: 36, USE_EXTERNAL_STICKERS: 37,
  SEND_MESSAGES_IN_THREADS: 38, USE_EMBEDDED_ACTIVITIES: 39, MODERATE_MEMBERS: 40, VIEW_CREATOR_MONETIZATION: 41,
  USE_SOUNDBOARD: 42, CREATE_EXPRESSIONS: 43, CREATE_EVENTS: 44, USE_EXTERNAL_SOUNDS: 45, SEND_VOICE_MESSAGES: 46,
  SET_VOICE_CHANNEL_STATUS: 48, SEND_POLLS: 49, USE_EXTERNAL_APPS: 50, PIN_MESSAGES: 51, BYPASS_SLOWMODE: 52,
};
const bit = (name) => 1n << BigInt(FLAGS[name]);
const names = (bits) => Object.keys(FLAGS).filter(n => bits & bit(n)).join(', ') || 'nothing';

// Never hand these to everyone, even if Member somehow has them.
const RISKY = ['ADMINISTRATOR', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_CHANNELS', 'MANAGE_GUILD', 'VIEW_AUDIT_LOG',
  'MANAGE_MESSAGES', 'MENTION_EVERYONE', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS', 'MANAGE_NICKNAMES',
  'MANAGE_ROLES', 'MANAGE_WEBHOOKS', 'MANAGE_EXPRESSIONS', 'MANAGE_EVENTS', 'MANAGE_THREADS', 'MODERATE_MEMBERS',
  'VIEW_GUILD_INSIGHTS', 'VIEW_CREATOR_MONETIZATION'].reduce((acc, n) => acc | bit(n), 0n);

// Applying @everyone's overwrite and then Member's equals applying this one overwrite.
function merged(e, m) {
  const allow = ((e.allow & ~m.deny) | m.allow) & ~RISKY;
  const deny = (e.deny | m.deny) & ~allow;
  return { allow, deny };
}
const ow = (o) => ({ allow: BigInt(o?.allow || 0), deny: BigInt(o?.deny || 0) });

const [roles, channels] = await Promise.all([
  discord('GET', `/guilds/${GUILD}/roles`),
  discord('GET', `/guilds/${GUILD}/channels`),
]);
const everyone = roles.find(r => r.id === GUILD);
const member = roles.find(r => r.name === 'Member');
if (!member) throw new Error(`No role called Member. Roles: ${roles.map(r => r.name).join(', ')}`);
console.log(`Member role: ${member.id}`);

// What NEXO itself can do (it can only hand out permissions it has).
const me = await discord('GET', `/guilds/${GUILD}/members/${NEXO_ID}`);
const mine = roles.filter(r => r.id === GUILD || me.roles.includes(r.id)).reduce((acc, r) => acc | BigInt(r.permissions), 0n);
const isAdmin = Boolean(mine & bit('ADMINISTRATOR'));
console.log(`NEXO: ${isAdmin ? 'Administrator' : names(mine)}`);
if (!isAdmin && !(mine & bit('MANAGE_ROLES'))) throw new Error('NEXO needs Manage Roles (or Administrator) for this.');

console.log('\n=== Backup: @everyone today (to undo, put these back)');
console.log(JSON.stringify({
  everyonePermissions: everyone.permissions,
  overwrites: Object.fromEntries(channels.map(c => [c.id, c.permission_overwrites.find(o => o.id === GUILD) || null])),
}));

console.log('\n=== Server-wide');
const roleAdd = BigInt(member.permissions) & ~BigInt(everyone.permissions) & ~RISKY;
const skipped = BigInt(member.permissions) & ~BigInt(everyone.permissions) & RISKY;
if (skipped) console.log(`⚠️ Member has ${names(skipped)}: NOT given to everyone`);
if (roleAdd) {
  console.log(`@everyone gets: ${names(roleAdd)}`);
  await discord('PATCH', `/guilds/${GUILD}/roles/${GUILD}`, { permissions: String(BigInt(everyone.permissions) | roleAdd) });
} else console.log('@everyone already has everything Member has server-wide.');

console.log('\n=== Channels');
const byName = (c) => `${c.type === 4 ? '[category] ' : '#'}${c.name}`;
// Categories first, so channels synced to a category stay identical to it.
const ordered = [...channels].sort((a, b) => (b.type === 4) - (a.type === 4) || a.position - b.position);
let changed = 0;
for (const c of ordered) {
  const m = c.permission_overwrites.find(o => o.id === member.id);
  if (!m) continue;
  const e = ow(c.permission_overwrites.find(o => o.id === GUILD));
  const next = merged(e, ow(m));
  if (next.allow === e.allow && next.deny === e.deny) { console.log(`= ${byName(c)}`); continue; }
  const gained = next.allow & ~e.allow;
  const lost = next.deny & ~e.deny;
  console.log(`→ ${byName(c)}: @everyone now allowed ${names(gained)}${lost ? ` · now denied ${names(lost)}` : ''}`);
  try {
    await discord('PUT', `/channels/${c.id}/permissions/${GUILD}`, { type: 0, allow: String(next.allow), deny: String(next.deny) });
    changed++;
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
    process.exitCode = 1;
  }
}
console.log(`${changed} channel(s) ${DRY_RUN ? 'would change' : 'changed'}.`);

// ---- The button in #rules ----
console.log('\n=== #rules post');
const hasButton = (m) => JSON.stringify(m.components || []).includes('"accept_rules"');
const post = (await discord('GET', `/channels/${RULES_CHANNEL}/messages?limit=50`)).find(m => m.author.id === NEXO_ID && hasButton(m));
if (!post) console.log('No NEXO post with the accept button found (already removed?).');
else {
  const files = Object.fromEntries((post.attachments || []).map(a => [a.id, a.filename]));
  // Rebuild components for sending: drop the button row and its "Accept to unlock" line, point uploaded
  // images back at their attachment (the CDN links in a fetched message expire), keep everything else.
  const clean = (list) => {
    const out = [];
    for (const c of list) {
      if (c.type === 1 && c.components?.some(b => b.custom_id === 'accept_rules')) {
        const rest = c.components.filter(b => b.custom_id !== 'accept_rules');
        if (rest.length) out.push({ ...c, components: rest });
        continue;
      }
      if (c.type === 10 && /accept to unlock/i.test(c.content)) continue;
      const media = (item) => {
        const url = item.attachment_id && files[item.attachment_id] ? `attachment://${files[item.attachment_id]}` : item.url;
        return { url };
      };
      const copy = { ...c };
      if (copy.components) copy.components = clean(copy.components);
      if (copy.items) copy.items = copy.items.map(i => ({ ...i, media: media(i.media) }));
      if (copy.media) copy.media = media(copy.media);
      if (copy.file) copy.file = media(copy.file);
      if (copy.accessory) copy.accessory = clean([copy.accessory])[0];
      out.push(copy);
    }
    // No dangling divider at the end of a card.
    while (out.length && out[out.length - 1].type === 14) out.pop();
    return out;
  };
  const components = clean(post.components);
  console.log(`Post ${post.id}, flags ${post.flags}, files: ${Object.values(files).join(', ') || 'none'}`);
  console.log('Before:', JSON.stringify(post.components).slice(0, 1500));
  console.log('After: ', JSON.stringify(components).slice(0, 1500));
  const body = { components, attachments: (post.attachments || []).map(a => ({ id: a.id })) };
  if (!(post.flags & (1 << 15))) body.content = post.content;
  await discord('PATCH', `/channels/${RULES_CHANNEL}/messages/${post.id}`, body);
  console.log(DRY_RUN ? 'Would remove the button.' : '✅ Button removed.');
}

// Other NEXO posts at the start of the server that still talk about accepting (reported, not changed).
console.log('\n=== Other posts that mention accepting the rules');
const rules = channels.find(c => c.id === RULES_CHANNEL);
for (const c of channels.filter(c => c.parent_id === rules?.parent_id && c.type === 0)) {
  const msgs = await discord('GET', `/channels/${c.id}/messages?limit=50`).catch(() => []);
  for (const m of msgs) {
    const all = m.content + JSON.stringify(m.components || []) + JSON.stringify(m.embeds || []);
    if (m.id !== post?.id && /accept|unlock/i.test(all)) console.log(`#${c.name} ${m.id} (by ${m.author.username}): ${all.match(/.{0,80}(accept|unlock).{0,80}/i)?.[0]}`);
  }
}
