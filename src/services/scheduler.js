import cron from 'node-cron';
import { getAllGuildSettings, getGuildSettings } from './database.js';
import { executeWarReport, executeWarReminder } from './reportService.js';
import { config } from '../config.js';

// Map: guildId -> { reportJob: cron.ScheduledTask, reminderJob: cron.ScheduledTask }
const activeJobs = new Map();

/**
 * Berechnet die Uhrzeit 1 Minute vor einer angegebenen Zeit (z.B. "12:00" -> "11:59")
 */
export function getOneMinuteBefore(timeStr) {
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return '11:59';

  let hours = parseInt(parts[0], 10);
  let minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '11:59';
  }

  minutes -= 1;
  if (minutes < 0) {
    minutes = 59;
    hours = (hours - 1 + 24) % 24;
  }

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
}

/**
 * Wandelt "HH:MM" in eine Cron-Expression um (z.B. "12:00" -> "0 12 * * *")
 */
export function timeToCronExpression(timeStr) {
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return '0 12 * * *';

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '0 12 * * *';
  }

  return `${minutes} ${hours} * * *`;
}

/**
 * Registriert oder aktualisiert die Cron-Jobs (Reminder & Report) für einen Server
 */
export function scheduleGuildWarEnd(client, guildId, timeStr, timezone = config.timezone) {
  // Alte Jobs stoppen falls vorhanden
  if (activeJobs.has(guildId)) {
    const existing = activeJobs.get(guildId);
    existing.reportJob?.stop();
    existing.reminderJob?.stop();
    activeJobs.delete(guildId);
  }

  const effectiveTimezone = timezone || 'Europe/Berlin';
  const reminderTimeStr = getOneMinuteBefore(timeStr);
  const reminderCronExpr = timeToCronExpression(reminderTimeStr);
  const reportCronExpr = timeToCronExpression(timeStr);

  // 1. Reminder-Job (1 Minute vor Kriegsende)
  const reminderJob = cron.schedule(
    reminderCronExpr,
    async () => {
      console.log(`[Scheduler] 1 Minute vor Kriegsende für Server ${guildId} (${reminderTimeStr} ${effectiveTimezone}). Sende automatische Erinnerung...`);
      try {
        const result = await executeWarReminder(client, guildId);
        if (result.skipped) {
          console.log(`[Scheduler] Reminder für Server ${guildId} übersprungen: ${result.reason}`);
        } else {
          console.log(`[Scheduler] Reminder für Server ${guildId} erfolgreich versendet!`);
        }
      } catch (err) {
        console.error(`[Scheduler Reminder-Fehler auf Server ${guildId}]:`, err);
      }
    },
    { timezone: effectiveTimezone }
  );

  // 2. Report-Job (exakt zum Kriegsende)
  const reportJob = cron.schedule(
    reportCronExpr,
    async () => {
      console.log(`[Scheduler] Kriegsende erreicht für Server ${guildId} (${timeStr} ${effectiveTimezone}). Starte Abschlussbericht...`);
      try {
        const settings = getGuildSettings(guildId);
        if (!settings.clan_tag || !settings.channel_id) {
          console.warn(`[Scheduler] Server ${guildId} hat keinen Clan-Tag oder Zielkanal konfiguriert. Überspringe.`);
          return;
        }

        const result = await executeWarReport(client, guildId);
        if (result.skipped) {
          console.log(`[Scheduler] Bericht für Server ${guildId} wurde übersprungen: ${result.reason}`);
        } else {
          console.log(`[Scheduler] Bericht erfolgreich an Kanal ${result.channelId} gesendet!`);
        }
      } catch (err) {
        console.error(`[Scheduler Report-Fehler auf Server ${guildId}]:`, err);
      }
    },
    { timezone: effectiveTimezone }
  );

  activeJobs.set(guildId, { reportJob, reminderJob });
  console.log(`[Scheduler] Server ${guildId}: Reminder um ${reminderTimeStr} ("${reminderCronExpr}"), Report um ${timeStr} ("${reportCronExpr}") [${effectiveTimezone}]`);
}

/**
 * Initialisiert alle Scheduler beim Bot-Start für alle bekannten Server
 */
export function initScheduler(client) {
  console.log('[Scheduler] Initialisiere Clankriegs-Zeitpläne...');

  // Alle konfigurierten Guilds aus der Datenbank laden
  const dbSettings = getAllGuildSettings();
  const configuredGuildIds = new Set(dbSettings.map((s) => s.guild_id));

  for (const setting of dbSettings) {
    scheduleGuildWarEnd(client, setting.guild_id, setting.war_end_time || '12:00', setting.timezone || 'Europe/Berlin');
  }

  // Falls der Bot auf Servern ist, die noch nicht in der DB stehen, mit Default 12:00 registrieren
  for (const guild of client.guilds.cache.values()) {
    if (!configuredGuildIds.has(guild.id)) {
      scheduleGuildWarEnd(client, guild.id, config.defaultWarEndTime, config.timezone);
    }
  }

  console.log(`[Scheduler] ${activeJobs.size} Server-Zeitpläne erfolgreich aktiv.`);
}

/**
 * Stoppt alle aktiven Cron-Jobs (für graceful shutdown)
 */
export function stopAllSchedulers() {
  for (const [guildId, jobs] of activeJobs.entries()) {
    jobs.reportJob?.stop();
    jobs.reminderJob?.stop();
  }
  activeJobs.clear();
  console.log('[Scheduler] Alle Zeitpläne gestoppt.');
}
