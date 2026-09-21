import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getAllStrikes } from '../services/database.js';
import { createStrikesEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('verwarnungen')
  .setDescription('Zeigt die Liste aller Spieler mit verpassten Clankriegs-Decks aus der Datenbank.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const list = getAllStrikes(1); // Ab 1 verpassten Deck
    const embed = createStrikesEmbed({ strikesList: list, threshold: 5 });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler bei /verwarnungen:', error);
    await interaction.editReply({
      content: `❌ Fehler beim Laden der Verwarnungen-Datenbank: ${error.message}`
    });
  }
}
