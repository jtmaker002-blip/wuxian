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

  it('injects focus selection and tool context into the executed image prompt', async () => {
    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'focus-image-node',
          prompt: '只微调人物面部表情',
          imageModel: 'gemini-3.1-flash-image-preview',
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
          imageToolMode: 'enhance',
          focusSelection: {
            x: 10,
            y: 20,
            width: 30,
            height: 40,
          },
        }),
      });

      expect(response.status).toBe(200);
      expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('只微调人物面部表情'),
        })
      );
      expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('聚焦区域'),
        })
      );
      expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('x=10'),
        })
      );
      expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('图片工具：enhance'),
        })
      );
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it.each([
    ['enhance', undefined, ['图片工具：enhance', '高清增强']],
    ['grid', undefined, ['图片工具：grid', '九宫格']],
    ['split', undefined, ['图片工具：split', '分块']],
    ['mark', undefined, ['图片工具：mark', '标记区域']],
    ['multi-angle', undefined, ['图片工具：multi-angle', '多角度']],
    ['focus', { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, ['图片工具：focus', '焦点编辑', 'x=0.1']],
    [
      'lighting',
      undefined,
      ['图片工具：lighting', '打光', 'brightness=12'],
      {
        mode: 'local',
        smartMode: true,
        brightness: 12,
        color: '#ffeeaa',
        keyLight: 'left',
        rimLight: true,
      },
    ],
  ])(
    'persists backend prompt and metadata context for %s image tool',
    async (imageToolMode, focusSelection, expectedPromptParts, imageLightingSettings) => {
      const router = await importFreshGenerationRouter();
      const serverHandle = await createServer(router, {
        IMAGES_DIR: imagesDir,
      });

      try {
        const nodeId = `${imageToolMode}-tool-node`;
        const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId,
            prompt: '保持主体一致，只应用当前图片工具',
            imageModel: 'gemini-3.1-flash-image-preview',
            providerApiKey: 'sk-hosted-token',
            providerBaseUrl: 'https://openaiteach.com/v1',
            imageToolMode,
            imageToolAction: '扩图',
            focusSelection,
            imageLightingSettings,
          }),
        });

        expect(response.status).toBe(200);
        const executedPrompt = mockGenerateOpenAiTeachGeminiImage.mock.calls.at(-1)?.[0]?.prompt;
        expect(executedPrompt).toContain('保持主体一致，只应用当前图片工具');
        for (const expectedPart of expectedPromptParts) {
          expect(executedPrompt).toContain(expectedPart);
        }

        const metadata = JSON.parse(
          fs.readFileSync(path.join(imagesDir, `${nodeId}.json`), 'utf8')
        );
        expect(metadata.prompt).toBe(executedPrompt);
        expect(metadata.imageToolMode).toBe(imageToolMode);
        expect(metadata.imageToolAction).toBe('扩图');
        expect(executedPrompt).toContain('具体工具动作：扩图');
        expect(metadata.imageToolContext).toMatchObject({
          mode: imageToolMode,
          promptInstructions: expect.arrayContaining([
            expect.stringContaining(`图片工具：${imageToolMode}`),
          ]),
        });
        expect(metadata.imageToolContext.focusSelection).toEqual(focusSelection || null);
        expect(metadata.imageToolContext.lightingSettings).toEqual(
          imageLightingSettings || null
        );
      } finally {
        await new Promise((resolve) => serverHandle.server.close(resolve));
      }
    }
  );

  it.each([
    ['enhance', '高清', '执行真实高清增强'],
    ['enhance', '扩图', '向画面外侧自然延展'],
    ['enhance', '重绘', '只重做选定区域内容'],
    ['enhance', '擦除', '移除选定区域内的不需要内容'],
    ['enhance', '抠图', '提取选定主体或素材'],
    ['enhance', '裁剪', '按选定区域重新构图'],
    ['grid', '剧情推演四宫格', '九宫格动作：剧情推演四宫格'],
    ['split', '3x3 切分', '宫格切分：按 3 列 x 3 行'],
    ['lighting', '打光', '把照明变化真实作用在主体和环境上'],
  ])(
    'adds action-specific fallback prompt guidance for %s / %s',
    async (imageToolMode, imageToolAction, expectedPromptPart) => {
      const router = await importFreshGenerationRouter();
      const serverHandle = await createServer(router, {
        IMAGES_DIR: imagesDir,
      });

      try {
        const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: `${imageToolMode}-${imageToolAction}-fallback-node`,
            prompt: '走后端兜底执行真实图片工具',
            imageModel: 'gemini-3.1-flash-image-preview',
            providerApiKey: 'sk-hosted-token',
            providerBaseUrl: 'https://openaiteach.com/v1',
            imageToolMode,
            imageToolAction,
            focusSelection: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
            imageLightingSettings:
              imageToolMode === 'lighting'
                ? {
                    mode: 'global',
                    smartMode: false,
                    brightness: 50,
                    color: '#ffffff',
                    keyLight: 'front',
                    rimLight: false,
                  }
                : undefined,
          }),
        });

        expect(response.status).toBe(200);
        const executedPrompt = mockGenerateOpenAiTeachGeminiImage.mock.calls.at(-1)?.[0]?.prompt;
        expect(executedPrompt).toContain(expectedPromptPart);
        expect(executedPrompt).toContain(`具体工具动作：${imageToolAction}`);
      } finally {
        await new Promise((resolve) => serverHandle.server.close(resolve));
      }
    }
  );

  it('injects preserve and ignore annotation context into the executed image prompt', async () => {
    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'annotation-image-node',
          prompt: '根据标记生成',
          imageModel: 'gemini-3.1-flash-image-preview',
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
          imageAnnotations: [
            {
              id: 'keep-1',
              type: 'preserve',
              label: '保留区域',
              selection: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
            },
            {
              id: 'ignore-1',
              type: 'ignore',
              label: '忽略区域',
              selection: { x: 0.5, y: 0.6, width: 0.2, height: 0.1 },
            },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const executedPrompt = mockGenerateOpenAiTeachGeminiImage.mock.calls.at(-1)?.[0]?.prompt;
      expect(executedPrompt).toContain('保留区域必须尽量保持不变');
      expect(executedPrompt).toContain('忽略区域不作为主体参考');

      const metadata = JSON.parse(
        fs.readFileSync(path.join(imagesDir, 'annotation-image-node.json'), 'utf8')
      );
      expect(metadata.imageAnnotations).toHaveLength(2);
      expect(metadata.imageToolContext.annotations).toHaveLength(2);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('injects camera control settings into the executed image prompt and metadata', async () => {
    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'camera-control-image-node',
          prompt: '按摄像机设置生成',
          imageModel: 'gemini-3.1-flash-image-preview',
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
          imageCameraSettings: {
            camera: 'Panavision DXL2',
            lens: 'Zeiss Ultra Prime',
            focalLengthMm: '35',
            aperture: 'f/4',
          },
        }),
      });

      expect(response.status).toBe(200);
      const executedPrompt = mockGenerateOpenAiTeachGeminiImage.mock.calls.at(-1)?.[0]?.prompt;
      expect(executedPrompt).toContain('摄像机控制');
      expect(executedPrompt).toContain('camera=Panavision DXL2');
      expect(executedPrompt).toContain('focalLength=35mm');

      const metadata = JSON.parse(
        fs.readFileSync(path.join(imagesDir, 'camera-control-image-node.json'), 'utf8')
      );
      expect(metadata.imageCameraSettings).toEqual({
        camera: 'Panavision DXL2',
        lens: 'Zeiss Ultra Prime',
        focalLengthMm: '35',
        aperture: 'f/4',
      });
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
