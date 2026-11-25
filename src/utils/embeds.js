import { EmbedBuilder } from 'discord.js';
import { sanitizePublicText } from './sanitize.js';

export const COLORS = {
  SUCCESS_GREEN: 0x2ECC71,
  WARNING_ORANGE: 0xE67E22,
  DANGER_RED: 0xE74C3C,
  INFO_BLUE: 0x3498DB,
  NEUTRAL_DARK: 0x2C3E50
};

/**
 * Hilfsfunktion zur Aufteilung von Textlisten in Embed-Fields (max. 1024 Zeichen pro Field)
 * Verwendet ein unsichtbares Zeichen (\u200b) für Folgeblöcke anstelle von "(Fortsetzung X)"
 */
function splitIntoFields(builder, fieldTitle, lines, emptyText) {
  if (!lines || lines.length === 0) {
    builder.addFields({ name: fieldTitle, value: emptyText, inline: false });
    return;
  }

  let currentChunk = '';
  let isFirst = true;

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > 1000) {
      builder.addFields({
        name: isFirst ? fieldTitle : '\u200b',
        value: currentChunk,
        inline: false
      });
      currentChunk = '';
      isFirst = false;
    }
    currentChunk += (currentChunk ? '\n' : '') + line;
  }

  if (currentChunk.length > 0) {
    builder.addFields({
      name: isFirst ? fieldTitle : '\u200b',
      value: currentChunk,
      inline: false
    });
  }
}

/**
 * Erstellt das Embed für den täglichen Abschlussbericht
 */
export function createWarReportEmbed({
  clanName,
  clanTag,
  periodType,
  incompleteList = [],
  completedCount = 0,
  totalMembers = 0,
  kickCandidates = [],
  dateStr = '',
  isTest = false
}) {
  const hasIncomplete = incompleteList.length > 0;
  const hasKicks = kickCandidates.length > 0;

  let color = COLORS.SUCCESS_GREEN;
  if (hasKicks) {
    color = COLORS.DANGER_RED;
  } else if (hasIncomplete) {
    color = COLORS.WARNING_ORANGE;
  }

  const prefix = isTest ? '🧪 [TEST-MODUS] ' : '⚔️ ';
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${prefix}Clankriegs-Abschlussbericht – ${clanName}`)
    .setDescription(
      `**Clan-Tag:** \`${clanTag}\` | **Datum:** ${dateStr} (Europe/Berlin)\n` +
      `**Kriegsphase:** \`${periodType}\` | **Abschlussquote:** ${completedCount}/${totalMembers} Spieler (100% Decks)`
    )
    .setTimestamp();

  // 1. Unvollständige Spieler heute
  const incompleteLines = incompleteList.map((player) => {
    const totalText = player.totalMissed != null ? ` *(Gesamt verpasst: **${player.totalMissed}**)*` : '';
    return `• **${player.name}**: **${player.missedDecks}/4** Decks verpasst${totalText}`;
  });

  splitIntoFields(
    embed,
    `⚠️ Unvollständige Angriffe heute (${incompleteList.length} Spieler)`,
    incompleteLines,
    '🎉 **Perfekt!** Alle Clanmitglieder haben heute ihre 4 Angriffe absolviert!'
  );

  // 2. Kick-Vorschläge (ab 5+ verpasste Decks)
  const kickLines = kickCandidates.map((c) => {
    return `🚨 **${c.player_name}** – **${c.total_missed_decks} verpasste Decks** gesamt (Zuletzt: ${c.last_missed_date || 'k.A.'})`;
  });

  splitIntoFields(
    embed,
    `🔨 Kick-Vorschläge (5+ verpasste Decks gesammelt)`,
    kickLines,
    '✅ **Keine Kick-Kandidaten.** Kein Mitglied hat aktuell 5 oder mehr verpasste Decks.'
  );

  embed.setFooter({
    text: isTest
      ? 'Clash Royale Admin Bot • Manueller Testlauf'
      : 'Clash Royale Admin Bot • Täglicher automatischer Abschlussbericht'
  });

  return embed;
}

/**
 * Erstellt das Live-Status-Embed für /angriffe
 */
