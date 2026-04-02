import type { VideoCapabilityMode, VideoModelCapability } from '../config/modelCapabilities';
import type { NodeData } from '../types';

export type StandardVideoInputMode = 'text-to-video' | 'image-to-video';

export type StandardVideoInputState = {
  inputMode: StandardVideoInputMode;
  supportsCurrentInputMode: boolean;
  supportsReferenceImages: boolean;
  usesReferenceImages: boolean;
  hasUnsupportedMultipleImageInputs: boolean;
};

export type StandardVideoExecutionState = StandardVideoInputState & {
  referenceImageUrls: string[] | undefined;
};

export function toCapabilityMode(videoMode: NodeData['videoMode']): VideoCapabilityMode {
  if (videoMode === 'frame-to-frame') return 'frameToFrame';
  if (videoMode === 'motion-control') return 'motionControl';
  return 'standard';
}

export function fromCapabilityMode(mode: VideoCapabilityMode): NonNullable<NodeData['videoMode']> {
  if (mode === 'frameToFrame') return 'frame-to-frame';
  if (mode === 'motionControl') return 'motion-control';
  return 'standard';
}

export function getEnabledVideoModes(capability: VideoModelCapability): VideoCapabilityMode[] {
  return (Object.entries(capability.modes) as Array<[VideoCapabilityMode, VideoModelCapability['modes'][VideoCapabilityMode]]>)
    .filter(([, mode]) => mode.enabled)
    .map(([mode]) => mode);
}

export function resolveStandardVideoInputState(
  capability: VideoModelCapability | undefined,
  options: {
    imageInputCount: number;
    hasInputSource: boolean;
  }
): StandardVideoInputState {
  const { imageInputCount, hasInputSource } = options;
  const inputMode: StandardVideoInputMode =
    !hasInputSource && imageInputCount === 0 ? 'text-to-video' : 'image-to-video';

  if (!capability) {
    return {
      inputMode,
      supportsCurrentInputMode: false,
      supportsReferenceImages: false,
      usesReferenceImages: false,
      hasUnsupportedMultipleImageInputs: inputMode === 'image-to-video' && imageInputCount > 1,
    };
  }

  const standardCapability = capability.modes.standard;
  const supportsReferenceImages = Boolean(
    standardCapability.supportsFullReference || standardCapability.supportsMultiImage
  );

  if (inputMode === 'text-to-video') {
    return {
      inputMode,
      supportsCurrentInputMode: standardCapability.supportsTextToVideo,
      supportsReferenceImages,
      usesReferenceImages: false,
      hasUnsupportedMultipleImageInputs: false,
    };
  }

  const usesReferenceImages =
    imageInputCount > 1
      ? supportsReferenceImages &&
        (standardCapability.supportsMultiImage || standardCapability.supportsFullReference)
      : imageInputCount === 1
        ? supportsReferenceImages && standardCapability.supportsFullReference
        : false;

  const supportsCurrentInputMode =
    imageInputCount > 1
      ? usesReferenceImages
      : usesReferenceImages || standardCapability.supportsImageToVideo;

  return {
    inputMode,
    supportsCurrentInputMode,
    supportsReferenceImages,
    usesReferenceImages,
    hasUnsupportedMultipleImageInputs: imageInputCount > 1 && !supportsCurrentInputMode,
  };
}

export function resolveStandardVideoExecutionState(
  capability: VideoModelCapability | undefined,
  options: {
    imageUrls: Array<string | undefined>;
    hasInputSource: boolean;
  }
): StandardVideoExecutionState {
  const validImageUrls = options.imageUrls.filter((url): url is string => Boolean(url));
  const state = resolveStandardVideoInputState(capability, {
    imageInputCount: validImageUrls.length,
    hasInputSource: options.hasInputSource,
  });

  return {
    ...state,
    referenceImageUrls: state.usesReferenceImages ? validImageUrls : undefined,
  };
}

export function sanitizeVideoNodeState(node: NodeData, capability: VideoModelCapability): Partial<NodeData> {
  const requestedMode = node.videoMode ?? 'standard';
  const safeMode =
    requestedMode === 'frame-to-frame' || requestedMode === 'motion-control' || requestedMode === 'standard'
      ? requestedMode
      : 'standard';
  const capabilityMode = toCapabilityMode(safeMode);
  const modeCapability = capability.modes[capabilityMode];
  const parentIdSet = new Set(node.parentIds ?? []);

  const updates: Partial<NodeData> = {
    videoMode: safeMode,
    videoDuration: modeCapability.durations.includes(node.videoDuration ?? modeCapability.defaultDuration)
      ? (node.videoDuration ?? modeCapability.defaultDuration)
      : modeCapability.defaultDuration,
    aspectRatio: modeCapability.aspectRatios.includes(node.aspectRatio)
      ? node.aspectRatio
      : modeCapability.defaultAspectRatio,
    resolution: modeCapability.resolutions.includes(node.resolution)
      ? node.resolution
      : modeCapability.defaultResolution,
  };

  if (capabilityMode === 'frameToFrame' && modeCapability.supportsStartEndFrames) {
    const validFrameInputs = (node.frameInputs ?? []).filter(
      (input) =>
        parentIdSet.has(input.nodeId) &&
        (input.order === 'start' || input.order === 'end')
    );
    const startInput = validFrameInputs.find((input) => input.order === 'start');
    const endInput = validFrameInputs.find((input) => input.order === 'end');
    updates.frameInputs =
      startInput && endInput && startInput.nodeId !== endInput.nodeId
        ? [startInput, endInput]
        : undefined;
  }

  if (!modeCapability.supportsAudio) {
    updates.generateAudio = false;
  } else {
    updates.generateAudio = node.generateAudio === true;
  }

  return updates;
}

export function getVideoNodeStateMismatches(node: NodeData, capability: VideoModelCapability): string[] {
  const next = sanitizeVideoNodeState(node, capability);
  const mismatches: string[] = [];

  if (
    typeof node.videoDuration === 'number' &&
    typeof next.videoDuration === 'number' &&
    node.videoDuration !== next.videoDuration
  ) {
    mismatches.push('秒数');
  }

  if (
    typeof node.aspectRatio === 'string' &&
    typeof next.aspectRatio === 'string' &&
    node.aspectRatio !== next.aspectRatio
  ) {
    mismatches.push('比例');
  }

  if (
    typeof node.resolution === 'string' &&
    typeof next.resolution === 'string' &&
    node.resolution !== next.resolution
  ) {
    mismatches.push('清晰度');
  }

  if (
    node.generateAudio === true &&
    next.generateAudio === false
  ) {
    mismatches.push('音频');
  }

  return mismatches;
}
