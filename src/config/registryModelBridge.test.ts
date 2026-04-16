import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCAL_VIDEO_CAPABILITIES,
  resetRuntimeVideoCapabilities,
  setRuntimeVideoCapabilities,
} from './modelCapabilities';
import {
  DEFAULT_REGISTRY_IMAGE_ID,
  canonicalizeVideoModelId,
  canonicalizeImageModelId,
  mapRegistryImageIdToServerImageId,
  mapRegistryVideoIdToServerVideoId,
} from './registryModelBridge';

describe('registry model bridge', () => {
  afterEach(() => {
    resetRuntimeVideoCapabilities();
  });

  it('keeps executable image registry ids stable when canonicalizing', () => {
    expect(canonicalizeImageModelId('gemini-2.5-flash-image-preview')).toBe(
      'gemini-2.5-flash-image-preview'
    );
    expect(canonicalizeImageModelId('gemini-3.1-flash-image-preview')).toBe(
      'gemini-3.1-flash-image-preview'
    );
    expect(canonicalizeImageModelId('gemini-3-pro-image-preview')).toBe(
      'gemini-3-pro-image-preview'
    );
    expect(canonicalizeImageModelId('gpt-image-1.5-all')).toBe('gpt-image-1.5-all');
  });

  it('normalizes truthful legacy aliases and collapses unsupported image ids to the visible default', () => {
    expect(canonicalizeImageModelId('gpt-image-1.5')).toBe('gpt-image-1.5-all');
    expect(canonicalizeImageModelId('gemini-pro')).toBe('gemini-3-pro-image-preview');
    expect(canonicalizeImageModelId('kling-v1-5')).toBe(DEFAULT_REGISTRY_IMAGE_ID);
    expect(canonicalizeImageModelId('grok-4.2-image')).toBe('grok-4.2-image');
    expect(canonicalizeImageModelId('midjourney-v6')).toBe('midjourney-v6');
  });

  it('maps registry image ids to the backend model ids they actually execute', () => {
    expect(mapRegistryImageIdToServerImageId('gpt-image-1.5-all')).toBe('gpt-image-1.5');
    expect(mapRegistryImageIdToServerImageId('gemini-2.5-flash-image-preview')).toBe(
      'gemini-2.5-flash-image-preview'
    );
    expect(mapRegistryImageIdToServerImageId('gemini-3.1-flash-image-preview')).toBe(
      'gemini-3.1-flash-image-preview'
    );
    expect(mapRegistryImageIdToServerImageId('gemini-3-pro-image-preview')).toBe(
      'gemini-3-pro-image-preview'
    );
    expect(mapRegistryImageIdToServerImageId('grok-4.2-image')).toBe('grok-4.2-image');
    expect(mapRegistryImageIdToServerImageId('midjourney-v6')).toBe('midjourney-v6');
  });

  it('canonicalizes legacy video aliases to visible executable registry ids', () => {
    expect(canonicalizeVideoModelId('veo-3.1-fast-generate-preview')).toBe('veo3.1-fast');
    expect(canonicalizeVideoModelId('veo3.1')).toBe('veo3.1-fast');
    expect(canonicalizeVideoModelId('veo_3_1-fast')).toBe('veo3.1-fast');
    expect(canonicalizeVideoModelId('veo_3_1-lite')).toBe('veo3.1-lite');
    expect(canonicalizeVideoModelId('veo3.1-pro')).toBe('veo3.1-fast');
    expect(canonicalizeVideoModelId('veo3.1-fast-components')).toBe('veo3.1-fast');
    expect(canonicalizeVideoModelId('wan2.6-i2v')).toBe('wan2.6-i2v');
    expect(canonicalizeVideoModelId('jimeng-4.5')).toBe('jimeng-4.5');
    expect(mapRegistryVideoIdToServerVideoId('veo3.1-fast')).toBe('veo_3_1-fast');
    expect(mapRegistryVideoIdToServerVideoId('veo3.1-lite')).toBe('veo_3_1-lite');
    expect(mapRegistryVideoIdToServerVideoId('veo3.1')).toBeUndefined();
    expect(mapRegistryVideoIdToServerVideoId('veo3.1-pro')).toBeUndefined();
    expect(mapRegistryVideoIdToServerVideoId('veo3.1-fast-components')).toBeUndefined();
    expect(mapRegistryVideoIdToServerVideoId('wan2.6-i2v')).toBe('wan2.6-i2v');
    expect(mapRegistryVideoIdToServerVideoId('wan2.5-i2v-preview')).toBeUndefined();
  });

  it('keeps sunset video models on the node for readonly display, but stops mapping them to executable server ids', () => {
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

    expect(canonicalizeVideoModelId('veo3.1-fast')).toBe('veo3.1-fast');
    expect(canonicalizeVideoModelId('veo-3.1-fast-generate-preview')).toBe('veo3.1-fast');
    expect(mapRegistryVideoIdToServerVideoId('veo3.1-fast')).toBeUndefined();
  });
});
