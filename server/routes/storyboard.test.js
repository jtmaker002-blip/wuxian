import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'url';
import path from 'path';

const storyboardModuleHref = pathToFileURL(
  path.join(process.cwd(), 'server', 'routes', 'storyboard.js')
).href;

const generateOpenAITextMock = vi.fn();
const generateOpenAIImageMock = vi.fn();

vi.mock('../services/openai.js', () => ({
  generateOpenAIText: (...args) => generateOpenAITextMock(...args),
  generateOpenAIImage: (...args) => generateOpenAIImageMock(...args),
}));

async function importFreshStoryboardRouter() {
  vi.resetModules();
  const module = await import(`${storyboardModuleHref}?t=${Date.now()}-${Math.random()}`);
  return module.default;
}

async function createServer(router, locals = {}) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  Object.assign(app.locals, locals);
  app.use('/api/storyboard', router);

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

describe('storyboard hosted text routing', () => {
  beforeEach(() => {
    generateOpenAITextMock.mockReset();
    generateOpenAIImageMock.mockReset();
  });

  it('uses hosted token text generation for script generation even without local GEMINI_API_KEY', async () => {
    generateOpenAITextMock.mockResolvedValue(JSON.stringify({
      styleAnchor: 'cinematic',
      characterDNA: { Hero: 'Consistent hero DNA' },
      scenes: [
        {
          sceneNumber: 1,
          description: '@Hero enters the scene',
          cameraAngle: 'Wide shot',
          cameraMovement: 'Static',
          lighting: 'soft',
          mood: 'hopeful',
        },
      ],
    }));

    const router = await importFreshStoryboardRouter();
    const serverHandle = await createServer(router);

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/storyboard/generate-scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: 'A hero enters the scene.',
          sceneCount: 1,
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.scripts).toHaveLength(1);
      expect(generateOpenAITextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
          model: 'gpt-4o-mini',
        })
      );
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('uses hosted token text generation for story brainstorming without local GEMINI_API_KEY', async () => {
    generateOpenAITextMock.mockResolvedValue('A cinematic story idea.');

    const router = await importFreshStoryboardRouter();
    const serverHandle = await createServer(router);

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/storyboard/brainstorm-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterDescriptions: [{ name: 'Hero', description: 'Brave protagonist' }],
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.story).toBe('A cinematic story idea.');
      expect(generateOpenAITextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('uses hosted token text generation for story optimization without local GEMINI_API_KEY', async () => {
    generateOpenAITextMock.mockResolvedValue('Optimized story.');

    const router = await importFreshStoryboardRouter();
    const serverHandle = await createServer(router);

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/storyboard/optimize-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: 'Original story.',
          characterNames: ['Hero'],
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.optimizedStory).toBe('Optimized story.');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('uses hosted token image generation for composite storyboard previews without local GEMINI_API_KEY', async () => {
    generateOpenAIImageMock.mockResolvedValue(Buffer.from('composite-image'));

    const router = await importFreshStoryboardRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: path.join(process.cwd(), 'library', 'images'),
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/storyboard/generate-composite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scripts: [
            {
              sceneNumber: 1,
              description: '@Hero enters the scene',
              cameraAngle: 'Wide shot',
              mood: 'hopeful',
            },
          ],
          styleAnchor: 'cinematic',
          characterDNA: { Hero: 'Consistent hero DNA' },
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.imageUrl).toContain('/library/images/storyboard_composite_');
      expect(generateOpenAIImageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
          imageModel: 'gemini-3-pro-image-preview',
        })
      );
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('forwards storyboard reference images into the hosted composite image chain', async () => {
    generateOpenAIImageMock.mockResolvedValue(Buffer.from('composite-image'));

    const router = await importFreshStoryboardRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: path.join(process.cwd(), 'library', 'images'),
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/storyboard/generate-composite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scripts: [
            {
              sceneNumber: 1,
              description: '@Hero enters the scene',
              cameraAngle: 'Wide shot',
              mood: 'hopeful',
            },
          ],
          styleAnchor: 'cinematic',
          characterDNA: { Hero: 'Consistent hero DNA' },
          referenceImages: [
            {
              name: 'Hero',
              category: 'Character',
              url: 'data:image/png;base64,YWJj',
            },
          ],
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      expect(generateOpenAIImageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          imageBase64Array: ['data:image/png;base64,YWJj'],
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
