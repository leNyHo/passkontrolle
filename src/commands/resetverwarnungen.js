import { SlashCommandBuilder } from 'discord.js';
import { resetPlayerStrikes, getPlayerStrikes } from '../services/database.js';
import { normalizeClanTag } from '../services/clashRoyale.js';

export const data = new SlashCommandBuilder()
  .setName('resetverwarnungen')
  .setDescription('Setzt die verpassten Decks (Verwarnungen) eines Spielers auf 0 zurück.')
  .addStringOption(option =>
    option
      .setName('tag')
      .setDescription('Der Spieler-Tag (z.B. #ABC123XYZ)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const inputTag = interaction.options.getString('tag');
  const playerTag = normalizeClanTag(inputTag);

  const existing = getPlayerStrikes(playerTag);
  if (!existing || existing.total_missed_decks === 0) {
    return await interaction.reply({
      content: `ℹ️ Für Spieler mit Tag \`${playerTag}\` sind keine verpassten Decks verzeichnet.`,
      ephemeral: true
    });
  }

  resetPlayerStrikes(playerTag);

  await interaction.reply({
    content: `✅ **Verwarnungen zurückgesetzt!**\nDie verpassten Decks für **${existing.player_name}** (\`${playerTag}\`) wurden von **${existing.total_missed_decks}** auf **0** zurückgesetzt.`
  });
}
