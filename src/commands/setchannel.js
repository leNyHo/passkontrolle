import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('setchannel')
  .setDescription('Legt den aktuellen Kanal als Ziel für den täglichen Abschlussbericht fest.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const channel = interaction.channel;

  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    return await interaction.reply({
      content: '❌ Der Zielkanal muss ein Textkanal oder Ankündigungskanal sein.',
      ephemeral: true
    });
  }

  saveGuildSettings(interaction.guildId, { channel_id: channel.id });

  await interaction.reply({
    content: `✅ **Zielkanal festgelegt!** Der tägliche Clankriegsbericht wird ab sofort in <#${channel.id}> gepostet.`
  });
}
