import type { CameraPreset, VideoCameraControlState, VideoPanelModeKey } from '../types';

export const LIBTV_CAMERA_CONTROL_STORAGE_KEY = 'libtv-camera-control';

export const DEFAULT_VIDEO_CAMERA_CONTROL: VideoCameraControlState = {
  enabled: false,
  camera: 'Panavision DXL2',
  lens: 'Panavision C-series',
  focalLengthMm: '35',
  aperture: 'f/4',
};

export const VIDEO_CAMERA_PRESET_UNSUPPORTED_TOOLTIP = '当前模式不支持预设运镜';

export const VIDEO_CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'fixed',
    name: '固定镜头',
    prompt: '固定镜头，机位稳定不移动，保持主体和构图一致。',
  },
  {
    id: 'follow',
    name: '跟随拍摄',
    prompt: '镜头跟随主体移动，保持主体始终位于画面中心附近。',
  },
  {
    id: 'pan-up',
    name: '盘旋上升',
    prompt: '镜头围绕主体缓慢盘旋并向上升起，展现环境空间。',
  },
  {
    id: 'pan-down',
    name: '盘旋下降',
    prompt: '镜头从高处缓慢盘旋下降，逐步靠近主体。',
  },
  {
    id: 'tilt-up',
    name: '镜头上摇',
    prompt: '镜头由下向上摇动，逐渐揭示主体上方或天空空间。',
  },
  {
    id: 'tilt-down',
    name: '镜头下摇',
    prompt: '镜头由上向下摇动，逐渐落到主体或地面细节。',
  },
  {
    id: 'pan-left',
    name: '镜头左摇',
    prompt: '镜头向左平滑摇动，展示主体左侧环境。',
  },
  {
    id: 'pan-right',
    name: '镜头右摇',
    prompt: '镜头向右平滑摇动，展示主体右侧环境。',
  },
  {
    id: 'crane-up',
    name: '镜头上升',
    prompt: '镜头平稳上升，主体逐渐变小，环境范围扩大。',
  },
  {
    id: 'crane-down',
    name: '镜头下降',
    prompt: '镜头平稳下降，逐渐靠近主体并突出细节。',
  },
  {
    id: 'truck-left',
    name: '镜头左移',
    prompt: '镜头水平向左移动，保持主体稳定并产生自然视差。',
  },
  {
    id: 'truck-right',
    name: '镜头右移',
    prompt: '镜头水平向右移动，保持主体稳定并产生自然视差。',
  },
];

export function isCameraPresetSupported(mode: VideoPanelModeKey): boolean {
  return mode !== 'frames2video' && mode !== 'videoEdit2video';
}

export function toCameraPresetToken(index: number): string {
  return `{{CameraPreset ${index + 1}}}`;
}

export function buildCameraPresetPrompt(presets: CameraPreset[] | undefined): string {
  if (!presets?.length) return '';
  return presets
    .map((preset, index) => `${toCameraPresetToken(index)} ${preset.name}：${preset.prompt}`)
    .join('\n');
}

export function stripCameraPresetMentionTokens(prompt: string): string {
  return prompt
    .replace(/(?:^|\n)\{\{CameraPreset\s+\d+\}\}[^\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function loadCameraControlStorage(): VideoCameraControlState {
  if (typeof window === 'undefined') return DEFAULT_VIDEO_CAMERA_CONTROL;

  try {
    const raw = window.localStorage.getItem(LIBTV_CAMERA_CONTROL_STORAGE_KEY);
    if (!raw) return DEFAULT_VIDEO_CAMERA_CONTROL;
    const parsed = JSON.parse(raw) as Partial<VideoCameraControlState>;
    return {
      ...DEFAULT_VIDEO_CAMERA_CONTROL,
      ...parsed,
      enabled: parsed.enabled === true,
    };
  } catch {
    return DEFAULT_VIDEO_CAMERA_CONTROL;
  }
}

export function saveCameraControlStorage(state: VideoCameraControlState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LIBTV_CAMERA_CONTROL_STORAGE_KEY, JSON.stringify(state));
}

export function buildCameraControlPrompt(state: VideoCameraControlState): string {
  if (!state.enabled) return '';
  return `摄像机控制：${state.camera} / ${state.lens} / ${state.focalLengthMm}mm / ${state.aperture}`;
}
