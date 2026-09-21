import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('seterinnerung')
  .setDescription('Ändert die vorgegebene Erinnerungsnachricht für den /erinnerung Befehl.')
  .addStringOption(option =>
    option
      .setName('text')
      .setDescription('Der neue Text vor der Spielerliste (z.B. Folgende Spieler haben noch Decks offen:)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const newText = interaction.options.getString('text').trim();

  saveGuildSettings(interaction.guildId, { reminder_message: newText });

  await interaction.reply({
    content: `✅ **Erinnerungsnachricht aktualisiert!**\n` +
             `Bei Aufruf von \`/erinnerung\` wird nun folgender Text vorangestellt:\n` +
             `> ${newText}`
  });
}
