import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'url';

const modulePath = 'E:\\自己的无限画布\\TwitCanva-Video-Workflow\\server\\routes\\openaiteach-proxy.js';

async function importFreshProxyModule() {
  const href = pathToFileURL(modulePath).href;
  return import(`${href}?t=${Date.now()}-${Math.random()}`);
}

async function createServer(router) {
  const app = express();
  app.use(express.json());
  app.use('/api/openaiteach', router);

  return await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

describe('openaiteach-proxy sid 持久化', () => {
  let tempRoot;
  let sessionFile;
  let originalFetch;
  let originalEnvFile;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oat-proxy-'));
    sessionFile = path.join(tempRoot, 'openaiteach-proxy-sessions.json');
    originalFetch = global.fetch;
    originalEnvFile = process.env.OAT_PROXY_SESSION_FILE;
    process.env.OAT_PROXY_SESSION_FILE = sessionFile;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnvFile === undefined) {
      delete process.env.OAT_PROXY_SESSION_FILE;
    } else {
      process.env.OAT_PROXY_SESSION_FILE = originalEnvFile;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('登录后会把 sid 会话持久化到磁盘，并在模块重载后恢复', async () => {
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith('https://openaiteach.com/api/')) {
        return {
          ok: true,
          headers: {
            getSetCookie: () => [
              'sessionid=abc123; Path=/; HttpOnly',
              'csrftoken=xyz987; Path=/',
            ],
            get: () => null,
          },
          text: async () => JSON.stringify({
            success: true,
            data: {
              id: 9527,
              username: 'tester@example.com',
            },
          }),
        };
      }
      return originalFetch(input, init);
    });

    const firstModule = await importFreshProxyModule();
    const firstServer = await createServer(firstModule.default);

    try {
      const loginResponse = await fetch(`${firstServer.baseUrl}/api/openaiteach/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'tester@example.com',
          password: 'secret',
        }),
      });

      expect(loginResponse.status).toBe(200);
      const loginBody = await loginResponse.json();
      expect(loginBody.success).toBe(true);
      expect(typeof loginBody.oatProxySid).toBe('string');
      expect(fs.existsSync(sessionFile)).toBe(true);

      const persisted = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      expect(persisted).toHaveLength(1);
      expect(persisted[0].sid).toBe(loginBody.oatProxySid);
      expect(persisted[0].cookie).toContain('sessionid=abc123');

      const reloadedModule = await importFreshProxyModule();
      const restored = reloadedModule.getProxySessionRecord(loginBody.oatProxySid);
      expect(restored).toBeTruthy();
      expect(restored.cookie).toContain('sessionid=abc123');
      expect(restored.userId).toBe('9527');
      expect(restored.username).toBe('tester@example.com');
    } finally {
      await new Promise((resolve) => firstServer.server.close(resolve));
    }
  });

  it('登出后会同步清理磁盘上的 sid 会话', async () => {
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith('https://openaiteach.com/api/')) {
        return {
          ok: true,
          headers: {
            getSetCookie: () => ['sessionid=logout-me; Path=/; HttpOnly'],
            get: () => null,
          },
          text: async () => JSON.stringify({
            success: true,
            data: {
              id: 1,
              username: 'logout-user',
            },
          }),
        };
      }
      return originalFetch(input, init);
    });

    const proxyModule = await importFreshProxyModule();
    const serverHandle = await createServer(proxyModule.default);

    try {
      const loginResponse = await fetch(`${serverHandle.baseUrl}/api/openaiteach/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'logout-user', password: 'secret' }),
      });
      const loginBody = await loginResponse.json();
      expect(fs.existsSync(sessionFile)).toBe(true);

      const logoutResponse = await fetch(`${serverHandle.baseUrl}/api/openaiteach/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid: loginBody.oatProxySid }),
      });
      expect(logoutResponse.status).toBe(200);

      const persisted = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      expect(persisted).toHaveLength(0);
      expect(proxyModule.getProxySessionRecord(loginBody.oatProxySid)).toBeNull();
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('会忽略损坏的会话文件，并在重新登录后恢复正常持久化', async () => {
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.writeFileSync(sessionFile, '{not-json', 'utf8');

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith('https://openaiteach.com/api/')) {
        return {
          ok: true,
          headers: {
            getSetCookie: () => ['sessionid=recover-me; Path=/; HttpOnly'],
            get: () => null,
          },
          text: async () => JSON.stringify({
            success: true,
            data: {
              id: 77,
              username: 'recover-user',
            },
          }),
        };
      }
      return originalFetch(input, init);
    });

    const proxyModule = await importFreshProxyModule();
    expect(proxyModule.getProxySessionRecord('missing')).toBeNull();

    const serverHandle = await createServer(proxyModule.default);
    try {
      const loginResponse = await fetch(`${serverHandle.baseUrl}/api/openaiteach/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'recover-user', password: 'secret' }),
      });
      expect(loginResponse.status).toBe(200);
      const loginBody = await loginResponse.json();
      const persisted = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      expect(persisted).toHaveLength(1);
      expect(persisted[0].sid).toBe(loginBody.oatProxySid);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('模块重载时会忽略已过期会话，不再恢复旧 sid', async () => {
    const staleAt = Date.now() - (9 * 24 * 60 * 60 * 1000);
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify([
      {
        sid: 'stale-session',
        cookie: 'sessionid=stale',
        at: staleAt,
        userId: 'old',
        username: 'expired-user',
      },
    ]), 'utf8');

    const proxyModule = await importFreshProxyModule();
    expect(proxyModule.getProxySessionRecord('stale-session')).toBeNull();
  });
});
