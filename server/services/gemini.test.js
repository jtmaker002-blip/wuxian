import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContentMock, generateVideosMock, operationGetMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  generateVideosMock: vi.fn(),
  operationGetMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAIMock() {
    return {
      models: {
        generateContent: generateContentMock,
        generateVideos: generateVideosMock,
      },
      operations: {
        get: operationGetMock,
      },
    };
  }),
}));

describe('generateGeminiImage', () => {
  beforeEach(() => {
    vi.resetModules();
    generateContentMock.mockReset();
    generateContentMock.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: Buffer.from('image-bytes').toString('base64'),
                },
              },
            ],
          },
        },
      ],
    });
  });

  it.each([
    'gemini-2.5-flash-image-preview',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
  ])('uses the selected visible Gemini model %s without collapsing it', async (imageModel) => {
    const { generateGeminiImage } = await import('./gemini.js');

    await generateGeminiImage({
      prompt: 'draw a lighthouse at sunset',
      imageModel,
      apiKey: 'test-key',
    });

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: imageModel,
      })
    );
  });

  it('rejects unsupported Gemini image models instead of silently falling back', async () => {
    const { generateGeminiImage } = await import('./gemini.js');

    await expect(
      generateGeminiImage({
        prompt: 'draw a lighthouse at sunset',
        imageModel: 'gemini-9-future-image-preview',
        apiKey: 'test-key',
      })
    ).rejects.toThrow(/unsupported gemini image model/i);

    expect(generateContentMock).not.toHaveBeenCalled();
  });
});

describe('generateVeoVideo', () => {
  beforeEach(() => {
    vi.resetModules();
    generateVideosMock.mockReset();
    operationGetMock.mockReset();
    generateVideosMock.mockResolvedValue({
      done: true,
      response: {
        generatedVideos: [
          {
            videoBytes: Buffer.from('video-bytes').toString('base64'),
          },
        ],
      },
    });
  });

  it('sends a single image as the standard first-frame image-to-video input', async () => {
    const { generateVeoVideo } = await import('./gemini.js');

    await generateVeoVideo({
      prompt: 'push in on a portrait',
      imageBase64: 'data:image/png;base64,start-frame',
      videoModel: 'veo3.1',
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 4,
      generateAudio: false,
      apiKey: 'test-key',
    });

    expect(generateVideosMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'veo-3.1-fast-generate-preview',
        image: {
          imageBytes: 'start-frame',
          mimeType: 'image/jpeg',
        },
        config: expect.objectContaining({
          durationSeconds: 4,
          aspectRatio: '16:9',
          resolution: '720p',
        }),
      })
    );
    expect(generateVideosMock.mock.calls[0][0].config.referenceImages).toBeUndefined();
    expect(generateVideosMock.mock.calls[0][0].config.lastFrame).toBeUndefined();
  });

  it('sends Veo full-reference images through config.referenceImages as asset references', async () => {
    const { generateVeoVideo } = await import('./gemini.js');

    await generateVeoVideo({
      prompt: 'keep these product assets consistent',
      referenceImagesBase64: [
        'data:image/png;base64,asset-a',
        'data:image/jpeg;base64,asset-b',
      ],
      videoModel: 'veo3.1',
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 4,
      generateAudio: false,
      apiKey: 'test-key',
    });

    expect(generateVideosMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          referenceImages: [
            {
              image: {
                imageBytes: 'asset-a',
                mimeType: 'image/jpeg',
              },
              referenceType: 'ASSET',
            },
            {
              image: {
                imageBytes: 'asset-b',
                mimeType: 'image/jpeg',
              },
              referenceType: 'ASSET',
            },
          ],
        }),
      })
    );
    expect(generateVideosMock.mock.calls[0][0].image).toBeUndefined();
  });

  it('sends Veo end-frame interpolation through config.lastFrame', async () => {
    const { generateVeoVideo } = await import('./gemini.js');

    await generateVeoVideo({
      prompt: 'interpolate between two frames',
      imageBase64: 'data:image/png;base64,start-frame',
      lastFrameBase64: 'data:image/png;base64,end-frame',
      videoModel: 'veo3.1',
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 4,
      generateAudio: false,
      apiKey: 'test-key',
    });

    expect(generateVideosMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({
          imageBytes: 'start-frame',
        }),
        config: expect.objectContaining({
          lastFrame: {
            imageBytes: 'end-frame',
            mimeType: 'image/jpeg',
          },
        }),
      })
    );
  });
});

describe('resolveVeoVideoModel', () => {
  it('normalizes the legacy Veo route id to the real execution model', async () => {
    const { resolveVeoVideoModel } = await import('./gemini.js');

    expect(resolveVeoVideoModel('veo-3.1')).toBe('veo-3.1-fast-generate-preview');
    expect(resolveVeoVideoModel('veo-3.1-fast-generate-preview')).toBe(
      'veo-3.1-fast-generate-preview'
    );
    expect(resolveVeoVideoModel('veo3.1-fast')).toBe('veo_3_1-fast');
    expect(resolveVeoVideoModel('veo3.1-lite')).toBe('veo_3_1-lite');
    expect(resolveVeoVideoModel('veo_3_1-fast')).toBe('veo_3_1-fast');
    expect(resolveVeoVideoModel('veo_3_1-lite')).toBe('veo_3_1-lite');
  });

  it('rejects missing Veo video model ids instead of silently defaulting', async () => {
    const { resolveVeoVideoModel } = await import('./gemini.js');

    expect(() => resolveVeoVideoModel()).toThrow(/missing veo video model/i);
  });

  it('rejects unknown Veo ids instead of silently executing the default model', async () => {
    const { resolveVeoVideoModel } = await import('./gemini.js');

    expect(() => resolveVeoVideoModel('veo-9-future-preview')).toThrow(
      /unsupported veo video model/i
    );
  });
});
