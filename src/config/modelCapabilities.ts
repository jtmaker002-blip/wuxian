import { MODEL_REGISTRY } from './modelRegistry';

export type VideoCapabilityMode = 'standard' | 'frameToFrame' | 'motionControl';

export type VideoModeCapability = {
  enabled: boolean;
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsMultiImage: boolean;
  supportsStartEndFrames: boolean;
  supportsFullReference: boolean;
  supportsMotionReference: boolean;
  supportsAudio: boolean;
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  defaultDuration: number;
  defaultAspectRatio: string;
  defaultResolution: string;
};

export type VideoModelCapability = {
  id: string;
  category: 'video';
  serverModelId: string;
  modes: Record<VideoCapabilityMode, VideoModeCapability>;
};

export type VoiceModelCapability = {
  id: string;
  category: 'voice';
  serverModelId: string;
  supportsTextToSpeech: boolean;
  supportsVoiceClone: boolean;
  supportsVoiceDesign: boolean;
  supportsSpeedControl: boolean;
  supportsEmotionControl: boolean;
  defaultVoice: string;
};

export type VideoCapabilitiesMap = Record<string, VideoModelCapability>;
export type VoiceCapabilitiesMap = Record<string, VoiceModelCapability>;

const VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
const IMAGE_VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
const SEEDANCE_VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const;
const STANDARD_RESOLUTIONS = ['Auto', '720p', '1080p'] as const;

function createDisabledMode(): VideoModeCapability {
  return {
    enabled: false,
    supportsTextToVideo: false,
    supportsImageToVideo: false,
    supportsMultiImage: false,
    supportsStartEndFrames: false,
    supportsFullReference: false,
    supportsMotionReference: false,
    supportsAudio: false,
    durations: [5],
    aspectRatios: [...VIDEO_ASPECT_RATIOS],
    resolutions: [...STANDARD_RESOLUTIONS],
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
  };
}

function createStandardMode(options: Partial<VideoModeCapability> = {}): VideoModeCapability {
  return {
    enabled: true,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
    supportsMultiImage: false,
    supportsStartEndFrames: false,
    supportsFullReference: false,
    supportsMotionReference: false,
    supportsAudio: false,
    durations: [5],
    aspectRatios: [...IMAGE_VIDEO_ASPECT_RATIOS],
    resolutions: [...STANDARD_RESOLUTIONS],
    defaultDuration: 5,
    defaultAspectRatio: '16:9',
    defaultResolution: '720p',
    ...options,
  };
}

function createCapability(
  id: string,
  serverModelId: string,
  modes: Partial<Record<VideoCapabilityMode, Partial<VideoModeCapability>>>
): VideoModelCapability {
  return {
    id,
    category: 'video',
    serverModelId,
    modes: {
      standard: createStandardMode(modes.standard),
      frameToFrame: { ...createDisabledMode(), ...modes.frameToFrame },
      motionControl: { ...createDisabledMode(), ...modes.motionControl },
    },
  };
}

