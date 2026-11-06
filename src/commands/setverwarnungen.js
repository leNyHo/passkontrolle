import { SlashCommandBuilder } from 'discord.js';
import { setPlayerStrikes, getPlayerStrikes, getGuildSettings } from '../services/database.js';
import { normalizeClanTag, getClanInfo } from '../services/clashRoyale.js';

export const data = new SlashCommandBuilder()
  .setName('setverwarnungen')
  .setDescription('Setzt die verpassten Decks (Verwarnungen) eines Spielers manuell auf einen bestimmten Wert.')
  .addStringOption(option =>
    option
      .setName('tag')
      .setDescription('Der Spieler-Tag (z.B. #ABC123XYZ)')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('anzahl')
      .setDescription('Die Anzahl an verpassten Decks / Verwarnungen (0 oder mehr)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(100)
  );

export async function execute(interaction) {
  const inputTag = interaction.options.getString('tag');
  const count = interaction.options.getInteger('anzahl');
  const playerTag = normalizeClanTag(inputTag);

  const settings = getGuildSettings(interaction.guildId);
  const existing = getPlayerStrikes(playerTag);

  let playerName = existing?.player_name;

  // Falls der Spieler noch nicht in der Datenbank steht, versuchen wir den Namen aus dem Clan abzurufen
  if (!playerName && settings.clan_tag) {
    try {
      const clanInfo = await getClanInfo(settings.clan_tag);
      const member = (clanInfo?.memberList || []).find(
        m => m.tag?.toUpperCase() === playerTag.toUpperCase()
      );
      if (member) {
        playerName = member.name;
      }
    } catch {
      // Falls API-Aufruf fehlschlägt, fällt Name auf playerTag zurück
    }
  }

  const result = setPlayerStrikes(playerTag, count, playerName, settings.clan_tag);

  let statusText = '';
  if (count >= 5) {
    statusText = '\n🚨 **Achtung:** Der Spieler hat damit **5 oder mehr** verpasste Decks und ist als **Kick-Kandidat** gelistet!';
  } else if (count === 0) {
    statusText = '\n✅ Der Spieler hat nun **keine** offenen Verwarnungen mehr.';
  } else {
    statusText = `\n⚠️ Der Spieler ist verwarnt (Kick-Grenze: ab 5 Decks, aktuell: ${count}/5).`;
  }

  await interaction.reply({
    content:
      `✅ **Verwarnstand erfolgreich aktualisiert!**\n\n` +
      `• **Spieler:** **${result.player_name}** (\`${playerTag}\`)\n` +
      `• **Verwarnte Decks:** **${count}**${statusText}`
  });
}
