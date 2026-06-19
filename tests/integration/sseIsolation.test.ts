import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AddressInfo } from 'net';

// MED-05 / ADR-0013: e2e test that SSE /api/progress is isolated per user.
// Two concurrent SSE clients (userA, userB) must only receive their own broadcasts.

const testDataDir = path.join(os.tmpdir(), 'sc-sse-test-' + Date.now());
process.env.DATA_DIR = testDataDir;
process.env.SERVER_SECRET = 'A'.repeat(44);
process.env.ENABLE_WEBAUTHN = 'true';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_MAX = '5000';

let server: http.Server;
let baseUrl: string;
let closeDb: () => void;
let broadcastProgress: (userId: string, p: Record<string, unknown>) => void;
let userIdA = '';
let userIdB = '';
let tokenA = '';
let tokenB = '';

function openSseClient(token: string): Promise<{ events: string[]; close: () => void; ready: Promise<void> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + '/api/progress');
    const events: string[] = [];
    let resolveReady!: () => void;
    const ready = new Promise<void>((r) => (resolveReady = r));

    const req = http.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`SSE handshake failed: ${res.statusCode}`));
          return;
        }
        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => {
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) events.push(line.slice(6));
          }
        });
        // Give the server one tick to register the client in the Set.
        setTimeout(() => resolveReady(), 50);
        resolve({ events, close: () => req.destroy(), ready });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  fs.mkdirSync(testDataDir, { recursive: true });
  const { createServer } = await import('../../src/web/server');
  const { closeDb: _closeDb } = await import('../../src/database/db');
  const apiRoutes = await import('../../src/web/routes/apiRoutes');
  broadcastProgress = apiRoutes.broadcastProgress;
  closeDb = _closeDb;

  const app = createServer();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const regA = await request(app).post('/api/auth/register').send({ username: 'sseA', password: 'Str0ng!Pass#2024' });
  const regB = await request(app).post('/api/auth/register').send({ username: 'sseB', password: 'Str0ng!Pass#2024' });
  expect(regA.status).toBe(201);
  expect(regB.status).toBe(201);
  tokenA = regA.body.sessionToken;
  tokenB = regB.body.sessionToken;
  userIdA = regA.body.userId;
  userIdB = regB.body.userId;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDb?.();
  if (fs.existsSync(testDataDir)) fs.rmSync(testDataDir, { recursive: true, force: true });
});

describe('SSE /api/progress isolation (MED-05)', () => {
  it('rejects connection without session token', async () => {
    const res = await request(server).get('/api/progress');
    expect(res.status).toBe(401);
  });

  it('delivers a broadcast only to the targeted user', async () => {
    const a = await openSseClient(tokenA);
    const b = await openSseClient(tokenB);
    await a.ready;
    await b.ready;

    broadcastProgress(userIdA, { type: 'encrypt', filename: 'only-for-A.bin', percent: 42 });
    // Give the SSE stream time to flush.
    await new Promise((r) => setTimeout(r, 100));

    expect(a.events.some((e) => e.includes('only-for-A.bin'))).toBe(true);
    expect(b.events.some((e) => e.includes('only-for-A.bin'))).toBe(false);

    broadcastProgress(userIdB, { type: 'decrypt', filename: 'only-for-B.bin', percent: 17 });
    await new Promise((r) => setTimeout(r, 100));

    expect(b.events.some((e) => e.includes('only-for-B.bin'))).toBe(true);
    expect(a.events.some((e) => e.includes('only-for-B.bin'))).toBe(false);

    a.close();
    b.close();
  });
});
