export type ModelExecutionSupport = {
  mode: 'hosted-token' | 'local-key' | 'unimplemented';
  note: string;
};

const IMAGE_SUPPORT: Record<string, ModelExecutionSupport> = {
  'gemini-2.5-flash-image-preview': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链。',
  },
  'gemini-3.1-flash-image-preview': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链。',
  },
  'gemini-3-pro-image-preview': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链。',
  },
  'gpt-image-1.5-all': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链。',
  },
  'grok-4.2-image': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链；若上游无渠道会直接返回渠道错误。',
  },
  'grok-4.1-image': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链；若上游无渠道会直接返回渠道错误。',
  },
  'grok-4-image': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链；若上游无渠道会直接返回渠道错误。',
  },
  'grok-3-image': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链；若上游无渠道会直接返回渠道错误。',
  },
  'midjourney-v6': {
    mode: 'hosted-token',
    note: '已纳入 OpenAiTeach 托管图片链，是否可用取决于当前 token 的上游渠道。',
  },
  'midjourney-v6-raw': {
    mode: 'hosted-token',
    note: '已纳入 OpenAiTeach 托管图片链，是否可用取决于当前 token 的上游渠道。',
  },
  'midjourney-niji-v6': {
    mode: 'hosted-token',
    note: '已纳入 OpenAiTeach 托管图片链，是否可用取决于当前 token 的上游渠道。',
  },
  'doubao-seedream-5-0-260128': {
    mode: 'hosted-token',
    note: '已按 OpenAiTeach 托管图片模型处理，是否可用取决于当前 token 渠道。',
  },
  'doubao-seedream-4-5-251128': {
    mode: 'hosted-token',
    note: '已按 OpenAiTeach 托管图片模型处理，是否可用取决于当前 token 渠道。',
  },
  'doubao-seedream-4-0-250828': {
    mode: 'hosted-token',
    note: '已按 OpenAiTeach 托管图片模型处理，是否可用取决于当前 token 渠道。',
  },
  'doubao-seedream-3-0-t2i-250415': {
    mode: 'hosted-token',
    note: '已按 OpenAiTeach 托管图片模型处理，是否可用取决于当前 token 渠道。',
  },
  'qwen-image-edit-2509': {
    mode: 'hosted-token',
    note: '已按 OpenAiTeach 托管图片模型处理，是否可用取决于当前 token 渠道。',
  },
};

const VIDEO_SUPPORT: Record<string, ModelExecutionSupport> = {
  'sora-2': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链。',
  },
  'veo3.1': {
    mode: 'hosted-token',
    note: '已接 OpenAiTeach token 托管执行链。',
  },
  'grok-video-3': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；若上游无渠道会直接返回渠道错误。',
  },
  'kling-v3': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；首尾帧/运动参考等高级模式仍需本地 Kling/FAL key。',
  },
  'kling-v2-6': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；首尾帧/运动参考等高级模式仍需本地 Kling/FAL key。',
  },
  'kling-v2-5-turbo': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；高级模式仍需本地 Kling key。',
  },
  'minimax-hailuo': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；参考图/首尾帧等高级模式仍需本地 HAILUO_API_KEY。',
  },
  'wan2.6-i2v': {
    mode: 'hosted-token',
    note: '标准图生视频已接 OpenAiTeach token 托管；若上游无渠道会直接返回渠道错误。',
  },
  'wan2.6-i2v-flash': {
    mode: 'hosted-token',
    note: '标准图生视频已接 OpenAiTeach token 托管；若上游无渠道会直接返回渠道错误。',
  },
  'jimeng-seedance-2': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；首尾帧等高级模式仍需本地 SEEDANCE_API_KEY。',
  },
  'jimeng-4.5': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；首尾帧等高级模式仍需本地 SEEDANCE_API_KEY。',
  },
  'jimeng-4.1': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；若上游无渠道会直接返回渠道错误。',
  },
  'jimeng-4.0': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；若上游无渠道会直接返回渠道错误。',
  },
  'jimeng-video-3-fast': {
    mode: 'hosted-token',
    note: '标准文生/图生视频已接 OpenAiTeach token 托管；若上游无渠道会直接返回渠道错误。',
  },
};

const VOICE_SUPPORT: Record<string, ModelExecutionSupport> = {
  'cosyvoice-v3-flash': {
    mode: 'unimplemented',
    note: '语音 provider 仍未实现；即使绑定了 OpenAiTeach token，当前也无法执行。',
  },
  'cosyvoice-v3-plus': {
    mode: 'unimplemented',
    note: '语音 provider 仍未实现；即使绑定了 OpenAiTeach token，当前也无法执行。',
  },
  'qwen3-tts-flash': {
    mode: 'unimplemented',
    note: '语音 provider 仍未实现；即使绑定了 OpenAiTeach token，当前也无法执行。',
  },
  'qwen-voice-design': {
    mode: 'unimplemented',
    note: '语音 provider 仍未实现；即使绑定了 OpenAiTeach token，当前也无法执行。',
  },
};

export function getImageExecutionSupport(modelId: string | undefined): ModelExecutionSupport | undefined {
  if (!modelId) return undefined;
  return IMAGE_SUPPORT[modelId];
}

export function getVideoExecutionSupport(modelId: string | undefined): ModelExecutionSupport | undefined {
  if (!modelId) return undefined;
  return VIDEO_SUPPORT[modelId];
}

export function getVideoExecutionSupportForContext(
  modelId: string | undefined,
  options?: {
    videoMode?: 'standard' | 'frame-to-frame' | 'motion-control';
    usesReferenceImages?: boolean;
    hasHostedToken?: boolean;
  }
): ModelExecutionSupport | undefined {
  if (!modelId) return undefined;

  const base = VIDEO_SUPPORT[modelId];
  if (!base) return undefined;

  const videoMode = options?.videoMode ?? 'standard';
  const usesReferenceImages = options?.usesReferenceImages === true;
  const hasHostedToken = options?.hasHostedToken === true;

  const buildHostedAdvancedFallbackSupport = (label: string): ModelExecutionSupport => ({
    mode: 'hosted-token',
    note: `当前${label}在仅绑定 OpenAiTeach token 时会自动降级为标准托管视频链；若要保留原始高级效果，仍需配置本地 provider key。`,
  });

  if (videoMode === 'frame-to-frame') {
    if (hasHostedToken) {
      return buildHostedAdvancedFallbackSupport('首尾帧模式');
    }
    return {
      mode: 'local-key',
      note: '当前首尾帧模式仍需本地 provider key；OpenAiTeach token 托管暂未接通这一高级模式。',
    };
  }

  if (videoMode === 'motion-control') {
    if (hasHostedToken) {
      return buildHostedAdvancedFallbackSupport('运动参考模式');
    }
    return {
      mode: 'local-key',
      note: '当前运动参考模式仍需本地 provider key；OpenAiTeach token 托管暂未接通这一高级模式。',
    };
  }

  if (usesReferenceImages) {
    if (hasHostedToken) {
      return buildHostedAdvancedFallbackSupport('标准参考图/多图参考');
    }
    return {
      mode: 'local-key',
      note: '当前标准参考图/多图参考仍需本地 provider key；OpenAiTeach token 托管暂未接通这一标准高级输入模式。',
    };
  }

  return base;
}

export function getVoiceExecutionSupport(modelId: string | undefined): ModelExecutionSupport | undefined {
  if (!modelId) return undefined;
  return VOICE_SUPPORT[modelId];
}
