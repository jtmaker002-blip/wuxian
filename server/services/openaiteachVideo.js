function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function mapUnifiedVideoResolution(resolution) {
  const normalized = String(resolution || '').trim().toLowerCase();
  if (normalized === '1080p') return '1080P';
  if (normalized === '720p') return '720P';
  if (normalized === '480p') return '480P';
  return undefined;
}

function resolveTaskId(payload) {
  return (
    payload?.id ||
    payload?.task_id ||
    payload?.output?.task_id ||
    payload?.data?.id ||
    payload?.data?.task_id
  );
}

function resolveQueryStatus(payload) {
  return (
    payload?.status ||
    payload?.detail?.status ||
    payload?.output?.task_status ||
    payload?.data?.status
  );
}

function resolveVideoUrl(payload) {
  return (
    payload?.video_url ||
    payload?.detail?.video_url ||
    payload?.output?.video_url ||
    payload?.data?.video_url
  );
}

function resolveErrorMessage(payload) {
  return (
    payload?.error_message ||
    payload?.detail?.error_message ||
    payload?.error?.message ||
    payload?.message
  );
}

async function createUnifiedVideoTask({ apiKey, baseUrl, model, prompt, imageBase64, aspectRatio, resolution }) {
  const requestBody = {
    model,
    prompt: prompt || '',
    enhance_prompt: true,
    enable_upsample: String(resolution || '').trim().toLowerCase() === '1080p',
  };

  if (aspectRatio) {
    requestBody.aspect_ratio = aspectRatio;
  }

  const mappedSize = mapUnifiedVideoResolution(resolution);
  if (mappedSize) {
    requestBody.size = mappedSize;
  }

  if (imageBase64) {
    requestBody.images = [imageBase64];
  }

  const response = await fetch(`${trimTrailingSlash(baseUrl)}/video/create`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(`OpenAiTeach 统一视频创建失败（HTTP ${response.status}）${text ? `: ${text}` : ''}`);
    error.status = response.status;
    throw error;
  }

  const taskId = resolveTaskId(payload);
  if (!taskId) {
    throw new Error('OpenAiTeach 统一视频接口未返回任务 ID');
  }

  return taskId;
}

async function pollUnifiedVideoTask({ apiKey, baseUrl, taskId, maxWaitMs = 300000 }) {
  const startedAt = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startedAt < maxWaitMs) {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/video/query?id=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const error = new Error(`OpenAiTeach 统一视频查询失败（HTTP ${response.status}）${text ? `: ${text}` : ''}`);
      error.status = response.status;
      throw error;
    }

    const status = String(resolveQueryStatus(payload) || '').toLowerCase();
    const videoUrl = resolveVideoUrl(payload);
    const errorMessage = resolveErrorMessage(payload);

    if (videoUrl && ['completed', 'succeeded', 'success'].includes(status)) {
      return videoUrl;
    }

    if (['failed', 'error', 'canceled', 'cancelled', 'expired'].includes(status)) {
      throw new Error(errorMessage || `OpenAiTeach 统一视频任务失败：${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('OpenAiTeach 统一视频生成超时');
}

export async function generateOpenAiTeachUnifiedVideo({
  prompt,
  imageBase64,
  aspectRatio,
  resolution,
  videoModel,
  apiKey,
  baseUrl = 'https://openaiteach.com/v1',
}) {
  const taskId = await createUnifiedVideoTask({
    apiKey,
    baseUrl,
    model: videoModel,
    prompt,
    imageBase64,
    aspectRatio,
    resolution,
  });

  const videoUrl = await pollUnifiedVideoTask({
    apiKey,
    baseUrl,
    taskId,
  });

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error('OpenAiTeach 统一视频下载失败');
  }

  return Buffer.from(await videoResponse.arrayBuffer());
}
