import { SlashCommandBuilder } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('seterinnerung')
  .setDescription('Ändert die Texte (Einleitung und/oder Schlusstext) für den /erinnerung Befehl.')
  .addStringOption((option) =>
    option
      .setName('text')
      .setDescription('Der Text VOR der Spielerliste (z.B. Erinnerung an folgende Spieler:)')
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName('endtext')
      .setDescription('Der Schlusstext NACH der Spielerliste (z.B. Ihr habt noch Decks offen!)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const newText = interaction.options.getString('text');
  const newEndText = interaction.options.getString('endtext');

  if (!newText && !newEndText) {
    return await interaction.reply({
      content:
        '❌ **Bitte gib mindestens einen Parameter an:** `text` (Einleitung) oder `endtext` (Schlusstext).\n' +
        'Beispiel:\n' +
        '• `/seterinnerung text: Erinnerung an folgende Spieler:`\n' +
        '• `/seterinnerung endtext: Ihr habt noch Decks offen!`',
      ephemeral: true
    });
  }

  const updates = {};
  const responseParts = [];

  if (newText) {
    updates.reminder_message = newText.trim();
    responseParts.push(`• **Einleitungstext (vor Spielern):**\n> ${updates.reminder_message}`);
  }
  if (newEndText) {
    updates.reminder_suffix = newEndText.trim();
    responseParts.push(`• **Schlusstext (nach Spielern):**\n> ${updates.reminder_suffix}`);
  }

  saveGuildSettings(interaction.guildId, updates);

  await interaction.reply({
    content:
      `✅ **Erinnerungstext(e) erfolgreich aktualisiert!**\n` +
      `Bei Aufruf von \`/erinnerung\` wird Folgendes verwendet:\n` +
      responseParts.join('\n')
  });
}
