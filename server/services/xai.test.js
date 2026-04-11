import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveXAIVideoModel', () => {
  it('accepts grok-video-3 as supported xAI video model', async () => {
    const { resolveXAIVideoModel } = await import('./xai.js');

    expect(resolveXAIVideoModel('grok-video-3')).toBe('grok-video-3');
  });

  it('rejects missing xAI video model ids instead of silently defaulting', async () => {
    const { resolveXAIVideoModel } = await import('./xai.js');

    expect(() => resolveXAIVideoModel()).toThrow(/missing xai video model/i);
  });

  it('rejects unsupported xAI video models', async () => {
    const { resolveXAIVideoModel } = await import('./xai.js');

    expect(() => resolveXAIVideoModel('grok-video-2')).toThrow(/unsupported xai video model/i);
  });
});

describe('generateXAIVideo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects reference-images payload for grok video generation explicitly', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { generateXAIVideo } = await import('./xai.js');

    await expect(
      generateXAIVideo({
        prompt: '让角色和衣服都保持一致',
        referenceImagesBase64: ['data:image/png;base64,aA=='],
        duration: 10,
        aspectRatio: '16:9',
        resolution: '720p',
        videoModel: 'grok-video-3',
        apiKey: 'xai-test',
      })
    ).rejects.toThrow(/不支持多图\/全图参考/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects multiple reference images explicitly', async () => {
    const fetchMock = vi.fn()
    ;
    vi.stubGlobal('fetch', fetchMock);

    const { generateXAIVideo } = await import('./xai.js');
    await expect(
      generateXAIVideo({
        prompt: '让角色和衣服都保持一致',
        referenceImagesBase64: ['data:image/png;base64,aA==', 'data:image/png;base64,aQ=='],
        duration: 10,
        aspectRatio: '16:9',
        resolution: '720p',
        videoModel: 'grok-video-3',
        apiKey: 'xai-test',
      })
    ).rejects.toThrow(/不支持多图\/全图参考/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends image payload for grok single-image video generation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'req_img' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'done', video: { url: 'https://cdn.example.com/video.mp4' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('video-bytes'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateXAIVideo } = await import('./xai.js');
    await generateXAIVideo({
      prompt: '让角色挥手',
      imageBase64: 'data:image/png;base64,aA==',
      duration: 6,
      aspectRatio: '9:16',
      resolution: '480p',
      executionMode: 'standard-image-to-video',
      videoModel: 'grok-video-3',
      apiKey: 'xai-test',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.x.ai/v1/videos/generations',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"image"'),
      })
    );
    expect(fetchMock.mock.calls[0][1].body).not.toContain('"reference_images"');
  });

  it('sends text-only payload for grok text-to-video generation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'req_txt' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'done', video: { url: 'https://cdn.example.com/video.mp4' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('video-bytes'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateXAIVideo } = await import('./xai.js');
    await generateXAIVideo({
      prompt: '一只机械海豚跃出海面',
      duration: 8,
      aspectRatio: '16:9',
      resolution: '720p',
      executionMode: 'standard-text-to-video',
      videoModel: 'grok-video-3',
      apiKey: 'xai-test',
    });

    const firstRequestBody = fetchMock.mock.calls[0][1].body;
    expect(firstRequestBody).not.toContain('"image"');
    expect(firstRequestBody).not.toContain('"reference_images"');
  });

  it('rejects unsupported xai execution modes explicitly', async () => {
    const { generateXAIVideo } = await import('./xai.js');

    await expect(
      generateXAIVideo({
        prompt: 'test',
        videoModel: 'grok-video-3',
        executionMode: 'frame-to-frame',
        apiKey: 'xai-test',
      })
    ).rejects.toThrow(/尚未接通模式/i);
  });

  it('rejects motion-control explicitly', async () => {
    const { generateXAIVideo } = await import('./xai.js');

    await expect(
      generateXAIVideo({
        prompt: 'test',
        imageBase64: 'data:image/png;base64,aA==',
        videoModel: 'grok-video-3',
        executionMode: 'motion-control',
        apiKey: 'xai-test',
      })
    ).rejects.toThrow(/尚未接通模式/i);
  });
});
