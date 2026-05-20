import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

const configSchema = z.object({
  concurrency: z.number().min(1).max(16).default(4),
  verbose: z.boolean().default(false),
  backgroundMode: z.boolean().default(false),
  streamBufferSize: z.number().default(64 * 1024),
});

export type AppConfig = z.infer<typeof configSchema>;

export const defaultConfig: AppConfig = {
  concurrency: Math.max(1, os.cpus().length - 1),
  verbose: false,
  backgroundMode: false,
  streamBufferSize: 64 * 1024,
};

export function getAppDataPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, 'Desktop', 'AppSecureData');
}

export function ensureAppDataDirs(): void {
  const basePath = getAppDataPath();
  const dirs = [
    basePath,
    path.join(basePath, 'vault'),
    path.join(basePath, 'metadata'),
    path.join(basePath, 'logs'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function loadConfig(): AppConfig {
  const configPath = path.join(getAppDataPath(), 'config.json');

  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return configSchema.parse(rawConfig);
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: AppConfig): void {
  ensureAppDataDirs();
  const configPath = path.join(getAppDataPath(), 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
