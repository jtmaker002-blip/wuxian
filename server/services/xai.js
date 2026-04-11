const XAI_BASE_URL = 'https://api.x.ai/v1';
const SUPPORTED_XAI_EXECUTION_MODES = new Set([
    'standard-text-to-video',
    'standard-image-to-video',
]);

export const SUPPORTED_XAI_VIDEO_MODELS = Object.freeze([
    'grok-video-3',
]);

export function resolveXAIVideoModel(videoModel) {
    if (!videoModel) {
        throw new Error('Missing xAI video model');
    }

    if (SUPPORTED_XAI_VIDEO_MODELS.includes(videoModel)) {
        return videoModel;
    }

    throw new Error(`Unsupported xAI video model: ${videoModel}`);
}

function mapXaiModel(videoModel) {
    const model = resolveXAIVideoModel(videoModel);
    if (model === 'grok-video-3') {
        return 'grok-imagine-video';
    }

    return model;
}

function assertSupportedExecutionMode(executionMode) {
    if (!SUPPORTED_XAI_EXECUTION_MODES.has(executionMode)) {
        throw new Error(`xAI 视频当前后端尚未接通模式：${executionMode}`);
    }
}

function resolveXAIVideoExecutionMode({
    executionMode,
    imageBase64,
    referenceImagesBase64,
}) {
    if (Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0) {
        throw new Error('Grok Video 3 当前不支持多图/全图参考，请仅使用单图 image 输入');
    }

    if (executionMode) {
        return executionMode;
    }

    if (imageBase64) {
        return 'standard-image-to-video';
    }

    return 'standard-text-to-video';
}

function buildXAIVideoRequest({
    prompt,
    imageBase64,
    referenceImagesBase64,
    duration,
    aspectRatio,
    resolution,
    videoModel,
    executionMode,
}) {
    const resolvedExecutionMode = resolveXAIVideoExecutionMode({
        executionMode,
        imageBase64,
        referenceImagesBase64,
    });
    assertSupportedExecutionMode(resolvedExecutionMode);

    const request = {
        model: mapXaiModel(videoModel),
        prompt: prompt || '',
        duration: Number(duration || 5),
        aspect_ratio: aspectRatio || '16:9',
        resolution: resolution || '720p',
    };

    if (resolvedExecutionMode === 'standard-image-to-video') {
        if (!imageBase64) {
            throw new Error('xAI 图片生成视频模式必须提供单张 image 输入');
        }
        request.image = { url: imageBase64 };
        return request;
    }

    return request;
}

async function pollXaiVideo(apiKey, requestId, maxWaitMs = 300000) {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < maxWaitMs) {
        const response = await fetch(`${XAI_BASE_URL}/videos/${requestId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`xAI 视频轮询失败（HTTP ${response.status}）`);
        }

        const result = await response.json();
        const status = result.status;

        if (status === 'done') {
            const url = result.video?.url;
            if (!url) {
                throw new Error('xAI 视频生成成功但未返回视频地址');
            }
            return url;
        }

        if (status === 'failed' || status === 'expired') {
            throw new Error(result.error?.message || `xAI 视频生成失败：${status}`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('xAI 视频生成超时');
}

export async function generateXAIVideo({
    prompt,
    imageBase64,
    referenceImagesBase64,
    duration,
    aspectRatio,
    resolution,
    videoModel,
    executionMode,
    apiKey,
}) {
    if (!apiKey) {
        throw new Error('XAI_API_KEY is required');
    }

    const request = buildXAIVideoRequest({
        prompt,
        imageBase64,
        referenceImagesBase64,
        duration,
        aspectRatio,
        resolution,
        videoModel,
        executionMode,
    });

    const response = await fetch(`${XAI_BASE_URL}/videos/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`xAI 视频请求失败（HTTP ${response.status}）${errorText ? `: ${errorText}` : ''}`);
    }

    const result = await response.json();
    const requestId = result.request_id;

    if (!requestId) {
        throw new Error('xAI 视频生成未返回 request_id');
    }

    const resultUrl = await pollXaiVideo(apiKey, requestId);
    const videoResponse = await fetch(resultUrl);

    if (!videoResponse.ok) {
        throw new Error('xAI 视频下载失败');
    }

    return Buffer.from(await videoResponse.arrayBuffer());
}
