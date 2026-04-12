import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'url';

const generationModuleHref = pathToFileURL(
  path.join(process.cwd(), 'server', 'routes', 'generation.js')
).href;

const mockGenerateKlingVideo = vi.fn();
const mockGenerateKlingTextToVideo = vi.fn();
const mockGenerateOpenAIVideo = vi.fn();
const mockGenerateOpenAiTeachUnifiedVideo = vi.fn();
const mockGenerateVeoVideo = vi.fn();
const SUPPORTED_KLING_VIDEO_MODELS = new Set([
  'kling-v2-1',
  'kling-v2-1-master',
  'kling-v2-5-turbo',
  'kling-v2-6',
  'kling-v3',
]);

const mockResolveKlingVideoModel = vi.fn((modelId) => {
  if (!modelId) {
    throw new Error('Missing Kling video model');
  }
  if (!SUPPORTED_KLING_VIDEO_MODELS.has(modelId)) {
    throw new Error(`Unsupported Kling video model: ${modelId}`);
  }
  return modelId;
});
const mockResolveKlingVideoExecutionDetails = vi.fn(({ modelId, executionProvider, executionMode }) => {
  if (executionProvider === 'fal') {
    if (executionMode === 'standard-text-to-video') {
      return {
        executedModel: 'fal-ai/kling-video/v2.6/pro/text-to-video',
        executedMode: 'pro',
      };
    }
    if (executionMode === 'standard-image-to-video') {
      return {
        executedModel: 'fal-ai/kling-video/v2.6/pro/image-to-video',
        executedMode: 'pro',
      };
    }
    if (executionMode === 'motion-control') {
      return {
        executedModel: 'fal-ai/kling-video/v2.6/pro/motion-control',
        executedMode: 'pro',
      };
    }
  }

  return {
    executedModel: modelId,
    executedMode: modelId === 'kling-v2-6' ? 'pro' : 'std',
  };
});
const mockGenerateHailuoVideo = vi.fn();
const mockGenerateHailuoSubjectVideo = vi.fn();
const mockResolveHailuoVideoExecutionDetails = vi.fn(({ modelId, imageBase64, lastFrameBase64 }) => ({
  executedModel: imageBase64 && lastFrameBase64 ? 'hailuo-02' : modelId || 'hailuo-2.3',
  executedMode: imageBase64 && lastFrameBase64 ? 'FL2V' : imageBase64 ? 'I2V' : 'T2V',
}));
const mockResolveHailuoSubjectExecutionDetails = vi.fn(() => ({
  executedModel: 'S2V-01',
  executedMode: 'S2V',
}));
const mockGenerateFalImageToVideo = vi.fn();
const mockGenerateFalTextToVideo = vi.fn();
const mockGenerateFalMotionControl = vi.fn();
const mockGenerateFalWanImageToVideo = vi.fn();
const mockGenerateFalWanImageToVideoFlash = vi.fn();

