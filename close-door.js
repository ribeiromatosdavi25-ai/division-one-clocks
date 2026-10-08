// One-off (2026-10-08, his call: "low quality ppl"): the door goes back, this time with an application.
// 1. @everyone gets back exactly the channel settings it had before open-server.js (from that run's backup),
//    so without the Member role you only see #welcome and #rules again.
// 2. The #rules card gets an "Apply to join" button (join_open, handled by the NEXO interactions endpoint).
// 3. The old announcement and today's #general welcome stop saying the server is open to everyone.
import { discord, GUILD, NEXO_ID, DRY_RUN } from './lib.js';

const RULES_CHANNEL = '1554918893787807794';
const GENERAL = '1523536618017783930';
const ANNOUNCEMENTS = { channel: '1523536614247235604', post: '1554935316928921650' };

// @everyone's overwrite before today (allow was 0 on every one of these): channel id -> deny.
const BEFORE = {
  '1554930926776221816': '1049600', '1523536464942600334': '1024', '1554930199294910536': '1024',
  '1554911150645453033': '1024', '1523536618017783930': '1024', '1554911196371488822': '1024',
  '1554912467509837874': '377957125120', '1554937920945914008': '1049600', '1554911200154747041': '1024',
  '1554912460371267648': '1024', '1554929273687777343': '377957125120', '1554930928399417518': '1049600',
  '1523536621272563722': '377957125120', '1554911204068040798': '1024', '1554926097353936986': '1024',
  '1554929875507351684': '377957125120', '1554930932807639090': '1049600', '1523536614247235604': '377957125120',
  '1554911188335202485': '1024', '1554911190839463968': '377957125120', '1554930936876113940': '1049600',
  '1523536616893976763': '1024', '1554912470185803836': '1024', '1554930940139147314': '1049600',
  '1523536619737583787': '1024', '1554912472903974994': '377957125120', '1554911193767084032': '377957125120',
  '1554911207193055323': '1024', '1523536627048386644': '1049600', '1554912463919648809': '1024',
  '1554952703300604076': '1049600', '1554952706190348420': '1049600',
};

console.log('=== Channels back to Member only');
const channels = await discord('GET', `/guilds/${GUILD}/channels`);
let changed = 0;
for (const [id, deny] of Object.entries(BEFORE)) {
  const c = channels.find(x => x.id === id);
  if (!c) { console.log(`? ${id} no longer exists`); continue; }
  const now = c.permission_overwrites.find(o => o.id === GUILD);
  if (now && now.allow === '0' && now.deny === deny) { console.log(`= ${c.name}`); continue; }
  try {
    await discord('PUT', `/channels/${id}/permissions/${GUILD}`, { type: 0, allow: '0', deny });
    console.log(`🔒 ${c.name}`);
    changed++;
  } catch (err) {
    console.log(`❌ ${c.name}: ${err.message}`);
    process.exitCode = 1;
  }
}
console.log(`${changed} channel(s) ${DRY_RUN ? 'would close' : 'closed'}.`);

// ---- Editing NEXO's own posts (same helper as open-server.js) ----
const tidy = (v) => Array.isArray(v) ? v.map(tidy)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => [k, tidy(x)]))
  : v;

// Uploaded images are sent again as files: the CDN links in a fetched message expire after about a day.
async function editPost(channel, post, transform) {
  const uploads = new Map();
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
  console.log('After:', JSON.stringify(components).slice(-700));
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

console.log('\n=== #rules card: Apply to join');
const rulesPost = (await discord('GET', `/channels/${RULES_CHANNEL}/messages?limit=50`))
  .find(m => m.author.id === NEXO_ID && JSON.stringify(m.components || []).includes('The rules'));
if (!rulesPost) throw new Error('NEXO rules card not found in #rules');
if (JSON.stringify(rulesPost.components).includes('"join_open"')) console.log('Already has the Apply button.');
else await editPost(RULES_CHANNEL, rulesPost, (list) => list.map(c => c.type !== 17 ? c : {
  ...c,
  components: [
    ...c.components,
    { type: 14, divider: true, spacing: 2 },
    { type: 10, content: '-# Read them? Apply to get in. A Founder reads every application.' },
    { type: 1, components: [{ type: 2, style: 1, label: 'Apply to join', emoji: { name: '📝' }, custom_id: 'join_open' }] },
  ],
}));

console.log('\n=== Old announcement');
const news = await discord('GET', `/channels/${ANNOUNCEMENTS.channel}/messages/${ANNOUNCEMENTS.post}`);
const fixLine = (list) => list.map(c => ({
  ...c,
  ...(c.type === 10 ? { content: c.content.replace(/Read the rules in (<#\d+>) and you're in/g, 'Apply in $1 and a Founder lets you in') } : {}),
  ...(c.components ? { components: fixLine(c.components) } : {}),
}));
if (news.author?.id !== NEXO_ID || !JSON.stringify(news.components || []).includes('Read the rules in')) console.log('Nothing to change.');
else await editPost(ANNOUNCEMENTS.channel, news, fixLine);

console.log('\n=== Today\'s #general welcome');
const hi = (await discord('GET', `/channels/${GENERAL}/messages?limit=50`))
  .find(m => m.author.id === NEXO_ID && m.content.includes('Welcome to everyone new'));
if (!hi || !hi.content.includes('No buttons, no waiting')) console.log('Nothing to change.');
else {
  const content = hi.content.replace(/\nThe whole server is open to you now\. No buttons, no waiting\./, '');
  await discord('PATCH', `/channels/${GENERAL}/messages/${hi.id}`, { content, allowed_mentions: { parse: [] } });
  console.log(DRY_RUN ? 'would edit' : '✅ edited');
}
