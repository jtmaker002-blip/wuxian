/**
 * openai.js
 *
 * Service for OpenAI GPT Image / Sora video generation.
 * Uses the Image API for text-to-image and image-to-image generation,
 * and the Videos API for text/image-to-video generation.
 */

import OpenAI, { toFile } from 'openai';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map aspect ratio or size to OpenAI size format
 * Accepts both pixel sizes (1024x1024) and aspect ratios (1:1)
 * Available sizes: 1024x1024 (square), 1536x1024 (landscape), 1024x1536 (portrait), auto
 */
function mapAspectRatioToSize(aspectRatio) {
    const sizeMap = {
        // Pixel sizes (new format for GPT Image 1.5)
        '1024x1024': '1024x1024',
        '1536x1024': '1536x1024',
        '1024x1536': '1024x1536',
        // Legacy aspect ratio mappings
        '1:1': '1024x1024',
        '16:9': '1536x1024',
        '9:16': '1024x1536',
        'Auto': 'auto'
    };
    return sizeMap[aspectRatio] || 'auto';
}

/**
 * Map resolution to OpenAI quality format
 * Quality options: low, medium, high, auto
 */
function mapResolutionToQuality(resolution) {
    const qualityMap = {
        '1K': 'low',
        '2K': 'medium',
        '4K': 'high',
        'Auto': 'auto'
    };
    return qualityMap[resolution] || 'auto';
}

export const SUPPORTED_OPENAI_VIDEO_MODELS = Object.freeze([
    'sora-2'
]);

export const DEFAULT_OPENAI_VIDEO_MODEL = 'sora-2';

export function resolveOpenAIVideoModel(videoModel) {
    if (!videoModel) {
        return DEFAULT_OPENAI_VIDEO_MODEL;
    }

    if (SUPPORTED_OPENAI_VIDEO_MODELS.includes(videoModel)) {
        return videoModel;
    }

    throw new Error(`Unsupported OpenAI video model: ${videoModel}`);
}

function mapVideoDurationToSeconds(duration) {
    const seconds = Number(duration || 0);
    if ([4, 8, 12].includes(seconds)) {
        return String(seconds);
    }
    return '4';
}

function mapVideoSize(aspectRatio, resolution) {
    const isPortrait = aspectRatio === '9:16';
    const wants1080p = resolution === '1080p';

    if (wants1080p) {
        return isPortrait ? '1024x1792' : '1792x1024';
    }

    return isPortrait ? '720x1280' : '1280x720';
}

/**
 * Convert base64 image data to a file object for OpenAI API
 * Strips data URL prefix if present
 */
async function base64ToFile(base64Data, filename = 'image.png') {
    // Strip data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Content = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;

    // Determine MIME type from data URL or default to PNG
    let mimeType = 'image/png';
    if (base64Data.startsWith('data:')) {
        const match = base64Data.match(/^data:(image\/\w+);base64,/);
        if (match) {
            mimeType = match[1];
        }
    }

    const buffer = Buffer.from(base64Content, 'base64');
    return await toFile(buffer, filename, { type: mimeType });
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Generate image using OpenAI GPT Image API
 * 
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - Text prompt for image generation
 * @param {string[]} [params.imageBase64Array] - Array of base64 images for image-to-image editing
 * @param {string} [params.aspectRatio] - Aspect ratio (1:1, 16:9, 9:16, Auto)
 * @param {string} [params.resolution] - Resolution/quality setting (1K, 2K, 4K, Auto)
 * @param {string} params.apiKey - OpenAI API key
 * @returns {Promise<Buffer>} Image buffer
 */
export async function generateOpenAIImage({ prompt, imageBase64Array, aspectRatio, resolution, apiKey }) {
    const openai = new OpenAI({ apiKey });

    const size = mapAspectRatioToSize(aspectRatio);
    const quality = mapResolutionToQuality(resolution);

    console.log(`[OpenAI] Generating image with gpt-image-1.5, size: ${size}, quality: ${quality}`);

    // Use edits endpoint if input images provided, otherwise generations
    if (imageBase64Array && imageBase64Array.length > 0) {
        // --- IMAGE EDITING (Image-to-Image) ---
        console.log(`[OpenAI] Using edits endpoint with ${imageBase64Array.length} input image(s)`);

        // Convert base64 images to file objects
        const imageFiles = await Promise.all(
            imageBase64Array.map(async (base64, idx) =>
                await base64ToFile(base64, `input_${idx}.png`)
            )
        );

        // Build request options
        const editOptions = {
            model: 'gpt-image-1.5',
            image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
            prompt,
            quality: quality === 'auto' ? undefined : quality,
        };

        // Only set size if not auto (auto is default behavior)
        if (size !== 'auto') {
            editOptions.size = size;
        }

        const response = await openai.images.edit(editOptions);

        // Response contains base64 data in b64_json field
        const imageBase64 = response.data[0].b64_json;
        return Buffer.from(imageBase64, 'base64');

    } else {
        // --- TEXT-TO-IMAGE (Generations) ---
        console.log(`[OpenAI] Using generations endpoint (text-to-image)`);

        // Build request options
        const generateOptions = {
            model: 'gpt-image-1.5',
            prompt,
            quality: quality === 'auto' ? undefined : quality,
        };

        // Only set size if not auto
        if (size !== 'auto') {
            generateOptions.size = size;
        }

        const response = await openai.images.generate(generateOptions);

        // Response contains base64 data in b64_json field
        const imageBase64 = response.data[0].b64_json;
        return Buffer.from(imageBase64, 'base64');
    }
}

// ============================================================================
// VIDEO GENERATION
// ============================================================================

async function pollOpenAIVideo(openai, videoId, maxWaitMs = 300000) {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < maxWaitMs) {
        const video = await openai.videos.retrieve(videoId);

        if (video.status === 'completed') {
            return video;
        }

        if (video.status === 'failed') {
            const message = video.error?.message || 'OpenAI video generation failed';
            throw new Error(message);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('OpenAI video generation timed out');
}

/**
 * Generate video using OpenAI Sora API
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.imageBase64]
 * @param {string} [params.aspectRatio]
 * @param {string|number} [params.duration]
 * @param {string} [params.resolution]
 * @param {string} [params.videoModel]
 * @param {string} params.apiKey
 * @returns {Promise<Buffer>}
 */
export async function generateOpenAIVideo({
    prompt,
    imageBase64,
    aspectRatio,
    duration,
    resolution,
    videoModel,
    apiKey,
}) {
    const openai = new OpenAI({ apiKey });
    const model = resolveOpenAIVideoModel(videoModel);
    const seconds = mapVideoDurationToSeconds(duration);
    const size = mapVideoSize(aspectRatio, resolution);

    const request = {
        model,
        prompt: prompt || '',
        seconds,
        size,
    };

    if (imageBase64) {
        request.input_reference = await base64ToFile(imageBase64, 'sora-reference.png');
    }

    const videoJob = await openai.videos.create(request);
    const finishedVideo = await pollOpenAIVideo(openai, videoJob.id);
    const contentResponse = await openai.videos.downloadContent(finishedVideo.id, {
        variant: 'video',
    });

    const arrayBuffer = await contentResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
