import express from 'express';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { env } from '../../config';
import { findUserById, findUserByUsername, updateLastLogin, setWrappedKey } from '../../database/userRepository';
import {
  saveCredential,
  findCredentialByCredentialId,
  getCredentialsForUser,
  updateCounter,
} from '../../database/webauthnRepository';
import { createSession, SESSION_TTL_MS, getSession } from '../session/sessionStore';
import { setSessionCookies, generateCsrfToken, readSessionTokenFromCookie } from '../session/cookieSession';
import { logger } from '../../utils/logger';

const router = express.Router();

// Temporary in-memory challenge store (keyed by userId)
const pendingRegistration = new Map<string, string>();
const pendingAuthentication = new Map<string, string>();

function extractToken(req: express.Request): string | undefined {
  const fromCookie = readSessionTokenFromCookie(req);
  if (fromCookie) return fromCookie;
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return undefined;
}

// CRIT-03 / ADR-005: wrap master key using HKDF-derived KEK from SERVER_SECRET.
// Previous version padded the raw secret with '0' bytes → low entropy when secret was short.
// Now: SERVER_SECRET must be ≥32 bytes (enforced at startup, see src/config.ts), and
// the actual KEK is derived via HKDF-SHA256 with explicit domain separation.
const WRAP_KEY_INFO = Buffer.from('SecureCrypt-v2-webauthn-wrap-key');
const WRAP_FORMAT_VERSION = 0x02;

function deriveWrapKey(): Buffer {
  // SERVER_SECRET length is validated at startup; this is a defensive assert.
  if (!env.serverSecret || env.serverSecret.length < 32) {
    throw new Error('SERVER_SECRET must be ≥32 chars when WebAuthn is enabled.');
  }
  const seed = Buffer.from(env.serverSecret, 'utf-8');
  const ab = crypto.hkdfSync('sha256', seed, Buffer.alloc(0), WRAP_KEY_INFO, 32);
  return Buffer.from(ab);
}

