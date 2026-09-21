import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { executeWarReport } from '../services/reportService.js';

export const data = new SlashCommandBuilder()
  .setName('testreport')
  .setDescription('Sendet sofort einen Test-Abschlussbericht in den aktuellen Kanal (ohne DB-Strafpunkte).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const result = await executeWarReport(interaction.client, interaction.guildId, {
      isTest: true,
      channelOverride: interaction.channelId,
      forceRun: true
    });

    await interaction.editReply({
      content: '✅ **Test-Bericht erfolgreich erstellt und oben gepostet!**'
    });
  } catch (error) {
    console.error('Fehler bei /testreport:', error);
    await interaction.editReply({
      content: `❌ **Fehler beim Erstellen des Test-Berichts:**\n${error.message}`
    });
  }
}