export function createStatusEmbed({
  clanName,
  clanTag,
  periodType,
  completedCount,
  incompleteCount,
  totalMembers,
  totalMissedToday,
  incompleteList = []
}) {
  const percentage = totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0;
  const isComplete = incompleteCount === 0;

  const embed = new EmbedBuilder()
    .setColor(isComplete ? COLORS.SUCCESS_GREEN : COLORS.INFO_BLUE)
    .setTitle(`📊 Aktueller Clankriegs-Status – ${clanName}`)
    .setDescription(
      `**Clan-Tag:** \`${clanTag}\` | **Phase:** \`${periodType}\`\n` +
      `**Fortschritt:** ${completedCount}/${totalMembers} Spieler fertig (${percentage}%)\n` +
      `**Heute noch offen:** ${totalMissedToday} Decks`
    )
    .setTimestamp();

  if (isComplete) {
    embed.addFields({
      name: 'Status',
      value: '🎉 Alle Mitglieder haben ihre 4 Angriffe für heute bereits abgeschlossen!',
      inline: false
    });
  } else {
    // Zeigt nur die @Namen der noch ausstehenden Spieler ohne Deck-Zahlen dahinter
    const lines = incompleteList.map((player) => {
      const name = player.name || 'Unbekannt';
      return `@${name}`;
    });

    splitIntoFields(
      embed,
      `⏳ Noch ausstehende Angriffe (${incompleteCount} Spieler)`,
      lines,
      '🎉 Alle Mitglieder haben ihre 4 Angriffe für heute bereits abgeschlossen!'
    );
  }

  embed.setFooter({ text: 'Clash Royale Admin Bot • Live-Abfrage via /angriffe' });
  return embed;
}

/**
 * Erstellt das Embed für die Verwarnungen-Übersicht (/verwarnungen)
 */
export function createStrikesEmbed({ strikesList = [], threshold = 5, prunedCount = 0 }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO_BLUE)
    .setTitle('📋 Übersicht der verpassten Clankriegs-Decks (Verwarnungen)');

  let desc = `Spieler mit **${threshold} oder mehr** verpassten Decks sind für einen Kick vorgemerkt.`;
  if (prunedCount > 0) {
    desc += `\n*(ℹ️ **${prunedCount}** ausgetretene(r) Spieler automatisch aus der Liste bereinigt)*`;
  }

  embed.setDescription(desc).setTimestamp();

  if (strikesList.length === 0) {
    embed.addFields({
      name: 'Status',
      value: '✅ Die Historie ist sauber! Keine registrierten verpassten Decks.',
      inline: false
    });
  } else {
    // 1. Liste aller registrierten Spieler (inklusive Player-Tag)
    const lines = strikesList.map((s, idx) => {
      const isKick = s.total_missed_decks >= threshold;
      const marker = isKick ? '🚨 **[KICK-KANDIDAT]** ' : '⚠️ ';
      const tagStr = s.player_tag ? ` (\`${s.player_tag}\`)` : '';
      return `${idx + 1}. ${marker}**${s.player_name}**${tagStr}: **${s.total_missed_decks}** Decks verpasst (Zuletzt: ${s.last_missed_date || 'k.A.'})`;
    });

    splitIntoFields(embed, `Registrierte Spieler (${strikesList.length})`, lines, 'Keine Einträge');

    // 2. Neuer Abschnitt: Copy-Paste Nachricht für den Clan (ohne Code-Block / ''' )
    // Ermittle das aktuellste Verwarn-Datum
    const latestDate = strikesList.reduce((max, s) => {
      return s.last_missed_date && s.last_missed_date > max ? s.last_missed_date : max;
    }, '');

    // Bevorzuge Spieler vom aktuellsten Verwarntag ("neu verwarnte Mitglieder"), sonst alle
    const newlyWarned = latestDate
      ? strikesList.filter((s) => s.last_missed_date === latestDate)
      : strikesList;

    const maxStrikeNameLen = Math.max(...newlyWarned.map((p) => (p.player_name || '').length), 8);
    const copyLines = newlyWarned.map((p) => {
      const isKick = p.total_missed_decks >= threshold;
      const kickTag = isKick ? ' 🚨 [KICK]' : '';
      const missedNow = p.last_missed_decks || p.total_missed_decks;
      const decksWord = missedNow === 1 ? 'Deck' : 'Decks';
      const name = p.player_name || 'Unbekannt';
      const tagStr = p.player_tag ? ` (${p.player_tag})` : '';
      const diff = Math.max(0, maxStrikeNameLen - name.length);
      const spaceCount = Math.max(2, Math.round(diff * 1.8) + 4);
      const padding = ' '.repeat(spaceCount);
      return `@${name}${tagStr}${padding}(${missedNow} ${decksWord} verpasst – Gesamt: ${p.total_missed_decks}/${threshold}${kickTag})`;
    });

    const headerNote = latestDate ? ` (Stand: ${latestDate})` : '';
    const clanMessageLines = [
      `⚠️ Clankriegs-Verwarnung${headerNote}:`,
      `Folgende Spieler haben Decks verpasst und erhalten eine Verwarnung:`,
      '',
      ...copyLines,
      '',
      `Ab ${threshold} verpassten Decks erfolgt der Kick. Bitte holt eure Angriffe im nächsten Clankrieg nach!`
    ];

    splitIntoFields(
      embed,
      `📢 Copy-Paste Clan-Nachricht (Neu verwarnte Mitglieder: ${newlyWarned.length})`,
      clanMessageLines,
      'Keine neuen Verwarnungen.'
    );
  }

  embed.setFooter({ text: 'Clash Royale Admin Bot • Verwarnungen-Datenbank' });
  return embed;
}

