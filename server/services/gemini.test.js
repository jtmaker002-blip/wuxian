import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAIMock() {
    return {
      models: {
        generateContent: generateContentMock,
        generateVideos: vi.fn(),
      },
      operations: {
        get: vi.fn(),
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

describe('resolveVeoVideoModel', () => {
  it('normalizes the legacy Veo route id to the real execution model', async () => {
    const { resolveVeoVideoModel } = await import('./gemini.js');

    expect(resolveVeoVideoModel('veo-3.1')).toBe('veo-3.1-fast-generate-preview');
    expect(resolveVeoVideoModel('veo-3.1-fast-generate-preview')).toBe(
      'veo-3.1-fast-generate-preview'
    );
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
