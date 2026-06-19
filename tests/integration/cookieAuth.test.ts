import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Application } from 'express';

// ADR-0016 / Fase 4.C: integration tests for cookie HttpOnly + CSRF dual-mode.

const testDataDir = path.join(os.tmpdir(), 'sc-cookie-test-' + Date.now());
process.env.DATA_DIR = testDataDir;
process.env.SERVER_SECRET = 'A'.repeat(44);
process.env.ENABLE_WEBAUTHN = 'true';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_MAX = '5000';

let app: Application;
let closeDb: () => void;

beforeAll(async () => {
  fs.mkdirSync(testDataDir, { recursive: true });
  const { createServer } = await import('../../src/web/server');
  const { closeDb: _closeDb } = await import('../../src/database/db');
  app = createServer();
  closeDb = _closeDb;
});

afterAll(() => {
  closeDb?.();
  if (fs.existsSync(testDataDir)) fs.rmSync(testDataDir, { recursive: true, force: true });
});

const username = 'cookieuser';
const password = 'Str0ng!Pass#2024';

function parseSetCookie(headers: Record<string, unknown>): string[] {
  const raw = headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw as string[] : [raw as string];
}

describe('Cookie + CSRF dual-mode (ADR-0016)', () => {
  let csrfToken = '';

  it('register sets HttpOnly session cookie and a readable CSRF cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password });
    expect(res.status).toBe(201);
    expect(res.body.sessionToken).toBeDefined();
    expect(res.body.csrfToken).toBeDefined();
    csrfToken = res.body.csrfToken;

    const cookies = parseSetCookie(res.headers);
    const sessionCookie = cookies.find((c) => c.startsWith('sc_session='));
    const csrfCookie = cookies.find((c) => c.startsWith('sc_csrf='));
    expect(sessionCookie).toBeDefined();
    expect(csrfCookie).toBeDefined();
    expect(sessionCookie!.toLowerCase()).toContain('httponly');
    expect(sessionCookie!.toLowerCase()).toContain('samesite=strict');
    expect(csrfCookie!.toLowerCase()).not.toContain('httponly');
  });

  it('change-password via cookie + CSRF header succeeds', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ username, password });
    expect(login.status).toBe(200);
    const csrf = login.body.csrfToken as string;

    const res = await agent
      .post('/api/auth/change-password')
      .set('x-csrf-token', csrf)
      .send({ currentPassword: password, newPassword: 'EvenStr0ng3r!Pass#2026' });
    expect(res.status).toBe(200);
  });

  it('change-password via cookie WITHOUT CSRF header is rejected with 403', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ username, password: 'EvenStr0ng3r!Pass#2026' });
    expect(login.status).toBe(200);

    const res = await agent
      .post('/api/auth/change-password')
      .send({ currentPassword: 'EvenStr0ng3r!Pass#2026', newPassword: 'AnotherStr0ng!Pass#9' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/csrf/i);
  });

  it('change-password via cookie with WRONG CSRF header is rejected with 403', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ username, password: 'EvenStr0ng3r!Pass#2026' });
    expect(login.status).toBe(200);

    const res = await agent
      .post('/api/auth/change-password')
      .set('x-csrf-token', 'wrong-csrf-value')
      .send({ currentPassword: 'EvenStr0ng3r!Pass#2026', newPassword: 'Y3tAn0ther!Pass#7' });
    expect(res.status).toBe(403);
  });

  it('Bearer token still works for mutating requests without CSRF (legacy compat)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'EvenStr0ng3r!Pass#2026' });
    expect(login.status).toBe(200);
    const token = login.body.sessionToken as string;

    // change-password via Bearer + no CSRF header → must NOT 403
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'EvenStr0ng3r!Pass#2026', newPassword: 'BearerR0tat3d!Pass#2' });
    expect(res.status).toBe(200);
  });

  it('logout clears both cookies', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ username, password: 'BearerR0tat3d!Pass#2' });
    expect(login.status).toBe(200);

    const logout = await agent.post('/api/auth/logout').send({});
    expect(logout.status).toBe(200);
    const cookies = parseSetCookie(logout.headers);
    const sessionClear = cookies.find((c) => c.startsWith('sc_session=;'));
    const csrfClear = cookies.find((c) => c.startsWith('sc_csrf=;'));
    expect(sessionClear).toBeDefined();
    expect(csrfClear).toBeDefined();
  });

  it('GET endpoints (no body) are not subject to CSRF', async () => {
    // /api/progress requires session — but GET, so it should pass requireCsrf
    // without an X-CSRF-Token header. We just check requireCsrf doesn't 403.
    // /api/progress would normally upgrade to SSE; we abort early.
    const res = await request(app)
      .get('/api/progress')
      .set('Accept', 'text/event-stream');
    // 401 is acceptable (no session); the point is requireCsrf didn't 403 first.
    expect([200, 401]).toContain(res.status);
  });
});
