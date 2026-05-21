import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

const schema = z.object({
  concurrency: z.number().min(1).max(16).default(4),
  verbose: z.boolean().default(false),
});

export type Config = z.infer<typeof schema>;
export const defaults: Config = { concurrency: Math.max(1, os.cpus().length - 1), verbose: false };

export function dataDir(): string {
  return path.join(os.homedir(), 'Desktop', 'AppSecureData');
}

export function ensureDirs(): void {
  [dataDir(), path.join(dataDir(), 'vault'), path.join(dataDir(), 'metadata'), path.join(dataDir(), 'logs')].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

export function loadConfig(): Config {
  const p = path.join(dataDir(), 'config.json');
  if (!fs.existsSync(p)) return defaults;
  try { return schema.parse(JSON.parse(fs.readFileSync(p, 'utf-8'))); } catch { return defaults; }
}

export function saveConfig(c: Config): void {
  ensureDirs();
  fs.writeFileSync(path.join(dataDir(), 'config.json'), JSON.stringify(c, null, 2));
}

export const EXCLUSIONS = [
  'C:\\Windows\\', 'C:\\Program Files\\', 'C:\\Program Files (x86)\\',
  'C:\\ProgramData\\', 'AppData\\', '$Recycle.Bin\\', 'System Volume Information\\',
  'Recovery\\', 'pagefile.sys', 'hiberfil.sys', 'swapfile.sys', 'AppSecureData\\',
];

export function isExcluded(p: string): boolean {
  const n = p.toLowerCase();
  return EXCLUSIONS.some(e => n.includes(e.toLowerCase()));
}
