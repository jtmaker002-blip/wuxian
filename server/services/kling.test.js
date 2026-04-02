import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('generateKlingTextToVideo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a text2video task and polls the result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { task_id: 'kling-text-task' } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            task_status: 'succeed',
            task_result: { videos: [{ url: 'https://cdn.example.com/kling-text.mp4' }] },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateKlingTextToVideo } = await import('./kling.js');
    const result = await generateKlingTextToVideo({
      prompt: '城市上空的无人机镜头',
      modelId: 'kling-v3',
      aspectRatio: '9:16',
      duration: 10,
      accessKey: 'kling-ak',
      secretKey: 'kling-sk',
    });

    const createBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(createBody.model_name).toBe('kling-v3');
    expect(createBody.aspect_ratio).toBe('9:16');
    expect(createBody.duration).toBe('10');
    expect(result).toBe('https://cdn.example.com/kling-text.mp4');
  });
});

describe('generateKlingVideo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a frame-to-frame image2video payload with tail image', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { task_id: 'kling-frame-task' } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            task_status: 'succeed',
            task_result: { videos: [{ url: 'https://cdn.example.com/kling-frame.mp4' }] },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateKlingVideo } = await import('./kling.js');
    const result = await generateKlingVideo({
      prompt: '角色从站立变成奔跑',
      imageBase64: 'data:image/png;base64,start-frame',
      lastFrameBase64: 'data:image/png;base64,end-frame',
      modelId: 'kling-v3',
      aspectRatio: '16:9',
      duration: 5,
      accessKey: 'kling-ak',
      secretKey: 'kling-sk',
    });

    const createBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(createBody.mode).toBe('pro');
    expect(createBody.image).toBe('start-frame');
    expect(createBody.image_tail).toBe('end-frame');
    expect(result).toBe('https://cdn.example.com/kling-frame.mp4');
  });
});
