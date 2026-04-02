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

  it('only exposes executable image providers in the image registry list', () => {
    const providerIds = new Set(REGISTRY_IMAGE_MODELS.map((model) => model.provider));
    expect(providerIds.has('openai') || providerIds.has('google')).toBe(true);
    expect(providerIds.has('kling')).toBe(false);
  });

  it('only exposes executable image model ids from the registry', () => {
    expect(REGISTRY_IMAGE_MODELS.map((model) => model.id)).toEqual([
      'gemini-2.5-flash-image-preview',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
      'gpt-image-1.5-all',
    ]);
  });

  it('reflects runtime video capability overrides in the generated video registry list', () => {
    setRuntimeVideoCapabilities({
      ...LOCAL_VIDEO_CAPABILITIES,
      'veo3.1': {
        ...LOCAL_VIDEO_CAPABILITIES['veo3.1'],
        modes: {
          ...LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes,
          standard: {
            ...LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes.standard,
            durations: [6],
            defaultDuration: 6,
          },
        },
      },
    });

    const veo = getRegistryVideoModels().find((model) => model.id === 'veo3.1');
    expect(veo?.durations).toEqual([6]);
  });

  it('does not treat start/end frame support as standard multi-image capability in the canvas registry metadata', () => {
    const kling = getRegistryVideoModels().find((model) => model.id === 'kling-v3');
    const veo = getRegistryVideoModels().find((model) => model.id === 'veo3.1');
    const grok = getRegistryVideoModels().find((model) => model.id === 'grok-video-3');

    expect(kling?.supportsMultiImage).toBe(false);
    expect(veo?.supportsMultiImage).toBe(false);
    expect(grok?.provider).toBe('xai');
    expect(grok?.supportsMultiImage).toBe(false);
  });

  it('only exposes currently executable video model ids', () => {
    expect(getRegistryVideoModels().map((model) => model.id)).toEqual([
      'sora-2',
      'veo3.1',
      'grok-video-3',
      'kling-v3',
      'kling-v2-6',
      'kling-v2-5-turbo',
      'minimax-hailuo',
      'wan2.6-i2v',
      'wan2.6-i2v-flash',
      'wan2.5-i2v-preview',
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
      'veo3.1': {
        ...LOCAL_VIDEO_CAPABILITIES['veo3.1'],
        modes: {
          standard: { ...LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes.standard, enabled: false },
          frameToFrame: { ...LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes.frameToFrame, enabled: false },
          motionControl: { ...LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes.motionControl, enabled: false },
        },
      },
    });

    expect(getRegistryVideoModels().some((model) => model.id === 'veo3.1')).toBe(false);
  });
});
