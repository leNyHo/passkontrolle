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
  recordMissedDecksBatch,
  getPlayerStrikes,
  getKickCandidates,
  getAllStrikes,
  resetPlayerStrikes,
  resetAllStrikes,
  pruneStrikesNotInMemberList,
  saveTimeCheckReminder,
  getPendingTimeCheckReminders,
  getTimeCheckReminderByMessage,
  getTimeCheckReminderByGuildAndDate,
  acknowledgeTimeCheckReminder,
  updateTimeCheckReminderMessage,
  closeDatabase
} = await import('../src/services/database.js');

const { normalizeClanTag, encodeClanTag } = await import('../src/services/clashRoyale.js');
const { timeToCronExpression, checkPendingTimeReminders } = await import('../src/services/scheduler.js');
const { isMondayInTimezone } = await import('../src/services/reportService.js');
const {
  createWarReportEmbed,
  createStatusEmbed,
  createStrikesEmbed,
  createTimeCheckReminderEmbed
} = await import('../src/utils/embeds.js');
const erlauberolle = await import('../src/commands/erlauberolle.js');
const setreminder = await import('../src/commands/setreminder.js');

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
assert.ok(erlauberolle.data.name === 'erlauberolle');
assert.ok(setreminder.data.name === 'setreminder');
assert.ok(setreminder.data.options.some((o) => o.name === 'rolle'));
assert.ok(setreminder.data.options.some((o) => o.name === 'deaktivieren'));
console.log('  ✔ Cron-Konverter & Command-Export Tests erfolgreich!\n');

// Test 3: Datenbank-Operationen
console.log('▶ Test 3: SQLite Datenbank & Guild Settings');
const guildId = '123456789012345678';
const initialSettings = getGuildSettings(guildId);
assert.equal(initialSettings.war_end_time, '12:00');
assert.equal(initialSettings.clan_tag, null);
assert.equal(initialSettings.reminder_message, 'Folgende Spieler haben noch Decks offen:');
assert.equal(initialSettings.allowed_role_id, null);
assert.equal(initialSettings.reminder_role_id, null);

saveGuildSettings(guildId, {
  clan_tag: '#2PP',
  channel_id: '987654321098765432',
  war_end_time: '11:30',
  reminder_message: 'Kriegs-Erinnerung:',
  allowed_role_id: '111222333444555666',
  reminder_role_id: '999888777666555444'
});

const updatedSettings = getGuildSettings(guildId);
assert.equal(updatedSettings.clan_tag, '#2PP');
assert.equal(updatedSettings.channel_id, '987654321098765432');
assert.equal(updatedSettings.war_end_time, '11:30');
assert.equal(updatedSettings.reminder_message, 'Kriegs-Erinnerung:');
assert.equal(updatedSettings.allowed_role_id, '111222333444555666');
assert.equal(updatedSettings.reminder_role_id, '999888777666555444');
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

// Test 4b: Multi-Server Idempotenz (Verhindert doppelte Verwarnungen wenn Bot auf 2 Servern läuft)
console.log('▶ Test 4b: Multi-Server Schutz (Keine Verdopplung von Strafpunkten)');
const playerSample = [{ tag: '#P99', name: 'MultiServerPlayer', missedDecks: 2 }];

// Server 1 führt Report aus:
const res1 = recordMissedDecksBatch('guild-alpha', '#CLAN123', '2026-10-16', playerSample);
assert.equal(res1.insertedCount, 1);
assert.equal(res1.skippedCount, 0);

const strikeAfterServer1 = getPlayerStrikes('#P99');
assert.equal(strikeAfterServer1.total_missed_decks, 2);

// Server 2 führt Report für denselben Clan am selben Tag aus:
const res2 = recordMissedDecksBatch('guild-beta', '#CLAN123', '2026-10-16', playerSample);
assert.equal(res2.insertedCount, 0);
assert.equal(res2.skippedCount, 1); // Übersprungen!

// Strafpunkte dürfen NICHT verdoppelt worden sein (müssen immer noch 2 sein, nicht 4!):
const strikeAfterServer2 = getPlayerStrikes('#P99');
assert.equal(strikeAfterServer2.total_missed_decks, 2);

// Clan-Filterung prüfen
const clanStrikes = getAllStrikes('#CLAN123', 1);
assert.equal(clanStrikes.length, 1);
assert.equal(clanStrikes[0].player_tag, '#P99');

const otherClanStrikes = getAllStrikes('#OTHERCLAN', 1);
assert.equal(otherClanStrikes.length, 0);

console.log('  ✔ Multi-Server Idempotenz erfolgreich validiert (Strafpunkte bleiben exakt bei 2)!\n');

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

// Test 6: Montags-Erinnerung zur Clankriegs-Zeitüberprüfung (/setreminder & 24h-Wiederholung)
console.log('▶ Test 6: Montags-Erinnerung zur Clankriegs-Zeitüberprüfung & 24h-Wiederholung');

