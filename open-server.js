// One-off (2026-10-08, his call): no more rules gate. Reading the rules is enough.
// 1. Whatever the Member role allows (server-wide and per channel) is given to @everyone, so someone who just
//    joined, with no role, sees exactly what a Member sees. People who already have Member see no change.
// 2. The "I accept the rules" button (and its line) comes off NEXO's post in #rules, and the old
//    announcement that said "Accept the rules" now says "Read the rules".
// DRY_RUN=1 prints the plan plus a backup of the current @everyone settings; without it the changes are made.
import { discord, GUILD, NEXO_ID, DRY_RUN } from './lib.js';

const RULES_CHANNEL = '1554918893787807794';
const ANNOUNCEMENTS = { channel: '1523536614247235604', post: '1554935316928921650' };

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

// ---- Editing NEXO's own posts ----

// Response-only fields (null emoji ids, proxy urls...) are left out of what we send back.
const tidy = (v) => Array.isArray(v) ? v.map(tidy)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => [k, tidy(x)]))
  : v;

// Edit a Components V2 post. Uploaded images are sent again as files: the CDN links in a fetched message
// expire after about a day, so pointing back at them would break the picture.
async function editPost(channel, post, transform) {
  const uploads = new Map(); // attachment id -> { url, filename }
  const media = (m) => {
    if (!m?.attachment_id) return { url: m.url };
    const filename = decodeURIComponent(new URL(m.url).pathname.split('/').pop());
    uploads.set(m.attachment_id, { url: m.url, filename });
    return { url: `attachment://${filename}` };
  };
  const rebuild = (list) => list.map(c => {
    const copy = { ...c };
    if (copy.components) copy.components = rebuild(copy.components);
    if (copy.items) copy.items = copy.items.map(i => ({ ...i, media: media(i.media) }));
    if (copy.media) copy.media = media(copy.media);
    if (copy.file) copy.file = media(copy.file);
    if (copy.accessory) copy.accessory = rebuild([copy.accessory])[0];
    return copy;
  });
  const components = tidy(rebuild(transform(post.components)));
  const files = [...uploads.values()];
  const payload = { components, attachments: files.map((f, i) => ({ id: i, filename: f.filename })) };
  console.log('After:', JSON.stringify(components).slice(0, 2500));
  console.log(`Images sent again: ${files.map(f => f.filename).join(', ') || 'none'}`);
  if (DRY_RUN) { console.log(`[dry run] PATCH /channels/${channel}/messages/${post.id}`); return; }

  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  for (const [i, f] of files.entries()) {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`could not download ${f.filename}: ${res.status}`);
    form.append(`files[${i}]`, new Blob([await res.arrayBuffer()], { type: res.headers.get('content-type') || 'image/png' }), f.filename);
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${channel}/messages/${post.id}`, {
    method: 'PATCH', headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }, body: form,
  });
  if (!res.ok) throw new Error(`PATCH message ${post.id} -> ${res.status} ${await res.text()}`);
  console.log('✅ edited');
}

// Drop the accept button row and its "Accept to unlock" line, and any divider left dangling at the end.
function withoutButton(list) {
  const out = [];
  for (const c of list) {
    if (c.type === 1 && c.components?.some(b => b.custom_id === 'accept_rules')) {
      const rest = c.components.filter(b => b.custom_id !== 'accept_rules');
      if (rest.length) out.push({ ...c, components: rest });
      continue;
    }
    if (c.type === 10 && /accept to unlock/i.test(c.content)) continue;
    out.push(c.components ? { ...c, components: withoutButton(c.components) } : c);
  }
  while (out.length && out[out.length - 1].type === 14) out.pop();
  return out;
}

// "Accept the rules in #rules" -> "Read the rules in #rules".
const readNotAccept = (list) => list.map(c => ({
  ...c,
  ...(c.type === 10 ? { content: c.content.replace(/Accept the rules/g, 'Read the rules') } : {}),
  ...(c.components ? { components: readNotAccept(c.components) } : {}),
}));

console.log('\n=== #rules post');
const hasButton = (m) => JSON.stringify(m.components || []).includes('"accept_rules"');
const post = (await discord('GET', `/channels/${RULES_CHANNEL}/messages?limit=50`)).find(m => m.author.id === NEXO_ID && hasButton(m));
if (!post) console.log('No NEXO post with the accept button found (already removed?).');
else {
  console.log(`Post ${post.id}`);
  await editPost(RULES_CHANNEL, post, withoutButton);
}

console.log('\n=== Old announcement');
const news = await discord('GET', `/channels/${ANNOUNCEMENTS.channel}/messages/${ANNOUNCEMENTS.post}`);
if (news.author?.id !== NEXO_ID || !JSON.stringify(news.components || []).includes('Accept the rules')) console.log('Nothing to change.');
else await editPost(ANNOUNCEMENTS.channel, news, readNotAccept);
