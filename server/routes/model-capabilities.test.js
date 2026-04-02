import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'url';

const modulePath = 'E:\\自己的无限画布\\TwitCanva-Video-Workflow\\server\\routes\\model-capabilities.js';

async function importFreshRouteModule() {
  const href = pathToFileURL(modulePath).href;
  return import(`${href}?t=${Date.now()}-${Math.random()}`);
}

async function createServer(router) {
  const app = express();
  app.use('/api/model-capabilities', router);

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

describe('model-capabilities route', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('video 路由会过滤上游未知模型，只返回白名单内项目', async () => {
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith('https://openaiteach.com/api/model-capabilities/video')) {
        return {
          ok: true,
          json: async () => ({
            video: {
              'veo3.1': { serverModelId: 'veo-3.1-fast-generate-preview' },
              'unknown-video': { serverModelId: 'unknown-video' },
            },
          }),
        };
      }
      return originalFetch(input, init);
    });

    const routeModule = await importFreshRouteModule();
    const serverHandle = await createServer(routeModule.default);

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/model-capabilities/video`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.video).toHaveProperty('veo3.1');
      expect(body.video).not.toHaveProperty('unknown-video');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('voice 路由在上游失败时只返回本地白名单内 override', async () => {
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith('https://openaiteach.com/api/model-capabilities/voice')) {
        return {
          ok: false,
          status: 502,
        };
      }
      return originalFetch(input, init);
    });

    const routeModule = await importFreshRouteModule();
    const serverHandle = await createServer(routeModule.default);

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/model-capabilities/voice`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('voice');
      expect(body.voice).not.toHaveProperty('unknown-voice');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
