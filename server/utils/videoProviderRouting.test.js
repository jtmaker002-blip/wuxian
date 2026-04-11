import { describe, expect, it } from 'vitest';
import { assertVideoExecutionSupported, resolveVideoExecutionPlan, resolveVideoProvider } from './videoProviderRouting.js';

describe('resolveVideoProvider', () => {
  it('routes Kling models through the Kling provider', () => {
    expect(resolveVideoProvider('kling-v3')).toEqual({
      provider: 'kling',
      normalizedModel: 'kling-v3',
    });
  });

  it('routes minimax-hailuo through the Hailuo provider alias', () => {
    expect(resolveVideoProvider('minimax-hailuo')).toEqual({
      provider: 'hailuo',
      normalizedModel: 'hailuo-2.3',
    });
  });

  it('routes Veo aliases through the Veo provider', () => {
    expect(resolveVideoProvider('veo3.1')).toEqual({
      provider: 'veo',
      normalizedModel: 'veo-3.1-fast-generate-preview',
    });
  });

  it('routes wan 2.6 image-to-video through the wan provider family', () => {
    expect(resolveVideoProvider('wan2.6-i2v')).toEqual({
      provider: 'wan',
      normalizedModel: 'wan2.6-i2v',
    });
  });

  it('routes wan 2.6 flash image-to-video through the wan provider family', () => {
    expect(resolveVideoProvider('wan2.6-i2v-flash')).toEqual({
      provider: 'wan',
      normalizedModel: 'wan2.6-i2v-flash',
    });
  });

  it('routes sora-2 through the openai video provider', () => {
    expect(resolveVideoProvider('sora-2')).toEqual({
      provider: 'openai-video',
      normalizedModel: 'sora-2',
    });
  });

  it('routes grok-video-3 through the xai video provider', () => {
    expect(resolveVideoProvider('grok-video-3')).toEqual({
      provider: 'xai-video',
      normalizedModel: 'grok-video-3',
    });
  });

  it('routes jimeng models through the seedance provider family', () => {
    expect(resolveVideoProvider('jimeng-4.5')).toEqual({
      provider: 'seedance',
      normalizedModel: 'jimeng-4.5',
    });
  });

  it('still rejects truly unknown video models', () => {
    expect(() => resolveVideoProvider('totally-unknown-video')).toThrow(/unsupported video model/i);
  });
});

describe('resolveVideoExecutionPlan', () => {
  it('resolves kling-v2-6 standard text-to-video mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'kling-v2-6',
      })
    ).toEqual({
      provider: 'kling',
      normalizedModel: 'kling-v2-6',
      executionMode: 'standard-text-to-video',
      executionProvider: 'fal',
    });
  });

  it('resolves kling-v2-6 standard image-to-video mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'kling-v2-6',
        imageBase64: 'img',
      })
    ).toEqual({
      provider: 'kling',
      normalizedModel: 'kling-v2-6',
      executionMode: 'standard-image-to-video',
      executionProvider: 'fal',
    });
  });

  it('resolves kling-v2-6 motion-control mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'kling-v2-6',
        imageBase64: 'img',
        motionReferenceUrl: 'motion',
      })
    ).toEqual({
      provider: 'kling',
      normalizedModel: 'kling-v2-6',
      executionMode: 'motion-control',
      executionProvider: 'fal',
    });
  });

  it('resolves kling-v2-6 frame-to-frame onto the official kling runtime', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'kling-v2-6',
        imageBase64: 'img',
        lastFrameBase64: 'end',
      })
    ).toEqual({
      provider: 'kling',
      normalizedModel: 'kling-v2-6',
      executionMode: 'frame-to-frame',
      executionProvider: 'kling',
    });
  });

  it('resolves sora-2 standard image-to-video mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'sora-2',
        imageBase64: 'img',
      })
    ).toEqual({
      provider: 'openai-video',
      normalizedModel: 'sora-2',
      executionMode: 'standard-image-to-video',
      executionProvider: 'openai-video',
    });
  });

  it('resolves sora-2 with an end frame as frame-to-frame so the unsupported mode can be rejected explicitly', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'sora-2',
        imageBase64: 'img',
        lastFrameBase64: 'end',
      })
    ).toEqual({
      provider: 'openai-video',
      normalizedModel: 'sora-2',
      executionMode: 'frame-to-frame',
      executionProvider: 'openai-video',
    });
  });

  it('does not advertise a fake reference-images route for grok-video-3', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'grok-video-3',
        referenceImagesBase64: ['img-a', 'img-b'],
      })
    ).toEqual({
      provider: 'xai-video',
      normalizedModel: 'grok-video-3',
      executionMode: 'standard-text-to-video',
      executionProvider: 'xai-video',
    });
  });

  it('resolves grok-video-3 standard text-to-video mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'grok-video-3',
      })
    ).toEqual({
      provider: 'xai-video',
      normalizedModel: 'grok-video-3',
      executionMode: 'standard-text-to-video',
      executionProvider: 'xai-video',
    });
  });

  it('resolves grok-video-3 standard image-to-video mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'grok-video-3',
        imageBase64: 'img',
      })
    ).toEqual({
      provider: 'xai-video',
      normalizedModel: 'grok-video-3',
      executionMode: 'standard-image-to-video',
      executionProvider: 'xai-video',
    });
  });

  it('resolves wan 2.6 image-to-video onto the fal wan runtime', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'wan2.6-i2v',
        imageBase64: 'img',
      })
    ).toEqual({
      provider: 'wan',
      normalizedModel: 'wan2.6-i2v',
      executionMode: 'standard-image-to-video',
      executionProvider: 'fal-wan',
    });
  });

  it('resolves hailuo standard reference-images mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'minimax-hailuo',
        referenceImagesBase64: ['img-a', 'img-b'],
      })
    ).toEqual({
      provider: 'hailuo',
      normalizedModel: 'hailuo-2.3',
      executionMode: 'standard-reference-images',
      executionProvider: 'hailuo',
    });
  });

  it('resolves jimeng standard text-to-video mode', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'jimeng-seedance-2',
      })
    ).toEqual({
      provider: 'seedance',
      normalizedModel: 'jimeng-seedance-2',
      executionMode: 'standard-text-to-video',
      executionProvider: 'seedance',
    });
  });

  it('resolves jimeng frame-to-frame mode when start/end frames are present', () => {
    expect(
      resolveVideoExecutionPlan({
        modelId: 'jimeng-seedance-2',
        imageBase64: 'img',
        lastFrameBase64: 'end',
      })
    ).toEqual({
      provider: 'seedance',
      normalizedModel: 'jimeng-seedance-2',
      executionMode: 'frame-to-frame',
      executionProvider: 'seedance',
    });
  });
});