/**
 * Erstellt das Embed für die Montags-Erinnerung zur Überprüfung der Clankriegs-Uhrzeit
 */
export function createTimeCheckReminderEmbed({
  roleId,
  warEndTime = '12:00',
  timezone = 'Europe/Berlin',
  isRepeat = false
}) {
  const embed = new EmbedBuilder()
    .setColor(isRepeat ? COLORS.WARNING_ORANGE : COLORS.INFO_BLUE)
    .setTitle(
      isRepeat
        ? '⚠️ Erinnerung: Clankriegs-Uhrzeit überprüfen!'
        : '⏰ Clankriegs-Woche beendet: Zeitüberprüfung erforderlich'
    )
    .setDescription(
      `Der Clankrieg für diese Woche ist offiziell beendet!\n\n` +
      `👉 **Bitte überprüft die Clankriegs-Uhrzeit für die kommende Woche:**\n` +
      `Aktuell eingestellt: **${warEndTime} Uhr** (${timezone})\n\n` +
      `• Falls sich die Endzeit ändert, passt sie bitte mit \`/settime [HH:MM]\` an.\n` +
      `• **Wichtig:** Bitte reagiert mit einem grünen Haken (**✅**) auf diese Nachricht, sobald die Zeit überprüft wurde!\n\n` +
      (isRepeat
        ? `⚠️ *Dies ist eine erneute Erinnerung, da nach 24 Stunden noch keine Bestätigung mit ✅ erfolgte.*`
        : `*Erfolgt innerhalb von 24 Stunden keine Reaktion mit ✅, wird diese Erinnerung automatisch wiederholt.*`)
    )
    .setFooter({ text: 'Clash Royale Bot • Clankriegs-Zeitüberprüfung' })
    .setTimestamp();

  return embed;
}

