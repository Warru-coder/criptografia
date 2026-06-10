import express from 'express';
import { verifyMasterPassword, getMasterKey } from '../../passwordManager/secureStorage';
import { createSession, deleteSession, SESSION_TTL_MS } from '../session/sessionStore';
import { logger } from '../../utils/logger';

const router = express.Router();

function extractToken(req: express.Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return undefined;
}

router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const isValid = await verifyMasterPassword(password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const masterKey = await getMasterKey(password);
    const token = createSession(masterKey);
    masterKey.fill(0);

    logger.info('Session created');
    res.json({
      sessionToken: token,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
  } catch (error) {
    logger.error(`Login failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) deleteSession(token);
  res.json({ success: true });
});

export { router as authRoutes };
