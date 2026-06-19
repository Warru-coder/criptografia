import express from 'express';
import { createSession, deleteSession, deleteUserSessions, getSession, SESSION_TTL_MS } from '../session/sessionStore';
import { setupMasterPassword, verifyMasterPassword, getMasterKey, changeMasterPassword } from '../../passwordManager/secureStorage';
import { createUser, findUserByUsername, updateLastLogin, setWrappedKey } from '../../database/userRepository';
import { validatePassword } from '../../passwordManager/passwordValidator';
import { deriveKeyForStorage } from '../../crypto/cryptoUtils';
import { env } from '../../config';
import { logger } from '../../utils/logger';
import {
  setSessionCookies,
  clearSessionCookies,
  generateCsrfToken,
  readSessionTokenFromCookie,
} from '../session/cookieSession';
import { requireCsrf } from '../middleware/requireCsrf';

const router = express.Router();

// Dual-mode token extraction: cookie first, Bearer fallback. See ADR-0016.
function extractToken(req: express.Request): string | undefined {
  const fromCookie = readSessionTokenFromCookie(req);
  if (fromCookie) return fromCookie;
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return undefined;
}

function issueSessionResponse(
  res: express.Response,
  userId: string,
  token: string,
  status: number,
  extra: Record<string, unknown> = {},
): void {
  const csrfToken = generateCsrfToken();
  setSessionCookies(res, token, csrfToken);
  res.status(status).json({
    sessionToken: token,
    csrfToken,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    userId,
    ...extra,
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    if (!env.enableRegistration) {
      res.status(403).json({ error: 'Registration is disabled.' });
      return;
    }

    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters.' });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    const trimmed = username.trim().toLowerCase();

    if (findUserByUsername(trimmed)) {
      res.status(409).json({ error: 'Username already taken.' });
      return;
    }

    const { hash, salt } = await deriveKeyForStorage(password);
    const user = createUser(trimmed, hash, salt.toString('base64'));

    await setupMasterPassword(user.id, password);

    const masterKey = await getMasterKey(user.id, password);
    const token = createSession(masterKey, user.id);
    masterKey.fill(0);

    updateLastLogin(user.id);
    logger.info(`User registered and logged in: ${trimmed}`);

    issueSessionResponse(res, user.id, token, 201);
  } catch (error) {
    logger.error(`Register failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }
    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }

    const trimmed = username.trim().toLowerCase();
    const user = findUserByUsername(trimmed);

    const isValid = user ? await verifyMasterPassword(user.id, password) : false;

    if (!user || !isValid) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const masterKey = await getMasterKey(user.id, password);
    const token = createSession(masterKey, user.id);
    masterKey.fill(0);

    updateLastLogin(user.id);
    logger.info(`User logged in: ${trimmed}`);

    issueSessionResponse(res, user.id, token, 200);
  } catch (error) {
    logger.error(`Login failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) deleteSession(token);
  clearSessionCookies(res);
  res.json({ success: true });
});

// MED-04 / ADR-0014: POST /api/auth/change-password
// CSRF required when authenticated via cookie (no-op for Bearer callers).
router.post('/change-password', requireCsrf, async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) { res.status(401).json({ error: 'Authentication required.' }); return; }
    const session = getSession(token);
    if (!session) { res.status(401).json({ error: 'Session expired.' }); return; }

    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'currentPassword and newPassword are required.' });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    const newMasterKey = await changeMasterPassword(session.userId, currentPassword, newPassword);

    deleteUserSessions(session.userId);
    setWrappedKey(session.userId, '');

    const newToken = createSession(newMasterKey, session.userId);
    newMasterKey.fill(0);

    logger.info(`Password changed for user ${session.userId}; sessions rotated.`);
    issueSessionResponse(res, session.userId, newToken, 200, { passkeyResetRequired: true });
  } catch (error) {
    const msg = (error as Error).message ?? 'Internal error';
    if (msg.includes('Current password is incorrect')) {
      res.status(401).json({ error: msg });
      return;
    }
    logger.error(`Change password failed: ${msg}`);
    res.status(500).json({ error: 'Internal error during password change.' });
  }
});

export { router as authRoutes };
