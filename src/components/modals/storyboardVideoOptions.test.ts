import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCAL_VIDEO_CAPABILITIES,
  resetRuntimeVideoCapabilities,
  setRuntimeVideoCapabilities,
} from '../../config/modelCapabilities';
import {
  getStoryboardVideoModalState,
  getStoryboardVideoOptions,
  getStoryboardVideoSections,
  normalizeStoryboardVideoSettings,
} from './storyboardVideoOptions';

describe('storyboardVideoOptions', () => {
  afterEach(() => {
    resetRuntimeVideoCapabilities();
  });

  it('only exposes enabled runtime-executable standard image-to-video models', () => {
    setRuntimeVideoCapabilities({
      ...LOCAL_VIDEO_CAPABILITIES,
      'veo3.1-fast': {
        ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'],
        modes: {
          ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes,
          standard: {
            ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes.standard,
            enabled: false,
          },
        },
      },
      'kling-v2-6': {
        ...LOCAL_VIDEO_CAPABILITIES['kling-v2-6'],
        modes: {
          ...LOCAL_VIDEO_CAPABILITIES['kling-v2-6'].modes,
          standard: {
            ...LOCAL_VIDEO_CAPABILITIES['kling-v2-6'].modes.standard,
            supportsImageToVideo: false,
          },
        },
      },
    });

    const options = getStoryboardVideoOptions(new Set(['veo3.1-fast', 'kling-v2-6', 'minimax-hailuo']));

    expect(options.map((option) => option.model.id)).toEqual(['minimax-hailuo']);
  });

  it('normalizes invalid settings using runtime capability defaults', () => {
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
            resolutions: ['1080p'],
            defaultResolution: '1080p',
          },
        },
      },
    });

    const options = getStoryboardVideoOptions(new Set(['veo3.1-fast']));
    const normalized = normalizeStoryboardVideoSettings(
      {
        model: 'veo3.1-fast',
        duration: 4,
        resolution: '720p',
      },
      options
    );

    expect(normalized).toEqual({
      model: 'veo3.1-fast',
      duration: 6,
      resolution: '1080p',
    });
  });

  it('builds modal state from runtime-safe options and falls back when the selected model is no longer executable', () => {
    setRuntimeVideoCapabilities({
      ...LOCAL_VIDEO_CAPABILITIES,
      'veo3.1-fast': {
        ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'],
        modes: {
          ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes,
          standard: {
            ...LOCAL_VIDEO_CAPABILITIES['veo3.1-fast'].modes.standard,
            enabled: false,
          },
        },
      },
      'kling-v2-6': {
        ...LOCAL_VIDEO_CAPABILITIES['kling-v2-6'],
        modes: {
          ...LOCAL_VIDEO_CAPABILITIES['kling-v2-6'].modes,
          standard: {
            ...LOCAL_VIDEO_CAPABILITIES['kling-v2-6'].modes.standard,
            durations: [10],
            defaultDuration: 10,
            resolutions: ['1080p'],
            defaultResolution: '1080p',
          },
        },
      },
    });

    const state = getStoryboardVideoModalState(
      new Set(['veo3.1-fast', 'kling-v2-6']),
      {
        model: 'veo3.1-fast',
        duration: 4,
        resolution: '720p',
      }
    );

    expect(state.options.map((option) => option.model.id)).toEqual(['kling-v2-6']);
    expect(state.sections).toEqual([
      {
        provider: 'kling',
        label: 'Kling AI',
        models: [expect.objectContaining({ id: 'kling-v2-6' })],
      },
    ]);
    expect(state.currentOption?.model.id).toBe('kling-v2-6');
    expect(state.currentSettings).toEqual({
      model: 'kling-v2-6',
      duration: 10,
      resolution: '1080p',
    });
  });

  it('keeps xAI, Wan, and Seedance models in storyboard provider sections instead of dropping them', () => {
    const options = getStoryboardVideoOptions(
      new Set(['grok-video-3', 'wan2.6-i2v', 'jimeng-seedance-2'])
    );
    const sections = getStoryboardVideoSections(options);

    expect(sections).toEqual([
      {
        provider: 'xai',
        label: 'xAI',
        models: [expect.objectContaining({ id: 'grok-video-3' })],
      },
      {
        provider: 'wan',
        label: 'Wan',
        models: [expect.objectContaining({ id: 'wan2.6-i2v' })],
      },
      {
        provider: 'seedance',
        label: '即梦 / Seedance',
        models: [expect.objectContaining({ id: 'jimeng-seedance-2' })],
      },
    ]);
  });
});
