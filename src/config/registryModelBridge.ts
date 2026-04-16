/**
 * 节点上存 registry id（与设置一致）→ 请求本地 /api 时转为 generation.js 识别的 server id。
 * 旧画布上的 legacy id 会规范成 registry id。
 */

import {
  EXECUTABLE_IMAGE_MODEL_CONFIG,
  getRegistryVideoModels,
  isExecutableImageModelId,
  REGISTRY_IMAGE_MODELS,
} from './registryCanvasModels';
import { getVideoCapability } from './modelCapabilities';

const LEGACY_VIDEO_TO_REGISTRY: Record<string, string> = {
  'veo-3.1': 'veo3.1-fast',
  'veo-3.1-fast-generate-preview': 'veo3.1-fast',
  'veo3.1': 'veo3.1-fast',
  'veo_3_1-fast': 'veo3.1-fast',
  'veo_3_1-lite': 'veo3.1-lite',
  'veo3.1-pro': 'veo3.1-fast',
  'veo3.1-fast-components': 'veo3.1-fast',
  'kling-v2-1': 'kling-v3',
  'kling-v2-1-master': 'kling-v3',
  'kling-v2-5-turbo': 'kling-v2-5-turbo',
  'kling-v2-6': 'kling-v2-6',
  'hailuo-2.3': 'minimax-hailuo',
  'hailuo-2.3-fast': 'minimax-hailuo',
  'hailuo-02': 'minimax-hailuo',
};

const LEGACY_IMAGE_TO_REGISTRY: Record<string, string> = {
  'gpt-image-1.5': 'gpt-image-1.5-all',
  'gemini-pro': 'gemini-3-pro-image-preview',
};

const registryImageIdSet = new Set(REGISTRY_IMAGE_MODELS.map((m) => m.id));
function getExecutableRegistryVideoIdSet() {
  return new Set(getRegistryVideoModels().map((m) => m.id));
}

export const DEFAULT_REGISTRY_VIDEO_ID =
  getRegistryVideoModels().find((m) => m.id === 'veo3.1-fast')?.id ?? getRegistryVideoModels()[0]?.id ?? 'veo3.1-fast';

export const DEFAULT_REGISTRY_IMAGE_ID =
  REGISTRY_IMAGE_MODELS.find((m) => m.id === 'gemini-2.5-flash-image-preview')?.id ??
  REGISTRY_IMAGE_MODELS[0]?.id ??
  'gemini-2.5-flash-image-preview';

export function canonicalizeVideoModelId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id === 'tiktok-import') return id;
  if (getExecutableRegistryVideoIdSet().has(id)) return id;
  return LEGACY_VIDEO_TO_REGISTRY[id] ?? id;
}

export function canonicalizeImageModelId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const normalizedId = LEGACY_IMAGE_TO_REGISTRY[id] ?? id;
  if (registryImageIdSet.has(normalizedId)) return normalizedId;
  return DEFAULT_REGISTRY_IMAGE_ID;
}

/** 发给 POST /api/generate-video 的 videoModel */
export function mapRegistryVideoIdToServerVideoId(registryId: string | undefined): string | undefined {
  if (!registryId || registryId === 'tiktok-import') return registryId;
  const executableIds = getExecutableRegistryVideoIdSet();
  if (!executableIds.has(registryId)) return undefined;
  const capability = getVideoCapability(registryId);
  if (capability?.serverModelId) return capability.serverModelId;
  return undefined;
}

/** 发给 POST /api/generate-image 的 imageModel */
export function mapRegistryImageIdToServerImageId(registryId: string | undefined): string | undefined {
  if (!registryId) return undefined;
  if (isExecutableImageModelId(registryId)) {
    return EXECUTABLE_IMAGE_MODEL_CONFIG[registryId].serverModelId;
  }
  if (registryImageIdSet.has(registryId)) {
    return registryId;
  }
  return undefined;
}
