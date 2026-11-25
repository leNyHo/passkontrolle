import { config } from '../config.js';
import { sanitizePublicText } from '../utils/sanitize.js';

const BASE_URL = 'https://api.clashroyale.com/v1';

export function normalizeClanTag(tag) {
  if (!tag) return '';
  let clean = tag.trim().toUpperCase();
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }
  return clean;
}

export function encodeClanTag(tag) {
  const normalized = normalizeClanTag(tag);
  return encodeURIComponent(normalized);
}

async function apiFetch(endpoint) {
  if (!config.clashRoyaleApiKey) {
    throw new Error('CLASH_ROYALE_API_KEY ist nicht in den Umgebungsvariablen (.env) hinterlegt!');
  }

  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.clashRoyaleApiKey}`,
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }

    if (response.status === 403) {
      throw new Error(
        `[Clash Royale API 403 Forbidden] Zugriff verweigert! ` +
        `Überprüfe, ob dein API-Token korrekt ist und ob die externe IP-Adresse deines Servers im Supercell Developer Portal freigeschaltet wurde. (${errorDetail})`
      );
    } else if (response.status === 404) {
      throw new Error(`[Clash Royale API 404] Clan oder Ressource nicht gefunden. Bitte Clan-Tag prüfen. (${errorDetail})`);
    } else if (response.status === 503) {
      throw new Error(`[Clash Royale API 503] Supercell Server im Wartungsmodus (Maintenance). Bitte später erneut versuchen.`);
    } else {
      throw new Error(`[Clash Royale API Fehler ${response.status}]: ${errorDetail}`);
    }
  }

  return await response.json();
}

/**
 * Ruft die allgemeinen Clan-Details und die aktuelle Mitgliederliste ab
 */
export async function getClanInfo(clanTag) {
  const encoded = encodeClanTag(clanTag);
  return await apiFetch(`/clans/${encoded}`);
}

/**
 * Ruft den aktuellen Clankrieg (River Race) ab
 */
export async function getCurrentRiverRace(clanTag) {
  const encoded = encodeClanTag(clanTag);
  return await apiFetch(`/clans/${encoded}/currentriverrace`);
}

/**
 * Führt die Clan-Mitgliederliste und die River-Race-Teilnehmer zusammen
 * Ermittelt präzise, wer heute alle 4 Decks gespielt hat und wer wie viele verpasst hat.
 */
export async function getWarParticipation(clanTag) {
  const normalizedTag = normalizeClanTag(clanTag);

  // Parallele Abfragen für minimale Latenz
  const [clanInfo, raceData] = await Promise.all([
    getClanInfo(normalizedTag),
    getCurrentRiverRace(normalizedTag)
  ]);

  const memberList = clanInfo.memberList || [];
  const participants = raceData.clan?.participants || [];

  // Map der Teilnehmer aus dem aktuellen River Race nach Spieler-Tag
  const participantMap = new Map();
  for (const p of participants) {
    participantMap.set(p.tag, p);
  }

  const completed = [];
  const incomplete = [];
  let totalMissedToday = 0;

  for (const member of memberList) {
    const warEntry = participantMap.get(member.tag);
    const decksUsedToday = warEntry?.decksUsedToday ?? 0;
    const decksUsedTotal = warEntry?.decksUsed ?? 0;
    const fame = warEntry?.fame ?? 0;
    const missed = Math.max(0, 4 - decksUsedToday);

    const playerStatus = {
      tag: member.tag,
      name: member.name,
      role: member.role,
      decksUsedToday,
      decksUsedTotal,
      fame,
      missedDecks: missed,
      isComplete: missed === 0
    };

    if (missed === 0) {
      completed.push(playerStatus);
    } else {
      incomplete.push(playerStatus);
      totalMissedToday += missed;
    }
  }

  // Sortiere unvollständige Spieler: Wer am meisten verpasst hat zuerst, dann alphabetisch
  incomplete.sort((a, b) => b.missedDecks - a.missedDecks || a.name.localeCompare(b.name));
  completed.sort((a, b) => a.name.localeCompare(b.name));

  return {
    clanName: raceData.clan?.name || clanInfo.name,
    clanTag: normalizedTag,
    totalMembers: memberList.length,
    completedCount: completed.length,
    incompleteCount: incomplete.length,
    totalMissedToday,
    periodType: raceData.periodType || 'warDay', // 'warDay', 'training', 'colosseum'
    sectionIndex: raceData.sectionIndex ?? 0,
    completed,
    incomplete,
    clanScore: clanInfo.clanScore,
    badgeId: clanInfo.badgeId
  };
}

/**
 * Klassifiziert Clash-Royale-API-Fehler ohne sensible Server-IPs oder Tokens preiszugeben.
 */
function formatSafeApiError(error) {
  const msg = error?.message || '';
  if (msg.includes('403')) {
    return '403 Forbidden (API-Key ungültig oder aktuelle Server-IP nicht freigeschaltet)';
  }
  if (msg.includes('404')) {
    return '404 Not Found (Clan-Tag nicht gefunden)';
  }
  if (msg.includes('503')) {
    return '503 Maintenance (Supercell-Wartungsmodus)';
  }
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || msg.toLowerCase().includes('timed out')) {
    return 'Timeout (Supercell API antwortet nicht rechtzeitig)';
  }
  return sanitizePublicText(msg) || 'Unbekannter API-Fehler';
}

/**
 * Prüft die Live-Verbindung zur Clash Royale API (ohne sensible Daten wie Server-IPs offenzulegen).
 */
export async function checkApiHealth(clanTag = null) {
  const hasApiKey = Boolean(config.clashRoyaleApiKey);
  if (!hasApiKey) {
    return {
      hasApiKey: false,
      connected: false,
      clanFound: false,
      latencyMs: null,
      statusText: 'Kein API-Key konfiguriert',
      clanName: null,
      periodType: null,
      totalMembers: null,
      completedCount: null,
      incompleteCount: null
    };
  }

  const start = Date.now();
  try {
    if (clanTag) {
      const warData = await getWarParticipation(clanTag);
      return {
        hasApiKey: true,
        connected: true,
        clanFound: true,
        latencyMs: Date.now() - start,
        statusText: 'OK (Verbunden)',
        clanName: warData.clanName,
        periodType: warData.periodType,
        totalMembers: warData.totalMembers,
        completedCount: warData.completedCount,
        incompleteCount: warData.incompleteCount
      };
    }

    await apiFetch('/locations?limit=1');
    return {
      hasApiKey: true,
      connected: true,
      clanFound: false,
      latencyMs: Date.now() - start,
      statusText: 'OK (Verbunden, kein Clan-Tag gesetzt)',
      clanName: null,
      periodType: null,
      totalMembers: null,
      completedCount: null,
      incompleteCount: null
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const msg = error?.message || '';

    // Bei 404 prüfen, ob die API-Authentifizierung selbst grundsätzlich funktioniert
    if (clanTag && msg.includes('404')) {
      try {
        await apiFetch('/locations?limit=1');
        return {
          hasApiKey: true,
          connected: true,
          clanFound: false,
          latencyMs: Date.now() - start,
          statusText: 'API verbunden, aber Clan-Tag nicht gefunden (404)',
          clanName: null,
          periodType: null,
          totalMembers: null,
          completedCount: null,
          incompleteCount: null
        };
      } catch (fallbackErr) {
        return {
          hasApiKey: true,
          connected: false,
          clanFound: false,
          latencyMs: Date.now() - start,
          statusText: formatSafeApiError(fallbackErr),
          clanName: null,
          periodType: null,
          totalMembers: null,
          completedCount: null,
          incompleteCount: null
        };
      }
    }

    return {
      hasApiKey: true,
      connected: false,
      clanFound: false,
      latencyMs,
      statusText: formatSafeApiError(error),
      clanName: null,
      periodType: null,
      totalMembers: null,
      completedCount: null,
      incompleteCount: null
    };
  }
}
