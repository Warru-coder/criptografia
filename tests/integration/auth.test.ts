import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Isolated DB per test file
const tempDb = path.join(os.tmpdir(), `sc_auth_test_${Date.now()}.db`);
process.env.DB_PATH = tempDb;
process.env.SESSION_TTL_MINUTES = '30';
process.env.ENABLE_REGISTRATION = 'true';
process.env.ENABLE_WEBAUTHN = 'false';
process.env.ENABLE_AI = 'false';
process.env.SERVER_SECRET = 'test-secret-32-chars-padded-xxxx';
process.env.LOGIN_RATE_LIMIT_MAX = '100';
process.env.RATE_LIMIT_MAX = '500';
process.env.NODE_ENV = 'test';

// Import after env setup
let app: import('express').Application;
let closeDb: () => void;

beforeAll(async () => {
  const { createServer } = await import('../../src/web/server');
  const { closeDb: _closeDb } = await import('../../src/database/db');
  app = createServer();
  closeDb = _closeDb;
});

afterAll(() => {
  closeDb();
  const files = [tempDb, `${tempDb}-wal`, `${tempDb}-shm`];
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* best-effort */ }
  }
});

// ─── /api/auth/register ────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates a new user and returns a session token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'Str0ng!Pass#2024' })
      .expect(201);

    expect(res.body).toHaveProperty('sessionToken');
    expect(res.body).toHaveProperty('userId');
    expect(res.body.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'dupuser', password: 'Str0ng!Pass#2024' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dupuser', password: 'Str0ng!Pass#2024' })
      .expect(409);

    expect(res.body.error).toMatch(/taken/i);
  });

  it('rejects too-short username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', password: 'Str0ng!Pass#2024' })
      .expect(400);

    expect(res.body.error).toMatch(/3 characters/i);
  });

  it('rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'weakpwduser', password: 'weak' })
      .expect(400);

    expect(res.body).toHaveProperty('errors');
  });

  it('rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'nopwduser' })
      .expect(400);

    expect(res.body.error).toMatch(/password/i);
  });
});

// ─── /api/auth/login ───────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const username = 'loginuser';
  const password = 'Str0ng!Pass#2024';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username, password });
  });

  it('returns a session token with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    expect(res.body).toHaveProperty('sessionToken');
    expect(res.body.sessionToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'WrongPass!99' })
      .expect(401);

    expect(res.body.error).toMatch(/invalid/i);
  });

  it('rejects unknown username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody_here', password })
      .expect(401);

    expect(res.body.error).toMatch(/invalid/i);
  });

  it('rejects missing username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password })
      .expect(400);

    expect(res.body.error).toMatch(/username/i);
  });
});

// ─── /api/auth/logout ──────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns success even without a token', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('returns success with a valid Bearer token', async () => {
    // Register and get token
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'logoutuser', password: 'Str0ng!Pass#2024' });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${reg.body.sessionToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
