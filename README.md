# Division One clocks

Keeps the 🌍 GLOBAL TIME voice channels in the Division One Discord showing each city's local time.

GitHub Actions runs `clocks.js` every 10 minutes (Discord only allows 2 channel renames per 10 minutes). The bot token lives in the `DISCORD_TOKEN` repository secret, never in the code.

To add a city, create a voice channel in the category and add a line to `CLOCKS` in `clocks.js` with its channel ID and an IANA time zone.
