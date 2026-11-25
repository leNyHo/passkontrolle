import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { getGuildSettings, getDatabaseDiagnostics } from '../services/database.js';
import { checkApiHealth } from '../services/clashRoyale.js';
import { getSchedulerStatus, timeToCronExpression } from '../services/scheduler.js';
import { getTodayDateString } from '../services/reportService.js';
import { createAdminConfigEmbed } from '../utils/embeds.js';
import { sanitizePublicText } from '../utils/sanitize.js';

export function formatUptime(seconds) {
  const totalSec = Math.max(0, Math.floor(seconds || 0));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function getNextRunDisplay(warEndTime = '12:00', timezone = 'Europe/Berlin', now = new Date()) {
  const cronExpr = timeToCronExpression(warEndTime);
  const [minStr, hourStr] = cronExpr.split(' ');
  const targetMinutes = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);

  const curHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const curMin = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const currentMinutes = curHour * 60 + curMin;

  const paddedTime = `${String(hourStr).padStart(2, '0')}:${String(minStr).padStart(2, '0')}`;
  return currentMinutes < targetMinutes ? `Heute, ${paddedTime} Uhr` : `Morgen, ${paddedTime} Uhr`;
}

export async function checkChannelPermissions(client, guildId, channelId) {
  if (!channelId || !client?.channels?.fetch) {
    return { exists: false, canView: false, canSend: false, canEmbed: false, missing: [] };
  }

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return { exists: false, canView: false, canSend: false, canEmbed: false, missing: [] };
    }

    let me = channel.guild?.members?.me || null;
    if (!me && client.guilds?.fetch && guildId && client.user?.id) {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      me = guild?.members?.me || (await guild?.members?.fetch?.(client.user.id).catch(() => null));
    }

    const perms = me && typeof channel.permissionsFor === 'function' ? channel.permissionsFor(me) : null;
    if (!perms || typeof perms.has !== 'function') {
      return { exists: true, canView: true, canSend: true, canEmbed: true, missing: [] };
    }

    const canView = perms.has(PermissionFlagsBits.ViewChannel);
    const canSend = perms.has(PermissionFlagsBits.SendMessages);
    const canEmbed = perms.has(PermissionFlagsBits.EmbedLinks);
    const missing = [];
    if (!canView) missing.push('Kanal ansehen');
    if (!canSend) missing.push('Nachrichten senden');
    if (!canEmbed) missing.push('Links einbetten');

    return { exists: true, canView, canSend, canEmbed, missing };
  } catch {
    return { exists: false, canView: false, canSend: false, canEmbed: false, missing: [] };
  }
}

export const data = new SlashCommandBuilder()
  .setName('adminconfig')
  .setDescription('Zeigt Systemstatus, API-Verbindung, Kanal-Verknüpfung & Report-Zeiten datenschutzsicher an.')
  .addBooleanOption((option) =>
    option
      .setName('oeffentlich')
      .setDescription('Sichtbar für alle im Kanal posten? (Standard: Nein, nur für dich sichtbar)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const isPublic = interaction.options?.getBoolean?.('oeffentlich') === true;
  await interaction.deferReply(isPublic ? {} : { flags: MessageFlags.Ephemeral });

  try {
    const settings = getGuildSettings(interaction.guildId);
    const timezone = settings.timezone || config.timezone || 'Europe/Berlin';
    const warEndTime = settings.war_end_time || config.defaultWarEndTime || '12:00';

    const [apiHealth, channelPermissions] = await Promise.all([
      checkApiHealth(settings.clan_tag),
      checkChannelPermissions(interaction.client, interaction.guildId, settings.channel_id)
    ]);

    const schedulerStatus = getSchedulerStatus(interaction.guildId);
    const dbDiagnostics = getDatabaseDiagnostics(interaction.guildId, settings.clan_tag);
    const todayDateStr = getTodayDateString(timezone);

    const wsPing = interaction.client?.ws?.ping;
    const discordPingMs = Number.isFinite(wsPing) && wsPing >= 0 ? Math.round(wsPing) : null;

    const embed = createAdminConfigEmbed({
      isBotReady: Boolean(interaction.client?.isReady?.()),
      discordPingMs,
      uptimeText: formatUptime(process.uptime()),
      hasDiscordToken: Boolean(config.discordToken),
      apiHealth,
      clanTag: settings.clan_tag,
      channelId: settings.channel_id,
      channelPermissions,
      allowedRoleId: settings.allowed_role_id,
      reminderRoleId: settings.reminder_role_id,
      warEndTime,
      timezone,
      schedulerStatus,
      nextRunLabel: getNextRunDisplay(warEndTime, timezone),
      lastReportDate: settings.last_report_date,
      executedToday: Boolean(settings.last_report_date && settings.last_report_date === todayDateStr),
      dbDiagnostics,
      reminderPrefix: settings.reminder_message,
      reminderSuffix: settings.reminder_suffix
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Fehler bei /adminconfig:', error);
    await interaction.editReply({
      content: `❌ **Fehler bei der Diagnose-Abfrage:**\n${sanitizePublicText(error?.message || 'Unbekannter Fehler')}`
    });
  }
}
