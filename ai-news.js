// Every hour: new posts from official AI blogs into #ai-news. Only real sources, never repeats.
// Anthropic has no RSS feed (checked 2026-09-30), so their news stays manual.
import { CH, NEXO_ID, discord } from './lib.js';

const FEEDS = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Google AI', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
];
const MAX_AGE_HOURS = 36; // never backfill old posts
const MAX_PER_RUN = 3;    // never flood the channel

const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ''; };

function parse(xml) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(m => m[0]);
  const entries = [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/g)].map(m => m[0]);
  return [
    ...items.map(b => ({ title: tag(b, 'title'), link: tag(b, 'link'), date: tag(b, 'pubDate') || tag(b, 'dc:date') })),
    ...entries.map(b => ({ title: tag(b, 'title'), link: (b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '', date: tag(b, 'published') || tag(b, 'updated') })),
  ].filter(x => x.title && x.link);
}

// Everything NEXO already posted, so nothing is posted twice.
const recent = await discord('GET', `/channels/${CH.aiNews}/messages?limit=100`);
const seen = new Set(recent.filter(m => m.author.id === NEXO_ID).flatMap(m => (m.content.match(/https?:\/\/\S+/g) || [])));
for (const m of recent) for (const c of JSON.stringify(m.components || []).match(/https?:[^"]+/g) || []) seen.add(c);

const fresh = [];
for (const feed of FEEDS) {
  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 (DivisionOne news bot)' } });
    if (!res.ok) { console.log('⚠️', feed.name, res.status); continue; }
    for (const item of parse(await res.text())) {
      const age = (Date.now() - new Date(item.date).getTime()) / 36e5;
      if (!item.date || isNaN(age) || age > MAX_AGE_HOURS || age < 0) continue;
      if (seen.has(item.link)) continue;
      fresh.push({ ...item, source: feed.name, time: new Date(item.date).getTime() });
    }
  } catch (e) {
    console.log('⚠️', feed.name, e.message);
  }
}

fresh.sort((a, b) => a.time - b.time);
for (const item of fresh.slice(0, MAX_PER_RUN)) {
  await discord('POST', `/channels/${CH.aiNews}/messages`, {
    content: `### ${item.title}\n-# ${item.source} · official blog\n${item.link}`,
    allowed_mentions: { parse: [] },
  });
  console.log('✅', item.source, '·', item.title);
}
if (!fresh.length) console.log('Nothing new.');