function registerGenerationMocks() {
  vi.doMock('../services/kling.js', () => ({
    generateKlingVideo: mockGenerateKlingVideo,
    generateKlingImage: vi.fn(),
    generateKlingMultiImage: vi.fn(),
    generateKlingTextToVideo: mockGenerateKlingTextToVideo,
    resolveKlingVideoModel: mockResolveKlingVideoModel,
    resolveKlingVideoExecutionDetails: mockResolveKlingVideoExecutionDetails,
  }));
  vi.doMock('../services/gemini.js', () => ({
    DEFAULT_GEMINI_IMAGE_MODEL: 'gemini-2.5-flash-image-preview',
    DEFAULT_VEO_VIDEO_MODEL: 'veo-3.1-fast-generate-preview',
    generateGeminiImage: vi.fn(),
    generateVeoVideo: mockGenerateVeoVideo,
    resolveGeminiImageModel: vi.fn((modelId) => modelId || 'gemini-2.5-flash-image-preview'),
    resolveVeoVideoModel: vi.fn((modelId) => {
      if (!modelId) {
        throw new Error('Missing Veo video model');
      }
      if (modelId === 'veo3.1' || modelId === 'veo-3.1') {
        return 'veo-3.1-fast-generate-preview';
      }
      if (modelId === 'veo-3.1-fast-generate-preview') {
        return modelId;
      }
      throw new Error(`Unsupported Veo video model: ${modelId}`);
    }),
  }));
  vi.doMock('../services/hailuo.js', () => ({
    generateHailuoVideo: mockGenerateHailuoVideo,
    generateHailuoSubjectVideo: mockGenerateHailuoSubjectVideo,
    resolveHailuoVideoExecutionDetails: mockResolveHailuoVideoExecutionDetails,
    resolveHailuoSubjectExecutionDetails: mockResolveHailuoSubjectExecutionDetails,
  }));
  vi.doMock('../services/openai.js', () => ({
    generateOpenAIImage: vi.fn(),
    generateOpenAIVideo: mockGenerateOpenAIVideo,
  }));
  vi.doMock('../services/openaiteachVideo.js', () => ({
    generateOpenAiTeachUnifiedVideo: mockGenerateOpenAiTeachUnifiedVideo,
  }));
  vi.doMock('../services/xai.js', () => ({
    generateXAIVideo: vi.fn(),
  }));
  vi.doMock('../services/seedance.js', () => ({
    generateSeedanceVideo: vi.fn(),
  }));
  vi.doMock('../services/fal.js', () => ({
    generateFalImageToVideo: mockGenerateFalImageToVideo,
    generateFalTextToVideo: mockGenerateFalTextToVideo,
    generateFalMotionControl: mockGenerateFalMotionControl,
    generateFalWanImageToVideo: mockGenerateFalWanImageToVideo,
    generateFalWanImageToVideoFlash: mockGenerateFalWanImageToVideoFlash,
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

describe('generation /generate-video model passthrough', () => {
  let tempRoot;
  let imagesDir;
  let videosDir;
  let originalFetch;

  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generation-video-route-'));
    imagesDir = path.join(tempRoot, 'images');
    videosDir = path.join(tempRoot, 'videos');
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.mkdirSync(videosDir, { recursive: true });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('透传 Hailuo 标准参考图模式的 requested/executed model，并写入状态元数据', async () => {
    mockGenerateHailuoSubjectVideo.mockResolvedValue('https://cdn.example.com/hailuo-standard.mp4');

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      HAILUO_API_KEY: 'hailuo-key',
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith(serverHandle.baseUrl)) {
        return originalFetch(input, init);
      }
      if (url === 'https://cdn.example.com/hailuo-standard.mp4') {
        return new Response(Buffer.from('hailuo-standard-video'), { status: 200 });
      }
      throw new Error(`Unexpected fetch in Hailuo standard test: ${url}`);
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'hailuo-standard-node',
          prompt: '双角色统一风格表演',
          videoModel: 'minimax-hailuo',
          referenceImagesBase64: [
            'data:image/png;base64,subject-a',
            'data:image/png;base64,subject-b',
          ],
          aspectRatio: '16:9',
          resolution: '768p',
          duration: 6,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: 'minimax-hailuo',
        executedModel: 'S2V-01',
        executionMode: 'standard-reference-images',
        executedMode: 'S2V',
        executionProvider: 'hailuo',
      });

      expect(mockGenerateHailuoSubjectVideo).toHaveBeenCalledWith(expect.objectContaining({
        prompt: '双角色统一风格表演',
        subjectImagesBase64: [
          'data:image/png;base64,subject-a',
          'data:image/png;base64,subject-b',
        ],
        aspectRatio: '16:9',
        resolution: '768p',
        duration: 6,
        apiKey: 'hailuo-key',
      }));

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, 'hailuo-standard-node.json'), 'utf8')
      );
      expect(metadata.requestedModel).toBe('minimax-hailuo');
      expect(metadata.model).toBe('S2V-01');
      expect(metadata.executionMode).toBe('standard-reference-images');
      expect(metadata.executedMode).toBe('S2V');
      expect(metadata.executionProvider).toBe('hailuo');

      const statusResponse = await fetch(
        `${serverHandle.baseUrl}/api/generation-status/hailuo-standard-node`
      );
      expect(statusResponse.status).toBe(200);
      await expect(statusResponse.json()).resolves.toMatchObject({
        status: 'success',
        requestedModel: 'minimax-hailuo',
        executedModel: 'S2V-01',
        executionMode: 'standard-reference-images',
        executedMode: 'S2V',
        executionProvider: 'hailuo',
      });
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('透传 Hailuo 首尾帧的请求模型，同时显式回传真实执行模型 hailuo-02', async () => {
    mockGenerateHailuoVideo.mockResolvedValue('https://cdn.example.com/hailuo-fl2v.mp4');

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      HAILUO_API_KEY: 'hailuo-key',
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith(serverHandle.baseUrl)) {
        return originalFetch(input, init);
      }
      if (url === 'https://cdn.example.com/hailuo-fl2v.mp4') {
        return new Response(Buffer.from('hailuo-frame-video'), { status: 200 });
      }
      throw new Error(`Unexpected fetch in Hailuo frame test: ${url}`);
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'hailuo-frame-node',
          prompt: '角色从左走到右',
          videoModel: 'minimax-hailuo',
          imageBase64: 'data:image/png;base64,start-frame',
          lastFrameBase64: 'data:image/png;base64,end-frame',
          aspectRatio: '9:16',
          resolution: '1080p',
          duration: 10,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: 'minimax-hailuo',
        executedModel: 'hailuo-02',
        executionMode: 'frame-to-frame',
        executedMode: 'FL2V',
        executionProvider: 'hailuo',
      });

      expect(mockGenerateHailuoVideo).toHaveBeenCalledWith(expect.objectContaining({
        prompt: '角色从左走到右',
        imageBase64: 'data:image/png;base64,start-frame',
        lastFrameBase64: 'data:image/png;base64,end-frame',
        modelId: 'hailuo-2.3',
        aspectRatio: '9:16',
        resolution: '1080p',
        duration: 10,
        apiKey: 'hailuo-key',
      }));

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, 'hailuo-frame-node.json'), 'utf8')
      );
      expect(metadata.requestedModel).toBe('minimax-hailuo');
      expect(metadata.model).toBe('hailuo-02');
      expect(metadata.executionMode).toBe('frame-to-frame');
      expect(metadata.executedMode).toBe('FL2V');
      expect(metadata.executionProvider).toBe('hailuo');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('对 Kling 2.6 标准模式保持模型透传，但把 FAL 执行链细节藏在路由内部', async () => {
    mockGenerateFalTextToVideo.mockResolvedValue('https://cdn.example.com/kling-fal.mp4');

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      FAL_API_KEY: 'fal-key',
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.startsWith(serverHandle.baseUrl)) {
        return originalFetch(input, init);
      }
      if (url === 'https://cdn.example.com/kling-fal.mp4') {
        return new Response(Buffer.from('kling-fal-video'), { status: 200 });
      }
      throw new Error(`Unexpected fetch in Kling standard test: ${url}`);
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'kling-standard-node',
          prompt: '城市上空的无人机镜头',
          videoModel: 'kling-v2-6',
          aspectRatio: '1:1',
          resolution: 'Auto',
          duration: 5,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: 'kling-v2-6',
        executedModel: 'fal-ai/kling-video/v2.6/pro/text-to-video',
        executionMode: 'standard-text-to-video',
        executedMode: 'pro',
        executionProvider: 'fal',
      });

      expect(mockGenerateFalTextToVideo).toHaveBeenCalledWith({
        prompt: '城市上空的无人机镜头',
        duration: '5',
        aspectRatio: '1:1',
        generateAudio: false,
        apiKey: 'fal-key',
      });
      expect(mockGenerateKlingTextToVideo).not.toHaveBeenCalled();
      expect(mockGenerateKlingVideo).not.toHaveBeenCalled();

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, 'kling-standard-node.json'), 'utf8')
      );
      expect(metadata.requestedModel).toBe('kling-v2-6');
      expect(metadata.model).toBe('fal-ai/kling-video/v2.6/pro/text-to-video');
      expect(metadata.executionMode).toBe('standard-text-to-video');
      expect(metadata.executedMode).toBe('pro');
      expect(metadata.executionProvider).toBe('fal');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('在绑定 OpenAiTeach token 时，Veo 标准文生会优先走 hosted 视频链而不是本地 GEMINI_API_KEY', async () => {
    mockGenerateOpenAIVideo.mockResolvedValue(Buffer.from('hosted-veo-video'));
    mockGenerateOpenAiTeachUnifiedVideo.mockResolvedValue(Buffer.from('hosted-veo-video'));

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'veo-hosted-node',
          prompt: '一个亚洲男人跳舞',
          videoModel: 'veo3.1',
          aspectRatio: '16:9',
          resolution: '720p',
          duration: 4,
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: 'veo3.1',
        executedModel: 'veo3.1-fast',
        executionMode: 'standard-text-to-video',
        executionProvider: 'openaiteach-hosted',
      });
      expect(mockGenerateOpenAiTeachUnifiedVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          videoModel: 'veo3.1-fast',
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, 'veo-hosted-node.json'), 'utf8')
      );
      expect(metadata.executionProvider).toBe('openaiteach-hosted');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('Veo 标准图生在本地 key 可用时会调用 generateVeoVideo 并传入首帧图片', async () => {
    mockGenerateVeoVideo.mockResolvedValue(Buffer.from('veo-local-video'));

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      GEMINI_API_KEY: 'gemini-key',
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'veo-i2v-node',
          prompt: '一个镜头推近人物脸部',
          videoModel: 'veo3.1',
          imageBase64: 'data:image/png;base64,start-frame',
          aspectRatio: '16:9',
          resolution: '720p',
          duration: 4,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: 'veo3.1',
        executedModel: 'veo-3.1-fast-generate-preview',
        executionMode: 'standard-image-to-video',
        executionProvider: 'veo',
      });
      expect(mockGenerateVeoVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          imageBase64: 'data:image/png;base64,start-frame',
          referenceImagesBase64: undefined,
          lastFrameBase64: null,
          videoModel: 'veo-3.1-fast-generate-preview',
          apiKey: 'gemini-key',
        })
      );

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, 'veo-i2v-node.json'), 'utf8')
      );
      expect(metadata.executionMode).toBe('standard-image-to-video');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('在绑定 OpenAiTeach token 时，Kling 标准文生也会优先走 hosted 视频链而不是本地 FAL/Kling key', async () => {
    mockGenerateOpenAIVideo.mockResolvedValue(Buffer.from('hosted-kling-video'));
    mockGenerateOpenAiTeachUnifiedVideo.mockResolvedValue(Buffer.from('hosted-kling-video'));

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'kling-hosted-node',
          prompt: '赛博城市夜景飞行镜头',
          videoModel: 'kling-v3',
          aspectRatio: '16:9',
          resolution: '720p',
          duration: 5,
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: 'kling-v3',
        executedModel: 'kling-v3',
        executionMode: 'standard-text-to-video',
        executionProvider: 'openaiteach-hosted',
      });
      expect(mockGenerateOpenAiTeachUnifiedVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          videoModel: 'kling-v3',
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );
      expect(mockGenerateFalTextToVideo).not.toHaveBeenCalled();
      expect(mockGenerateKlingTextToVideo).not.toHaveBeenCalled();

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, 'kling-hosted-node.json'), 'utf8')
      );
      expect(metadata.executionProvider).toBe('openaiteach-hosted');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it.each([
    {
      title: 'Hailuo 标准图生',
      payload: {
        nodeId: 'hailuo-hosted-node',
        prompt: '角色站在街头',
        videoModel: 'minimax-hailuo',
        imageBase64: 'data:image/png;base64,start-frame',
        aspectRatio: '16:9',
        resolution: '768p',
        duration: 6,
      },
      expectedModel: 'MiniMax-Hailuo-02',
    },
    {
      title: 'Seedance 标准文生',
      payload: {
        nodeId: 'seedance-hosted-node',
        prompt: '未来都市穿梭镜头',
        videoModel: 'jimeng-4.5',
        aspectRatio: '16:9',
        resolution: '720p',
        duration: 5,
      },
      expectedModel: 'doubao-seedance-1-0-pro-250528',
    },
    {
      title: 'Grok 标准文生',
      payload: {
        nodeId: 'grok-hosted-node',
        prompt: '太空站外景镜头',
        videoModel: 'grok-video-3',
        aspectRatio: '16:9',
        resolution: '720p',
        duration: 8,
      },
      expectedModel: 'grok-video-3',
    },
    {
      title: 'Wan 标准图生',
      payload: {
        nodeId: 'wan-hosted-node',
        prompt: '山间云海延时镜头',
        videoModel: 'wan2.6-i2v',
        imageBase64: 'data:image/png;base64,start-frame',
        aspectRatio: 'Auto',
        resolution: '1080p',
        duration: 5,
      },
      expectedModel: 'wan2.5-i2v-preview',
    },
  ])('在绑定 OpenAiTeach token 时，$title 会优先走 hosted 视频链', async ({ payload, expectedModel }) => {
    mockGenerateOpenAIVideo.mockResolvedValue(Buffer.from('hosted-video'));
    mockGenerateOpenAiTeachUnifiedVideo.mockResolvedValue(Buffer.from('hosted-video'));

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: payload.videoModel,
        executedModel: expectedModel,
        executionProvider: 'openaiteach-hosted',
      });
      expect(mockGenerateOpenAiTeachUnifiedVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          videoModel: expectedModel,
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, `${payload.nodeId}.json`), 'utf8')
      );
      expect(metadata.executionProvider).toBe('openaiteach-hosted');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it.each([
    {
      title: 'Veo 首尾帧',
      payload: {
        nodeId: 'veo-frame-node',
        prompt: '角色从左走到右',
        videoModel: 'veo3.1',
        imageBase64: 'data:image/png;base64,start-frame',
        lastFrameBase64: 'data:image/png;base64,end-frame',
        aspectRatio: '16:9',
        resolution: '720p',
        duration: 4,
      },
      expectedMode: 'standard-image-to-video',
      expectedModel: 'veo3-fast-frames',
    },
    {
      title: 'Kling 运动参考',
      payload: {
        nodeId: 'kling-motion-node',
        prompt: '动作参考测试',
        videoModel: 'kling-v2-6',
        imageBase64: 'data:image/png;base64:character',
        motionReferenceUrl: 'data:video/mp4;base64,bW90aW9u',
        aspectRatio: '16:9',
        resolution: 'Auto',
        duration: 5,
      },
      expectedMode: 'standard-image-to-video',
      expectedModel: 'kling-v2-6',
    },
    {
      title: 'Hailuo 标准参考图',
      payload: {
        nodeId: 'hailuo-reference-node',
        prompt: '统一角色风格',
        videoModel: 'minimax-hailuo',
        referenceImagesBase64: [
          'data:image/png;base64,subject-a',
          'data:image/png;base64,subject-b',
        ],
        aspectRatio: '16:9',
        resolution: '768p',
        duration: 6,
      },
      expectedMode: 'standard-image-to-video',
      expectedModel: 'MiniMax-Hailuo-02',
    },
    {
      title: 'Seedance 首尾帧',
      payload: {
        nodeId: 'seedance-frame-node',
        prompt: '镜头平移',
        videoModel: 'jimeng-4.5',
        imageBase64: 'data:image/png;base64,start-frame',
        lastFrameBase64: 'data:image/png;base64,end-frame',
        aspectRatio: '16:9',
        resolution: '720p',
        duration: 5,
      },
      expectedMode: 'standard-image-to-video',
      expectedModel: 'doubao-seedance-1-0-pro-250528',
    },
  ])('在绑定 OpenAiTeach token 时，$title 会自动降级到标准 hosted 视频链', async ({ payload, expectedMode, expectedModel }) => {
    mockGenerateOpenAiTeachUnifiedVideo.mockResolvedValue(Buffer.from('hosted-video'));

    const router = await importFreshGenerationRouter();
    const serverHandle = await createServer(router, {
      IMAGES_DIR: imagesDir,
      VIDEOS_DIR: videosDir,
    });

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        requestedModel: payload.videoModel,
        executedModel: expectedModel,
        executionMode:
          payload.referenceImagesBase64?.length
            ? 'standard-reference-images'
            : payload.motionReferenceUrl
              ? 'motion-control'
              : 'frame-to-frame',
        executedMode: expectedMode,
        executionProvider: 'openaiteach-hosted',
      });
      expect(mockGenerateOpenAiTeachUnifiedVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          videoModel: expectedModel,
          apiKey: 'sk-hosted-token',
          baseUrl: 'https://openaiteach.com/v1',
        })
      );

      const metadata = JSON.parse(
        fs.readFileSync(path.join(videosDir, `${payload.nodeId}.json`), 'utf8')
      );
      expect(metadata.executionProvider).toBe('openaiteach-hosted');
      expect(metadata.executedMode).toBe(expectedMode);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
