import fs from 'fs';
import path from 'path';
import { SYSTEM_EXCLUSIONS, ENCRYPTED_EXTENSION } from '../core/constants';
import { FileError } from '../core/errorHandler';

export interface FileEntry {
  path: string;
  size: number;
  isDirectory: boolean;
}

export function scanDirectory(dirPath: string): FileEntry[] {
  if (!fs.existsSync(dirPath)) {
    throw new FileError(`Directory not found: ${dirPath}`);
  }

  const results: FileEntry[] = [];

  function walk(currentPath: string): void {
    const entries = fs.readdirSync(currentPath);

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      const stat = fs.statSync(fullPath);

      if (isExcluded(fullPath)) {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        results.push({
          path: fullPath,
          size: stat.size,
          isDirectory: false,
        });
      }
    }
  }

  walk(dirPath);
  return results;
}

export function isExcluded(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();

  for (const pattern of SYSTEM_EXCLUSIONS) {
    const regexPattern = pattern
      .toLowerCase()
      .replace(/\\/g, '\\\\')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^\\\\]*');

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

export function getOutputPath(
  inputPath: string,
  outputDir: string | null,
  isEncrypting: boolean
): string {
  const baseName = path.basename(inputPath);
  const dirName = outputDir || path.dirname(inputPath);

  if (isEncrypting) {
    return path.join(dirName, baseName + ENCRYPTED_EXTENSION);
  }

  if (baseName.endsWith(ENCRYPTED_EXTENSION)) {
    return path.join(dirName, baseName.slice(0, -ENCRYPTED_EXTENSION.length));
  }

  return path.join(dirName, baseName + '.decrypted');
}
