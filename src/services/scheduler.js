import cron from 'node-cron';
import { getAllGuildSettings, getGuildSettings } from './database.js';
import { executeWarReport } from './reportService.js';
import { config } from '../config.js';

// Map: guildId -> cron.ScheduledTask
const activeJobs = new Map();

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
 * Registriert oder aktualisiert den Cron-Job für einen Server
 */
export function scheduleGuildWarEnd(client, guildId, timeStr, timezone = config.timezone) {
  // Alten Job stoppen falls vorhanden
  if (activeJobs.has(guildId)) {
    activeJobs.get(guildId).stop();
    activeJobs.delete(guildId);
  }

  const cronExpr = timeToCronExpression(timeStr);

  const job = cron.schedule(
    cronExpr,
    async () => {
      console.log(`[Scheduler] Kriegsende erreicht für Server ${guildId} (${timeStr} ${timezone}). Starte Berichtsprüfung...`);
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
        console.error(`[Scheduler Fehler auf Server ${guildId}]:`, err);
      }
    },
    {
      timezone: timezone || 'Europe/Berlin'
    }
  );

  activeJobs.set(guildId, job);
  console.log(`[Scheduler] Kriegsende-Job für Server ${guildId} registriert: "${cronExpr}" (${timezone})`);
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
  for (const [guildId, job] of activeJobs.entries()) {
    job.stop();
  }
  activeJobs.clear();
  console.log('[Scheduler] Alle Zeitpläne gestoppt.');
}
