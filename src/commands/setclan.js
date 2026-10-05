import { SlashCommandBuilder } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';
import { normalizeClanTag, getClanInfo } from '../services/clashRoyale.js';

export const data = new SlashCommandBuilder()
  .setName('setclan')
  .setDescription('Legt den zu überwachenden Clash Royale Clan fest.')
  .addStringOption(option =>
    option
      .setName('tag')
      .setDescription('Der Clan-Tag (z.B. #2PP oder 2PP)')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const inputTag = interaction.options.getString('tag');
  const clanTag = normalizeClanTag(inputTag);

  try {
    // Überprüfen, ob der Clan existiert
    const clanInfo = await getClanInfo(clanTag);

    saveGuildSettings(interaction.guildId, { clan_tag: clanTag });

    await interaction.editReply({
      content: `✅ **Clan erfolgreich festgelegt!**\n` +
               `• **Clan-Name:** ${clanInfo.name}\n` +
               `• **Clan-Tag:** \`${clanInfo.tag}\`\n` +
               `• **Mitglieder:** ${clanInfo.members}/50`
    });
  } catch (error) {
    console.error('Fehler bei /setclan:', error);
    await interaction.editReply({
      content: `❌ **Clan konnte nicht verifiziert werden:**\n${error.message}\n` +
               `Bitte stelle sicher, dass der Clan-Tag stimmt und die API-Verbindung aktiv ist.`
    });
  }
}
