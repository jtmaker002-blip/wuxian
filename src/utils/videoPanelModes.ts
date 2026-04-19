import { NodeType, type NodeData, type VideoPanelModeKey } from '../types';
import type { VideoModelCapability } from '../config/modelCapabilities';

export type VideoPanelListKey = 'imageList' | 'videoList' | 'audioList' | 'mixedList' | null;
export type VideoPanelMediaType = 'image' | 'video' | 'audio';

export type VideoPanelModeDefinition = {
  key: VideoPanelModeKey;
  label: string;
  listKey: VideoPanelListKey;
  requiredImages: number;
  acceptsImage: boolean;
  acceptsVideo: boolean;
  acceptsAudio: boolean;
  description: string;
};

export type VideoPanelInputCounts = {
  imageCount: number;
  videoCount: number;
  audioCount: number;
};

export type VideoPanelModeValidation = {
  isValid: boolean;
  acceptsCurrentInputs: boolean;
  reason?: string;
};

export type VideoPanelModeReferencePolicy = {
  acceptsImage: boolean;
  acceptsVideo: boolean;
  acceptsAudio: boolean;
  canUsePresetCamera: boolean;
};

export type VideoPanelConnectedSource = {
  id: string;
  type?: NodeType;
  url?: string;
};

export const VIDEO_PANEL_MODES: VideoPanelModeDefinition[] = [
  {
    key: 'text2video',
    label: '文生视频',
    listKey: null,
    requiredImages: 0,
    acceptsImage: false,
    acceptsVideo: false,
    acceptsAudio: false,
    description: '仅使用 prompt，不依赖媒体输入。',
  },
  {
    key: 'mixed2video',
    label: '全能参考',
    listKey: 'mixedList',
    requiredImages: 0,
    acceptsImage: true,
    acceptsVideo: true,
    acceptsAudio: true,
    description: '允许图片、视频、音频混合进入生成上下文。',
  },
  {
    key: 'singleImage2video',
    label: '图生视频',
    listKey: 'imageList',
    requiredImages: 1,
    acceptsImage: true,
    acceptsVideo: false,
    acceptsAudio: false,
    description: '使用 1 张图片作为视频首帧。',
  },
  {
    key: 'frames2video',
    label: '首尾帧',
    listKey: 'imageList',
    requiredImages: 2,
    acceptsImage: true,
    acceptsVideo: false,
    acceptsAudio: false,
    description: '使用 2 张图片作为首帧和尾帧。',
  },
  {
    key: 'image2video',
    label: '图片参考',
    listKey: 'imageList',
    requiredImages: 1,
    acceptsImage: true,
    acceptsVideo: false,
    acceptsAudio: false,
    description: '允许一张或多张图片作为视频参考素材。',
  },
  {
    key: 'video2video',
    label: '视频参考',
    listKey: 'videoList',
    requiredImages: 0,
    acceptsImage: true,
    acceptsVideo: true,
    acceptsAudio: false,
    description: '使用视频作为运动参考，图片作为角色或主体参考。',
  },
  {
    key: 'videoEdit2video',
    label: '视频编辑',
    listKey: 'videoList',
    requiredImages: 0,
    acceptsImage: true,
    acceptsVideo: true,
    acceptsAudio: false,
    description: '为后续视频编辑链路保留的参考模式。',
  },
  {
    key: 'audio2video',
    label: '音频参考',
    listKey: 'audioList',
    requiredImages: 0,
    acceptsImage: true,
    acceptsVideo: false,
    acceptsAudio: true,
    description: '为支持音频驱动的视频模型保留入口。',
  },
];

export const PRIMARY_VIDEO_PANEL_MODE_KEYS: VideoPanelModeKey[] = [
  'text2video',
  'mixed2video',
  'singleImage2video',
  'frames2video',
  'image2video',
];

export function getVideoPanelModeByKey(key: VideoPanelModeKey): VideoPanelModeDefinition {
  return VIDEO_PANEL_MODES.find((mode) => mode.key === key) ?? VIDEO_PANEL_MODES[0];
}

export function getLegacyVideoModeForPanelMode(key: VideoPanelModeKey): NonNullable<NodeData['videoMode']> {
  if (key === 'frames2video') return 'frame-to-frame';
  if (key === 'video2video' || key === 'videoEdit2video') return 'motion-control';
  return 'standard';
}

export function resolveVideoPanelModeKey(
  node: Pick<NodeData, 'type' | 'videoMode' | 'videoPanelMode'>
): VideoPanelModeKey {
  if (node.videoPanelMode) return node.videoPanelMode;
  if (node.videoMode === 'frame-to-frame') return 'frames2video';
  if (node.videoMode === 'motion-control') return 'video2video';
  return 'text2video';
}

