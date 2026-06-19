import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from '../config';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(env.dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(env.dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');

  migrate(_db);
  return _db;
}

export function closeDb(): void {
  if (_db) { _db.close(); _db = null; }
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL COLLATE NOCASE,
      passwordHash TEXT NOT NULL,
      salt         TEXT NOT NULL,
      wrappedKey   TEXT,
      createdAt    TEXT NOT NULL,
      lastLoginAt  TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token     TEXT PRIMARY KEY,
      userId    TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id           TEXT PRIMARY KEY,
      userId       TEXT NOT NULL,
      credentialId TEXT UNIQUE NOT NULL,
      publicKey    TEXT NOT NULL,
      counter      INTEGER NOT NULL DEFAULT 0,
      deviceType   TEXT NOT NULL DEFAULT 'platform',
      backedUp     INTEGER NOT NULL DEFAULT 0,
      createdAt    TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_wa_user          ON webauthn_credentials(userId);
  `);

  // ADR-0012 exec / ALTA-02: idempotent ALTER TABLE to add masterSalt.
  // SQLite doesn't support ADD COLUMN IF NOT EXISTS pre-3.35, so detect via PRAGMA.
  addColumnIfMissing(db, 'users', 'masterSalt', 'TEXT');
  // ADR-0015 / ALTA-06 (scaffolding): per-credential PRF salt for WebAuthn PRF
  // extension. Stays NULL for credentials registered before PRF support landed.
  addColumnIfMissing(db, 'webauthn_credentials', 'prfSalt', 'TEXT');
  // Track wrap format version per user (1 = legacy SERVER_SECRET-padded,
  // 2 = HKDF over SERVER_SECRET, 3 = future PRF-derived KEK).
  addColumnIfMissing(db, 'users', 'wrappedKeyVersion', 'INTEGER');
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
