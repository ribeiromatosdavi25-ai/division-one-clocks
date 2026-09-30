# Division One automations

Scheduled jobs for the Division One Discord, run for free on GitHub Actions. The NEXO bot token lives in the `DISCORD_TOKEN` repository secret, never in the code.

| Job | When (UK time) | What it does |
|---|---|---|
| `clocks.js` | every 10 min | Renames the GLOBAL TIME voice channels to each city's time, plus the member counter |
| `daily-goals.js` | daily 9:00 | Posts the daily goal prompt with a thread in #daily-goals |
| `weekly-numbers.js` | Friday 17:00 | Posts the numbers check-in in #weekly-numbers |
| `ai-news.js` | hourly | Posts new articles from official AI blogs (OpenAI, Google DeepMind, Google AI, Hugging Face) to #ai-news. Never repeats, never backfills more than 36 hours, max 3 per run |
| `trending.js` | Monday 10:00 | Posts the most starred AI repos created in the last 7 days to #ai-resources |
| `bump-reminder.js` | every 2 hours | Reminds the team in #staff-chat to /bump on DISBOARD (the bump itself stays manual) |
| `calls-board.js` | daily 7:00 | Rebuilds the pinned "This week's calls" board in #calls from `calls.json` (UK times) and creates a Discord event for each call in the next 7 days |
| `weekly-report.js` | Sunday 19:00 | Members, applications, most active channels and invite uses, in #staff-chat |

Times are in UTC in the workflows, so they shift by an hour when the UK changes clocks.

Test any job without posting: `DRY_RUN=1 DISCORD_TOKEN=... node <job>.js`

If GitHub pauses the schedules after 60 days without activity: `gh workflow enable <file>.yml`.

## Adding a call

Edit `calls.json`. Times are UK time; the board shows everyone their own time zone.

```json
{ "calls": [
  { "name": "Weekly call", "emoji": "🔊", "days": ["monday"], "time": "17:00", "minutes": 60, "channel": "<voice channel id>" }
] }
```
