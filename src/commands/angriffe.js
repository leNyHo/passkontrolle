import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../services/database.js';
import { getWarParticipation } from '../services/clashRoyale.js';
import { createStatusEmbed } from '../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('angriffe')
  .setDescription('Ruft den aktuellen Angriffsstatus des laufenden Clankrieges ab.');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const settings = getGuildSettings(interaction.guildId);
    if (!settings.clan_tag) {
      return await interaction.editReply({
        content: '❌ **Kein Clan-Tag hinterlegt!** Bitte nutze zuerst `/setclan [Clan-Tag]`.'
      });
    }

    const warData = await getWarParticipation(settings.clan_tag);
    const embed = createStatusEmbed({
      clanName: warData.clanName,
      clanTag: warData.clanTag,
      periodType: warData.periodType,
      completedCount: warData.completedCount,
      incompleteCount: warData.incompleteCount,
      totalMembers: warData.totalMembers,
      totalMissedToday: warData.totalMissedToday,
      incompleteList: warData.incomplete
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler bei /angriffe:', error);
    await interaction.editReply({
      content: `❌ **Fehler beim Abrufen der Clankriegsdaten:**\n${error.message}`
    });
  }
}
