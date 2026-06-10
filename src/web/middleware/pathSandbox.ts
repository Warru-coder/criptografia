import path from 'path';
import os from 'os';
import { ForbiddenPathError } from '../../core/errorHandler';

const BASE_DIR = path.resolve(process.env.SECURECRYPT_BASE_DIR ?? os.homedir());

export function sandboxPath(userInput: string): string {
  const resolved = path.resolve(userInput);
  const base = BASE_DIR + path.sep;

  if (resolved !== BASE_DIR && !resolved.startsWith(base)) {
    throw new ForbiddenPathError(
      `Access denied: path is outside the allowed directory. Set SECURECRYPT_BASE_DIR to change it.`
    );
  }

  return resolved;
}
