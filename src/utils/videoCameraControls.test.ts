import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildCameraControlPrompt,
  buildCameraPresetPrompt,
  DEFAULT_VIDEO_CAMERA_CONTROL,
  isCameraPresetSupported,
  LIBTV_CAMERA_CONTROL_STORAGE_KEY,
  loadCameraControlStorage,
  saveCameraControlStorage,
  stripCameraPresetMentionTokens,
  toCameraPresetToken,
  VIDEO_CAMERA_PRESET_UNSUPPORTED_TOOLTIP,
  VIDEO_CAMERA_PRESETS,
} from './videoCameraControls';

describe('videoCameraControls', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    vi.restoreAllMocks();
  });

  it('uses the confirmed localStorage key for camera control persistence', () => {
    const next = {
      ...DEFAULT_VIDEO_CAMERA_CONTROL,
      enabled: true,
      camera: 'Arri Alexa 65',
    };

    saveCameraControlStorage(next);

    expect(window.localStorage.getItem(LIBTV_CAMERA_CONTROL_STORAGE_KEY)).toContain('Arri Alexa 65');
    expect(loadCameraControlStorage()).toMatchObject(next);
  });

  it('builds camera control prompt only when enabled', () => {
    expect(buildCameraControlPrompt(DEFAULT_VIDEO_CAMERA_CONTROL)).toBe('');
    expect(buildCameraControlPrompt({ ...DEFAULT_VIDEO_CAMERA_CONTROL, enabled: true }))
      .toContain('摄像机控制：');
  });

  it('models unsupported camera preset modes and tooltip', () => {
    expect(isCameraPresetSupported('text2video')).toBe(true);
    expect(isCameraPresetSupported('frames2video')).toBe(false);
    expect(isCameraPresetSupported('videoEdit2video')).toBe(false);
    expect(VIDEO_CAMERA_PRESET_UNSUPPORTED_TOOLTIP).toBe('当前模式不支持预设运镜');
  });

  it('serializes camera preset mention tokens into prompt text', () => {
    const prompt = buildCameraPresetPrompt(VIDEO_CAMERA_PRESETS.slice(0, 2));

    expect(toCameraPresetToken(0)).toBe('{{CameraPreset 1}}');
    expect(prompt).toContain('{{CameraPreset 1}}');
    expect(prompt).toContain('{{CameraPreset 2}}');
    expect(stripCameraPresetMentionTokens(`主体奔跑\n${prompt}`)).toBe('主体奔跑');
  });
});
