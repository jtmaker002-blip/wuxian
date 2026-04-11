const SEEDANCE_BASE_URL = process.env.SEEDANCE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

const SEEDANCE_MODEL_MATRIX = Object.freeze({
  'jimeng-seedance-2': {
    standardText: 'doubao-seedance-1-5-pro-251215',
    standardImage: 'doubao-seedance-1-5-pro-251215',
    frameToFrame: 'doubao-seedance-1-5-pro-251215',
  },
  'jimeng-4.5': {
    standardText: 'doubao-seedance-1-0-pro-250528',
    standardImage: 'doubao-seedance-1-0-pro-250528',
    frameToFrame: 'doubao-seedance-1-0-pro-250528',
  },
  'jimeng-4.1': {
    standardText: 'doubao-seedance-1-0-pro-fast-251015',
    standardImage: 'doubao-seedance-1-0-pro-fast-251015',
  },
  'jimeng-4.0': {
    standardText: 'doubao-seedance-1-0-lite-t2v-250428',
    standardImage: 'doubao-seedance-1-0-lite-i2v-250428',
  },
  'jimeng-video-3-fast': {
    standardText: 'doubao-seedance-1-0-pro-fast-251015',
    standardImage: 'doubao-seedance-1-0-pro-fast-251015',
  },
});

export const SUPPORTED_SEEDANCE_VIDEO_MODELS = Object.freeze(Object.keys(SEEDANCE_MODEL_MATRIX));
export const SEEDANCE_START_END_FRAME_MODELS = Object.freeze(
  SUPPORTED_SEEDANCE_VIDEO_MODELS.filter((id) => Boolean(SEEDANCE_MODEL_MATRIX[id].frameToFrame))
);
export const SEEDANCE_STANDARD_ONLY_MODELS = Object.freeze(
  SUPPORTED_SEEDANCE_VIDEO_MODELS.filter((id) => !Boolean(SEEDANCE_MODEL_MATRIX[id].frameToFrame))
);

export function resolveSeedanceVideoModel(videoModel) {
  if (!videoModel) {
    throw new Error('Missing Seedance video model');
  }

  if (SUPPORTED_SEEDANCE_VIDEO_MODELS.includes(videoModel)) {
    return videoModel;
  }

  throw new Error(`Unsupported Seedance video model: ${videoModel}`);
}

export function mapSeedanceDuration(duration) {
  const seconds = Number(duration || 0);
  if (Number.isFinite(seconds) && [5, 10].includes(seconds)) {
    return seconds;
  }
  return 5;
}

export function mapSeedanceRatio(aspectRatio) {
  const ratio = String(aspectRatio || '').trim();
  if (!ratio) return '16:9';
  if (['16:9', '9:16'].includes(ratio)) {
    return ratio;
  }
  return '16:9';
}

export function mapSeedanceResolution(resolution) {
  const normalized = String(resolution || '').trim().toLowerCase();
  if (normalized === '1080p') return '1080p';
  if (normalized === '720p') return '720p';
  return '720p';
}

export function resolveSeedanceExecutionMode({ executionMode, imageBase64, lastFrameBase64 }) {
  if (executionMode === 'frame-to-frame' || lastFrameBase64) {
    return 'frame-to-frame';
  }
  if (imageBase64) {
    return 'standard-image-to-video';
  }
  return 'standard-text-to-video';
}

export function selectSeedanceServerModel(videoModel, resolvedExecutionMode) {
  const normalized = resolveSeedanceVideoModel(videoModel);
  const matrix = SEEDANCE_MODEL_MATRIX[normalized];

  if (resolvedExecutionMode === 'frame-to-frame') {
    if (!matrix.frameToFrame) {
      throw new Error(`${normalized} 当前后端尚未接通首尾帧模式。`);
    }
    return matrix.frameToFrame;
  }

  if (resolvedExecutionMode === 'standard-image-to-video') {
    if (!matrix.standardImage) {
      throw new Error(`${normalized} 当前后端尚未接通图生视频模式。`);
    }
    return matrix.standardImage;
  }

  if (!matrix.standardText) {
    throw new Error(`${normalized} 当前后端尚未接通文生视频模式。`);
  }
  return matrix.standardText;
}

