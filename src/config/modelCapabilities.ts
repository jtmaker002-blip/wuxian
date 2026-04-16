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
export type NativeVideoFeatureKey =
  | 'textToVideo'
  | 'imageToVideo'
  | 'multiImage'
  | 'fullReference'
  | 'startEndFrame'
  | 'motionReference'
  | 'audio'
  | 'subjectReference'
  | 'referenceVideo'
  | 'characterConsistency';
export type NativeVideoModelNotes = Partial<Record<string, string[]>>;
export type NativeVideoModelSources = Partial<Record<string, string[]>>;

const VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
const IMAGE_VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
const SEEDANCE_VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
const SEEDANCE_VIDEO_DURATIONS = [5, 10] as const;
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
      supportsMultiImage: true,
      supportsFullReference: true,
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
  'veo3.1-fast': createCapability('veo3.1-fast', 'veo_3_1-fast', {
    standard: {
      supportsMultiImage: true,
      supportsFullReference: true,
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
  'veo3.1-lite': createCapability('veo3.1-lite', 'veo_3_1-lite', {
    standard: {
      supportsMultiImage: true,
      supportsFullReference: true,
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
  'jimeng-seedance-2': createCapability('jimeng-seedance-2', 'jimeng-seedance-2', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [...SEEDANCE_VIDEO_DURATIONS],
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
      durations: [...SEEDANCE_VIDEO_DURATIONS],
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
      durations: [...SEEDANCE_VIDEO_DURATIONS],
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
      durations: [...SEEDANCE_VIDEO_DURATIONS],
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
      durations: [...SEEDANCE_VIDEO_DURATIONS],
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
      durations: [...SEEDANCE_VIDEO_DURATIONS],
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
      durations: [...SEEDANCE_VIDEO_DURATIONS],
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

export const NATIVE_VIDEO_CAPABILITY_OVERRIDES: Partial<VideoCapabilitiesMap> = {
  'grok-video-3': createCapability('grok-video-3', 'grok-video-3', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [1, 4, 8, 10, 12, 15],
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
      supportsFullReference: true,
      supportsAudio: true,
      durations: [10, 16, 20],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['720p', '1080p'],
      defaultDuration: 10,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'veo3.1': createCapability('veo3.1', 'veo-3.1-fast-generate-preview', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsMultiImage: true,
      supportsFullReference: true,
      supportsAudio: false,
      durations: [4, 6, 8],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['512p', '720p', '1080p'],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsStartEndFrames: true,
      durations: [4, 6, 8],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['512p', '720p', '1080p'],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'kling-v2-6': createCapability('kling-v2-6', 'kling-v2-6', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [5, 10],
      aspectRatios: ['1:1', '16:9', '9:16'],
      resolutions: ['Auto'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: 'Auto',
    },
  }),
  'kling-v2-5-turbo': createCapability('kling-v2-5-turbo', 'kling-v2-5-turbo', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsFullReference: true,
      supportsAudio: false,
      durations: [5],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '1080p',
    },
  }),
  'kling-v3': createCapability('kling-v3', 'kling-v3', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsMultiImage: true,
      supportsFullReference: true,
      supportsAudio: true,
      durations: [5, 10, 15],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'minimax-hailuo': createCapability('minimax-hailuo', 'hailuo-2.3', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [6, 10],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['768p', '1080p'],
      defaultDuration: 6,
      defaultAspectRatio: '16:9',
      defaultResolution: '768p',
    },
  }),
  'jimeng-seedance-2': createCapability('jimeng-seedance-2', 'jimeng-seedance-2', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: true,
      durations: [2, 5, 10, 12, 15],
      aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'Auto'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsStartEndFrames: true,
      supportsAudio: true,
      durations: [2, 5, 10, 12, 15],
      aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'Auto'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-4.5': createCapability('jimeng-4.5', 'jimeng-4.5', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [2, 5, 10, 12],
      aspectRatios: ['16:9', '4:3', '1:1', '21:9'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsStartEndFrames: true,
      supportsAudio: false,
      durations: [2, 5, 10, 12],
      aspectRatios: ['16:9', '4:3', '1:1', '21:9'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-4.1': createCapability('jimeng-4.1', 'jimeng-4.1', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [5, 10],
      aspectRatios: ['16:9', '4:3', '1:1', '21:9'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-4.0': createCapability('jimeng-4.0', 'jimeng-4.0', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsMultiImage: true,
      supportsFullReference: true,
      supportsAudio: false,
      durations: [2, 12],
      aspectRatios: ['16:9', '4:3', '1:1', '21:9'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsStartEndFrames: true,
      supportsAudio: false,
      durations: [2, 12],
      aspectRatios: ['16:9', '4:3', '1:1', '21:9'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'jimeng-video-3-fast': createCapability('jimeng-video-3-fast', 'jimeng-video-3-fast', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsAudio: false,
      durations: [5, 10],
      aspectRatios: ['16:9', '4:3', '1:1', '21:9'],
      resolutions: ['480p', '720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'wan2.6-i2v': createCapability('wan2.6-i2v', 'wan2.6-i2v', {
    standard: {
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsAudio: true,
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
      supportsAudio: true,
      durations: [2, 5, 10, 15],
      aspectRatios: ['Auto'],
      resolutions: ['720p', '1080p'],
      defaultDuration: 5,
      defaultAspectRatio: 'Auto',
      defaultResolution: '1080p',
    },
  }),
  'veo3.1-fast': createCapability('veo3.1-fast', 'veo_3_1-fast', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsMultiImage: true,
      supportsFullReference: true,
      supportsAudio: false,
      durations: [4, 6, 8],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['512p', '720p', '1080p'],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsStartEndFrames: true,
      durations: [4, 6, 8],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
  'veo3.1-lite': createCapability('veo3.1-lite', 'veo_3_1-lite', {
    standard: {
      supportsTextToVideo: true,
      supportsImageToVideo: true,
      supportsMultiImage: true,
      supportsFullReference: true,
      supportsAudio: false,
      durations: [4, 6, 8],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['512p', '720p', '1080p'],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
    frameToFrame: {
      enabled: true,
      supportsTextToVideo: false,
      supportsImageToVideo: true,
      supportsStartEndFrames: true,
      durations: [4, 6, 8],
      defaultDuration: 4,
      defaultAspectRatio: '16:9',
      defaultResolution: '720p',
    },
  }),
};

export const NATIVE_VIDEO_FEATURE_KEYS: Partial<Record<string, NativeVideoFeatureKey[]>> = {
  'grok-video-3': ['textToVideo', 'imageToVideo'],
  'sora-2': ['textToVideo', 'imageToVideo', 'fullReference', 'characterConsistency', 'audio'],
  'veo3.1': ['textToVideo', 'imageToVideo', 'fullReference', 'startEndFrame'],
  'veo3.1-fast': ['textToVideo', 'imageToVideo', 'fullReference', 'startEndFrame'],
  'veo3.1-lite': ['textToVideo', 'imageToVideo', 'fullReference', 'startEndFrame'],
  'kling-v2-6': ['textToVideo', 'imageToVideo', 'subjectReference', 'motionReference', 'audio'],
  'kling-v2-5-turbo': ['textToVideo', 'imageToVideo', 'fullReference'],
  'kling-v3': ['textToVideo', 'imageToVideo', 'multiImage', 'referenceVideo', 'audio'],
  'minimax-hailuo': ['textToVideo', 'imageToVideo', 'subjectReference'],
  'jimeng-seedance-2': ['textToVideo', 'imageToVideo', 'multiImage', 'fullReference', 'startEndFrame'],
  'jimeng-4.5': ['textToVideo', 'imageToVideo', 'startEndFrame'],
  'jimeng-4.1': ['textToVideo', 'imageToVideo'],
  'jimeng-4.0': ['textToVideo', 'imageToVideo', 'multiImage', 'fullReference', 'startEndFrame'],
  'jimeng-video-3-fast': ['textToVideo', 'imageToVideo'],
  'wan2.6-i2v': ['imageToVideo', 'audio'],
  'wan2.6-i2v-flash': ['imageToVideo', 'audio'],
};

export const NATIVE_VIDEO_MODEL_NOTES: NativeVideoModelNotes = {
  'sora-2': ['官方 API 文档支持音频与参考图；当前后端只接了标准文生/图生，且时长仍按 4/8/12 秒执行。'],
  'veo3.1': ['官方文档支持图生视频、参考图与首尾帧；当前后端已接通标准单图/多图参考与首尾帧，音频仍受当前 SDK 路线限制。'],
  'veo3.1-fast': ['Veo 3.1 Fast 作为独立前端模型接入，使用 veo_3_1-fast 执行；支持图生视频、参考图与首尾帧。'],
  'veo3.1-lite': ['Veo 3.1 Lite 作为独立前端模型接入，使用 veo_3_1-lite 执行。'],
  'kling-v2-6': ['官方资料明确支持主体参考、运动参考与原生音频。'],
  'kling-v2-5-turbo': ['官方公开资料确认 5 秒 1080p，并提到参考图风格一致性。'],
  'kling-v3': ['官方资料确认多图参考、参考视频和原生音频。'],
  'minimax-hailuo': ['官方公开资料明确有主体参考；首尾帧只在 Hailuo 02 文档中直接确认，因此此 SKU 不默认标首尾帧。'],
  'jimeng-seedance-2': ['官方文档确认首尾帧；多图/全图参考来自官方 Seedance 2.0/1.0 Lite I2V 能力线索，但你当前后端只接了标准模式和首尾帧。'],
  'jimeng-4.5': ['官方公开页确认文生、图生、首尾帧；更细能力参数仍需按 SKU 文档继续核。'],
  'jimeng-4.1': ['官方公开页确认文生与图生；音频未在公开资料中直接确认。'],
  'jimeng-4.0': ['官方文档可确认多图/全图参考与首尾帧。'],
  'jimeng-video-3-fast': ['官方公开页确认文生与图生；更多能力未在公开资料中直接确认。'],
  'wan2.6-i2v': ['官方明确为图生视频，输出比例跟随首帧；支持音频。'],
  'wan2.6-i2v-flash': ['官方明确为图生视频，输出比例跟随首帧；支持音频。'],
};

export const NATIVE_VIDEO_MODEL_SOURCES: NativeVideoModelSources = {
  'grok-video-3': [
    'https://x.ai/news/grok-video',
  ],
  'sora-2': [
    'https://developers.openai.com/api/docs/models/sora-2',
    'https://developers.openai.com/api/docs/guides/video-generation',
  ],
  'veo3.1': [
    'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate',
  ],
  'veo3.1-fast': [
    'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate',
  ],
  'veo3.1-lite': [
    'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate',
  ],
  'kling-v2-6': [
    'https://ir.kuaishou.com/zh-hans/news-releases/news-release-details/keling26moxingtuichuyinhuatongchunengli',
  ],
  'kling-v2-5-turbo': [
    'https://ir.kuaishou.com/news-releases/news-release-details/kling-ai-launches-25-turbo-video-model-industry-leading/',
  ],
  'kling-v3': [
    'https://ir.kuaishou.com/news-releases/news-release-details/kling-ai-launches-30-model-ushering-era-where-everyone-can-be/',
  ],
  'minimax-hailuo': [
    'https://platform.minimax.io/docs/guides/video-generation',
    'https://platform.minimax.io/docs/api-reference/video-generation-i2v',
    'https://platform.minimax.io/docs/api-reference/video-generation-fl2v',
  ],
  'jimeng-seedance-2': [
    'https://docs.byteplus.com/en/docs/ModelArk/1330310',
    'https://docs.byteplus.com/en/docs/modelark/1587798',
  ],
  'jimeng-4.5': [
    'https://jimeng.com/',
  ],
  'jimeng-4.1': [
    'https://jimeng.com/',
  ],
  'jimeng-4.0': [
    'https://docs.byteplus.com/en/docs/ModelArk/1553576',
  ],
  'jimeng-video-3-fast': [
    'https://jimeng.com/',
  ],
  'wan2.6-i2v': [
    'https://help.aliyun.com/zh/model-studio/image-to-video-api-reference',
  ],
  'wan2.6-i2v-flash': [
    'https://help.aliyun.com/zh/model-studio/image-to-video-api-reference',
  ],
};

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

export function getNativeVideoCapability(id: string | undefined): VideoModelCapability | undefined {
  if (!id) return undefined;
  return NATIVE_VIDEO_CAPABILITY_OVERRIDES[id] ?? LOCAL_VIDEO_CAPABILITIES[id];
}

export function getNativeVideoFeatureKeys(id: string | undefined): NativeVideoFeatureKey[] {
  if (!id) return [];
  return NATIVE_VIDEO_FEATURE_KEYS[id] ?? [];
}

export function getNativeVideoModelNotes(id: string | undefined): string[] {
  if (!id) return [];
  return NATIVE_VIDEO_MODEL_NOTES[id] ?? [];
}

export function getNativeVideoModelSources(id: string | undefined): string[] {
  if (!id) return [];
  return NATIVE_VIDEO_MODEL_SOURCES[id] ?? [];
}

export function getVoiceCapability(id: string | undefined): VoiceModelCapability | undefined {
  if (!id) return undefined;
  return runtimeVoiceCapabilities[id];
}
