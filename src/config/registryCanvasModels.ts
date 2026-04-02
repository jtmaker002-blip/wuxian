/**
 * 画布节点 UI 用的视频/图像模型列表 —— 直接来自 MODEL_REGISTRY，与设置里勾选的 id 一致。
 */

import { MODEL_REGISTRY, type ModelEntry } from './modelRegistry';
import { getVideoCapability } from './modelCapabilities';

export type VideoUiProvider = 'openai' | 'google' | 'xai' | 'kling' | 'hailuo' | 'wan' | 'other';

export interface CanvasVideoModel {
  id: string;
  name: string;
  provider: VideoUiProvider;
  supportsTextToVideo: boolean;
  supportsImageToVideo: boolean;
  supportsMultiImage: boolean;
  durations: number[];
  resolutions: string[];
  aspectRatios: string[];
  recommended?: boolean;
  durationResolutionMap?: Record<number, string[]>;
}

export interface CanvasImageModel {
  id: string;
  name: string;
  provider: 'openai' | 'google' | 'kling' | 'other';
  supportsImageToImage: boolean;
  supportsMultiImage: boolean;
  resolutions: string[];
  aspectRatios: string[];
  recommended?: boolean;
}

const PREFERRED_VIDEO_REGISTRY_ID_BY_SERVER_ID: Record<string, string> = {
  'veo-3.1-fast-generate-preview': 'veo3.1',
  'hailuo-2.3': 'minimax-hailuo',
};

function inferVideoProvider(id: string): VideoUiProvider {
  if (id.startsWith('kling-')) return 'kling';
  if (id === 'minimax-hailuo') return 'hailuo';
  if (id.startsWith('wan')) return 'wan';
  if (id === 'grok-video-3') return 'xai';
  if (id === 'sora-2') return 'openai';
  if (id.startsWith('veo')) return 'google';
  return 'other';
}

function buildVideoFromRegistry(e: ModelEntry): CanvasVideoModel {
  const provider = inferVideoProvider(e.id);
  const capability = getVideoCapability(e.id);
  const standardMode = capability?.modes.standard;
  const base = {
    id: e.id,
    name: e.name,
    provider,
    supportsTextToVideo: standardMode?.supportsTextToVideo ?? true,
    supportsImageToVideo: standardMode?.supportsImageToVideo ?? true,
    supportsMultiImage: standardMode?.supportsMultiImage ?? false,
    aspectRatios: standardMode?.aspectRatios ?? ['16:9', '9:16'],
    recommended: e.tags?.includes('HOT'),
  };

  if (standardMode) {
    return {
      ...base,
      durations: standardMode.durations,
      resolutions: standardMode.resolutions,
    };
  }

  return {
    ...base,
    durations: [5, 8, 10],
    resolutions: ['Auto', '720p', '1080p'],
  };
}

const OPENAI_IMAGE_RATIOS = ['Auto', '1024x1024', '1536x1024', '1024x1536'];
const GEMINI_IMAGE_RATIOS = [
  'Auto',
  '1:1',
  '9:16',
  '16:9',
  '3:4',
  '4:3',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
];

type ExecutableImageModelConfig = Omit<CanvasImageModel, 'id' | 'name' | 'recommended'> & {
  serverModelId: string;
};

export const EXECUTABLE_IMAGE_MODEL_CONFIG = {
  'gemini-2.5-flash-image-preview': {
    provider: 'google',
    serverModelId: 'gemini-2.5-flash-image-preview',
    supportsImageToImage: true,
    supportsMultiImage: true,
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: GEMINI_IMAGE_RATIOS,
  },
  'gemini-3.1-flash-image-preview': {
    provider: 'google',
    serverModelId: 'gemini-3.1-flash-image-preview',
    supportsImageToImage: true,
    supportsMultiImage: true,
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: GEMINI_IMAGE_RATIOS,
  },
  'gemini-3-pro-image-preview': {
    provider: 'google',
    serverModelId: 'gemini-3-pro-image-preview',
    supportsImageToImage: true,
    supportsMultiImage: true,
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: GEMINI_IMAGE_RATIOS,
  },
  'gpt-image-1.5-all': {
    provider: 'openai',
    serverModelId: 'gpt-image-1.5',
    supportsImageToImage: true,
    supportsMultiImage: true,
    resolutions: ['Auto', '1K', '2K', '4K'],
    aspectRatios: OPENAI_IMAGE_RATIOS,
  },
} satisfies Record<string, ExecutableImageModelConfig>;

export function isExecutableImageModelId(
  id: string | undefined
): id is keyof typeof EXECUTABLE_IMAGE_MODEL_CONFIG {
  return Boolean(id && id in EXECUTABLE_IMAGE_MODEL_CONFIG);
}

function buildImageFromRegistry(e: ModelEntry): CanvasImageModel {
  const hot = e.tags?.includes('HOT');
  const config = EXECUTABLE_IMAGE_MODEL_CONFIG[e.id];

  if (config) {
    const { serverModelId: _serverModelId, ...uiConfig } = config;
    return {
      id: e.id,
      name: e.name,
      ...uiConfig,
      recommended: hot,
    };
  }

  return {
    id: e.id,
    name: e.name,
    provider: 'other',
    supportsImageToImage: true,
    supportsMultiImage: true,
    resolutions: ['1K', '2K', '4K'],
    aspectRatios: GEMINI_IMAGE_RATIOS,
  };
}

export function getRegistryVideoModels(): CanvasVideoModel[] {
  const seenServerModelIds = new Set<string>();

  return MODEL_REGISTRY
    .filter((m) => {
      if (m.category !== 'video') return false;
      const capability = getVideoCapability(m.id);
      if (!capability || !Object.values(capability.modes).some((mode) => mode.enabled)) {
        return false;
      }

      const preferredId = PREFERRED_VIDEO_REGISTRY_ID_BY_SERVER_ID[capability.serverModelId];
      if (preferredId && preferredId !== m.id) {
        return false;
      }

      if (seenServerModelIds.has(capability.serverModelId)) {
        return false;
      }

      seenServerModelIds.add(capability.serverModelId);
      return true;
    })
    .map(buildVideoFromRegistry);
}

export const REGISTRY_VIDEO_MODELS: CanvasVideoModel[] = getRegistryVideoModels();

export const REGISTRY_IMAGE_MODELS: CanvasImageModel[] = MODEL_REGISTRY.filter(
  (m) => m.category === 'image' && isExecutableImageModelId(m.id)
).map(buildImageFromRegistry);
