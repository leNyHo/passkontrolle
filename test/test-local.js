import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporäre Test-Datenbank
const testDbPath = path.resolve(__dirname, 'test-clashbot.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
process.env.DATABASE_PATH = testDbPath;

console.log('🧪 Starte lokale Verifizierungstests...\n');

// 1. Module importieren
const {
  getDatabase,
  getGuildSettings,
  saveGuildSettings,
  recordMissedDecks,
  getKickCandidates,
  getAllStrikes,
  resetPlayerStrikes,
  resetAllStrikes,
  pruneStrikesNotInMemberList,
  closeDatabase
} = await import('../src/services/database.js');

const { normalizeClanTag, encodeClanTag } = await import('../src/services/clashRoyale.js');
const { timeToCronExpression } = await import('../src/services/scheduler.js');
const { createWarReportEmbed, createStatusEmbed, createStrikesEmbed } = await import('../src/utils/embeds.js');
const wasistdasproblem = await import('../src/commands/wasistdasproblem.js');
const erlauberolle = await import('../src/commands/erlauberolle.js');
const { hasPasskontrollRole, ROLE_NAME } = await import('../src/utils/roles.js');

// Test 1: Clan Tag Normalisierung
console.log('▶ Test 1: Clan-Tag Normalisierung & URL-Encoding');
assert.equal(normalizeClanTag('2pp'), '#2PP');
assert.equal(normalizeClanTag('#abc123xyz'), '#ABC123XYZ');
assert.equal(encodeClanTag('2pp'), '%232PP');
console.log('  ✔ Clan-Tag Tests erfolgreich!\n');

// Test 2: Cron-Time Konverter & Commands
console.log('▶ Test 2: Zeit-zu-Cron Konverter & Command-Exporte');
assert.equal(timeToCronExpression('12:00'), '0 12 * * *');
assert.equal(timeToCronExpression('09:45'), '45 9 * * *');
assert.equal(timeToCronExpression('18:05'), '5 18 * * *');
assert.ok(wasistdasproblem.data.name === 'wasistdasproblem');
assert.ok(erlauberolle.data.name === 'erlauberolle');
console.log('  ✔ Cron-Konverter & Command-Export Tests erfolgreich!\n');

// Test 2b: Rolle "Passkontroll-User" Prüfung
console.log('▶ Test 2b: Rolle Passkontroll-User Erkennung');
assert.equal(ROLE_NAME, 'Passkontroll-User');

const mockMemberWithRole = {
  roles: {
    cache: new Map([
      ['role-1', { id: 'role-1', name: 'Member' }],
      ['role-2', { id: 'role-2', name: 'passkontroll-user' }]
    ])
  }
};
mockMemberWithRole.roles.cache.some = Array.prototype.some.bind([...mockMemberWithRole.roles.cache.values()]);

const mockMemberWithoutRole = {
  roles: {
    cache: new Map([['role-1', { id: 'role-1', name: 'Member' }]])
  }
};
mockMemberWithoutRole.roles.cache.some = Array.prototype.some.bind([...mockMemberWithoutRole.roles.cache.values()]);

assert.equal(hasPasskontrollRole(mockMemberWithRole), true);
assert.equal(hasPasskontrollRole(mockMemberWithoutRole), false);
console.log('  ✔ Rollen-Prüfung erfolgreich!\n');

// Test 3: Datenbank-Operationen
console.log('▶ Test 3: SQLite Datenbank & Guild Settings');
const guildId = '123456789012345678';
const initialSettings = getGuildSettings(guildId);
assert.equal(initialSettings.war_end_time, '12:00');
assert.equal(initialSettings.clan_tag, null);
assert.equal(initialSettings.reminder_message, 'Folgende Spieler haben noch Decks offen:');
assert.equal(initialSettings.allowed_role_id, null);

saveGuildSettings(guildId, {
  clan_tag: '#2PP',
  channel_id: '987654321098765432',
  war_end_time: '11:30',
  reminder_message: 'Kriegs-Erinnerung:',
  allowed_role_id: '111222333444555666'
});

const updatedSettings = getGuildSettings(guildId);
assert.equal(updatedSettings.clan_tag, '#2PP');
assert.equal(updatedSettings.channel_id, '987654321098765432');
assert.equal(updatedSettings.war_end_time, '11:30');
assert.equal(updatedSettings.reminder_message, 'Kriegs-Erinnerung:');
assert.equal(updatedSettings.allowed_role_id, '111222333444555666');
console.log('  ✔ Guild-Settings erfolgreich gespeichert und geladen!\n');

// Test 4: Strikes & Kick-Vorschläge (5+ Regel) & Reset All
console.log('▶ Test 4: Fehlangriffe, Kick-Threshold (5+) & resetAllStrikes');
// Spieler 1: 4 verpasste Decks am Tag 1
recordMissedDecks(guildId, '#2PP', '2026-09-20', '#P1', 'Max', 4);
// Spieler 2: 2 verpasste Decks am Tag 1
recordMissedDecks(guildId, '#2PP', '2026-09-20', '#P2', 'Lisa', 2);
// Spieler 3: 4 verpasste Decks an Tag 1, 1 an Tag 2 -> insgesamt 5!
recordMissedDecks(guildId, '#2PP', '2026-09-20', '#P3', 'Tom', 4);
recordMissedDecks(guildId, '#2PP', '2026-09-21', '#P3', 'Tom', 1);

const kicks = getKickCandidates(5);
assert.equal(kicks.length, 1);
assert.equal(kicks[0].player_name, 'Tom');
assert.equal(kicks[0].total_missed_decks, 5);

const all = getAllStrikes(1);
assert.equal(all.length, 3);
assert.equal(all[0].player_name, 'Tom'); // Höchste zuerst

// Test Clan-Mitglieder Abgleich (Pruning von ausgetretenen Spielern)
// Lisa (#P2) verlässt den Clan, nur Max (#P1) und Tom (#P3) sind noch da
const pruned = pruneStrikesNotInMemberList(['#P1', '#P3'], '#2PP');
assert.equal(pruned.length, 1);
assert.equal(pruned[0].player_tag, '#P2');
assert.equal(pruned[0].player_name, 'Lisa');

const allAfterPrune = getAllStrikes(1);
assert.equal(allAfterPrune.length, 2);
assert.equal(allAfterPrune.some(p => p.player_tag === '#P2'), false);

// Einzel-Reset Test
resetPlayerStrikes('#P3');
const afterResetKicks = getKickCandidates(5);
assert.equal(afterResetKicks.length, 0);

// Reset ALL Test
resetAllStrikes();
const afterResetAll = getAllStrikes(1);
assert.equal(afterResetAll.length, 0);
console.log('  ✔ Strikes, Kick-Threshold (5+), Mitglieder-Abgleich & resetAllStrikes erfolgreich validiert!\n');

// Test 5: Discord Embed Erstellung
console.log('▶ Test 5: Discord Embed Rendering (ohne Verwarnnachricht, ohne Fortsetzung X)');
const reportEmbed = createWarReportEmbed({
  clanName: 'Test Clan',
  clanTag: '#2PP',
  periodType: 'warDay',
  incompleteList: [
    { name: 'Max', tag: '#P1', missedDecks: 4, totalMissed: 4 },
    { name: 'Lisa', tag: '#P2', missedDecks: 2, totalMissed: 2 }
  ],
  completedCount: 48,
  totalMembers: 50,
  kickCandidates: [
    { player_name: 'Tom', player_tag: '#P3', total_missed_decks: 5, last_missed_date: '2026-09-21' }
  ],
  dateStr: '21.09.2026, 12:00',
  isTest: false
});

assert.ok(reportEmbed.data.title.includes('Clankriegs-Abschlussbericht'));
assert.equal(reportEmbed.data.fields.length, 2); // 1. Unvollständig, 2. Kick-Kandidaten (kein Verwarnfeld mehr)

const statusEmbed = createStatusEmbed({
  clanName: 'Test Clan',
  clanTag: '#2PP',
  periodType: 'warDay',
  completedCount: 40,
  incompleteCount: 10,
  totalMembers: 50,
  totalMissedToday: 24,
  incompleteList: [
    { name: 'Max', tag: '#P1', missedDecks: 4, decksUsedToday: 0 }
  ]
});
assert.ok(statusEmbed.data.title.includes('Aktueller Clankriegs-Status'));
assert.ok(!JSON.stringify(statusEmbed.data).includes('Fortsetzung'));

console.log('  ✔ Embeds fehlerfrei gerendert!\n');

// Aufräumen
closeDatabase();
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

console.log('🎉 ALLE TESTS ERFOLGREICH BESTANDEN!');
