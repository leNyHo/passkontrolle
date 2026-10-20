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
 * Erstellt das Live-Status- & Erinnerungs-Embed für /erinnerung (und /angriffe)
 */
export function createStatusEmbed({
  clanName,
  clanTag,
  periodType,
  completedCount,
  incompleteCount,
  totalMembers,
  totalMissedToday,
  incompleteList = [],
  reminderMessage = 'Folgende Spieler haben noch Decks offen:'
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
    // Vor jedem Namen ein @, dahinter 2 Tabs und "(X Decks)", gefolgt von Zeilenumbruch
    const playerLines = incompleteList.map((player) => {
      const decksWord = player.missedDecks === 1 ? 'Deck' : 'Decks';
      return `@${player.name}\t\t(${player.missedDecks} ${decksWord})`;
    });

    const prefix = reminderMessage || 'Folgende Spieler haben noch Decks offen:';
    const copyContent = `${prefix}\n\n${playerLines.join('\n')}`;
    const codeBlock = `\`\`\`\n${copyContent}\n\`\`\``;

    if (codeBlock.length <= 1024) {
      embed.addFields({
        name: `⏳ Noch ausstehende Angriffe (${incompleteCount} Spieler)`,
        value: codeBlock,
        inline: false
      });
    } else {
      let currentChunk = `${prefix}\n\n`;
      let fieldIndex = 1;

      for (const line of playerLines) {
        if (`\`\`\`\n${currentChunk}${line}\n\`\`\``.length > 1020) {
          embed.addFields({
            name: fieldIndex === 1
              ? `⏳ Ausstehende Angriffe (${incompleteCount} Spieler)`
              : `⏳ Ausstehende Angriffe (Teil ${fieldIndex})`,
            value: `\`\`\`\n${currentChunk.trim()}\n\`\`\``,
            inline: false
          });
          currentChunk = '';
          fieldIndex++;
        }
        currentChunk += `${line}\n`;
      }

      if (currentChunk.trim()) {
        embed.addFields({
          name: fieldIndex === 1
            ? `⏳ Ausstehende Angriffe (${incompleteCount} Spieler)`
            : `⏳ Ausstehende Angriffe (Teil ${fieldIndex})`,
          value: `\`\`\`\n${currentChunk.trim()}\n\`\`\``,
          inline: false
        });
      }
    }
  }

  embed.setFooter({ text: 'Clash Royale Admin Bot • Live-Abfrage via /erinnerung' });
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
    // 1. Liste aller registrierten Spieler
    const lines = strikesList.map((s, idx) => {
      const isKick = s.total_missed_decks >= threshold;
      const marker = isKick ? '🚨 **[KICK-KANDIDAT]** ' : '⚠️ ';
      return `${idx + 1}. ${marker}**${s.player_name}**: **${s.total_missed_decks}** Decks verpasst (Zuletzt: ${s.last_missed_date || 'k.A.'})`;
    });

    splitIntoFields(embed, `Registrierte Spieler (${strikesList.length})`, lines, 'Keine Einträge');

    // 2. Neuer Abschnitt: Copy-Paste Nachricht für den Clan
    // Ermittle das aktuellste Verwarn-Datum
    const latestDate = strikesList.reduce((max, s) => {
      return s.last_missed_date && s.last_missed_date > max ? s.last_missed_date : max;
    }, '');

    // Bevorzuge Spieler vom aktuellsten Verwarntag ("neu verwarnte Mitglieder"), sonst alle
    const newlyWarned = latestDate
      ? strikesList.filter((s) => s.last_missed_date === latestDate)
      : strikesList;

    const copyLines = newlyWarned.map((p) => {
      const isKick = p.total_missed_decks >= threshold;
      const kickTag = isKick ? ' 🚨 [KICK]' : '';
      const missedNow = p.last_missed_decks || p.total_missed_decks;
      const decksWord = missedNow === 1 ? 'Deck' : 'Decks';
      return `@${p.player_name}\t\t(${missedNow} ${decksWord} verpasst – Gesamt: ${p.total_missed_decks}/${threshold}${kickTag})`;
    });

    const headerNote = latestDate ? ` (Stand: ${latestDate})` : '';
    const clanMessageText =
      `⚠️ Clankriegs-Verwarnung${headerNote}:\n` +
      `Folgende Spieler haben Decks verpasst und erhalten eine Verwarnung:\n\n` +
      `${copyLines.join('\n')}\n\n` +
      `Ab ${threshold} verpassten Decks erfolgt der Kick. Bitte holt eure Angriffe im nächsten Clankrieg nach!`;

    const clanCodeBlock = `\`\`\`\n${clanMessageText}\n\`\`\``;

    if (clanCodeBlock.length <= 1024) {
      embed.addFields({
        name: `📢 Copy-Paste Clan-Nachricht (Neu verwarnte Mitglieder: ${newlyWarned.length})`,
        value: clanCodeBlock,
        inline: false
      });
    } else {
      let chunk = `⚠️ Clankriegs-Verwarnung${headerNote}:\n\n`;
      let part = 1;
      for (const line of copyLines) {
        if (`\`\`\`\n${chunk}${line}\n\`\`\``.length > 1020) {
          embed.addFields({
            name: `📢 Copy-Paste Clan-Nachricht (Teil ${part})`,
            value: `\`\`\`\n${chunk.trim()}\n\`\`\``,
            inline: false
          });
          chunk = '';
          part++;
        }
        chunk += `${line}\n`;
      }
      if (chunk.trim()) {
        embed.addFields({
          name: `📢 Copy-Paste Clan-Nachricht (Teil ${part})`,
          value: `\`\`\`\n${chunk.trim()}\n\nAb ${threshold} verpassten Decks erfolgt der Kick!\`\`\``,
          inline: false
        });
      }
    }
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
