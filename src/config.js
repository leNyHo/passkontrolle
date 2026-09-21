import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  discordToken: process.env.DISCORD_TOKEN || '',
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
  clashRoyaleApiKey: process.env.CLASH_ROYALE_API_KEY || '',
  defaultClanTag: process.env.DEFAULT_CLAN_TAG || '',
  timezone: process.env.TZ || 'Europe/Berlin',
  databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/clashbot.db'),
  defaultWarningMessage: '⚠️ Bitte denkt daran, eure Clankriegs-Angriffe rechtzeitig abzuschließen! Unvollständige Decks schwächen den Clan.',
  defaultWarEndTime: '12:00', // Format: HH:MM in Europe/Berlin
};

export function validateConfig() {
  const missing = [];
  if (!config.discordToken) missing.push('DISCORD_TOKEN');
  if (!config.discordClientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.clashRoyaleApiKey) missing.push('CLASH_ROYALE_API_KEY');

  if (missing.length > 0) {
    console.warn(`[WARNUNG] Fehlende Umgebungsvariablen: ${missing.join(', ')}. Bitte in .env eintragen!`);
  }
}
