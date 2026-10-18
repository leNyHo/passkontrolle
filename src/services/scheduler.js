import cron from 'node-cron';
import {
  getAllGuildSettings,
  getGuildSettings,
  getPendingTimeCheckReminders,
  acknowledgeTimeCheckReminder,
  updateTimeCheckReminderMessage
} from './database.js';
import { executeWarReport } from './reportService.js';
import { createTimeCheckReminderEmbed } from '../utils/embeds.js';
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
 * Registriert oder aktualisiert den Cron-Job für den Abschlussbericht eines Servers
 */
export function scheduleGuildWarEnd(client, guildId, timeStr, timezone = config.timezone) {
  // Alten Job stoppen falls vorhanden
  if (activeJobs.has(guildId)) {
    activeJobs.get(guildId).stop();
    activeJobs.delete(guildId);
  }

  const effectiveTimezone = timezone || 'Europe/Berlin';
  const reportCronExpr = timeToCronExpression(timeStr);

  // Abschlussbericht-Job (exakt zum eingestellten Kriegsende)
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

  activeJobs.set(guildId, reportJob);
  console.log(`[Scheduler] Server ${guildId}: Abschlussbericht um ${timeStr} ("${reportCronExpr}") [${effectiveTimezone}]`);
}

/**
 * Überprüft ausstehende Zeitüberprüfungs-Erinnerungen.
 * - Wurde mit ✅ reagiert: Als bestätigt markieren.
 * - Nach 24h noch nicht bestätigt: Erneut an die Rolle senden.
 */
export async function checkPendingTimeReminders(client, now = Date.now()) {
  const pending = getPendingTimeCheckReminders(now);
  if (!pending || pending.length === 0) return [];

  console.log(`[Reminder-Check] Prüfe ${pending.length} ausstehende Zeitüberprüfungs-Erinnerungen...`);
  const processed = [];

  for (const reminder of pending) {
    try {
      const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
      if (!channel) {
        console.warn(`[Reminder-Check] Kanal ${reminder.channel_id} für Erinnerung #${reminder.id} nicht gefunden.`);
        continue;
      }

      // Versuche die bisherige Nachricht abzurufen
      let message = null;
      try {
        message = await channel.messages.fetch(reminder.message_id);
      } catch (mErr) {
        console.warn(`[Reminder-Check] Nachricht ${reminder.message_id} konnte nicht abgerufen werden:`, mErr.message);
      }

      // Prüfen, ob bereits mit ✅ reagiert wurde
      let acknowledgedBy = null;
      if (message) {
        const checkReaction = message.reactions?.cache?.get('✅');
        if (checkReaction) {
          const users = await checkReaction.users.fetch().catch(() => null);
          if (users) {
            const humanUser = users.find((u) => !u.bot);
            if (humanUser) {
              acknowledgedBy = humanUser.id;
            }
          }
        }
      }

      if (acknowledgedBy) {
        acknowledgeTimeCheckReminder(reminder.id, acknowledgedBy);
        console.log(`[Reminder-Check] Erinnerung #${reminder.id} wurde nachträglich durch User ${acknowledgedBy} mit ✅ bestätigt.`);
        processed.push({ id: reminder.id, action: 'acknowledged', userId: acknowledgedBy });
        continue;
      }

      // Noch nicht bestätigt und 24h sind vergangen: Erneuten Reminder senden!
      const settings = getGuildSettings(reminder.guild_id);
      const repeatEmbed = createTimeCheckReminderEmbed({
        roleId: reminder.role_id,
        warEndTime: settings.war_end_time,
        timezone: settings.timezone,
        isRepeat: true
      });

      const newMsg = await channel.send({
        content: `<@&${reminder.role_id}>`,
        embeds: [repeatEmbed]
      });

      await newMsg.react('✅').catch((rErr) => {
        console.warn(`[Reminder-Check] Konnte ✅ auf Nachricht ${newMsg.id} nicht setzen:`, rErr.message);
      });

      const nextRemindAt = Date.now() + 24 * 60 * 60 * 1000;
      const newRepeatCount = (reminder.repeat_count || 0) + 1;
      updateTimeCheckReminderMessage(reminder.id, newMsg.id, nextRemindAt, newRepeatCount);

      console.log(`[Reminder-Check] Erinnerung #${reminder.id} nach 24h wiederholt gesendet (Neue Msg ID: ${newMsg.id}, Wiederholung #${newRepeatCount}).`);
      processed.push({ id: reminder.id, action: 'repeated', newMessageId: newMsg.id, repeatCount: newRepeatCount });
    } catch (err) {
      console.error(`[Reminder-Check] Fehler bei Erinnerung #${reminder.id}:`, err);
    }
  }

  return processed;
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

  // Regelmäßige Prüfung für ausstehende 24h-Erinnerungen (alle 10 Minuten)
  const reminderCheckJob = cron.schedule('*/10 * * * *', async () => {
    try {
      await checkPendingTimeReminders(client);
    } catch (checkErr) {
      console.error('[Scheduler] Fehler bei checkPendingTimeReminders:', checkErr);
    }
  });
  activeJobs.set('__system_reminder_check__', reminderCheckJob);

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
