import crypto from 'crypto';

export const SESSION_TTL_MS =
  parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? '30', 10) * 60_000;

interface Session {
  masterKey: Buffer;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      session.masterKey.fill(0);
      sessions.delete(token);
    }
  }
}, 60_000);

cleanup.unref();

export function createSession(masterKey: Buffer): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    masterKey: Buffer.from(masterKey),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function getSession(token: string): Session | undefined {
  const session = sessions.get(token);
  if (!session) return undefined;

  const now = Date.now();
  if (session.expiresAt <= now) {
    session.masterKey.fill(0);
    sessions.delete(token);
    return undefined;
  }

  session.expiresAt = now + SESSION_TTL_MS;
  return session;
}

export function deleteSession(token: string): void {
  const session = sessions.get(token);
  if (session) {
    session.masterKey.fill(0);
    sessions.delete(token);
  }
}
