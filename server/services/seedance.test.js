import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('seedance service helpers', () => {
  it('accepts known seedance video models', async () => {
    const { resolveSeedanceVideoModel } = await import('./seedance.js');

    expect(resolveSeedanceVideoModel('jimeng-seedance-2')).toBe('jimeng-seedance-2');
    expect(resolveSeedanceVideoModel('jimeng-4.5')).toBe('jimeng-4.5');
    expect(resolveSeedanceVideoModel('jimeng-4.1')).toBe('jimeng-4.1');
  });

  it('rejects missing seedance video model ids instead of silently defaulting', async () => {
    const { resolveSeedanceVideoModel } = await import('./seedance.js');

    expect(() => resolveSeedanceVideoModel()).toThrow(/missing seedance video model/i);
  });

  it('rejects unknown seedance video models', async () => {
    const { resolveSeedanceVideoModel } = await import('./seedance.js');

    expect(() => resolveSeedanceVideoModel('jimeng-unknown')).toThrow(/unsupported seedance video model/i);
  });

  it('resolves frame-to-frame when end frame exists', async () => {
    const { resolveSeedanceExecutionMode } = await import('./seedance.js');

    expect(
      resolveSeedanceExecutionMode({
        imageBase64: 'start',
        lastFrameBase64: 'end',
      })
    ).toBe('frame-to-frame');
  });

  it('rejects frame-to-frame generation when only end frame is provided', async () => {
    const { generateSeedanceVideo } = await import('./seedance.js');

    await expect(
      generateSeedanceVideo({
        prompt: '测试',
        lastFrameBase64: 'end',
        videoModel: 'jimeng-seedance-2',
        apiKey: 'seedance-key',
      })
    ).rejects.toThrow(/首尾帧模式需要同时提供首帧和尾帧/i);
  });

  it('accepts standard image-to-video on jimeng-4.1', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'task_124' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: { video_url: 'https://cdn.example.com/seedance-image.mp4' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('seedance-image-video'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateSeedanceVideo } = await import('./seedance.js');
    const buffer = await generateSeedanceVideo({
      prompt: '女孩抬手转头',
      imageBase64: 'data:image/png;base64,start-frame',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
      videoModel: 'jimeng-4.1',
      apiKey: 'seedance-key',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('doubao-seedance-1-0-pro-fast-251015'),
      })
    );
    expect(buffer.toString()).toBe('seedance-image-video');
  });

  it('rejects frame-to-frame on models that do not expose that chain', async () => {
    const { selectSeedanceServerModel } = await import('./seedance.js');

    expect(() =>
      selectSeedanceServerModel('jimeng-4.1', 'frame-to-frame')
    ).toThrow(/尚未接通首尾帧模式/i);
    expect(() =>
      selectSeedanceServerModel('jimeng-4.0', 'frame-to-frame')
    ).toThrow(/尚未接通首尾帧模式/i);
    expect(() =>
      selectSeedanceServerModel('jimeng-video-3-fast', 'frame-to-frame')
    ).toThrow(/尚未接通首尾帧模式/i);
  });
});

describe('generateSeedanceVideo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs text-to-video through create -> poll -> download', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'task_123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: { video_url: 'https://cdn.example.com/seedance.mp4' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('seedance-video'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateSeedanceVideo } = await import('./seedance.js');
    const buffer = await generateSeedanceVideo({
      prompt: '海边的少女转身微笑',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
      videoModel: 'jimeng-seedance-2',
      apiKey: 'seedance-key',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('doubao-seedance-1-5-pro-251215'),
      })
    );
    expect(buffer.toString()).toBe('seedance-video');
  });

  it('includes generate_audio when supported seedance models request audio', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'task_audio' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: { video_url: 'https://cdn.example.com/seedance-audio.mp4' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('seedance-audio'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateSeedanceVideo } = await import('./seedance.js');
    const buffer = await generateSeedanceVideo({
      prompt: '城市夜景延时摄影',
      duration: 10,
      aspectRatio: '9:16',
      resolution: '1080p',
      videoModel: 'jimeng-4.1',
      generateAudio: true,
      apiKey: 'seedance-key',
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.parameters).toEqual({ generate_audio: true });
    expect(buffer.toString()).toBe('seedance-audio');
  });

  it('runs frame-to-frame with explicit first and last frame payloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'task_frames' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: { video_url: 'https://cdn.example.com/seedance-frames.mp4' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('seedance-frames'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateSeedanceVideo } = await import('./seedance.js');
    const buffer = await generateSeedanceVideo({
      prompt: '角色从左向右移动',
      imageBase64: 'data:image/png;base64,start-frame',
      lastFrameBase64: 'data:image/png;base64,end-frame',
      duration: 10,
      aspectRatio: '9:16',
      resolution: '1080p',
      videoModel: 'jimeng-seedance-2',
      apiKey: 'seedance-key',
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'image_url', role: 'first_frame' }),
        expect.objectContaining({ type: 'image_url', role: 'last_frame' }),
      ])
    );
    expect(buffer.toString()).toBe('seedance-frames');
  });

  it('runs image-to-video through the standard image chain for seedance models', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'task_image' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: { video_url: 'https://cdn.example.com/seedance-image.mp4' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('seedance-image'),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { generateSeedanceVideo } = await import('./seedance.js');
    const buffer = await generateSeedanceVideo({
      prompt: '镜头推进到角色脸部',
      imageBase64: 'data:image/png;base64,start-image',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
      videoModel: 'jimeng-4.0',
      apiKey: 'seedance-key',
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'image_url', role: 'first_frame' }),
      ])
    );
    expect(buffer.toString()).toBe('seedance-image');
  });

  it('normalizes unsupported seedance durations and ratios back to the safe defaults', async () => {
    const { mapSeedanceDuration, mapSeedanceRatio } = await import('./seedance.js');

    expect(mapSeedanceDuration(8)).toBe(5);
    expect(mapSeedanceDuration(10)).toBe(10);
    expect(mapSeedanceRatio('21:9')).toBe('16:9');
    expect(mapSeedanceRatio('9:16')).toBe('9:16');
  });
});
