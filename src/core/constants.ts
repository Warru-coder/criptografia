export const MAGIC_BYTES = Buffer.from('SCRYPT');
export const FILE_VERSION = 1;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 16;
export const AUTH_TAG_LENGTH = 16;
export const HEADER_SIZE = 128;
export const ENCRYPTED_EXTENSION = '.scrypt';

export const ARGON2_MEMORY_COST = 65536;
export const ARGON2_TIME_COST = 3;
export const ARGON2_PARALLELISM = 2;
export const ARGON2_HASH_LENGTH = 32;

export const STREAM_HIGH_WATER_MARK = 64 * 1024;
import { cpus } from 'os';
export const DEFAULT_CONCURRENCY = Math.max(1, cpus().length - 1);
export const MAX_QUEUE_SIZE = 10000;

export const SYSTEM_EXCLUSIONS = [
  'C:\\Windows\\**',
  'C:\\Program Files\\**',
  'C:\\Program Files (x86)\\**',
  'C:\\ProgramData\\**',
  '**\\AppData\\**',
  '**\\$Recycle.Bin\\**',
  '**\\System Volume Information\\**',
  '**\\Recovery\\**',
  '**\\pagefile.sys',
  '**\\hiberfil.sys',
  '**\\swapfile.sys',
  '**\\AppSecureData\\**',
];

export const APP_DATA_DIR = process.env.APP_SECURE_DATA || '';