function truncateText(text, maxLen = 180) {
  if (!text) return '*(leer)*';
  const clean = String(text).replace(/\r?\n/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 3)}...` : clean;
}

/**
 * Erstellt das Datenschutz-sichere Diagnose- & Konfigurations-Embed für /adminconfig.
 * Gibt keinerlei sensible Serverdaten (IPs, Tokens, Pfade, Hostnames, E-Mails, fremde Server) aus.
 */
export function createAdminConfigEmbed({
  isBotReady = false,
  discordPingMs = null,
  uptimeText = 'k.A.',
  hasDiscordToken = false,
  apiHealth = {},
  clanTag = null,
  channelId = null,
  channelPermissions = { exists: false, canView: false, canSend: false, canEmbed: false, missing: [] },
  allowedRoleId = null,
  reminderRoleId = null,
  warEndTime = '12:00',
  timezone = 'Europe/Berlin',
  schedulerStatus = {},
  nextRunLabel = 'k.A.',
  lastReportDate = null,
  executedToday = false,
  dbDiagnostics = {},
  reminderPrefix = '',
  reminderSuffix = ''
}) {
  const isApiConnected = Boolean(apiHealth.connected);
  const isSchedulerActive = Boolean(schedulerStatus.isJobRegistered);
  const isChannelReady = Boolean(
    channelId &&
      channelPermissions.exists &&
      channelPermissions.canView &&
      channelPermissions.canSend &&
      channelPermissions.canEmbed
  );
  const isDbOk = Boolean(dbDiagnostics.dbConnected && dbDiagnostics.dbWritable);
  const isDiskOk = dbDiagnostics.diskSpaceOk !== false;

  const blockers = [];
  if (!isBotReady) blockers.push('`isBotReady` ist `False`');
  if (!apiHealth.hasApiKey) blockers.push('Kein Clash Royale API-Key hinterlegt');
  else if (!isApiConnected) blockers.push('Clash Royale API nicht erreichbar / 403');
  if (!clanTag) blockers.push('Kein Clan-Tag konfiguriert (`/setclan`)');
  else if (isApiConnected && apiHealth.clanFound === false) blockers.push('Clan-Tag bei API nicht gefunden (404)');
  if (!channelId) blockers.push('Kein Report-Kanal gesetzt (`/setchannel`)');
  else if (!channelPermissions.exists) blockers.push('Verknüpfter Report-Kanal existiert nicht mehr');
  else if (!isChannelReady) blockers.push(`Fehlende Rechte im Kanal (${(channelPermissions.missing || []).join(', ')})`);
  if (!isSchedulerActive) blockers.push('Scheduler-Cronjob nicht aktiv');
  if (!isDbOk) blockers.push('Datenbank nicht les- oder schreibbar');
  if (!isDiskOk) blockers.push('Speicherplatz auf Server kritisch (< 50 MB frei)');

  const isAutoReportReady = blockers.length === 0;

  let color = COLORS.SUCCESS_GREEN;
  if (!isApiConnected || !isDbOk || !isDiskOk || !isBotReady) {
    color = COLORS.DANGER_RED;
  } else if (!isAutoReportReady) {
    color = COLORS.WARNING_ORANGE;
  }

  let statusSummary = `**Automatische Reports betriebsbereit:** \`${isAutoReportReady ? 'True' : 'False'}\``;
  if (blockers.length > 0) {
    statusSummary += `\n⚠️ **Erkannte Probleme:**\n${blockers.map((b) => `• ${b}`).join('\n')}`;
  } else if (apiHealth.periodType && apiHealth.periodType !== 'warDay' && apiHealth.periodType !== 'colosseum') {
    statusSummary += `\nℹ️ *Hinweis: Aktuell läuft ein Trainingstag (\`${apiHealth.periodType}\`) – automatische Berichte pausieren Mo–Mi und laufen ab Do wieder.*`;
  }

  let permText = '—';
  if (channelId) {
    if (!channelPermissions.exists) {
      permText = '❌ Kanal nicht gefunden oder Bot hat keinen Zugriff';
    } else if (isChannelReady) {
      permText = '✅ OK (Ansehen, Senden, Embeds)';
    } else {
      permText = `❌ Fehlend: ${(channelPermissions.missing || []).join(', ') || 'Unbekannt'}`;
    }
  }

  let diskSpaceLabel = '`Unbekannt`';
  if (dbDiagnostics.diskSpaceOk === true) {
    diskSpaceLabel =
      dbDiagnostics.diskUsedPercent != null
        ? `\`True\` (Belegt: ${dbDiagnostics.diskUsedPercent}%)`
        : '`True`';
  } else if (dbDiagnostics.diskSpaceOk === false) {
    diskSpaceLabel =
      dbDiagnostics.diskUsedPercent != null
        ? `\`False\` ⚠️ Kritisch voll (${dbDiagnostics.diskUsedPercent}% belegt!)`
        : '`False` ⚠️ Kritisch voll!';
  }

  const isWarDay = apiHealth.periodType === 'warDay' || apiHealth.periodType === 'colosseum';
  const apiLines = [
    `**mitClashRoyaleApiVerbunden:** \`${isApiConnected ? 'True' : 'False'}\``,
    `**API-Key hinterlegt:** \`${apiHealth.hasApiKey ? 'True' : 'False'}\``,
    `**API-Status:** ${sanitizePublicText(apiHealth.statusText || 'Unbekannt')}`,
    `**API-Latenz:** ${apiHealth.latencyMs != null ? `\`${apiHealth.latencyMs} ms\`` : '`k.A.`'}`,
    `**Clan-Tag:** ${clanTag ? `\`${clanTag}\`${apiHealth.clanName ? ` (${sanitizePublicText(apiHealth.clanName)})` : ''}` : '❌ Nicht gesetzt (`/setclan`)'}`
  ];

  if (apiHealth.periodType) {
    apiLines.push(
      `**Aktuelle Kriegsphase:** \`${apiHealth.periodType}\` (${isWarDay ? '✅ Kriegstag' : 'ℹ️ Trainingstag'})`
    );
  }
  if (apiHealth.totalMembers != null) {
    apiLines.push(`**Live-Fortschritt:** ${apiHealth.completedCount}/${apiHealth.totalMembers} Spieler fertig`);
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🛠️ Admin-Diagnose & Konfiguration')
    .setDescription(statusSummary)
    .addFields(
      {
        name: '🤖 Bot & Discord',
        value:
          `**isBotReady:** \`${isBotReady ? 'True' : 'False'}\`\n` +
          `**Discord Ping:** ${discordPingMs != null ? `\`${discordPingMs} ms\`` : '`k.A.`'}\n` +
          `**Uptime:** \`${uptimeText}\`\n` +
          `**Discord-Token konfiguriert:** \`${hasDiscordToken ? 'True' : 'False'}\``,
        inline: true
      },
      {
        name: '📢 Verknüpfte Kanäle & Rollen',
        value:
          `**Report-Kanal:** ${channelId ? `<#${channelId}>` : '❌ Nicht gesetzt (`/setchannel`)'}\n` +
          `**Kanal-Rechte:** ${permText}\n` +
          `**Erlaubte Rolle:** ${allowedRoleId ? `<@&${allowedRoleId}>` : 'Nur Owner / Admins'}\n` +
          `**Montags-Reminder:** ${reminderRoleId ? `<@&${reminderRoleId}>` : 'Deaktiviert'}`,
        inline: true
      },
      {
        name: '⚔️ Clash Royale API',
        value: apiLines.join('\n'),
        inline: false
      },
      {
        name: '⏰ Report-Zeitplan & Scheduler',
        value:
          `**Report-Uhrzeit:** **${warEndTime} Uhr** (${timezone})\n` +
          `**isSchedulerActive:** \`${isSchedulerActive ? 'True' : 'False'}\`${schedulerStatus.cronExpr ? ` (\`${schedulerStatus.cronExpr}\`)` : ''}\n` +
          `**Nächster geplanter Lauf:** ${nextRunLabel}\n` +
          `**Letzter Auto-Report:** ${lastReportDate ? `\`${lastReportDate}\`` : 'Noch keiner'}\n` +
          `**Heute bereits ausgeführt:** \`${executedToday ? 'True' : 'False'}\`\n` +
          `**24h-Reminder-Check aktiv:** \`${schedulerStatus.isGlobalReminderCheckActive ? 'True' : 'False'}\``,
        inline: true
      },
      {
        name: '💾 Datenbank & Speicher',
        value:
          `**Datenbank verbunden:** \`${dbDiagnostics.dbConnected ? 'True' : 'False'}\`\n` +
          `**Datenbank schreibbar:** \`${dbDiagnostics.dbWritable ? 'True' : 'False'}\`\n` +
          `**Speicherplatz OK:** ${diskSpaceLabel}\n` +
          `**Verwarnungen (Clan):** ${dbDiagnostics.strikeCount ?? 0} Spieler (${dbDiagnostics.kickCandidateCount ?? 0} Kick-Kandidaten)\n` +
          `**Offene Zeit-Erinnerungen:** ${dbDiagnostics.openRemindersCount ?? 0}`,
        inline: true
      },
      {
        name: '📝 Erinnerungstexte (/seterinnerung)',
        value:
          `**Einleitungstext:** ${truncateText(sanitizePublicText(reminderPrefix), 160)}\n` +
          `**Schlusstext:** ${truncateText(sanitizePublicText(reminderSuffix), 160)}`,
        inline: false
      }
    )
    .setFooter({ text: 'Clash Royale Admin Bot • Datenschutz-gefilterte Diagnose (ohne IPs, Keys & Pfade)' })
    .setTimestamp();

  return embed;
}