// 6a. Wochentag-Erkennung (Montag)
const mondayDate = new Date('2026-10-19T10:00:00Z'); // 19. Okt 2026 ist Montag
const tuesdayDate = new Date('2026-10-20T10:00:00Z'); // 20. Okt 2026 ist Dienstag
assert.equal(isMondayInTimezone('Europe/Berlin', mondayDate), true);
assert.equal(isMondayInTimezone('Europe/Berlin', tuesdayDate), false);

// 6b. Reminder-Embeds
const initialReminderEmbed = createTimeCheckReminderEmbed({
  roleId: '999888777666555444',
  warEndTime: '12:00',
  timezone: 'Europe/Berlin',
  isRepeat: false
});
assert.ok(initialReminderEmbed.data.title.includes('Zeitüberprüfung erforderlich'));
assert.ok(initialReminderEmbed.data.description.includes('12:00 Uhr'));

const repeatReminderEmbed = createTimeCheckReminderEmbed({
  roleId: '999888777666555444',
  warEndTime: '12:00',
  timezone: 'Europe/Berlin',
  isRepeat: true
});
assert.ok(repeatReminderEmbed.data.title.includes('Erinnerung: Clankriegs-Uhrzeit überprüfen'));
assert.ok(repeatReminderEmbed.data.description.includes('erneute Erinnerung'));

// 6c. Datenbank-Operationen für time_check_reminders
const testGuildId = 'guild-remind-test';
const savedRem = saveTimeCheckReminder({
  guild_id: testGuildId,
  channel_id: 'channel-test-1',
  role_id: 'role-test-1',
  message_id: 'msg-test-100',
  war_date: '2026-10-19',
  next_remind_at: Date.now() - 5000, // Bereits fällig
  repeat_count: 0
});
assert.ok(savedRem.id > 0);

const fetchedByMsg = getTimeCheckReminderByMessage('msg-test-100');
assert.equal(fetchedByMsg.guild_id, testGuildId);
assert.equal(fetchedByMsg.acknowledged, 0);

const fetchedByGuild = getTimeCheckReminderByGuildAndDate(testGuildId, '2026-10-19');
assert.equal(fetchedByGuild.message_id, 'msg-test-100');

let pendingList = getPendingTimeCheckReminders(Date.now());
assert.ok(pendingList.some((r) => r.id === savedRem.id));

// Bestätigung per Häkchen testen
const ackResult = acknowledgeTimeCheckReminder('msg-test-100', 'user-mod-1');
assert.equal(ackResult, true);

const afterAck = getTimeCheckReminderByMessage('msg-test-100');
assert.equal(afterAck.acknowledged, 1);
assert.equal(afterAck.acknowledged_by, 'user-mod-1');

pendingList = getPendingTimeCheckReminders(Date.now());
assert.ok(!pendingList.some((r) => r.id === savedRem.id));

// 6d. Scheduler 24h-Wiederholungsprüfung mit Mock-Discord-Client
// Erstelle eine neue fällige Erinnerung (unbestätigt)
const unackRem = saveTimeCheckReminder({
  guild_id: testGuildId,
  channel_id: 'channel-test-2',
  role_id: 'role-test-2',
  message_id: 'msg-test-200',
  war_date: '2026-10-19',
  next_remind_at: Date.now() - 5000,
  repeat_count: 0
});

let mockSentPayload = null;
let mockReactionAdded = null;
const mockChannel = {
  id: 'channel-test-2',
  send: async (payload) => {
    mockSentPayload = payload;
    return {
      id: 'msg-repeat-300',
      react: async (emoji) => {
        mockReactionAdded = emoji;
      }
    };
  },
  messages: {
    fetch: async () => ({
      id: 'msg-test-200',
      reactions: {
        cache: {
          get: (emoji) => null // Noch keine ✅ Reaktion!
        }
      }
    })
  }
};

const mockClient = {
  channels: {
    fetch: async (id) => (id === 'channel-test-2' ? mockChannel : null)
  }
};

// Scheduler-Prüfung ausführen
const checkResults = await checkPendingTimeReminders(mockClient, Date.now());
assert.ok(checkResults.some((r) => r.id === unackRem.id && r.action === 'repeated'));
assert.equal(mockReactionAdded, '✅');
assert.ok(mockSentPayload.content.includes('role-test-2'));

// Überprüfe aktualisierten DB-Eintrag
const updatedRem = getTimeCheckReminderByMessage('msg-repeat-300');
assert.ok(updatedRem);
assert.equal(updatedRem.repeat_count, 1);
assert.ok(updatedRem.next_remind_at > Date.now());

console.log('  ✔ Montags-Erinnerung & 24h-Wiederholung erfolgreich validiert!\n');

// Aufräumen
closeDatabase();
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

console.log('🎉 ALLE TESTS ERFOLGREICH BESTANDEN!');
