// Every Monday: the most starred AI repos created in the last 7 days, into #ai-resources.
// GitHub has no "stars gained this week" API, so this is honest about what it is: new repos, ranked by stars.
import { CH, discord, card, text, sep, alreadyPosted } from './lib.js';

if (await alreadyPosted(CH.aiResources, 'New this week on GitHub', 48)) { console.log('already posted, skipping'); process.exit(0); }

const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const TOPICS = ['llm', 'ai-agents', 'mcp', 'generative-ai', 'rag', 'agents'];

const found = new Map();
for (const topic of TOPICS) {
  const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${topic} created:>=${since}`)}&sort=stars&order=desc&per_page=10`, {
    headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
  });
  if (!res.ok) { console.log('⚠️', topic, res.status); continue; }
  for (const r of (await res.json()).items || []) if (!r.fork && !r.archived) found.set(r.full_name, r);
}

const top = [...found.values()].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
if (!top.length) { console.log('Nothing found this week.'); process.exit(0); }

const stars = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : `${n}`);
const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || 'No description.');

await discord('POST', `/channels/${CH.aiResources}/messages`, card([
  text(`## ⭐ New this week on GitHub\n-# The most starred AI repos created since ${since}. New, so check them before you rely on them.`),
  sep(),
  ...top.map((r, i) => ({
    type: 9,
    components: [text(`**${i + 1}. ${r.name}** · ⭐ ${stars(r.stargazers_count)}\n-# ${clip(r.description, 110)}`)],
    accessory: { type: 2, style: 5, label: 'GitHub', url: r.html_url },
  })),
]));
console.log('✅ trending posted:', top.map(r => r.full_name).join(', '));
