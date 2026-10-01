// Every Friday: the weekly numbers check-in in #weekly-numbers (Division One only).
import { CH, card, text, sep, postWithThread, alreadyPosted } from './lib.js';

if (await alreadyPosted(CH.weeklyNumbers, 'Numbers time', 48)) { console.log('already posted, skipping'); process.exit(0); }

const week = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }).format(new Date());

await postWithThread(
  CH.weeklyNumbers,
  card([
    text(`## 📊 Numbers time · week of ${week}`),
    text('Drop yours in the thread. Real numbers, no shame. What gets measured gets done.'),
    sep(),
    text('```\nOutreach sent:    \nMeetings booked:  \nMeetings held:    \nDeals closed:     \nRevenue:          (optional)\nNext week target: \n```'),
  ]),
  `Numbers · ${week}`,
);
console.log('✅ weekly numbers posted:', week);
