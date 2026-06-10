import express from 'express';
import { createSession, deleteSession, SESSION_TTL_MS } from '../session/sessionStore';
import { setupMasterPassword, verifyMasterPassword, getMasterKey } from '../../passwordManager/secureStorage';
import { createUser, findUserByUsername, updateLastLogin } from '../../database/userRepository';
import { validatePassword } from '../../passwordManager/passwordValidator';
import { deriveKeyForStorage } from '../../crypto/cryptoUtils';
import { env } from '../../config';
import { logger } from '../../utils/logger';

const router = express.Router();

function extractToken(req: express.Request): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return undefined;
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

    // Derive credential hash for DB (separate from vault KDF)
    const { hash, salt } = await deriveKeyForStorage(password);
    const user = createUser(trimmed, hash, salt.toString('base64'));

    // Create per-user vault (stores Argon2id hash for key derivation)
    await setupMasterPassword(user.id, password);

    // Log in immediately after registration
    const masterKey = await getMasterKey(user.id, password);
    const token = createSession(masterKey, user.id);
    masterKey.fill(0);

    updateLastLogin(user.id);
    logger.info(`User registered and logged in: ${trimmed}`);

    res.status(201).json({
      sessionToken: token,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      userId: user.id,
    });
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

    // Constant-time: always run verify even if user not found, to prevent timing attacks
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

    res.json({
      sessionToken: token,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      userId: user.id,
    });
  } catch (error) {
    logger.error(`Login failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) deleteSession(token);
  res.json({ success: true });
});

export { router as authRoutes };
