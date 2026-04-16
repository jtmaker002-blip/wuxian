import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCAL_VIDEO_CAPABILITIES,
  resetRuntimeVideoCapabilities,
  setRuntimeVideoCapabilities,
} from './modelCapabilities';
import { getRegistryVideoModels, REGISTRY_IMAGE_MODELS } from './registryCanvasModels';

describe('registry canvas models', () => {
  afterEach(() => {
    resetRuntimeVideoCapabilities();
  });

  it('exposes all registry image providers in the image registry list', () => {
    const providerIds = new Set(REGISTRY_IMAGE_MODELS.map((model) => model.provider));
    expect(providerIds.has('openai') || providerIds.has('google')).toBe(true);
    expect(providerIds.has('kling')).toBe(false);
    expect(providerIds.has('hosted')).toBe(true);
  });

  it('keeps executable image models first and also exposes hosted-only image models from the registry', () => {
    expect(REGISTRY_IMAGE_MODELS.map((model) => model.id).slice(0, 4)).toEqual([
      'gemini-2.5-flash-image-preview',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
      'gpt-image-1.5-all',
    ]);
    expect(REGISTRY_IMAGE_MODELS.map((model) => model.id)).toContain('midjourney-v6');
    expect(REGISTRY_IMAGE_MODELS.map((model) => model.id)).toContain('midjourney-v6-raw');
    expect(REGISTRY_IMAGE_MODELS.map((model) => model.id)).toContain('midjourney-niji-v6');
    expect(REGISTRY_IMAGE_MODELS.map((model) => model.id)).toContain('grok-4.2-image');
  });

  it('groups hosted-only image models under the hosted provider instead of generic other', () => {
    const midjourney = REGISTRY_IMAGE_MODELS.find((model) => model.id === 'midjourney-v6');
    const grokImage = REGISTRY_IMAGE_MODELS.find((model) => model.id === 'grok-4.2-image');
    const qwenImage = REGISTRY_IMAGE_MODELS.find((model) => model.id === 'qwen-image-edit-2509');

    expect(midjourney?.provider).toBe('hosted');
    expect(grokImage?.provider).toBe('hosted');
    expect(qwenImage?.provider).toBe('hosted');
  });

  it('reflects runtime video capability overrides in the generated video registry list', () => {
    setRuntimeVideoCapabilities({
      ...LOCAL_VIDEO_CAPABILITIES,
      'veo3.1-fast': {
        ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'],
        modes: {
          ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes,
          standard: {
            ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes.standard,
            durations: [6],
            defaultDuration: 6,
          },
        },
      },
    });

    const veo = getRegistryVideoModels().find((model) => model.id === 'veo3.1-fast');
    expect(veo?.durations).toEqual([6]);
  });

  it('does not treat start/end frame support as standard multi-image capability in the canvas registry metadata', () => {
    const kling = getRegistryVideoModels().find((model) => model.id === 'kling-v3');
    const veo = getRegistryVideoModels().find((model) => model.id === 'veo3.1-fast');
    const grok = getRegistryVideoModels().find((model) => model.id === 'grok-video-3');
    const wan = getRegistryVideoModels().find((model) => model.id === 'wan2.6-i2v');
    const seedance = getRegistryVideoModels().find((model) => model.id === 'jimeng-seedance-2');

    expect(kling?.supportsMultiImage).toBe(false);
    expect(veo?.supportsMultiImage).toBe(true);
    expect(grok?.provider).toBe('xai');
    expect(grok?.supportsMultiImage).toBe(false);
    expect(wan?.provider).toBe('wan');
    expect(seedance?.provider).toBe('seedance');
  });

  it('only exposes currently executable video model ids', () => {
    expect(getRegistryVideoModels().map((model) => model.id)).toEqual([
      'sora-2',
      'veo3.1-fast',
      'veo3.1-lite',
      'grok-video-3',
      'kling-v3',
      'kling-v2-6',
      'kling-v2-5-turbo',
      'minimax-hailuo',
      'wan2.6-i2v',
      'wan2.6-i2v-flash',
      'jimeng-seedance-2',
      'jimeng-4.5',
      'jimeng-4.1',
      'jimeng-4.0',
      'jimeng-video-3-fast',
    ]);
  });

  it('drops video models whose runtime capabilities disable every mode', () => {
    setRuntimeVideoCapabilities({
      ...LOCAL_VIDEO_CAPABILITIES,
      'veo3.1-fast': {
        ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'],
        modes: {
          standard: { ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes.standard, enabled: false },
          frameToFrame: { ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes.frameToFrame, enabled: false },
          motionControl: { ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes.motionControl, enabled: false },
        },
      },
    });

    expect(getRegistryVideoModels().some((model) => model.id === 'veo3.1-fast')).toBe(false);
  });
});
