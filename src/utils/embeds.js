import { EmbedBuilder } from 'discord.js';

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

  const lines = incompleteList.map((player) => {
    return `• **${player.name}**: ${player.decksUsedToday}/4 Decks (**${player.missedDecks} offen**)`;
  });

  splitIntoFields(
    embed,
    `⏳ Noch ausstehende Angriffe (${incompleteCount} Spieler)`,
    lines,
    '🎉 Alle Mitglieder haben ihre 4 Angriffe für heute bereits abgeschlossen!'
  );

  embed.setFooter({ text: 'Clash Royale Admin Bot • Live-Abfrage via /angriffe' });
  return embed;
}

/**
 * Erstellt das Embed für die Verwarnungen-Übersicht (/verwarnungen)
 */
export function createStrikesEmbed({ strikesList = [], threshold = 5 }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO_BLUE)
    .setTitle('📋 Übersicht der verpassten Clankriegs-Decks (Verwarnungen)')
    .setDescription(`Spieler mit **${threshold} oder mehr** verpassten Decks sind für einen Kick vorgemerkt.`)
    .setTimestamp();

  if (strikesList.length === 0) {
    embed.addFields({
      name: 'Status',
      value: '✅ Die Historie ist sauber! Keine registrierten verpassten Decks.',
      inline: false
    });
  } else {
    const lines = strikesList.map((s, idx) => {
      const isKick = s.total_missed_decks >= threshold;
      const marker = isKick ? '🚨 **[KICK-KANDIDAT]** ' : '⚠️ ';
      return `${idx + 1}. ${marker}**${s.player_name}**: **${s.total_missed_decks}** Decks verpasst (Zuletzt: ${s.last_missed_date || 'k.A.'})`;
    });

    splitIntoFields(embed, `Registrierte Spieler (${strikesList.length})`, lines, 'Keine Einträge');
  }

  embed.setFooter({ text: 'Clash Royale Admin Bot • Verwarnungen-Datenbank' });
  return embed;
}
