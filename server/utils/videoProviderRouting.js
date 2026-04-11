import { DEFAULT_VEO_VIDEO_MODEL, resolveVeoVideoModel } from '../services/gemini.js';
import { resolveKlingVideoModel } from '../services/kling.js';

const SUPPORTED_HAILUO_VIDEO_MODELS = new Set([
  'minimax-hailuo',
  'hailuo-2.3',
  'hailuo-2.3-fast',
  'hailuo-02',
]);

const LOCAL_VIDEO_MODEL_ALIASES = Object.freeze({
  'veo3.1': 'veo-3.1-fast-generate-preview',
});

const UNSUPPORTED_REMOTE_PROVIDER_MODELS = Object.freeze({
  'jimeng-seedance-2': 'seedance',
  'jimeng-4.5': 'seedance',
  'jimeng-4.1': 'seedance',
  'jimeng-4.0': 'seedance',
  'jimeng-video-3-fast': 'seedance',
});

const SUPPORTED_SEEDANCE_FRAME_EXECUTION_MODELS = new Set([
  'jimeng-seedance-2',
  'jimeng-4.5',
]);

const REMOTE_PROVIDER_LABELS = Object.freeze({
  'openai-video': 'Sora 2',
  'xai-video': 'Grok Video 3',
  wan: 'Wan 视频模型',
  seedance: '即梦视频模型',
});

const XAI_SUPPORTED_EXECUTION_MODES = new Set([
  'standard-text-to-video',
  'standard-image-to-video',
]);

const OPENAI_SUPPORTED_EXECUTION_MODES = new Set([
  'standard-text-to-video',
  'standard-image-to-video',
]);

const FAL_BACKED_KLING_MODELS = new Set([
  'kling-v2-6',
]);

const FAL_BACKED_WAN_MODELS = new Set([
  'wan2.6-i2v',
  'wan2.6-i2v-flash',
]);

export function isSupportedHailuoVideoModel(modelId) {
  return SUPPORTED_HAILUO_VIDEO_MODELS.has(modelId);
}

export function resolveVideoProvider(modelId) {
  const rawModel = String(modelId || '').trim();
  const model = LOCAL_VIDEO_MODEL_ALIASES[rawModel] || rawModel;
  if (!model) {
    return {
      provider: 'veo',
      normalizedModel: DEFAULT_VEO_VIDEO_MODEL,
    };
  }

  try {
    return {
      provider: 'kling',
      normalizedModel: resolveKlingVideoModel(model),
    };
  } catch {
    // noop
  }

  if (isSupportedHailuoVideoModel(model)) {
    return {
      provider: 'hailuo',
      normalizedModel: model === 'minimax-hailuo' ? 'hailuo-2.3' : model,
    };
  }

  if (model === 'sora-2') {
    return {
      provider: 'openai-video',
      normalizedModel: 'sora-2',
    };
  }

  if (model === 'grok-video-3') {
    return {
      provider: 'xai-video',
      normalizedModel: 'grok-video-3',
    };
  }

  if (FAL_BACKED_WAN_MODELS.has(model)) {
    return {
      provider: 'wan',
      normalizedModel: model,
    };
  }

  const hintedProvider = UNSUPPORTED_REMOTE_PROVIDER_MODELS[model];
  if (hintedProvider) {
    return {
      provider: hintedProvider,
      normalizedModel: model,
    };
  }

  try {
    return {
      provider: 'veo',
      normalizedModel: resolveVeoVideoModel(model),
    };
  } catch {
    throw new Error(`Unsupported video model: ${model}`);
  }
}

export function assertVideoExecutionSupported({ provider, normalizedModel, executionMode }) {
  if (provider === 'wan' && FAL_BACKED_WAN_MODELS.has(normalizedModel)) {
    return;
  }

  if (provider === 'openai-video' && !OPENAI_SUPPORTED_EXECUTION_MODES.has(executionMode)) {
    throw new Error(`Sora 2 当前后端尚未接通模式：${executionMode}`);
  }

  if (provider === 'xai-video' && !XAI_SUPPORTED_EXECUTION_MODES.has(executionMode)) {
    throw new Error(`Grok Video 3 当前后端尚未接通模式：${executionMode}`);
  }

  if (provider === 'seedance') {
    if (!['standard-text-to-video', 'standard-image-to-video', 'frame-to-frame'].includes(executionMode)) {
      throw new Error(`即梦视频模型当前后端尚未接通模式：${executionMode}`);
    }
    if (executionMode === 'frame-to-frame' && !SUPPORTED_SEEDANCE_FRAME_EXECUTION_MODELS.has(normalizedModel)) {
      throw new Error(`${normalizedModel} 当前后端尚未接通首尾帧模式`);
    }
    return;
  }

  if (provider === 'wan') {
    const providerLabel = REMOTE_PROVIDER_LABELS[provider] || normalizedModel;
    throw new Error(`${providerLabel} 当前后端尚未接通真实执行链，请先切换到 Veo、Kling 或 Hailuo。`);
  }
}

export function resolveVideoExecutionPlan({
  modelId,
  imageBase64,
  referenceImagesBase64,
  lastFrameBase64,
  motionReferenceUrl,
}) {
  const { provider, normalizedModel } = resolveVideoProvider(modelId);
  const hasStartFrame = Boolean(imageBase64);
  const hasReferenceImages = Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0;
  const hasEndFrame = Boolean(lastFrameBase64);
  const hasMotionReference = Boolean(motionReferenceUrl);
  let executionProvider = provider;
  if (provider === 'kling' && FAL_BACKED_KLING_MODELS.has(normalizedModel)) {
    executionProvider = hasEndFrame ? 'kling' : 'fal';
  } else if (provider === 'wan' && FAL_BACKED_WAN_MODELS.has(normalizedModel)) {
    executionProvider = 'fal-wan';
  }

  if (hasMotionReference) {
    return {
      provider,
      normalizedModel,
      executionMode: 'motion-control',
      executionProvider,
    };
  }

  if (provider === 'hailuo' && hasReferenceImages) {
    return {
      provider,
      normalizedModel,
      executionMode: 'standard-reference-images',
      executionProvider,
    };
  }

  if (hasEndFrame) {
    return {
      provider,
      normalizedModel,
      executionMode: 'frame-to-frame',
      executionProvider,
    };
  }

  if (hasStartFrame) {
    return {
      provider,
      normalizedModel,
      executionMode: 'standard-image-to-video',
      executionProvider,
    };
  }

  return {
    provider,
    normalizedModel,
    executionMode: 'standard-text-to-video',
    executionProvider,
  };
}