describe('assertVideoExecutionSupported', () => {
  it('allows supported wan 2.6 execution', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'wan',
        normalizedModel: 'wan2.6-i2v',
        executionMode: 'standard-image-to-video',
      })
    ).not.toThrow();
  });

  it('allows kling 2.6 frame-to-frame execution', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'kling',
        normalizedModel: 'kling-v2-6',
        executionMode: 'frame-to-frame',
      })
    ).not.toThrow();
  });

  it('allows supported seedance standard execution', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'seedance',
        normalizedModel: 'jimeng-seedance-2',
        executionMode: 'standard-text-to-video',
      })
    ).not.toThrow();
  });

  it('rejects unsupported seedance motion-control execution', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'seedance',
        normalizedModel: 'jimeng-seedance-2',
        executionMode: 'motion-control',
      })
    ).toThrow(/尚未接通模式/i);
  });

  it('rejects unsupported seedance frame-to-frame execution for standard-only models', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'seedance',
        normalizedModel: 'jimeng-4.1',
        executionMode: 'frame-to-frame',
      })
    ).toThrow(/尚未接通首尾帧模式/i);
  });

  it('allows supported kling text-to-video execution', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'kling',
        normalizedModel: 'kling-v3',
        executionMode: 'standard-text-to-video',
      })
    ).not.toThrow();
  });

  it('allows supported hailuo reference-images execution', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'hailuo',
        normalizedModel: 'hailuo-2.3',
        executionMode: 'standard-reference-images',
      })
    ).not.toThrow();
  });

  it('allows supported sora-2 execution', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'openai-video',
        normalizedModel: 'sora-2',
        executionMode: 'standard-text-to-video',
      })
    ).not.toThrow();
  });

  it('rejects unsupported sora-2 frame-to-frame execution explicitly', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'openai-video',
        normalizedModel: 'sora-2',
        executionMode: 'frame-to-frame',
      })
    ).toThrow(/尚未接通模式/i);
  });

  it('rejects unsupported grok-video-3 reference-images execution explicitly', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'xai-video',
        normalizedModel: 'grok-video-3',
        executionMode: 'standard-reference-images',
      })
    ).toThrow(/尚未接通模式/i);
  });

  it('rejects unsupported grok-video-3 execution modes explicitly', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'xai-video',
        normalizedModel: 'grok-video-3',
        executionMode: 'frame-to-frame',
      })
    ).toThrow(/尚未接通模式/i);
  });

  it('rejects unsupported grok-video-3 motion-control execution explicitly', () => {
    expect(() =>
      assertVideoExecutionSupported({
        provider: 'xai-video',
        normalizedModel: 'grok-video-3',
        executionMode: 'motion-control',
      })
    ).toThrow(/尚未接通模式/i);
  });
});
