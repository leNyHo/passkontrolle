import { SlashCommandBuilder } from 'discord.js';
import { getAllStrikes, getGuildSettings } from '../services/database.js';
import { syncClanMembersAndPruneStrikes } from '../services/reportService.js';
import { createStrikesEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('verwarnungen')
  .setDescription('Zeigt die Liste aller Spieler mit verpassten Clankriegs-Decks aus der Datenbank.');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const settings = getGuildSettings(interaction.guildId);
    let prunedCount = 0;

    // Vorab-Abgleich: Prüfen, wer noch im Clan ist und Ausgetretene löschen
    if (settings.clan_tag) {
      const syncResult = await syncClanMembersAndPruneStrikes(settings.clan_tag);
      prunedCount = syncResult?.prunedCount || 0;
    }

    const list = getAllStrikes(1); // Ab 1 verpassten Deck
    const embed = createStrikesEmbed({ strikesList: list, threshold: 5, prunedCount });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler bei /verwarnungen:', error);
    await interaction.editReply({
      content: `❌ Fehler beim Laden der Verwarnungen-Datenbank: ${error.message}`
    });
  }
}
