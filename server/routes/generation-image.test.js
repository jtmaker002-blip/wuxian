import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'url';

const generationModuleHref = pathToFileURL(
  path.join(process.cwd(), 'server', 'routes', 'generation.js')
).href;

const mockGenerateOpenAIImage = vi.fn();
const mockGenerateOpenAiTeachGeminiImage = vi.fn();
const mockResolveGeminiImageModel = vi.fn((modelId) => modelId || 'gemini-3-pro-image-preview');

function registerGenerationMocks() {
  vi.doMock('../services/openai.js', () => ({
    generateOpenAIImage: mockGenerateOpenAIImage,
    generateOpenAIVideo: vi.fn(),
  }));
  vi.doMock('../services/openaiteachGeminiImage.js', () => ({
    generateOpenAiTeachGeminiImage: mockGenerateOpenAiTeachGeminiImage,
  }));
  vi.doMock('../services/gemini.js', () => ({
    DEFAULT_GEMINI_IMAGE_MODEL: 'gemini-3-pro-image-preview',
    DEFAULT_VEO_VIDEO_MODEL: 'veo-3.1-fast-generate-preview',
    generateGeminiImage: vi.fn(),
    generateVeoVideo: vi.fn(),
    resolveGeminiImageModel: mockResolveGeminiImageModel,
    resolveVeoVideoModel: vi.fn((modelId) => modelId || 'veo-3.1-fast-generate-preview'),
  }));
  vi.doMock('../services/kling.js', () => ({
    generateKlingVideo: vi.fn(),
    generateKlingImage: vi.fn(),
    generateKlingMultiImage: vi.fn(),
    generateKlingTextToVideo: vi.fn(),
    resolveKlingVideoExecutionDetails: vi.fn(),
  }));
  vi.doMock('../services/hailuo.js', () => ({
    generateHailuoVideo: vi.fn(),
    generateHailuoSubjectVideo: vi.fn(),
    resolveHailuoVideoExecutionDetails: vi.fn(),
    resolveHailuoSubjectExecutionDetails: vi.fn(),
  }));
  vi.doMock('../services/xai.js', () => ({
    generateXAIVideo: vi.fn(),
  }));
  vi.doMock('../services/seedance.js', () => ({
    generateSeedanceVideo: vi.fn(),
  }));
}

async function importFreshGenerationRouter() {
  vi.resetModules();
  registerGenerationMocks();
  const module = await import(`${generationModuleHref}?t=${Date.now()}-${Math.random()}`);
  return module.default;
}

async function createServer(router, locals) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  Object.assign(app.locals, locals);
  app.use('/api', router);

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

describe('generation /generate-image hosted token routing', () => {
  let tempRoot;
  let imagesDir;

  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generation-image-route-'));
    imagesDir = path.join(tempRoot, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    mockGenerateOpenAIImage.mockResolvedValue(Buffer.from('hosted-image'));
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(Buffer.from('hosted-image'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('uses hosted provider token for Nano Banana image models even without local GEMINI_API_KEY', async () => {
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    );

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'hosted-image-node',
          prompt: '生成一个亚洲美女',
          imageModel: 'gemini-3.1-flash-image-preview',
          aspectRatio: '16:9',
          resolution: '1K',
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imageModel: 'gemini-3.1-flash-image-preview',
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );

      const metadata = JSON.parse(
        fs.readFileSync(path.join(imagesDir, 'hosted-image-node.json'), 'utf8')
      );
      expect(metadata.requestedModel).toBe('gemini-3.1-flash-image-preview');
      expect(metadata.model).toBe('gemini-3.1-flash-image-preview');
      expect(metadata.executionProvider).toBe('openaiteach-hosted');
      expect(body.resultUrl).toMatch(/\.jpg$/);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('passes hosted-only image models like Midjourney through the hosted image chain', async () => {
    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'midjourney-node',
          prompt: 'generate a cinematic portrait',
          imageModel: 'midjourney-v6',
          aspectRatio: '16:9',
          resolution: '1K',
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      expect(mockGenerateOpenAIImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imageModel: 'midjourney-v6',
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );

      const statusResponse = await fetch(
        `${serverHandle.baseUrl}/api/generation-status/midjourney-node`
      );
      expect(statusResponse.status).toBe(200);
      await expect(statusResponse.json()).resolves.toMatchObject({
        status: 'success',
        requestedModel: 'midjourney-v6',
        executedModel: 'midjourney-v6',
        executionProvider: 'openaiteach-hosted',
      });
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('returns a truthful fallback message for local-key-only image chains when a hosted token is bound', async () => {
    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'local-image-node',
          prompt: '生成一张参考图',
          imageModel: 'kling-v1-5',
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('OpenAiTeach Token 托管执行链');
      expect(body.error).toContain('KLING_ACCESS_KEY');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
