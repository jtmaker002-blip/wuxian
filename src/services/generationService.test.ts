import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAudio, generateImage, generateVideo } from './generationService';

describe('generationService OpenAiTeach token passthrough', () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ resultUrl: 'https://example.com/result' }),
    })) as unknown as typeof fetch;

    const store = new Map<string, string>();
    store.set('openaiteach-token-config', JSON.stringify({
      state: {
        selectedTokenValue: 'sk-test-token',
      },
    }));

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => store.set(key, value)),
        removeItem: vi.fn((key: string) => store.delete(key)),
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('attaches provider token config to image requests by default', async () => {
    await generateImage({ prompt: 'test image' });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.providerApiKey).toBe('sk-test-token');
    expect(body.providerBaseUrl).toBe('https://openaiteach.com/v1');
  });

  it('attaches provider token config to video requests by default', async () => {
    await generateVideo({ prompt: 'test video', videoModel: 'veo3.1' });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.providerApiKey).toBe('sk-test-token');
    expect(body.providerBaseUrl).toBe('https://openaiteach.com/v1');
  });

  it('attaches provider token config to audio requests by default', async () => {
    await generateAudio({ prompt: 'test audio', audioModel: 'qwen3-tts-flash' });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.providerApiKey).toBe('sk-test-token');
    expect(body.providerBaseUrl).toBe('https://openaiteach.com/v1');
  });

  it('does not overwrite an explicitly supplied image provider config with stored token config', async () => {
    await generateImage({
      prompt: 'test image',
      providerApiKey: 'sk-explicit-image',
      providerBaseUrl: 'https://example.com/v1',
    });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.providerApiKey).toBe('sk-explicit-image');
    expect(body.providerBaseUrl).toBe('https://example.com/v1');
  });

  it('does not overwrite an explicitly supplied video provider config with stored token config', async () => {
    await generateVideo({
      prompt: 'test video',
      videoModel: 'veo3.1',
      providerApiKey: 'sk-explicit-video',
      providerBaseUrl: 'https://example.com/v1',
    });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.providerApiKey).toBe('sk-explicit-video');
    expect(body.providerBaseUrl).toBe('https://example.com/v1');
  });

  it('does not overwrite an explicitly supplied audio provider config with stored token config', async () => {
    await generateAudio({
      prompt: 'test audio',
      audioModel: 'qwen3-tts-flash',
      providerApiKey: 'sk-explicit-audio',
      providerBaseUrl: 'https://example.com/v1',
    });

    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.providerApiKey).toBe('sk-explicit-audio');
    expect(body.providerBaseUrl).toBe('https://example.com/v1');
  });
});
