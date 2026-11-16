import { SlashCommandBuilder } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('seterinnerungsendtext')
  .setDescription('Ändert den Schlusstext (nach der Spielerliste) für den /erinnerung Befehl.')
  .addStringOption((option) =>
    option
      .setName('text')
      .setDescription('Der neue Schlusstext (z.B. Ihr habt noch Decks offen!)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const newText = interaction.options.getString('text').trim();

  saveGuildSettings(interaction.guildId, { reminder_suffix: newText });

  await interaction.reply({
    content:
      `✅ **Schlusstext für \`/erinnerung\` aktualisiert!**\n` +
      `Nach der Liste der noch ausstehenden Spieler wird nun folgender Text angezeigt:\n` +
      `> ${newText}`
  });
}
