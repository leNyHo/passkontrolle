import { SlashCommandBuilder } from 'discord.js';
import { saveGuildSettings } from '../services/database.js';
import { scheduleGuildWarEnd } from '../services/scheduler.js';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const data = new SlashCommandBuilder()
  .setName('settime')
  .setDescription('Passt die Uhrzeit für das Kriegsende manuell an (Format HH:MM in Europe/Berlin).')
  .addStringOption(option =>
    option
      .setName('uhrzeit')
      .setDescription('Uhrzeit im Format HH:MM (z.B. 12:00 oder 11:30)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const inputTime = interaction.options.getString('uhrzeit').trim();

  if (!TIME_REGEX.test(inputTime)) {
    return await interaction.reply({
      content: '❌ **Ungültiges Zeitformat!** Bitte gib die Uhrzeit im 24-Stunden-Format `HH:MM` an (z.B. `12:00` oder `10:15`).',
      ephemeral: true
    });
  }

  // In Datenbank speichern
  const updated = saveGuildSettings(interaction.guildId, { war_end_time: inputTime });

  // Cron-Scheduler sofort auf die neue Zeit aktualisieren
  scheduleGuildWarEnd(interaction.client, interaction.guildId, inputTime, updated.timezone || 'Europe/Berlin');

  await interaction.reply({
    content: `✅ **Kriegsende-Zeit aktualisiert!**\n` +
             `Der tägliche Abschlussbericht wird nun um **${inputTime} Uhr** (${updated.timezone || 'Europe/Berlin'}) ausgeführt.`
  });
}
