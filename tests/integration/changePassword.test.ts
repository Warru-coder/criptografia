import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Application } from 'express';

// MED-04 / ADR-0014: integration test for password rotation endpoint.

const testDataDir = path.join(os.tmpdir(), 'sc-changepw-test-' + Date.now());
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

describe('POST /api/auth/change-password', () => {
  const username = 'rotuser';
  const oldPw = 'Str0ng!Pass#2024';
  const newPw = 'EvenStr0ng3r!Pass#2026';
  let oldToken = '';

  it('registers initial user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: oldPw });
    expect(res.status).toBe(201);
    oldToken = res.body.sessionToken;
  });

  it('rejects change with wrong current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'WrongPass!9999', newPassword: newPw });
    expect(res.status).toBe(401);
  });

  it('rejects change with weak new password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: oldPw, newPassword: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.errors?.length).toBeGreaterThan(0);
  });

  it('changes password, rotates session, and invalidates the old token', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: oldPw, newPassword: newPw });
    expect(res.status).toBe(200);
    expect(res.body.sessionToken).toBeDefined();
    expect(res.body.sessionToken).not.toBe(oldToken);
    expect(res.body.passkeyResetRequired).toBe(true);

    // Old token must be invalid now.
    const oldUse = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: newPw, newPassword: 'irrelevant!Pass#2030' });
    expect(oldUse.status).toBe(401);
  });

  it('login with new password works; old password fails', async () => {
    const loginNew = await request(app)
      .post('/api/auth/login')
      .send({ username, password: newPw });
    expect(loginNew.status).toBe(200);

    const loginOld = await request(app)
      .post('/api/auth/login')
      .send({ username, password: oldPw });
    expect(loginOld.status).toBe(401);
  });
});
