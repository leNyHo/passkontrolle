import { getGuildSettings, saveGuildSettings, recordMissedDecks, getKickCandidates, getPlayerStrikes } from './database.js';
import { getWarParticipation } from './clashRoyale.js';
import { createWarReportEmbed } from '../utils/embeds.js';

export function getTodayDateString(timezone = 'Europe/Berlin') {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date()); // Format: YYYY-MM-DD
}

export function getFormattedDateTime(timezone = 'Europe/Berlin') {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date());
}

/**
 * Erstellt den Clankriegs-Abschlussbericht
 * @param {object} client - Discord Client
 * @param {string} guildId - Server-ID
 * @param {object} options - { isTest: boolean, channelOverride: string|null, forceRun: boolean }
 */
export async function executeWarReport(client, guildId, options = {}) {
  const { isTest = false, channelOverride = null, forceRun = false } = options;
  const settings = getGuildSettings(guildId);

  if (!settings.clan_tag) {
    throw new Error('Es ist noch kein Clan-Tag hinterlegt. Bitte führe zuerst `/setclan [Clan-Tag]` aus.');
  }

  const channelId = channelOverride || settings.channel_id;
  if (!channelId) {
    throw new Error('Es ist noch kein Zielkanal hinterlegt. Bitte führe `/setchannel` im gewünschten Admin-Kanal aus.');
  }

  const targetChannel = await client.channels.fetch(channelId).catch((err) => {
    throw new Error(`Kanal mit ID ${channelId} konnte nicht gefunden werden oder Bot hat keine Berechtigung: ${err.message}`);
  });

  const todayDateStr = getTodayDateString(settings.timezone);

  // Doppelte Ausführung am selben Tag verhindern (außer bei explizitem Testlauf oder Force)
  if (!isTest && !forceRun && settings.last_report_date === todayDateStr) {
    console.log(`[Report] Für Server ${guildId} wurde heute (${todayDateStr}) bereits ein Abschlussbericht erstellt. Überspringe.`);
    return { skipped: true, reason: 'Already executed today' };
  }

  // Live-Clankriegsdaten abrufen
  const warData = await getWarParticipation(settings.clan_tag);

  // An Clankriegstagen (warDay / colosseum) prüfen; Trainingstage überspringen, außer bei Test/Force
  const isWarDay = warData.periodType === 'warDay' || warData.periodType === 'colosseum';
  if (!isWarDay && !isTest && !forceRun) {
    console.log(`[Report] Heute ist ein Trainingstag (${warData.periodType}). Clankriegsbericht wird nur an Clankriegstagen erstellt.`);
    return { skipped: true, reason: `Kein Clankriegstag (aktuell: ${warData.periodType})` };
  }

  // Wenn kein Test: Strafpunkte in SQLite-Datenbank persistieren
  if (!isTest) {
    for (const player of warData.incomplete) {
      recordMissedDecks(
        guildId,
        warData.clanTag,
        todayDateStr,
        player.tag,
        player.name,
        player.missedDecks
      );
    }

    saveGuildSettings(guildId, { last_report_date: todayDateStr });
  }

  // Daten anreichern: Gesamt-Fehlangriffe jedes unvollständigen Spielers ermitteln
  const enrichedIncomplete = warData.incomplete.map((player) => {
    const strikeInfo = getPlayerStrikes(player.tag);
    return {
      ...player,
      totalMissed: strikeInfo ? strikeInfo.total_missed_decks : player.missedDecks
    };
  });

  // Kick-Kandidaten aus der SQLite-Datenbank ermitteln (Threshold >= 5)
  const kickCandidates = getKickCandidates(5);

  const embed = createWarReportEmbed({
    clanName: warData.clanName,
    clanTag: warData.clanTag,
    periodType: warData.periodType,
    incompleteList: enrichedIncomplete,
    completedCount: warData.completedCount,
    totalMembers: warData.totalMembers,
    kickCandidates,
    warningMessage: settings.warning_message,
    dateStr: getFormattedDateTime(settings.timezone),
    isTest
  });

  await targetChannel.send({ embeds: [embed] });

  return {
    success: true,
    channelId,
    incompleteCount: warData.incomplete.length,
    kickCandidateCount: kickCandidates.length,
    embed
  };
}
