const HOSTED_IMAGE_MODEL_MAP = Object.freeze({
  'gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image',
  'gpt-image-1.5-all': 'gpt-image-1.5',
});

const HOSTED_TEXT_MODEL_MAP = Object.freeze({});

const HOSTED_VIDEO_STANDARD_MODEL_MAP = Object.freeze({
  'veo3.1': 'veo3.1-fast',
  'sora-2': 'sora-2',
  'grok-video-3': 'grok-video-3',
  'minimax-hailuo': 'MiniMax-Hailuo-02',
  'wan2.6-i2v': 'wan2.5-i2v-preview',
  'wan2.6-i2v-flash': 'wan2.5-i2v-preview',
  'jimeng-seedance-2': 'doubao-seedance-1-5-pro-251215',
  'jimeng-4.5': 'doubao-seedance-1-0-pro-250528',
  'jimeng-4.1': 'doubao-seedance-1-0-pro-fast-251015',
  'jimeng-4.0': 'doubao-seedance-1-0-lite-t2v-250428',
  'jimeng-video-3-fast': 'doubao-seedance-1-0-pro-fast-251015',
});

const HOSTED_VIDEO_IMAGE_MODEL_MAP = Object.freeze({
  'veo3.1': 'veo3-fast-frames',
  'jimeng-4.0': 'doubao-seedance-1-0-lite-i2v-250428',
});

export function resolveOpenAiTeachHostedImageModel(modelId) {
  if (!modelId) return modelId;
  return HOSTED_IMAGE_MODEL_MAP[modelId] || modelId;
}

export function resolveOpenAiTeachHostedTextModel(modelId) {
  if (!modelId) return modelId;
  return HOSTED_TEXT_MODEL_MAP[modelId] || modelId;
}

export function resolveOpenAiTeachHostedVideoModel(modelId, options = {}) {
  if (!modelId) return modelId;
  const prefersImageRoute = options.hasImageInput === true;
  if (prefersImageRoute && HOSTED_VIDEO_IMAGE_MODEL_MAP[modelId]) {
    return HOSTED_VIDEO_IMAGE_MODEL_MAP[modelId];
  }
  return HOSTED_VIDEO_STANDARD_MODEL_MAP[modelId] || modelId;
}
