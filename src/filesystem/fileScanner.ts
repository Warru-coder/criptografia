import fs from 'fs';
import path from 'path';
import picomatch from 'picomatch';
import { SYSTEM_EXCLUSIONS, ENCRYPTED_EXTENSION } from '../core/constants';
import { FileError } from '../core/errorHandler';

// MED-02 / ADR-0009: use picomatch instead of the artisanal regex.
// SYSTEM_EXCLUSIONS uses Windows-style backslashes; picomatch wants forward
// slashes, so we normalise both pattern and candidate. Patterns are matched
// case-insensitively (Windows convention).
const EXCLUSION_MATCHERS = SYSTEM_EXCLUSIONS.map((p) =>
  picomatch(p.replace(/\\/g, '/'), { nocase: true, dot: true }),
);

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
  const candidate = filePath.replace(/\\/g, '/');
  return EXCLUSION_MATCHERS.some((m) => m(candidate));
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
