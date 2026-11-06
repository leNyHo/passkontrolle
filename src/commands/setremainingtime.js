import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, saveGuildSettings } from '../services/database.js';
import { scheduleGuildWarEnd } from '../services/scheduler.js';

/**
 * Parst Benutzereingaben für die Restzeit wie "4h 30m", "4:30", "4h", "30m", "4 Std 30 Min"
 */
export function parseRemainingTime(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') return null;
  const str = inputStr.trim().toLowerCase();

  // 1. Format HH:MM oder H:MM (z.B. "04:30", "4:30", "4:30:00")
  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    if (hours >= 0 && hours <= 72 && minutes >= 0 && minutes < 60) {
      const totalMinutes = hours * 60 + minutes;
      if (totalMinutes > 0) {
        return { hours, minutes, totalMinutes };
      }
    }
  }

  // 2. Format wie "4h 30m", "4h30m", "4h", "30m", "4 std 30 min", "4h 30", "30min"
  let hours = 0;
  let minutes = 0;
  let found = false;

  const hourMatch = str.match(/(\d+)\s*(?:h|std|stunde|stunden)\b/);
  if (hourMatch) {
    hours = parseInt(hourMatch[1], 10);
    found = true;
  }

  const minMatch = str.match(/(\d+)\s*(?:m|min|minute|minuten)\b/);
  if (minMatch) {
    minutes = parseInt(minMatch[1], 10);
    found = true;
  }

  // 3. Fallback: Zwei Zahlen mit Leerzeichen z.B. "4 30" -> 4h 30m
  if (!found) {
    const twoNumbers = str.match(/^(\d+)\s+(\d+)$/);
    if (twoNumbers) {
      hours = parseInt(twoNumbers[1], 10);
      minutes = parseInt(twoNumbers[2], 10);
      found = true;
    }
  }

  // 4. Fallback: Nur eine Zahl z.B. "4" -> 4 Stunden
  if (!found) {
    const singleNumber = str.match(/^(\d+)$/);
    if (singleNumber) {
      const val = parseInt(singleNumber[1], 10);
      if (val > 0 && val <= 72) {
        hours = val;
        minutes = 0;
        found = true;
      }
    }
  }

  if (found) {
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes > 0 && totalMinutes <= 72 * 60) {
      return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
        totalMinutes
      };
    }
  }

  return null;
}

/**
 * Berechnet die Uhrzeit (HH:MM) für das Kriegsende ausgehend von der aktuellen Zeit + Restzeit
 */
export function calculateWarEndTimeFromRemaining(totalMinutes, timezone = 'Europe/Berlin', baseDate = new Date()) {
  const targetDate = new Date(baseDate.getTime() + totalMinutes * 60 * 1000);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(targetDate);

  const hour = parts.find(p => p.type === 'hour')?.value.padStart(2, '0') || '12';
  const minute = parts.find(p => p.type === 'minute')?.value.padStart(2, '0') || '00';

  return `${hour}:${minute}`;
}

export const data = new SlashCommandBuilder()
  .setName('setremainingtime')
  .setDescription('Berechnet und setzt das Kriegsende anhand der noch verbleibenden Restzeit (z.B. 4h 30m).')
  .addStringOption(option =>
    option
      .setName('zeit')
      .setDescription('Verbleibende Restzeit bis Kriegsende (z.B. "4h 30m", "4:30", "4h" oder "30m")')
      .setRequired(true)
  );

export async function execute(interaction) {
  const inputStr = interaction.options.getString('zeit');
  const parsed = parseRemainingTime(inputStr);

  if (!parsed) {
    return await interaction.reply({
      content:
        '❌ **Ungültiges Zeitformat für die Restzeit!**\n\n' +
        'Bitte gib die verbleibende Zeit z.B. so an:\n' +
        '• `4h 30m` oder `4h30m`\n' +
        '• `4:30` (4 Stunden, 30 Minuten)\n' +
        '• `4h` (nur Stunden)\n' +
        '• `45m` (nur Minuten)',
      ephemeral: true
    });
  }

  const settings = getGuildSettings(interaction.guildId);
  const timezone = settings.timezone || 'Europe/Berlin';

  const calculatedEndTime = calculateWarEndTimeFromRemaining(parsed.totalMinutes, timezone, new Date());

  // In Datenbank speichern
  saveGuildSettings(interaction.guildId, { war_end_time: calculatedEndTime });

  // Cron-Scheduler sofort auf die neue Endzeit aktualisieren
  scheduleGuildWarEnd(interaction.client, interaction.guildId, calculatedEndTime, timezone);

  await interaction.reply({
    content:
      `✅ **Kriegsende-Zeit berechnet und eingestellt!**\n\n` +
      `• **Eingegebene Restzeit:** **${parsed.hours}h ${parsed.minutes}m** (${parsed.totalMinutes} Minuten)\n` +
      `• **Berechnete Kriegsende-Uhrzeit:** **${calculatedEndTime} Uhr** (${timezone})\n\n` +
      `Der tägliche Abschlussbericht wird ab sofort um **${calculatedEndTime} Uhr** ausgeführt.\n` +
      `*(Tipp: Mit \`/settime [HH:MM]\` kannst du die Uhrzeit bei Bedarf auch direkt manuell anpassen).*`
  });
}
