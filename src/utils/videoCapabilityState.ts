import type { VideoCapabilityMode, VideoModelCapability } from '../config/modelCapabilities';
import type { NodeData } from '../types';

export type StandardVideoInputMode = 'text-to-video' | 'image-to-video';
export type StandardVideoInputSourceType = 'image' | 'video';

export type StandardVideoInputSource = {
  nodeId?: string;
  type: StandardVideoInputSourceType;
  url?: string;
  previewUrl?: string;
};

export type ResolvedStandardVideoInputSource = {
  nodeId?: string;
  type: StandardVideoInputSourceType;
  url: string;
  previewUrl: string;
};

export type StandardVideoInputState = {
  inputMode: StandardVideoInputMode;
  supportsCurrentInputMode: boolean;
  supportsReferenceImages: boolean;
  usesReferenceImages: boolean;
  hasUnsupportedMultipleImageInputs: boolean;
};

export type StandardVideoExecutionState = StandardVideoInputState & {
  resolvedInputSources: ResolvedStandardVideoInputSource[];
  primaryInputSource?: ResolvedStandardVideoInputSource;
  primaryInputUrl?: string;
  referenceImageSources: ResolvedStandardVideoInputSource[];
  referenceImageUrls: string[] | undefined;
};

export type StandardVideoCapabilityState = StandardVideoExecutionState & {
  isBlocked: boolean;
  blockedReason?: string;
};

export function canQuickAddStandardVideoImage(
  capability: VideoModelCapability | undefined,
  standardState: StandardVideoCapabilityState | StandardVideoExecutionState | StandardVideoInputState | undefined,
  connectedImageCount: number
): boolean {
  if (connectedImageCount === 0) {
    return Boolean(
      capability?.modes.standard.supportsImageToVideo ||
      standardState?.supportsReferenceImages
    );
  }

  return Boolean(standardState?.supportsReferenceImages);
}

function areFrameInputsEqual(
  left: NodeData['frameInputs'],
  right: NodeData['frameInputs']
): boolean {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;

  return left.every((input, index) => {
    const candidate = right[index];
    return (
      candidate?.nodeId === input.nodeId &&
      candidate?.order === input.order
    );
  });
}

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

function resolveStandardVideoInputSources(
  sources: StandardVideoInputSource[]
): ResolvedStandardVideoInputSource[] {
  return sources
    .filter((source): source is StandardVideoInputSource & { url: string } => Boolean(source.url))
    .map((source) => ({
      nodeId: source.nodeId,
      type: source.type,
      url: source.url,
      previewUrl: source.previewUrl ?? source.url,
    }));
}

export function resolveStandardVideoInputState(
  capability: VideoModelCapability | undefined,
  options: {
    sources: StandardVideoInputSource[];
  }
): StandardVideoInputState {
  const resolvedSources = resolveStandardVideoInputSources(options.sources);
  const visualInputCount = resolvedSources.length;
  const inputMode: StandardVideoInputMode = visualInputCount === 0 ? 'text-to-video' : 'image-to-video';

  if (!capability) {
    return {
      inputMode,
      supportsCurrentInputMode: false,
      supportsReferenceImages: false,
      usesReferenceImages: false,
      hasUnsupportedMultipleImageInputs: visualInputCount > 1,
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
    visualInputCount > 1
      ? supportsReferenceImages &&
        (standardCapability.supportsMultiImage || standardCapability.supportsFullReference)
      : visualInputCount === 1
        ? supportsReferenceImages && standardCapability.supportsFullReference
        : false;

  const supportsCurrentInputMode =
    visualInputCount > 1
      ? usesReferenceImages
      : usesReferenceImages || standardCapability.supportsImageToVideo;

  return {
    inputMode,
    supportsCurrentInputMode,
    supportsReferenceImages,
    usesReferenceImages,
    hasUnsupportedMultipleImageInputs: visualInputCount > 1 && !supportsCurrentInputMode,
  };
}

export function resolveStandardVideoExecutionState(
  capability: VideoModelCapability | undefined,
  options: {
    sources: StandardVideoInputSource[];
  }
): StandardVideoExecutionState {
  const resolvedInputSources = resolveStandardVideoInputSources(options.sources);
  const state = resolveStandardVideoInputState(capability, { sources: resolvedInputSources });
  const referenceImageSources = state.usesReferenceImages ? resolvedInputSources : [];
  const primaryInputSource =
    state.inputMode === 'image-to-video' && !state.usesReferenceImages
      ? resolvedInputSources[0]
      : undefined;

  return {
    ...state,
    resolvedInputSources,
    primaryInputSource,
    primaryInputUrl: primaryInputSource?.url,
    referenceImageSources,
    referenceImageUrls: referenceImageSources.length > 0 ? referenceImageSources.map((source) => source.url) : undefined,
  };
}

export function resolveStandardVideoCapabilityState(
  capability: VideoModelCapability | undefined,
  options: {
    sources: StandardVideoInputSource[];
  }
): StandardVideoCapabilityState {
  const executionState = resolveStandardVideoExecutionState(capability, options);

  if (!capability) {
    return {
      ...executionState,
      isBlocked: true,
      blockedReason: '当前视频模型在后端尚未接通真实执行链，请切换到已接通的可执行视频模型。',
    };
  }

  if (executionState.hasUnsupportedMultipleImageInputs) {
    return {
      ...executionState,
      isBlocked: true,
      blockedReason: '当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。',
    };
  }

  if (!executionState.supportsCurrentInputMode) {
    return {
      ...executionState,
      isBlocked: true,
      blockedReason: '当前视频模型尚未接通当前标准输入模式，请切换模型或调整输入后再试。',
    };
  }

  return {
    ...executionState,
    isBlocked: false,
    blockedReason: undefined,
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
    const sanitizedFrameInputs =
      startInput && endInput && startInput.nodeId !== endInput.nodeId
        ? [startInput, endInput]
        : undefined;
    updates.frameInputs = areFrameInputsEqual(node.frameInputs, sanitizedFrameInputs)
      ? node.frameInputs
      : sanitizedFrameInputs;
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