function buildSeedanceContent({ prompt, imageBase64, lastFrameBase64, ratio, duration, resolution, executionMode }) {
  const textPrompt = `${prompt || ''}${prompt ? '\n' : ''}--ratio ${ratio} --dur ${duration} --rs ${resolution}`;
  const content = [
    {
      type: 'text',
      text: textPrompt.trim(),
    },
  ];

  if (executionMode === 'frame-to-frame') {
    content.push({
      type: 'image_url',
      role: 'first_frame',
      image_url: { url: imageBase64 },
    });
    content.push({
      type: 'image_url',
      role: 'last_frame',
      image_url: { url: lastFrameBase64 },
    });
    return content;
  }

  if (executionMode === 'standard-image-to-video' && imageBase64) {
    content.push({
      type: 'image_url',
      role: 'first_frame',
      image_url: { url: imageBase64 },
    });
  }

  return content;
}

async function createSeedanceTask({ apiKey, model, content, generateAudio }) {
  const body = {
    model,
    content,
  };

  if (generateAudio === true) {
    body.parameters = { generate_audio: true };
  }

  const response = await fetch(`${SEEDANCE_BASE_URL}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Seedance 创建任务失败（HTTP ${response.status}）${errorText ? `: ${errorText}` : ''}`);
  }

  const result = await response.json();
  const taskId = result.id || result.task_id;
  if (!taskId) {
    throw new Error('Seedance 未返回任务 ID。');
  }

  return taskId;
}

async function pollSeedanceTask({ apiKey, taskId, maxWaitMs = 300000 }) {
  const startTime = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${SEEDANCE_BASE_URL}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Seedance 查询任务失败（HTTP ${response.status}）${errorText ? `: ${errorText}` : ''}`);
    }

    const result = await response.json();
    const status = result.status;

    if (status === 'succeeded' || status === 'completed') {
      const videoUrl =
        result.content?.video_url
        || result.output?.video_url
        || result.video?.url
        || result.result?.video_url;
      if (!videoUrl) {
        throw new Error('Seedance 任务完成但未返回视频地址。');
      }
      return videoUrl;
    }

    if (status === 'failed' || status === 'canceled' || status === 'expired') {
      throw new Error(result.error?.message || result.message || `Seedance 任务失败：${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Seedance 视频生成超时。');
}

export async function generateSeedanceVideo({
  prompt,
  imageBase64,
  lastFrameBase64,
  aspectRatio,
  duration,
  resolution,
  videoModel,
  generateAudio,
  apiKey,
}) {
  if (!apiKey) {
    throw new Error('SEEDANCE_API_KEY is required');
  }

  const executionMode = resolveSeedanceExecutionMode({ imageBase64, lastFrameBase64 });
  if (executionMode === 'frame-to-frame' && (!imageBase64 || !lastFrameBase64)) {
    throw new Error('Seedance 首尾帧模式需要同时提供首帧和尾帧。');
  }
  const model = selectSeedanceServerModel(videoModel, executionMode);
  const ratio = mapSeedanceRatio(aspectRatio);
  const seconds = mapSeedanceDuration(duration);
  const mappedResolution = mapSeedanceResolution(resolution);
  const content = buildSeedanceContent({
    prompt,
    imageBase64,
    lastFrameBase64,
    ratio,
    duration: seconds,
    resolution: mappedResolution,
    executionMode,
  });

  const taskId = await createSeedanceTask({
    apiKey,
    model,
    content,
    generateAudio,
  });

  const resultUrl = await pollSeedanceTask({ apiKey, taskId });
  const videoResponse = await fetch(resultUrl);

  if (!videoResponse.ok) {
    throw new Error('Seedance 视频下载失败。');
  }

  return Buffer.from(await videoResponse.arrayBuffer());
}
