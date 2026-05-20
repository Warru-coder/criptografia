import { SYSTEM_EXCLUSIONS } from '../core/constants';

export interface ExclusionRule {
  pattern: string;
  reason: string;
}

export const exclusionRules: ExclusionRule[] = [
  { pattern: 'C:\\Windows\\**', reason: 'Windows system files' },
  { pattern: 'C:\\Program Files\\**', reason: 'Installed applications' },
  { pattern: 'C:\\Program Files (x86)\\**', reason: 'Installed applications (32-bit)' },
  { pattern: 'C:\\ProgramData\\**', reason: 'Program data' },
  { pattern: '**\\AppData\\**', reason: 'User application data' },
  { pattern: '**\\$Recycle.Bin\\**', reason: 'Recycle bin' },
  { pattern: '**\\System Volume Information\\**', reason: 'System restore points' },
  { pattern: '**\\Recovery\\**', reason: 'Recovery partition' },
  { pattern: '**\\pagefile.sys', reason: 'Virtual memory file' },
  { pattern: '**\\hiberfil.sys', reason: 'Hibernation file' },
  { pattern: '**\\swapfile.sys', reason: 'Swap file' },
  { pattern: '**\\AppSecureData\\**', reason: 'SecureCrypt data directory' },
];

export function getExclusionList(): string[] {
  return SYSTEM_EXCLUSIONS;
}

export function getExclusionRules(): ExclusionRule[] {
  return exclusionRules;
}

export function isCriticalSystemPath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();

  for (const rule of exclusionRules) {
    const regexPattern = rule.pattern
      .toLowerCase()
      .replace(/\\/g, '\\\\')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^\\\\]*');

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(normalized)) {
      return true;
    }
  }

  return false;
}
