import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings } from '../services/database.js';
import { executeWarReport } from '../services/reportService.js';

export const data = new SlashCommandBuilder()
  .setName('testreport')
  .setDescription('Erstellt einen Test-Abschlussbericht mit echten Live-Daten (ohne Verwarnungen zu speichern).');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const settings = getGuildSettings(interaction.guildId);
    if (!settings.clan_tag) {
      return await interaction.editReply({
        content: '❌ **Kein Clan-Tag hinterlegt!** Bitte nutze zuerst `/setclan [Clan-Tag]`.'
      });
    }

    const result = await executeWarReport(interaction.client, interaction.guildId, {
      isTest: true,
      forceRun: true,
      channelOverride: interaction.channelId,
      skipChannelSend: true
    });

    await interaction.editReply({ embeds: [result.embed] });
  } catch (error) {
    console.error('Fehler bei /testreport:', error);
    await interaction.editReply({
      content: `❌ **Fehler beim Erstellen des Test-Abschlussberichts:**\n${error.message}`
    });
  }
}
