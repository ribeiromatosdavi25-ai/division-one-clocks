// Read-only (2026-10-08): what Discord itself makes a no-role newcomer wait for before they can type.
import { discord, GUILD } from './lib.js';

const LEVELS = ['None', 'Low: verified email', 'Medium: on Discord 5+ minutes', 'High: in this server 10+ minutes', 'Highest: verified phone'];
const guild = await discord('GET', `/guilds/${GUILD}`);
console.log(`Verification level: ${guild.verification_level} (${LEVELS[guild.verification_level]})`);
console.log(`Rules screening (Discord's own "agree to rules" step): ${guild.features.includes('MEMBER_VERIFICATION_GATE_ENABLED') ? 'ON' : 'off'}`);
console.log(`Onboarding: ${guild.features.includes('GUILD_ONBOARDING') ? 'ON' : 'off'}`);

const members = await discord('GET', `/guilds/${GUILD}/members?limit=1000`);
const humans = members.filter(m => !m.user.bot);
const noRole = humans.filter(m => m.roles.length === 0);
const pending = humans.filter(m => m.pending);
// Counts only: this repo's logs are public, so no names.
console.log(`People: ${humans.length} · no role: ${noRole.length} · stuck on rules screening: ${pending.length}`);
