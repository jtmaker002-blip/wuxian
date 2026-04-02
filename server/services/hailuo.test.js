import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('generateHailuoVideo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a first/last-frame payload for Hailuo FL2V and downloads the result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          base_resp: { status_code: 0 },
          task_id: 'hailuo-task',
        }),
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            base_resp: { status_code: 0 },
            status: 'Success',
            file_id: 'file-123',
          }),
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            base_resp: { status_code: 0 },
            file: { download_url: 'https://cdn.example.com/hailuo.mp4' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('hailuo-video'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateHailuoVideo } = await import('./hailuo.js');
    const resultUrl = await generateHailuoVideo({
      prompt: '角色从左到右移动',
      imageBase64: 'data:image/png;base64,start-frame',
      lastFrameBase64: 'data:image/png;base64,end-frame',
      modelId: 'hailuo-2.3',
      aspectRatio: '9:16',
      resolution: '1080p',
      duration: 10,
      apiKey: 'hailuo-key',
    });

    const createBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(createBody.model).toBe('MiniMax-Hailuo-02');
    expect(createBody.first_frame_image).toBe('data:image/png;base64,start-frame');
    expect(createBody.last_frame_image).toBe('data:image/png;base64,end-frame');
    expect(createBody.duration).toBe(10);
    expect(createBody.aspect_ratio).toBe('9:16');
    expect(createBody.resolution).toBe('1080P');
    expect(resultUrl).toBe('https://cdn.example.com/hailuo.mp4');
  });
});

describe('generateHailuoSubjectVideo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a multi-image subject_reference payload for Hailuo S2V', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          base_resp: { status_code: 0 },
          task_id: 'hailuo-s2v-task',
        }),
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            base_resp: { status_code: 0 },
            status: 'Success',
            file_id: 'file-s2v',
          }),
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            base_resp: { status_code: 0 },
            file: { download_url: 'https://cdn.example.com/hailuo-s2v.mp4' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('hailuo-s2v'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateHailuoSubjectVideo } = await import('./hailuo.js');
    const resultUrl = await generateHailuoSubjectVideo({
      prompt: '双角色统一风格表演',
      subjectImagesBase64: ['data:image/png;base64:a', 'raw-base64-b'],
      aspectRatio: '16:9',
      resolution: '768p',
      duration: 6,
      apiKey: 'hailuo-key',
    });

    const createBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(createBody.model).toBe('S2V-01');
    expect(createBody.subject_reference?.[0]?.image).toEqual([
      'data:image/png;base64:a',
      'data:image/jpeg;base64,raw-base64-b',
    ]);
    expect(createBody.duration).toBe(6);
    expect(createBody.resolution).toBe('768P');
    expect(resultUrl).toBe('https://cdn.example.com/hailuo-s2v.mp4');
  });
});