export const LOCAL_VIDEO_CAPABILITIES: VideoCapabilitiesMap = {
  'grok-video-3': createCapability('grok-video-3', 'grok-video-3', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsMultiImage: false,
      supportsFullReference: false,
      supportsAudio: false,
      supportsStartEndFrames: false,
      supportsMotionReference: false,
      durations: [4, 8, 10, 12, 15],
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
      resolutions: ['480p', '720p'],
      defaultDuration: 8,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'sora-2': createCapability('sora-2', 'sora-2', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [4, 8, 12],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['720p', '1080p'],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'veo3.1': createCapability('veo3.1', 'veo-3.1-fast-generate-preview', {
    standard: {
      durations: [4, 6, 8],
      defaultDuration: 4,
      supportsAudio: false,
      resolutions: ['512p', '720p', '1080p'],
    },
      frameToFrame: {
        enabled: true,
        supportsTextToVideo: false,
        supportsImageToVideo: true,
        supportsMultiImage: false,
        supportsStartEndFrames: true,
        supportsFullReference: false,
        supportsMotionReference: false,
        supportsAudio: false,
      durations: [4, 6, 8],
      aspectRatios: [...IMAGE_VIDEO_ASPECT_RATIOS],
      resolutions: ['512p', '720p', '1080p'],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'kling-v3': createCapability('kling-v3', 'kling-v3', {
    standard: { durations: [5, 10], defaultDuration: 5 },
      frameToFrame: {
        enabled: true,
        supportsTextToVideo: false,
        supportsImageToVideo: true,
        supportsMultiImage: false,
        supportsStartEndFrames: true,
        supportsFullReference: false,
        supportsMotionReference: false,
        supportsAudio: false,
      durations: [5, 10],
      aspectRatios: [...IMAGE_VIDEO_ASPECT_RATIOS],
      resolutions: [...STANDARD_RESOLUTIONS],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'kling-v2-6': createCapability('kling-v2-6', 'kling-v2-6', {
    standard: {
      supportsTextToVideo: true,
      durations: [5, 10],
      defaultDuration: 5,
      supportsAudio: true,
      aspectRatios: ['1:1', ...IMAGE_VIDEO_ASPECT_RATIOS],
      resolutions: ['Auto'],
      defaultResolution: 'Auto',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsMultiImage: false,
      supportsStartEndFrames: true,
      supportsFullReference: false,
      supportsMotionReference: false,
      supportsAudio: false,
      durations: [5, 10],
      aspectRatios: [...IMAGE_VIDEO_ASPECT_RATIOS],
      resolutions: ['Auto'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: 'Auto',
    },
    motionControl: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsMultiImage: false,
      supportsStartEndFrames: false,
      supportsFullReference: false,
      supportsMotionReference: true,
      supportsAudio: false,
      durations: [5],
      aspectRatios: [...IMAGE_VIDEO_ASPECT_RATIOS],
      resolutions: ['Auto'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: 'Auto',
    },
  }),
  'kling-v2-5-turbo': createCapability('kling-v2-5-turbo', 'kling-v2-5-turbo', {
    standard: { durations: [5, 10], defaultDuration: 5 },
      frameToFrame: {
        enabled: true,
        supportsTextToVideo: false,
        supportsImageToVideo: true,
        supportsMultiImage: false,
        supportsStartEndFrames: true,
        supportsFullReference: false,
        supportsMotionReference: false,
        supportsAudio: false,
      durations: [5, 10],
      aspectRatios: [...IMAGE_VIDEO_ASPECT_RATIOS],
      resolutions: [...STANDARD_RESOLUTIONS],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'minimax-hailuo': createCapability('minimax-hailuo', 'hailuo-2.3', {
    standard: {
      supportsMultiImage: true,
      supportsFullReference: true,
      durations: [6, 10],
      defaultDuration: 6,
      resolutions: ['768p', '1080p'],
      defaultResolution: '768p',
    },
      frameToFrame: {
        enabled: true,
        supportsTextToVideo: false,
        supportsImageToVideo: true,
        supportsMultiImage: false,
        supportsStartEndFrames: true,
        supportsFullReference: false,
        supportsMotionReference: false,
        supportsAudio: false,
      durations: [6, 10],
      aspectRatios: [...IMAGE_VIDEO_ASPECT_RATIOS],
      resolutions: ['768p', '1080p'],
      defaultDuration: 6,
      defaultAspectRatio: '16:9',
      defaultResolution: '768p',
    },
  }),
  'wan2.6-i2v': createCapability('wan2.6-i2v', 'wan2.6-i2v', {
    standard: {
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [5, 10, 15],
      aspectRatios: ['Auto'],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: 'Auto',
      defaultResolution: '1080p',
    },
  }),
  'wan2.6-i2v-flash': createCapability('wan2.6-i2v-flash', 'wan2.6-i2v-flash', {
    standard: {
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [5, 10, 15],
      aspectRatios: ['Auto'],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: 'Auto',
      defaultResolution: '1080p',
    },
  }),
  'wan2.5-i2v-preview': createCapability('wan2.5-i2v-preview', 'wan2.5-i2v-preview', {
    standard: {
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [5, 10],
      aspectRatios: ['Auto'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: 'Auto',
      defaultResolution: '720p',
    },
  }),
  'jimeng-seedance-2': createCapability('jimeng-seedance-2', 'jimeng-seedance-2', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      aspectRatios: [...SEEDANCE_VIDEO_ASPECT_RATIOS],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsMultiImage: false,
      supportsStartEndFrames: true,
      supportsFullReference: false,
      supportsMotionReference: false,
      supportsAudio: true,
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      aspectRatios: [...SEEDANCE_VIDEO_ASPECT_RATIOS],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-4.5': createCapability('jimeng-4.5', 'jimeng-4.5', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      aspectRatios: [...SEEDANCE_VIDEO_ASPECT_RATIOS],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsMultiImage: false,
      supportsStartEndFrames: true,
      supportsFullReference: false,
      supportsMotionReference: false,
      supportsAudio: true,
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      aspectRatios: [...SEEDANCE_VIDEO_ASPECT_RATIOS],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-4.1': createCapability('jimeng-4.1', 'jimeng-4.1', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      aspectRatios: [...SEEDANCE_VIDEO_ASPECT_RATIOS],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-4.0': createCapability('jimeng-4.0', 'jimeng-4.0', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      aspectRatios: [...SEEDANCE_VIDEO_ASPECT_RATIOS],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-video-3-fast': createCapability('jimeng-video-3-fast', 'jimeng-video-3-fast', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      aspectRatios: [...SEEDANCE_VIDEO_ASPECT_RATIOS],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
};

export const LOCAL_VOICE_CAPABILITIES: VoiceCapabilitiesMap = Object.fromEntries(
  MODEL_REGISTRY.filter((entry) => entry.category === 'voice').map((entry) => [
    entry.id,
    {
      id: entry.id,
      category: 'voice' as const,
      serverModelId: entry.id,
      supportsTextToSpeech: true,
      supportsVoiceClone: entry.id.includes('voice') || entry.id.includes('cosyvoice'),
      supportsVoiceDesign: entry.id.includes('design'),
      supportsSpeedControl: true,
      supportsEmotionControl: entry.id.includes('voice-design'),
      defaultVoice: 'default',
    },
  ])
);

let runtimeVideoCapabilities: VideoCapabilitiesMap = { ...LOCAL_VIDEO_CAPABILITIES };
let runtimeVoiceCapabilities: VoiceCapabilitiesMap = { ...LOCAL_VOICE_CAPABILITIES };

export function getAllVideoCapabilities(): VideoCapabilitiesMap {
  return runtimeVideoCapabilities;
}

export function setRuntimeVideoCapabilities(next: VideoCapabilitiesMap) {
  runtimeVideoCapabilities = { ...next };
}

export function resetRuntimeVideoCapabilities() {
  runtimeVideoCapabilities = { ...LOCAL_VIDEO_CAPABILITIES };
}

export function getAllVoiceCapabilities(): VoiceCapabilitiesMap {
  return runtimeVoiceCapabilities;
}

export function setRuntimeVoiceCapabilities(next: VoiceCapabilitiesMap) {
  runtimeVoiceCapabilities = { ...next };
}

export function resetRuntimeVoiceCapabilities() {
  runtimeVoiceCapabilities = { ...LOCAL_VOICE_CAPABILITIES };
}

export function getVideoCapability(id: string | undefined): VideoModelCapability | undefined {
  if (!id) return undefined;
  return runtimeVideoCapabilities[id];
}

export function getVoiceCapability(id: string | undefined): VoiceModelCapability | undefined {
  if (!id) return undefined;
  return runtimeVoiceCapabilities[id];
}
