import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  imageGenerateMock,
  imageEditMock,
  videoCreateMock,
  videoRetrieveMock,
  videoDownloadMock,
  toFileMock,
} = vi.hoisted(() => ({
  imageGenerateMock: vi.fn(),
  imageEditMock: vi.fn(),
  videoCreateMock: vi.fn(),
  videoRetrieveMock: vi.fn(),
  videoDownloadMock: vi.fn(),
  toFileMock: vi.fn(async (buffer, filename) => ({ buffer, filename })),
}));

vi.mock('openai', () => {
  class OpenAIMock {
    constructor() {
      this.images = {
        generate: imageGenerateMock,
        edit: imageEditMock,
      };
      this.videos = {
        create: videoCreateMock,
        retrieve: videoRetrieveMock,
        downloadContent: videoDownloadMock,
      };
    }
  }

  return {
    default: OpenAIMock,
    toFile: toFileMock,
  };
});

describe('resolveOpenAIVideoModel', () => {
  beforeEach(() => {
    imageGenerateMock.mockReset();
    imageEditMock.mockReset();
    videoCreateMock.mockReset();
    videoRetrieveMock.mockReset();
    videoDownloadMock.mockReset();
    toFileMock.mockClear();
  });

  it('accepts sora-2 as the current executable OpenAI video model', async () => {
    const { resolveOpenAIVideoModel } = await import('./openai.js');

    expect(resolveOpenAIVideoModel('sora-2')).toBe('sora-2');
  });

  it('rejects unsupported OpenAI video ids', async () => {
    const { resolveOpenAIVideoModel } = await import('./openai.js');

    expect(() => resolveOpenAIVideoModel('sora-2-pro')).toThrow(/unsupported openai video model/i);
  });
});

describe('generateOpenAIVideo', () => {
  beforeEach(() => {
    imageGenerateMock.mockReset();
    imageEditMock.mockReset();
    videoCreateMock.mockReset();
    videoRetrieveMock.mockReset();
    videoDownloadMock.mockReset();
    toFileMock.mockClear();

    videoCreateMock.mockResolvedValue({ id: 'vid_123' });
    videoRetrieveMock.mockResolvedValue({ id: 'vid_123', status: 'completed' });
    videoDownloadMock.mockResolvedValue({
      arrayBuffer: async () => Buffer.from('video-bytes'),
    });
  });

  it('maps sora text-to-video requests onto the OpenAI videos api', async () => {
    const { generateOpenAIVideo } = await import('./openai.js');

    const buffer = await generateOpenAIVideo({
      prompt: 'a paper airplane flying over the ocean at sunset',
      aspectRatio: '16:9',
      resolution: '1080p',
      duration: 12,
      videoModel: 'sora-2',
      apiKey: 'test-key',
    });

    expect(videoCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'sora-2',
        seconds: '12',
        size: '1792x1024',
      })
    );
    expect(videoDownloadMock).toHaveBeenCalledWith('vid_123', { variant: 'video' });
    expect(buffer.toString()).toBe('video-bytes');
  });

  it('adds input_reference for image-to-video sora requests', async () => {
    const { generateOpenAIVideo } = await import('./openai.js');

    await generateOpenAIVideo({
      prompt: 'turn this portrait into a subtle cinematic clip',
      imageBase64: 'data:image/png;base64,aGVsbG8=',
      aspectRatio: '9:16',
      resolution: '720p',
      duration: 4,
      videoModel: 'sora-2',
      apiKey: 'test-key',
    });

    expect(toFileMock).toHaveBeenCalled();
    expect(videoCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        size: '720x1280',
        input_reference: expect.any(Object),
      })
    );
  });
});
