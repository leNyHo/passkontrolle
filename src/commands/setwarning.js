import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('setwarning')
  .setDescription('Ändert die vorgegebene Verwarnnachricht im täglichen Abschlussbericht.')
  .addStringOption(option =>
    option
      .setName('text')
      .setDescription('Der neue Verwarnungstext')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const newWarning = interaction.options.getString('text').trim();

  saveGuildSettings(interaction.guildId, { warning_message: newWarning });

  await interaction.reply({
    content: `✅ **Verwarnnachricht aktualisiert!**\n` +
             `Im nächsten Abschlussbericht wird folgende Nachricht angezeigt:\n` +
             `> ${newWarning.split('\n').join('\n> ')}`
  });
}
