import { describe, expect, it } from 'vitest';
import {
  LOCAL_VIDEO_CAPABILITIES,
  LOCAL_VOICE_CAPABILITIES,
  type VideoCapabilitiesMap,
} from '../config/modelCapabilities';
import {
  fetchRemoteVideoCapabilities,
  fetchRemoteVoiceCapabilities,
  mergeVideoCapabilities,
  mergeVoiceCapabilities,
} from './remoteCapabilitiesService';

describe('mergeVideoCapabilities', () => {
  it('deep merges mode fields without wiping unspecified defaults', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'veo3.1': {
        modes: {
          standard: {
            durations: [4, 6, 10],
            defaultDuration: 10,
          },
        },
      },
    });

    expect(merged['veo3.1'].modes.standard.durations).toEqual([4, 6, 10]);
    expect(merged['veo3.1'].modes.standard.defaultDuration).toBe(10);
    expect(merged['veo3.1'].modes.standard.aspectRatios).toEqual(
      LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes.standard.aspectRatios
    );
  });

  it('ignores unknown remote model ids', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'unknown-model': {
        serverModelId: 'whatever',
      },
    } as Record<string, unknown>);

    expect((merged as VideoCapabilitiesMap & Record<string, unknown>)['unknown-model']).toBeUndefined();
  });

  it('does not let remote capabilities replace a known video model with a different serverModelId', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'veo3.1': {
        serverModelId: 'some-unknown-upstream-model',
        modes: {
          standard: {
            durations: [4, 6, 8],
            defaultDuration: 4,
          },
        },
      },
    });

    expect(merged['veo3.1'].serverModelId).toBe(
      LOCAL_VIDEO_CAPABILITIES['veo3.1'].serverModelId
    );
  });

  it('ignores remote-only video models that are not in the local fallback table yet', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'totally-new-video-model': {
        serverModelId: 'totally-new-video-model',
        modes: {
          standard: {
            enabled: true,
            supportsTextToVideo: false,
            supportsImageToVideo: true,
            supportsFullReference: true,
            durations: [5],
            aspectRatios: ['16:9'],
            resolutions: ['720p'],
            defaultDuration: 5,
            defaultAspectRatio: '16:9',
            defaultResolution: '720p',
          },
        },
      },
    });

    expect((merged as Record<string, unknown>)['totally-new-video-model']).toBeUndefined();
  });

  it('rejects invalid remote defaults that are not present in options', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'kling-v2-6': {
        modes: {
          standard: {
            durations: [5, 10],
            defaultDuration: 8,
          },
        },
      },
    });

    expect(merged['kling-v2-6']).toEqual(LOCAL_VIDEO_CAPABILITIES['kling-v2-6']);
  });

  it('rejects contradictory remote mode combinations', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'kling-v2-6': {
        modes: {
          frameToFrame: {
            enabled: true,
            supportsImageToVideo: false,
            supportsStartEndFrames: true,
          },
        },
      },
    });

    expect(merged['kling-v2-6'].modes.frameToFrame).toEqual(
      LOCAL_VIDEO_CAPABILITIES['kling-v2-6'].modes.frameToFrame
    );
  });

  it('ignores remote full-reference flags for models whose backend still lacks true reference-image execution', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'veo3.1': {
        modes: {
          standard: {
            supportsMultiImage: true,
            supportsFullReference: true,
          },
        },
      },
    });

    expect(merged['veo3.1'].modes.standard.supportsMultiImage).toBe(false);
    expect(merged['veo3.1'].modes.standard.supportsFullReference).toBe(false);
  });

  it('retains remote full-reference flags for models whose backend truly supports reference-image execution', () => {
    const merged = mergeVideoCapabilities(LOCAL_VIDEO_CAPABILITIES, {
      'minimax-hailuo': {
        modes: {
          standard: {
            supportsMultiImage: true,
            supportsFullReference: true,
          },
        },
      },
    });

    expect(merged['minimax-hailuo'].modes.standard.supportsMultiImage).toBe(true);
    expect(merged['minimax-hailuo'].modes.standard.supportsFullReference).toBe(true);
  });

  it('returns null when remote capability endpoint is unavailable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;

    try {
      await expect(fetchRemoteVideoCapabilities()).resolves.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('passes sid when fetching remote video capabilities', async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = (async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;

    try {
      await fetchRemoteVideoCapabilities('sid-123');
      expect(requestedUrl).toContain('/api/model-capabilities/video?sid=sid-123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('unwraps nested video capability payloads from backend envelopes', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            capabilities: {
              video: {
                'veo3.1': {
                  serverModelId: 'veo-3.1-fast-generate-preview',
                },
              },
            },
          },
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      await expect(fetchRemoteVideoCapabilities()).resolves.toEqual({
        'veo3.1': {
          serverModelId: 'veo-3.1-fast-generate-preview',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('merges valid remote voice capability overrides', () => {
    const merged = mergeVoiceCapabilities(LOCAL_VOICE_CAPABILITIES, {
      'qwen3-tts-flash': {
        defaultVoice: 'xiaoyu',
      },
    });

    expect(merged['qwen3-tts-flash'].defaultVoice).toBe('xiaoyu');
  });

  it('allows remote capabilities to activate known registry voice models that are not in the local fallback table', () => {
    const merged = mergeVoiceCapabilities(LOCAL_VOICE_CAPABILITIES, {
      'cosyvoice-v3-plus': {
        serverModelId: 'cosyvoice-v3-plus',
        defaultVoice: 'narrator',
        supportsVoiceClone: true,
      },
    });

    expect(merged['cosyvoice-v3-plus']).toBeDefined();
    expect(merged['cosyvoice-v3-plus'].defaultVoice).toBe('narrator');
    expect(merged['cosyvoice-v3-plus'].supportsVoiceClone).toBe(true);
  });

  it('returns null when remote voice capability endpoint is unavailable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;

    try {
      await expect(fetchRemoteVoiceCapabilities()).resolves.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('passes sid when fetching remote voice capabilities', async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = (async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;

    try {
      await fetchRemoteVoiceCapabilities('sid-voice');
      expect(requestedUrl).toContain('/api/model-capabilities/voice?sid=sid-voice');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('unwraps nested voice capability payloads from backend envelopes', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          result: {
            voice: {
              'qwen3-tts-flash': {
                serverModelId: 'qwen3-tts-flash',
                defaultVoice: 'xiaoyu',
              },
            },
          },
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      await expect(fetchRemoteVoiceCapabilities()).resolves.toEqual({
        'qwen3-tts-flash': {
          serverModelId: 'qwen3-tts-flash',
          defaultVoice: 'xiaoyu',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
