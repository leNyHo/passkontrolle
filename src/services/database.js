import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

let db = null;

export function getDatabase() {
  if (db) return db;

  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new DatabaseSync(config.databasePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initSchema(db);
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      clan_tag TEXT,
      channel_id TEXT,
      war_end_time TEXT DEFAULT '12:00',
      warning_message TEXT,
      reminder_message TEXT DEFAULT 'Folgende Spieler haben noch Decks offen:',
      allowed_role_id TEXT,
      timezone TEXT DEFAULT 'Europe/Berlin',
      last_report_date TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS player_strikes (
      player_tag TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      clan_tag TEXT,
      total_missed_decks INTEGER DEFAULT 0,
      last_missed_decks INTEGER DEFAULT 0,
      last_missed_date TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS war_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      clan_tag TEXT,
      war_date TEXT,
      player_tag TEXT,
      player_name TEXT,
      missed_decks INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_player_strikes_total ON player_strikes(total_missed_decks);
    CREATE INDEX IF NOT EXISTS idx_player_strikes_clan ON player_strikes(clan_tag);
    CREATE INDEX IF NOT EXISTS idx_war_history_date ON war_history(war_date);
    CREATE INDEX IF NOT EXISTS idx_war_history_clan ON war_history(clan_tag);
  `);

  // Migrationen für bestehende Datenbanken
  try {
    database.exec("ALTER TABLE guild_settings ADD COLUMN reminder_message TEXT DEFAULT 'Folgende Spieler haben noch Decks offen:';");
  } catch {
    // Spalte existiert bereits
  }

  try {
    database.exec("ALTER TABLE guild_settings ADD COLUMN allowed_role_id TEXT;");
  } catch {
    // Spalte existiert bereits
  }
}

// ==========================================
// Guild Settings Abfragen
// ==========================================

export function getGuildSettings(guildId) {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

  if (!row) {
    return {
      guild_id: guildId,
      clan_tag: config.defaultClanTag || null,
      channel_id: null,
      war_end_time: config.defaultWarEndTime,
      warning_message: config.defaultWarningMessage,
      reminder_message: config.defaultReminderMessage,
      allowed_role_id: null,
      timezone: config.timezone,
      last_report_date: null
    };
  }

  return {
    ...row,
    war_end_time: row.war_end_time || config.defaultWarEndTime,
    warning_message: row.warning_message || config.defaultWarningMessage,
    reminder_message: row.reminder_message || config.defaultReminderMessage,
    allowed_role_id: row.allowed_role_id || null,
    timezone: row.timezone || config.timezone
  };
}

export function saveGuildSettings(guildId, updates = {}) {
  const current = getGuildSettings(guildId);
  const updated = { ...current, ...updates };

  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO guild_settings (guild_id, clan_tag, channel_id, war_end_time, warning_message, reminder_message, allowed_role_id, timezone, last_report_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(guild_id) DO UPDATE SET
      clan_tag = excluded.clan_tag,
      channel_id = excluded.channel_id,
      war_end_time = excluded.war_end_time,
      warning_message = excluded.warning_message,
      reminder_message = excluded.reminder_message,
      allowed_role_id = excluded.allowed_role_id,
      timezone = excluded.timezone,
      last_report_date = excluded.last_report_date,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    guildId,
    updated.clan_tag,
    updated.channel_id,
    updated.war_end_time,
    updated.warning_message,
    updated.reminder_message,
    updated.allowed_role_id,
    updated.timezone,
    updated.last_report_date
  );

  return updated;
}

export function getAllGuildSettings() {
  const database = getDatabase();
  return database.prepare('SELECT * FROM guild_settings').all();
}

// ==========================================
// Spieler-Strafen & Strikes Abfragen
// ==========================================

export function recordMissedDecks(guildId, clanTag, dateStr, playerTag, playerName, missedCount) {
  const database = getDatabase();

  database.exec('BEGIN TRANSACTION;');
  try {
    // 1. In player_strikes aktualisieren
    const upsertStmt = database.prepare(`
      INSERT INTO player_strikes (player_tag, player_name, clan_tag, total_missed_decks, last_missed_decks, last_missed_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(player_tag) DO UPDATE SET
        player_name = excluded.player_name,
        clan_tag = excluded.clan_tag,
        total_missed_decks = total_missed_decks + excluded.total_missed_decks,
        last_missed_decks = excluded.last_missed_decks,
        last_missed_date = excluded.last_missed_date,
        updated_at = CURRENT_TIMESTAMP
    `);
    upsertStmt.run(playerTag, playerName, clanTag, missedCount, missedCount, dateStr);

    // 2. In war_history protokollieren
    const historyStmt = database.prepare(`
      INSERT INTO war_history (guild_id, clan_tag, war_date, player_tag, player_name, missed_decks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    historyStmt.run(guildId, clanTag, dateStr, playerTag, playerName, missedCount);

    database.exec('COMMIT;');
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
}

/**
 * Speichert verpasste Decks mehrerer Spieler in einer einzigen atomaren Transaktion
 * (Vermeidet N+1 Transaktionen und wiederholtes Statement-Parsing).
 */
export function recordMissedDecksBatch(guildId, clanTag, dateStr, playerList = []) {
  if (!playerList || playerList.length === 0) return;

  const database = getDatabase();
  const upsertStmt = database.prepare(`
    INSERT INTO player_strikes (player_tag, player_name, clan_tag, total_missed_decks, last_missed_decks, last_missed_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(player_tag) DO UPDATE SET
      player_name = excluded.player_name,
      clan_tag = excluded.clan_tag,
      total_missed_decks = total_missed_decks + excluded.total_missed_decks,
      last_missed_decks = excluded.last_missed_decks,
      last_missed_date = excluded.last_missed_date,
      updated_at = CURRENT_TIMESTAMP
  `);

  const historyStmt = database.prepare(`
    INSERT INTO war_history (guild_id, clan_tag, war_date, player_tag, player_name, missed_decks)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  database.exec('BEGIN TRANSACTION;');
  try {
    for (const player of playerList) {
      upsertStmt.run(player.tag, player.name, clanTag, player.missedDecks, player.missedDecks, dateStr);
      historyStmt.run(guildId, clanTag, dateStr, player.tag, player.name, player.missedDecks);
    }
    database.exec('COMMIT;');
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
}

export function getPlayerStrikes(playerTag) {
  const database = getDatabase();
  return database.prepare('SELECT * FROM player_strikes WHERE player_tag = ?').get(playerTag);
}

export function getAllStrikes(minMissed = 1) {
  const database = getDatabase();
  return database.prepare(`
    SELECT * FROM player_strikes
    WHERE total_missed_decks >= ?
    ORDER BY total_missed_decks DESC, updated_at DESC
  `).all(minMissed);
}

export function getKickCandidates(threshold = 5) {
  const database = getDatabase();
  return database.prepare(`
    SELECT * FROM player_strikes
    WHERE total_missed_decks >= ?
    ORDER BY total_missed_decks DESC, player_name ASC
  `).all(threshold);
}

export function resetPlayerStrikes(playerTag) {
  const database = getDatabase();
  const info = database.prepare(`
    UPDATE player_strikes
    SET total_missed_decks = 0, last_missed_decks = 0, updated_at = CURRENT_TIMESTAMP
    WHERE player_tag = ?
  `).run(playerTag);

  return (info?.changes || 0) > 0;
}

export function resetAllStrikes() {
  const database = getDatabase();
  const info = database.prepare(`
    UPDATE player_strikes
    SET total_missed_decks = 0, last_missed_decks = 0, updated_at = CURRENT_TIMESTAMP
  `).run();

  return (info?.changes || 0) > 0;
}

/**
 * Löscht Spieler aus der Verwarnliste (player_strikes), die sich nicht mehr in der aktuellen Clan-Mitgliederliste befinden.
 * @param {string[]|Set<string>} currentMemberTags - Liste der aktuell im Clan befindlichen Spieler-Tags
 * @param {string|null} clanTag - Optionaler Clan-Tag zur Eingrenzung
 * @returns {Array} Liste der gelöschten Spieler-Objekte
 */
export function pruneStrikesNotInMemberList(currentMemberTags, clanTag = null) {
  if (!currentMemberTags) return [];

  const tagSet = new Set(
    (Array.isArray(currentMemberTags) ? currentMemberTags : [...currentMemberTags])
      .map((tag) => (typeof tag === 'string' ? tag.trim().toUpperCase() : ''))
  );

  const database = getDatabase();

  let allStrikes;
  if (clanTag) {
    const normTag = clanTag.trim().toUpperCase();
    allStrikes = database
      .prepare('SELECT player_tag, player_name, clan_tag, total_missed_decks FROM player_strikes WHERE clan_tag = ? OR clan_tag IS NULL')
      .all(normTag);
  } else {
    allStrikes = database
      .prepare('SELECT player_tag, player_name, clan_tag, total_missed_decks FROM player_strikes')
      .all();
  }

  const toDelete = allStrikes.filter((p) => !tagSet.has(p.player_tag?.trim().toUpperCase()));

  if (toDelete.length === 0) return [];

  const deleteStmt = database.prepare('DELETE FROM player_strikes WHERE player_tag = ?');
  database.exec('BEGIN TRANSACTION;');
  try {
    for (const player of toDelete) {
      deleteStmt.run(player.player_tag);
    }
    database.exec('COMMIT;');
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }

  console.log(
    `[Strikes] ${toDelete.length} ausgetretene(r) Spieler aus Verwarnliste entfernt:`,
    toDelete.map((p) => `${p.player_name} (${p.player_tag})`).join(', ')
  );
  return toDelete;
}

export function closeDatabase() {
  if (db) {
    try {
      db.close();
    } catch (e) {
      console.error('Fehler beim Schließen der SQLite-Datenbank:', e);
    }
    db = null;
  }
}
