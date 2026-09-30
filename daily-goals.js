// Every morning: a daily goals prompt in #daily-goals with a thread for the answers.
import { CH, card, text, postWithThread } from './lib.js';

const today = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());

await postWithThread(
  CH.dailyGoals,
  card([
    text(`## ☀️ ${today}\nWhat's your **one** goal today?`),
    text('-# Reply in the thread. Tonight, come back and mark it ✅ done or ❌ not done + why.'),
  ]),
  `Goals · ${today}`,
);
console.log('✅ daily goals posted:', today);
