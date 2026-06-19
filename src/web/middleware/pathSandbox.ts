import fs from 'fs';
import path from 'path';
import { env } from '../../config';
import { ForbiddenPathError } from '../../core/errorHandler';

const BASE_DIR = path.resolve(env.dataDir);

/**
 * Resolves a user-supplied path against the data-directory sandbox.
 *
 * MED-01 / ADR-0008: after `path.resolve`, we additionally apply `fs.realpathSync`
 * to defeat symlink-based escapes. The previous implementation only normalised
 * the textual path, so a symlink at `${dataDir}/escape → C:\Windows` would be
 * accepted by the textual check and then read the target.
 *
 * If the path doesn't exist yet (typical for output directories), we walk up
 * to the first existing parent, realpath it, and re-append the remaining tail.
 */
export function sandboxPath(userInput: string): string {
  const resolved = path.resolve(userInput);
  const real = resolveRealPath(resolved);
  const base = BASE_DIR + path.sep;

  if (real !== BASE_DIR && !real.startsWith(base)) {
    throw new ForbiddenPathError(
      `Access denied: path is outside the allowed directory (${BASE_DIR}).`,
    );
  }

  return real;
}

function resolveRealPath(p: string): string {
  if (fs.existsSync(p)) {
    return fs.realpathSync(p);
  }
  // Walk up until we find an existing ancestor, realpath it, then re-append.
  const tail: string[] = [];
  let cur = p;
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) break; // root reached
    tail.unshift(path.basename(cur));
    cur = parent;
  }
  if (cur === p) return p;
  const realParent = fs.realpathSync(cur);
  return path.join(realParent, ...tail);
}
