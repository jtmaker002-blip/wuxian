import type { VideoCapabilityMode, VideoModelCapability } from '../config/modelCapabilities';
import { NodeType, type NodeData } from '../types';
import { toCapabilityMode } from './videoCapabilityState';

type ConnectedNodePreview = {
  type?: NodeType;
};

export type ResolvedVideoMode = NonNullable<NodeData['videoMode']>;
export type VideoGenerationMode = 'text-to-video' | 'image-to-video' | 'frame-to-frame' | 'motion-control';

export type VideoModeAvailabilityState = {
  selectedMode: ResolvedVideoMode;
  capabilityMode: VideoCapabilityMode;
  selectedModeEnabled: boolean;
};

export type VideoModePrerequisiteState = {
  selectedMode: ResolvedVideoMode;
  imageCount: number;
  videoCount: number;
  canUseFrameToFrame: boolean;
  canUseMotionControl: boolean;
  missingFrameToFrame: boolean;
  missingMotionReferenceVideo: boolean;
  missingMotionReferenceImage: boolean;
  missingMotionControl: boolean;
};

function getSelectedVideoMode(
  node: Pick<NodeData, 'type' | 'videoMode'>
): ResolvedVideoMode {
  if (node.type !== NodeType.VIDEO) {
    return 'standard';
  }

  return node.videoMode ?? 'standard';
}

export function resolveEffectiveVideoMode(
  node: Pick<NodeData, 'type' | 'videoMode' | 'frameInputs' | 'parentIds'>,
  connectedInputs: ConnectedNodePreview[] = []
): ResolvedVideoMode {
  void connectedInputs;
  return getSelectedVideoMode(node);
}

export function getVideoModePrerequisiteState(
  node: Pick<NodeData, 'type' | 'videoMode' | 'frameInputs' | 'parentIds'>,
  connectedInputs: ConnectedNodePreview[] = []
): VideoModePrerequisiteState {
  const selectedMode = getSelectedVideoMode(node);
  const imageCount = connectedInputs.filter((candidate) => candidate.type === NodeType.IMAGE).length;
  const videoCount = connectedInputs.filter((candidate) => candidate.type === NodeType.VIDEO).length;
  const canUseFrameToFrame = imageCount >= 2;
  const missingMotionReferenceVideo = videoCount === 0;
  const missingMotionReferenceImage = imageCount === 0;
  const canUseMotionControl = !missingMotionReferenceVideo && !missingMotionReferenceImage;

  return {
    selectedMode,
    imageCount,
    videoCount,
    canUseFrameToFrame,
    canUseMotionControl,
    missingFrameToFrame: !canUseFrameToFrame,
    missingMotionReferenceVideo,
    missingMotionReferenceImage,
    missingMotionControl: !canUseMotionControl,
  };
}

export function getVideoModeAvailabilityState(
  node: Pick<NodeData, 'type' | 'videoMode'>,
  capability?: Pick<VideoModelCapability, 'modes'>
): VideoModeAvailabilityState {
  const selectedMode = getSelectedVideoMode(node);
  const capabilityMode = toCapabilityMode(selectedMode);

  return {
    selectedMode,
    capabilityMode,
    selectedModeEnabled: Boolean(capability?.modes[capabilityMode].enabled),
  };
}

export function getVideoGenerationMode(
  node: Pick<NodeData, 'type' | 'videoMode' | 'frameInputs' | 'parentIds'>,
  connectedInputs: ConnectedNodePreview[] = [],
  inputUrl?: string
): VideoGenerationMode {
  const mode = getSelectedVideoMode(node);
  if (mode === 'frame-to-frame' || mode === 'motion-control') {
    return mode;
  }

  const { imageCount } = getVideoModePrerequisiteState(node, connectedInputs);
  return inputUrl || imageCount > 0 ? 'image-to-video' : 'text-to-video';
}
