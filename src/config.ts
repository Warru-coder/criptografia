/**
 * Centralised runtime configuration.
 * All env vars are read here. No other file should call process.env directly.
 * For deployment: edit .env (or set env vars on the host). Nothing else changes.
 */
import 'dotenv/config';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { cpus } from 'os';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const bool = (v: string | undefined, def: boolean): boolean =>
  v === undefined ? def : v === 'true' || v === '1';

const num = (v: string | undefined, def: number): number =>
  v === undefined || v === '' ? def : Number(v);

const str = (v: string | undefined, def: string): string =>
  v === undefined || v === '' ? def : v;

// ─── Deployment config (from .env) ───────────────────────────────────────────

const _dataDir = str(process.env.DATA_DIR, path.join(os.homedir(), '.securecrypt'));

export const env = {
  // Server
  port:          num(process.env.PORT, 3000),
  host:          str(process.env.HOST, '0.0.0.0'),
  nodeEnv:       str(process.env.NODE_ENV, 'development'),
  trustProxy:    bool(process.env.TRUST_PROXY, false),

  // Storage (all paths derived from dataDir)
  dataDir:       _dataDir,
  dbPath:        str(process.env.DB_PATH,  path.join(_dataDir, 'securecrypt.db')),
  logDir:        str(process.env.LOG_DIR,  path.join(_dataDir, 'logs')),
  usersDir:      path.join(_dataDir, 'users'),
  tmpDir:        path.join(_dataDir, 'tmp'),

  // Security
  serverSecret:      str(process.env.SERVER_SECRET, ''),
  sessionTtlMs:      num(process.env.SESSION_TTL_MINUTES, 30) * 60_000,
  rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60_000),
  rateLimitMax:      num(process.env.RATE_LIMIT_MAX, 100),
  loginRateLimitMax: num(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  corsOrigins:       (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),

  // WebAuthn / FIDO2
  rpName:         str(process.env.RP_NAME,    'SecureCrypt'),
  rpId:           str(process.env.RP_ID,      'localhost'),
  rpOrigin:       str(process.env.RP_ORIGIN,  'http://localhost:3000'),
  enableWebAuthn: bool(process.env.ENABLE_WEBAUTHN, true),

  // Feature flags
  enableRegistration: bool(process.env.ENABLE_REGISTRATION, true),
  enableAi:           bool(process.env.ENABLE_AI, true),

  // AI / Ollama
  ollamaBaseUrl:  str(process.env.OLLAMA_BASE_URL, 'http://localhost:11434/v1'),
  ollamaModel:    str(process.env.OLLAMA_MODEL, 'llama3.2:3b'),
  ollamaTimeoutMs: num(process.env.OLLAMA_TIMEOUT_MS, 30_000),

  // Upload
  uploadLimitBytes: num(process.env.UPLOAD_LIMIT_MB, 10 * 1024) * 1024 * 1024,
} as const;

// CRIT-04 / ADR-005: SERVER_SECRET is validated UNCONDITIONALLY when WebAuthn is enabled,
// regardless of NODE_ENV. The previous behaviour (production-only check) silently allowed
// dev/test environments to wrap user master keys with an effectively all-zero KEK.
if (env.enableWebAuthn) {
  if (!env.serverSecret) {
    console.error(
      '[SecureCrypt] FATAL: SERVER_SECRET is required when WebAuthn is enabled.\n' +
      '  Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
    process.exit(1);
  }
  if (env.serverSecret.length < 32) {
    console.error(
      `[SecureCrypt] FATAL: SERVER_SECRET must be ≥32 characters (got ${env.serverSecret.length}).\n` +
      '  Recommended: 44-char base64 of crypto.randomBytes(32).',
    );
    process.exit(1);
  }
}

// ─── Runtime CLI config (persisted in {dataDir}/config.json) ─────────────────

const runtimeSchema = z.object({
  concurrency:      z.number().min(1).max(16).default(4),
  verbose:          z.boolean().default(false),
  backgroundMode:   z.boolean().default(false),
  streamBufferSize: z.number().default(64 * 1024),
});

export type AppConfig = z.infer<typeof runtimeSchema>;

export const defaultConfig: AppConfig = {
  concurrency:      Math.max(1, cpus().length - 1),
  verbose:          false,
  backgroundMode:   false,
  streamBufferSize: 64 * 1024,
};

import fs from 'fs';

export function getAppDataPath(): string { return env.dataDir; }

export function ensureAppDataDirs(): void {
  const dirs = [
    env.dataDir,
    env.usersDir,
    env.tmpDir,
    env.logDir,
    path.join(env.dataDir, 'vault'),
    path.join(env.dataDir, 'metadata'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function loadConfig(): AppConfig {
  const p = path.join(env.dataDir, 'config.json');
  if (!fs.existsSync(p)) return defaultConfig;
  try { return runtimeSchema.parse(JSON.parse(fs.readFileSync(p, 'utf-8'))); } catch { return defaultConfig; }
}

export function saveConfig(c: AppConfig): void {
  ensureAppDataDirs();
  fs.writeFileSync(path.join(env.dataDir, 'config.json'), JSON.stringify(c, null, 2));
}

// System path exclusions (used by directory processor)
export const EXCLUSIONS = [
  'C:\\Windows\\', 'C:\\Program Files\\', 'C:\\Program Files (x86)\\',
  'C:\\ProgramData\\', 'AppData\\', '$Recycle.Bin\\', 'System Volume Information\\',
  'Recovery\\', 'pagefile.sys', 'hiberfil.sys', 'swapfile.sys', '.securecrypt\\',
];

export function isExcluded(p: string): boolean {
  const n = p.toLowerCase();
  return EXCLUSIONS.some(e => n.includes(e.toLowerCase()));
}
