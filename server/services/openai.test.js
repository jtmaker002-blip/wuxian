import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  imageGenerateMock,
  imageEditMock,
  videoCreateMock,
  videoRetrieveMock,
  videoDownloadMock,
  chatCompletionsCreateMock,
  toFileMock,
} = vi.hoisted(() => ({
  imageGenerateMock: vi.fn(),
  imageEditMock: vi.fn(),
  videoCreateMock: vi.fn(),
  videoRetrieveMock: vi.fn(),
  videoDownloadMock: vi.fn(),
  chatCompletionsCreateMock: vi.fn(),
  toFileMock: vi.fn(async (buffer, filename) => ({ buffer, filename })),
}));

vi.mock('openai', () => {
  class OpenAIMock {
    constructor(config) {
      this.config = config;
      this.images = {
        generate: imageGenerateMock,
        edit: imageEditMock,
      };
      this.chat = {
        completions: {
          create: chatCompletionsCreateMock,
        },
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
    chatCompletionsCreateMock.mockReset();
    toFileMock.mockClear();
  });

  it('accepts sora-2 as the current executable OpenAI video model', async () => {
    const { resolveOpenAIVideoModel } = await import('./openai.js');

    expect(resolveOpenAIVideoModel('sora-2')).toBe('sora-2');
  });

  it('rejects missing OpenAI video model ids instead of silently defaulting', async () => {
    const { resolveOpenAIVideoModel } = await import('./openai.js');

    expect(() => resolveOpenAIVideoModel()).toThrow(/missing openai video model/i);
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
    chatCompletionsCreateMock.mockReset();
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

describe('generateOpenAIText', () => {
  beforeEach(() => {
    chatCompletionsCreateMock.mockReset();
    chatCompletionsCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'hosted text response',
          },
        },
      ],
    });
  });

  it('sends text completion requests through the OpenAI-compatible chat api', async () => {
    const { generateOpenAIText } = await import('./openai.js');

    const result = await generateOpenAIText({
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      baseUrl: 'https://openaiteach.com/v1',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'hello world' },
      ],
    });

    expect(result).toBe('hosted text response');
    expect(chatCompletionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: [{ type: 'text', text: 'You are helpful.' }] },
          { role: 'user', content: [{ type: 'text', text: 'hello world' }] },
        ],
      })
    );
  });

  it('normalizes mixed text and inline image parts for hosted multimodal text requests', async () => {
    const { generateOpenAIText } = await import('./openai.js');

    await generateOpenAIText({
      model: 'gpt-4o-mini',
      apiKey: 'test-key',
      messages: [
        {
          role: 'user',
          content: [
            'look at this',
            {
              inlineData: {
                mimeType: 'image/png',
                data: 'YWJj',
              },
            },
          ],
        },
      ],
    });

    expect(chatCompletionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'look at this' },
              {
                type: 'image_url',
                image_url: { url: 'data:image/png;base64,YWJj' },
              },
            ],
          },
        ],
      })
    );
  });

  it('rewrites hosted distributor errors into clearer OpenAiTeach text guidance', async () => {
    const { generateOpenAIText } = await import('./openai.js');
    chatCompletionsCreateMock.mockRejectedValue(
      new Error('503 分组 default 下模型 gemini-3.1-flash-image-preview 无可用渠道（distributor） (request id: abc123)')
    );

    await expect(
      generateOpenAIText({
        model: 'gpt-4o-mini',
        apiKey: 'test-key',
        baseUrl: 'https://openaiteach.com/v1',
        messages: [{ role: 'user', content: 'hello world' }],
      })
    ).rejects.toThrow(/OpenAiTeach 当前分组下的 文本模型 gpt-4o-mini 暂无可用渠道/);
  });
});

describe('generateOpenAIImage hosted errors', () => {
  beforeEach(() => {
    imageGenerateMock.mockReset();
    imageEditMock.mockReset();
  });

  it('rewrites hosted distributor errors into clearer OpenAiTeach image guidance', async () => {
    const { generateOpenAIImage } = await import('./openai.js');
    imageGenerateMock.mockRejectedValue(
      new Error('503 分组 default 下模型 midjourney-v6 无可用渠道（distributor） (request id: img123)')
    );

    await expect(
      generateOpenAIImage({
        prompt: 'generate a portrait',
        imageModel: 'midjourney-v6',
        apiKey: 'test-key',
        baseUrl: 'https://openaiteach.com/v1',
      })
    ).rejects.toThrow(/OpenAiTeach 当前分组下的 图片模型 midjourney-v6 暂无可用渠道/);
  });
});
