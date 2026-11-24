import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, saveGuildSettings } from '../services/database.js';
import { scheduleGuildWarEnd } from '../services/scheduler.js';
import { parseRemainingTime, calculateWarEndTimeFromRemaining } from './setremainingtime.js';

/**
 * Parst und normalisiert verschiedene Zeitformate (z.B. "12:00", "9:30", "12.00", "9.30", "12", "12 Uhr", "4h 30m")
 */
export function parseSetTimeInput(inputStr, timezone = 'Europe/Berlin') {
  if (!inputStr || typeof inputStr !== 'string') return null;
  const str = inputStr.trim().toLowerCase();

  // 1. Optionales "uhr" am Ende entfernen (z.B. "12:00 uhr", "12uhr", "12 uhr")
  const cleaned = str.replace(/\s*uhr\b/g, '').trim();

  // 2. HH:MM oder H:MM mit Doppelpunkt oder Punkt (z.B. "12:00", "09:30", "9:30", "12.00", "9.30")
  const matchColonOrDot = cleaned.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (matchColonOrDot) {
    const h = parseInt(matchColonOrDot[1], 10);
    const m = parseInt(matchColonOrDot[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return {
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        isCalculated: false
      };
    }
  }

  // 3. Nur volle Stunde (z.B. "12", "9", "12 Uhr")
  const matchHourOnly = cleaned.match(/^(\d{1,2})$/);
  if (matchHourOnly) {
    const h = parseInt(matchHourOnly[1], 10);
    if (h >= 0 && h <= 23) {
      return {
        time: `${String(h).padStart(2, '0')}:00`,
        isCalculated: false
      };
    }
  }

  // 4. Intelligenter Fallback: Benutzer hat eine Restzeit eingegeben (z.B. "4h 30m", "4h", "45m", "3 Std 15 Min")
  const remaining = parseRemainingTime(inputStr);
  if (remaining && remaining.totalMinutes > 0) {
    const calculated = calculateWarEndTimeFromRemaining(remaining.totalMinutes, timezone);
    return {
      time: calculated,
      isCalculated: true,
      remainingMinutes: remaining.totalMinutes,
      rawRemaining: inputStr.trim()
    };
  }

  return null;
}

export const data = new SlashCommandBuilder()
  .setName('settime')
  .setDescription('Passt die Uhrzeit für das Kriegsende manuell an (z.B. 12:00, 9:30, 11.30 oder 10 Uhr).')
  .addStringOption((option) =>
    option
      .setName('uhrzeit')
      .setDescription('Uhrzeit (z.B. 12:00, 09:30, 11.30 oder 10 Uhr)')
      .setRequired(true)
  );

export async function execute(interaction) {
  const input = interaction.options.getString('uhrzeit');
  const settings = getGuildSettings(interaction.guildId);
  const parsed = parseSetTimeInput(input, settings.timezone || 'Europe/Berlin');

  if (!parsed) {
    return await interaction.reply({
      content:
        '❌ **Ungültiges Zeitformat!**\n' +
        'Bitte gib die Uhrzeit z. B. als `12:00`, `9:30`, `11.30` oder `12 Uhr` an.\n' +
        '*(Tipp: Wenn du die noch verbleibende Restzeit angeben willst, nutze `/setremainingtime` oder z. B. `/settime 4h 30m`)*',
      ephemeral: true
    });
  }

  const inputTime = parsed.time;

  // In Datenbank speichern
  const updated = saveGuildSettings(interaction.guildId, { war_end_time: inputTime });

  // Cron-Scheduler sofort auf die neue Zeit aktualisieren
  scheduleGuildWarEnd(interaction.client, interaction.guildId, inputTime, updated.timezone || 'Europe/Berlin');

  let replyText =
    `✅ **Kriegsende-Zeit aktualisiert!**\n` +
    `Der tägliche Abschlussbericht wird nun um **${inputTime} Uhr** (${updated.timezone || 'Europe/Berlin'}) ausgeführt.`;

  if (parsed.isCalculated) {
    replyText += `\n*(ℹ️ Automatisch berechnet aus deiner Restzeit-Angabe "${parsed.rawRemaining}")*`;
  }

  await interaction.reply({ content: replyText });
}
