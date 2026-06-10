import path from 'path';
import { env } from '../../config';
import { ForbiddenPathError } from '../../core/errorHandler';

const BASE_DIR = path.resolve(env.dataDir);

export function sandboxPath(userInput: string): string {
  const resolved = path.resolve(userInput);
  const base = BASE_DIR + path.sep;

  if (resolved !== BASE_DIR && !resolved.startsWith(base)) {
    throw new ForbiddenPathError(
      `Access denied: path is outside the allowed directory (${BASE_DIR}).`
    );
  }

  return resolved;
}