export function getVideoPanelModeReferencePolicy(key: VideoPanelModeKey): VideoPanelModeReferencePolicy {
  const mode = getVideoPanelModeByKey(key);

  return {
    acceptsImage: mode.acceptsImage,
    acceptsVideo: mode.acceptsVideo,
    acceptsAudio: mode.acceptsAudio,
    canUsePresetCamera: key !== 'frames2video' && key !== 'videoEdit2video',
  };
}

export function isVideoPanelModeSupported(
  key: VideoPanelModeKey,
  capability: VideoModelCapability | undefined
): boolean {
  if (!capability) return false;

  const standard = capability.modes.standard;
  if (key === 'text2video') {
    return Boolean(standard.enabled && standard.supportsTextToVideo);
  }

  if (key === 'singleImage2video') {
    return Boolean(standard.enabled && standard.supportsImageToVideo);
  }

  if (key === 'image2video') {
    return Boolean(standard.enabled && (standard.supportsFullReference || standard.supportsMultiImage));
  }

  if (key === 'frames2video') {
    const frameToFrame = capability.modes.frameToFrame;
    return Boolean(frameToFrame.enabled && frameToFrame.supportsStartEndFrames);
  }

  if (key === 'mixed2video') {
    const motionControl = capability.modes.motionControl;
    return Boolean(
      (motionControl.enabled && motionControl.supportsMotionReference) ||
      (
        standard.enabled &&
        standard.supportsFullReference &&
        standard.supportsMultiImage &&
        standard.supportsAudio
      )
    );
  }

  if (key === 'video2video' || key === 'videoEdit2video') {
    const motionControl = capability.modes.motionControl;
    return Boolean(motionControl.enabled && motionControl.supportsMotionReference);
  }

  if (key === 'audio2video') {
    return Boolean(standard.enabled && standard.supportsAudio);
  }

  return false;
}

export function getVideoPanelModeValidation(
  key: VideoPanelModeKey,
  counts: VideoPanelInputCounts
): VideoPanelModeValidation {
  const policy = getVideoPanelModeReferencePolicy(key);
  const hasAcceptedInputs =
    (policy.acceptsImage && counts.imageCount > 0) ||
    (policy.acceptsVideo && counts.videoCount > 0) ||
    (policy.acceptsAudio && counts.audioCount > 0);
  const hasRejectedInputs =
    (!policy.acceptsImage && counts.imageCount > 0) ||
    (!policy.acceptsVideo && counts.videoCount > 0) ||
    (!policy.acceptsAudio && counts.audioCount > 0);

  if (key === 'singleImage2video' && counts.imageCount < 1) {
    return {
      isValid: false,
      acceptsCurrentInputs: hasAcceptedInputs,
      reason: '图生视频至少需要 1 张图片素材。',
    };
  }

  if (key === 'frames2video' && counts.imageCount < 2) {
    return {
      isValid: false,
      acceptsCurrentInputs: hasAcceptedInputs,
      reason: '首尾帧需要连接 2 张图片，分别作为首帧和尾帧。',
    };
  }

  if (key === 'image2video' && counts.imageCount < 1) {
    return {
      isValid: false,
      acceptsCurrentInputs: hasAcceptedInputs,
      reason: '图片参考至少需要 1 张图片素材。',
    };
  }

  if ((key === 'video2video' || key === 'videoEdit2video') && counts.videoCount < 1) {
    return {
      isValid: false,
      acceptsCurrentInputs: hasAcceptedInputs,
      reason: '视频参考至少需要 1 个视频素材。',
    };
  }

  if (key === 'audio2video' && counts.audioCount < 1) {
    return {
      isValid: false,
      acceptsCurrentInputs: hasAcceptedInputs,
      reason: '音频参考至少需要 1 个音频素材。',
    };
  }

  if (key === 'mixed2video' && counts.imageCount + counts.videoCount + counts.audioCount === 0) {
    return {
      isValid: false,
      acceptsCurrentInputs: false,
      reason: '全能参考需要至少添加 1 个图片、视频或音频素材。',
    };
  }

  return {
    isValid: true,
    acceptsCurrentInputs: hasAcceptedInputs && !hasRejectedInputs,
  };
}

export function getVideoPanelInputCounts(sources: VideoPanelConnectedSource[]): VideoPanelInputCounts {
  return sources.reduce<VideoPanelInputCounts>(
    (counts, source) => {
      if (source.type === NodeType.VIDEO) counts.videoCount += 1;
      else if (source.type === NodeType.AUDIO) counts.audioCount += 1;
      else if (source.type === NodeType.IMAGE || source.type === NodeType.IMAGE_EDITOR) counts.imageCount += 1;
      return counts;
    },
    { imageCount: 0, videoCount: 0, audioCount: 0 }
  );
}
