import { afterEach, describe, expect, it } from 'vitest';
import {
  getVideoCapability,
  getVoiceCapability,
  LOCAL_VIDEO_CAPABILITIES,
  LOCAL_VOICE_CAPABILITIES,
  resetRuntimeVideoCapabilities,
  setRuntimeVideoCapabilities,
} from './modelCapabilities';
import { mapRegistryVideoIdToServerVideoId } from './registryModelBridge';

describe('model capabilities', () => {
  afterEach(() => {
    resetRuntimeVideoCapabilities();
  });

  it('returns a known video capability by registry id', () => {
    const capability = getVideoCapability('veo3.1');

    expect(capability?.id).toBe('veo3.1');
    expect(capability?.serverModelId).toBeTruthy();
    expect(capability?.modes.standard.enabled).toBe(true);
  });

  it('returns a known voice capability by registry id', () => {
    const capability = getVoiceCapability('qwen3-tts-flash');

    expect(capability?.id).toBe('qwen3-tts-flash');
    expect(capability?.serverModelId).toBe('qwen3-tts-flash');
    expect(capability?.supportsTextToSpeech).toBe(true);
  });

  it('ensures every local video capability has valid defaults inside mode option arrays', () => {
    for (const capability of Object.values(LOCAL_VIDEO_CAPABILITIES)) {
      expect(capability.serverModelId).toBeTruthy();

      for (const mode of Object.values(capability.modes)) {
        if (!mode.enabled) continue;

        expect(mode.durations).toContain(mode.defaultDuration);
        expect(mode.aspectRatios).toContain(mode.defaultAspectRatio);
        expect(mode.resolutions).toContain(mode.defaultResolution);
      }
    }
  });

  it('ensures every local voice capability has a server model id', () => {
    for (const capability of Object.values(LOCAL_VOICE_CAPABILITIES)) {
      expect(capability.serverModelId).toBeTruthy();
    }
  });

  it('maps registry video ids through capability-backed server ids', () => {
    expect(mapRegistryVideoIdToServerVideoId('grok-video-3')).toBe('grok-video-3');
    expect(mapRegistryVideoIdToServerVideoId('sora-2')).toBe('sora-2');
    expect(mapRegistryVideoIdToServerVideoId('veo3.1')).toBe('veo-3.1-fast-generate-preview');
    expect(mapRegistryVideoIdToServerVideoId('veo3.1-pro')).toBeUndefined();
    expect(mapRegistryVideoIdToServerVideoId('veo3.1-fast-components')).toBeUndefined();
    expect(mapRegistryVideoIdToServerVideoId('minimax-hailuo')).toBe('hailuo-2.3');
    expect(mapRegistryVideoIdToServerVideoId('kling-v2-6')).toBe('kling-v2-6');
    expect(mapRegistryVideoIdToServerVideoId('wan2.5-i2v-preview')).toBe('wan2.5-i2v-preview');
    expect(mapRegistryVideoIdToServerVideoId('wan2.6-i2v')).toBe('wan2.6-i2v');
    expect(mapRegistryVideoIdToServerVideoId('wan2.6-i2v-flash')).toBe('wan2.6-i2v-flash');
    expect(mapRegistryVideoIdToServerVideoId('jimeng-seedance-2')).toBe('jimeng-seedance-2');
    expect(mapRegistryVideoIdToServerVideoId('jimeng-4.5')).toBe('jimeng-4.5');
    expect(mapRegistryVideoIdToServerVideoId('jimeng-4.1')).toBe('jimeng-4.1');
    expect(mapRegistryVideoIdToServerVideoId('jimeng-4.0')).toBe('jimeng-4.0');
    expect(mapRegistryVideoIdToServerVideoId('jimeng-video-3-fast')).toBe('jimeng-video-3-fast');
  });

  it('reads runtime-overridden video capabilities', () => {
    setRuntimeVideoCapabilities({
      ...LOCAL_VIDEO_CAPABILITIES,
      'veo3.1': {
        ...LOCAL_VIDEO_CAPABILITIES['veo3.1'],
        serverModelId: 'veo3.1-remote',
      },
    });

    expect(getVideoCapability('veo3.1')?.serverModelId).toBe('veo3.1-remote');
  });

  it('pins only truly executable local video models to backend ids', () => {
    expect(LOCAL_VIDEO_CAPABILITIES['grok-video-3'].serverModelId).toBe('grok-video-3');
    expect(LOCAL_VIDEO_CAPABILITIES['sora-2'].serverModelId).toBe('sora-2');
    expect(LOCAL_VIDEO_CAPABILITIES['veo3.1'].serverModelId).toBe('veo-3.1-fast-generate-preview');
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v3'].serverModelId).toBe('kling-v3');
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v2-6'].serverModelId).toBe('kling-v2-6');
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v2-5-turbo'].serverModelId).toBe('kling-v2-5-turbo');
    expect(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'].serverModelId).toBe('hailuo-2.3');
    expect(LOCAL_VIDEO_CAPABILITIES['wan2.5-i2v-preview'].serverModelId).toBe('wan2.5-i2v-preview');
    expect(LOCAL_VIDEO_CAPABILITIES['wan2.6-i2v'].serverModelId).toBe('wan2.6-i2v');
    expect(LOCAL_VIDEO_CAPABILITIES['wan2.6-i2v-flash'].serverModelId).toBe('wan2.6-i2v-flash');
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-seedance-2'].serverModelId).toBe('jimeng-seedance-2');
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-4.5'].serverModelId).toBe('jimeng-4.5');
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-4.1'].serverModelId).toBe('jimeng-4.1');
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-4.0'].serverModelId).toBe('jimeng-4.0');
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-video-3-fast'].serverModelId).toBe('jimeng-video-3-fast');
  });

  it('keeps standard full-reference flags aligned with currently wired providers', () => {
    expect(LOCAL_VIDEO_CAPABILITIES['grok-video-3'].modes.standard.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['grok-video-3'].modes.standard.supportsMultiImage).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['sora-2'].modes.standard.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes.standard.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v3'].modes.standard.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v2-6'].modes.standard.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v2-5-turbo'].modes.standard.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'].modes.standard.supportsFullReference).toBe(true);
    expect(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'].modes.standard.supportsMultiImage).toBe(true);
  });

  it('keeps frame-to-frame modes from pretending to be full-reference multi-image modes', () => {
    expect(LOCAL_VIDEO_CAPABILITIES['sora-2'].modes.frameToFrame.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['veo3.1'].modes.frameToFrame.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v3'].modes.frameToFrame.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['kling-v2-5-turbo'].modes.frameToFrame.supportsFullReference).toBe(false);
    expect(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'].modes.frameToFrame.supportsFullReference).toBe(false);
  });

  it('documents kling-v2-6 semantic contract', () => {
    const capability = LOCAL_VIDEO_CAPABILITIES['kling-v2-6'];

    expect(capability.modes.standard.supportsTextToVideo).toBe(true);
    expect(capability.modes.standard.supportsImageToVideo).toBe(true);
    expect(capability.modes.standard.supportsAudio).toBe(true);
    expect(capability.modes.standard.durations).toEqual([5, 10]);
    expect(capability.modes.standard.aspectRatios).toEqual(['1:1', '16:9', '9:16']);
    expect(capability.modes.standard.resolutions).toEqual(['Auto']);

    expect(capability.modes.frameToFrame.enabled).toBe(true);
    expect(capability.modes.frameToFrame.supportsStartEndFrames).toBe(true);
    expect(capability.modes.frameToFrame.supportsAudio).toBe(false);
    expect(capability.modes.frameToFrame.durations).toEqual([5, 10]);
    expect(capability.modes.frameToFrame.aspectRatios).toEqual(['16:9', '9:16']);
    expect(capability.modes.frameToFrame.resolutions).toEqual(['Auto']);

    expect(capability.modes.motionControl.enabled).toBe(true);
    expect(capability.modes.motionControl.supportsMotionReference).toBe(true);
    expect(capability.modes.motionControl.supportsAudio).toBe(false);
    expect(capability.modes.motionControl.durations).toEqual([5]);
    expect(capability.modes.motionControl.resolutions).toEqual(['Auto']);
  });

  it('documents sora-2 semantic contract', () => {
    const capability = LOCAL_VIDEO_CAPABILITIES['sora-2'];

    expect(capability.modes.standard.enabled).toBe(true);
    expect(capability.modes.standard.supportsTextToVideo).toBe(true);
    expect(capability.modes.standard.supportsImageToVideo).toBe(true);
    expect(capability.modes.standard.supportsAudio).toBe(false);
    expect(capability.modes.standard.durations).toEqual([4, 8, 12]);
    expect(capability.modes.standard.aspectRatios).toEqual(['16:9', '9:16']);
    expect(capability.modes.standard.resolutions).toEqual(['720p', '1080p']);
    expect(capability.modes.frameToFrame.enabled).toBe(false);
    expect(capability.modes.motionControl.enabled).toBe(false);
  });

  it('documents grok-video-3 semantic contract', () => {
    const capability = LOCAL_VIDEO_CAPABILITIES['grok-video-3'];

    expect(capability.modes.standard.enabled).toBe(true);
    expect(capability.modes.standard.supportsTextToVideo).toBe(true);
    expect(capability.modes.standard.supportsImageToVideo).toBe(true);
    expect(capability.modes.standard.supportsMultiImage).toBe(false);
    expect(capability.modes.standard.supportsFullReference).toBe(false);
    expect(capability.modes.standard.supportsStartEndFrames).toBe(false);
    expect(capability.modes.standard.supportsMotionReference).toBe(false);
    expect(capability.modes.standard.supportsAudio).toBe(false);
    expect(capability.modes.standard.durations).toEqual([4, 8, 10, 12, 15]);
    expect(capability.modes.standard.aspectRatios).toEqual(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']);
    expect(capability.modes.standard.resolutions).toEqual(['480p', '720p']);
    expect(capability.modes.frameToFrame.enabled).toBe(false);
    expect(capability.modes.motionControl.enabled).toBe(false);
  });

  it('documents wan 2.6 image-to-video semantic contract', () => {
    const capability = LOCAL_VIDEO_CAPABILITIES['wan2.6-i2v'];

    expect(capability.modes.standard.enabled).toBe(true);
    expect(capability.modes.standard.supportsTextToVideo).toBe(false);
    expect(capability.modes.standard.supportsImageToVideo).toBe(true);
    expect(capability.modes.standard.durations).toEqual([5, 10, 15]);
    expect(capability.modes.standard.aspectRatios).toEqual(['Auto']);
    expect(capability.modes.standard.resolutions).toEqual(['720p', '1080p']);
    expect(capability.modes.frameToFrame.enabled).toBe(false);
    expect(capability.modes.motionControl.enabled).toBe(false);
  });

  it('documents wan 2.5 preview image-to-video semantic contract', () => {
    const capability = LOCAL_VIDEO_CAPABILITIES['wan2.5-i2v-preview'];

    expect(capability.modes.standard.enabled).toBe(true);
    expect(capability.modes.standard.supportsTextToVideo).toBe(false);
    expect(capability.modes.standard.supportsImageToVideo).toBe(true);
    expect(capability.modes.standard.durations).toEqual([5, 10]);
    expect(capability.modes.standard.aspectRatios).toEqual(['Auto']);
    expect(capability.modes.standard.resolutions).toEqual(['480p', '720p', '1080p']);
    expect(capability.modes.frameToFrame.enabled).toBe(false);
    expect(capability.modes.motionControl.enabled).toBe(false);
  });

  it('documents jimeng-seedance-2 semantic contract', () => {
    const capability = LOCAL_VIDEO_CAPABILITIES['jimeng-seedance-2'];

    expect(capability.modes.standard.enabled).toBe(true);
    expect(capability.modes.standard.supportsTextToVideo).toBe(true);
    expect(capability.modes.standard.supportsImageToVideo).toBe(true);
    expect(capability.modes.standard.supportsAudio).toBe(true);
    expect(capability.modes.standard.durations).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(capability.modes.standard.aspectRatios).toEqual(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']);
    expect(capability.modes.standard.resolutions).toEqual(['720p', '1080p']);
    expect(capability.modes.frameToFrame.enabled).toBe(true);
    expect(capability.modes.frameToFrame.supportsStartEndFrames).toBe(true);
    expect(capability.modes.frameToFrame.supportsAudio).toBe(true);
    expect(capability.modes.motionControl.enabled).toBe(false);
  });

  it('documents jimeng-4.1 semantic contract', () => {
    const capability = LOCAL_VIDEO_CAPABILITIES['jimeng-4.1'];

    expect(capability.modes.standard.enabled).toBe(true);
    expect(capability.modes.standard.supportsTextToVideo).toBe(true);
    expect(capability.modes.standard.supportsImageToVideo).toBe(true);
    expect(capability.modes.standard.supportsAudio).toBe(true);
    expect(capability.modes.standard.durations).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(capability.modes.standard.aspectRatios).toEqual(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']);
    expect(capability.modes.frameToFrame.enabled).toBe(false);
    expect(capability.modes.motionControl.enabled).toBe(false);
  });

  it('keeps all jimeng family audio flags aligned with Seedance runtime support', () => {
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-seedance-2'].modes.standard.supportsAudio).toBe(true);
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-seedance-2'].modes.frameToFrame.supportsAudio).toBe(true);
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-4.5'].modes.standard.supportsAudio).toBe(true);
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-4.5'].modes.frameToFrame.supportsAudio).toBe(true);
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-4.1'].modes.standard.supportsAudio).toBe(true);
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-4.0'].modes.standard.supportsAudio).toBe(true);
    expect(LOCAL_VIDEO_CAPABILITIES['jimeng-video-3-fast'].modes.standard.supportsAudio).toBe(true);
  });
});