function wrapMasterKey(masterKey: Buffer): string {
  const kek = deriveWrapKey();
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    const encrypted = Buffer.concat([cipher.update(masterKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Layout: [version:1][iv:12][tag:16][ciphertext:N]
    return Buffer.concat([Buffer.from([WRAP_FORMAT_VERSION]), iv, tag, encrypted]).toString('base64');
  } finally {
    kek.fill(0);
  }
}

function unwrapMasterKey(wrapped: string): Buffer {
  const buf = Buffer.from(wrapped, 'base64');
  const version = buf[0];
  if (version !== WRAP_FORMAT_VERSION) {
    // v1 (pre-CRIT-03 fix) wrapped keys are no longer accepted: user must re-link
    // their passkey by logging in with their password (which re-wraps with v2).
    throw new Error(
      `Wrapped key format v${version} is not supported. Log in with your password and re-link the passkey.`,
    );
  }
  const kek = deriveWrapKey();
  try {
    const iv = buf.subarray(1, 13);
    const tag = buf.subarray(13, 29);
    const encrypted = buf.subarray(29);
    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } finally {
    kek.fill(0);
  }
}

// POST /api/auth/webauthn/registration-options
// Requires active password session to associate the passkey
router.post('/registration-options', async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) { res.status(401).json({ error: 'Authentication required.' }); return; }

    const session = getSession(token);
    if (!session) { res.status(401).json({ error: 'Session expired.' }); return; }

    const user = findUserById(session.userId);
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    const existingCredentials = getCredentialsForUser(user.id).map(c => ({
      id: c.credentialId,
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: env.rpName,
      rpID: env.rpId,
      userID: Buffer.from(user.id),
      userName: user.username,
      userDisplayName: user.username,
      excludeCredentials: existingCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    pendingRegistration.set(user.id, options.challenge);

    // Wrap the master key now so WebAuthn login can recover it without a password
    if (!user.wrappedKey) {
      const wrapped = wrapMasterKey(session.masterKey);
      setWrappedKey(user.id, wrapped);
    }

    res.json(options);
  } catch (error) {
    logger.error(`WebAuthn registration options: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/auth/webauthn/registration-verify
router.post('/registration-verify', async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) { res.status(401).json({ error: 'Authentication required.' }); return; }

    const session = getSession(token);
    if (!session) { res.status(401).json({ error: 'Session expired.' }); return; }

    const user = findUserById(session.userId);
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    const expectedChallenge = pendingRegistration.get(user.id);
    if (!expectedChallenge) { res.status(400).json({ error: 'No pending registration.' }); return; }

    const body = req.body as RegistrationResponseJSON;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: env.rpOrigin,
      expectedRPID: env.rpId,
    });

    pendingRegistration.delete(user.id);

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Verification failed.' });
      return;
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    saveCredential(
      user.id,
      Buffer.from(credential.id).toString('base64url'),
      Buffer.from(credential.publicKey).toString('base64'),
      credential.counter,
      credentialDeviceType,
      credentialBackedUp,
    );

    logger.info(`WebAuthn credential registered for user: ${user.username}`);
    res.json({ verified: true });
  } catch (error) {
    logger.error(`WebAuthn registration verify: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/auth/webauthn/authentication-options
router.post('/authentication-options', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) { res.status(400).json({ error: 'Username is required.' }); return; }

    const user = findUserByUsername((username as string).trim().toLowerCase());
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    const credentials = getCredentialsForUser(user.id).map(c => ({
      id: c.credentialId,
      type: 'public-key' as const,
    }));

    if (credentials.length === 0) {
      res.status(400).json({ error: 'No passkeys registered for this user.' });
      return;
    }

    const options = await generateAuthenticationOptions({
      rpID: env.rpId,
      allowCredentials: credentials,
      userVerification: 'preferred',
    });

    pendingAuthentication.set(user.id, options.challenge);
    res.json({ ...options, userId: user.id });
  } catch (error) {
    logger.error(`WebAuthn auth options: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/auth/webauthn/authentication-verify
router.post('/authentication-verify', async (req, res) => {
  try {
    const { userId, response } = req.body as { userId: string; response: AuthenticationResponseJSON };
    if (!userId || !response) { res.status(400).json({ error: 'userId and response are required.' }); return; }

    const user = findUserById(userId);
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    const expectedChallenge = pendingAuthentication.get(userId);
    if (!expectedChallenge) { res.status(400).json({ error: 'No pending authentication.' }); return; }

    const credentialId = response.id;
    const credRow = findCredentialByCredentialId(credentialId);
    if (!credRow) { res.status(400).json({ error: 'Credential not found.' }); return; }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: env.rpOrigin,
      expectedRPID: env.rpId,
      credential: {
        id: credRow.credentialId,
        publicKey: Buffer.from(credRow.publicKey, 'base64'),
        counter: credRow.counter,
        transports: undefined,
      },
    });

    pendingAuthentication.delete(userId);

    if (!verification.verified) {
      res.status(401).json({ error: 'Authentication failed.' });
      return;
    }

    updateCounter(credentialId, verification.authenticationInfo.newCounter);

    if (!user.wrappedKey) {
      res.status(400).json({ error: 'No wrapped key found. Please log in with password first to link your passkey.' });
      return;
    }

    const masterKey = unwrapMasterKey(user.wrappedKey);
    const token = createSession(masterKey, user.id);
    masterKey.fill(0);

    updateLastLogin(user.id);
    logger.info(`WebAuthn login for user: ${user.username}`);

    // ADR-0016 / Fase 4.C: emit session cookie + CSRF token for dual-mode auth.
    const csrfToken = generateCsrfToken();
    setSessionCookies(res, token, csrfToken);
    res.json({
      sessionToken: token,
      csrfToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      userId: user.id,
    });
  } catch (error) {
    logger.error(`WebAuthn auth verify: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as webauthnRoutes };
