/**
 * generation.js
 * 
 * Routes for AI image and video generation.
 * Supports Gemini, Veo, Kling AI, Hailuo AI, and OpenAI GPT Image providers.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import {
    generateKlingVideo,
    generateKlingImage,
    generateKlingMultiImage,
    generateKlingTextToVideo,
    resolveKlingVideoExecutionDetails
} from '../services/kling.js';
import {
    DEFAULT_GEMINI_IMAGE_MODEL,
    DEFAULT_VEO_VIDEO_MODEL,
    generateGeminiImage,
    generateVeoVideo,
    resolveGeminiImageModel,
    resolveVeoVideoModel
} from '../services/gemini.js';
import {
    generateHailuoSubjectVideo,
    generateHailuoVideo,
    resolveHailuoSubjectExecutionDetails,
    resolveHailuoVideoExecutionDetails
} from '../services/hailuo.js';
import { generateOpenAIImage, generateOpenAIVideo } from '../services/openai.js';
import {
    resolveOpenAiTeachHostedImageModel,
    resolveOpenAiTeachHostedVideoModel,
} from '../services/openaiteachHostedModelMap.js';
import { generateOpenAiTeachGeminiImage } from '../services/openaiteachGeminiImage.js';
import { generateOpenAiTeachUnifiedVideo } from '../services/openaiteachVideo.js';
import { generateXAIVideo } from '../services/xai.js';
import { generateSeedanceVideo } from '../services/seedance.js';
import { detectImageExtensionFromBuffer, resolveImageToBase64, saveBufferToFile } from '../utils/imageHelpers.js';
import { validateVideoRequest } from '../utils/videoRequestValidation.js';
import { assertVideoExecutionSupported, resolveVideoExecutionPlan } from '../utils/videoProviderRouting.js';

const router = express.Router();

function getHostedFallbackMessage({
    hostedProviderApiKey,
    featureLabel,
}) {
    if (!hostedProviderApiKey) return null;
    return `${featureLabel} 的专用执行链尚未接入；当前只保留前端参数与面板交互。`;
}

function hasLocalVideoExecutionKey({
    executionProvider,
    GEMINI_API_KEY,
    KLING_ACCESS_KEY,
    KLING_SECRET_KEY,
    HAILUO_API_KEY,
    OPENAI_API_KEY,
    XAI_API_KEY,
    FAL_API_KEY,
    SEEDANCE_API_KEY,
}) {
    switch (executionProvider) {
        case 'veo':
            return Boolean(GEMINI_API_KEY);
        case 'kling':
            return Boolean(KLING_ACCESS_KEY && KLING_SECRET_KEY);
        case 'hailuo':
            return Boolean(HAILUO_API_KEY);
        case 'openai-video':
            return Boolean(OPENAI_API_KEY);
        case 'xai-video':
            return Boolean(XAI_API_KEY);
        case 'fal':
        case 'fal-wan':
            return Boolean(FAL_API_KEY);
        case 'seedance':
            return Boolean(SEEDANCE_API_KEY);
        default:
            return false;
    }
}

function resolveHostedFallbackVideoInput({
    executionMode,
    imageBase64,
    referenceImagesBase64,
}) {
    if (executionMode === 'standard-reference-images') {
        return referenceImagesBase64?.[0] || imageBase64;
    }

    if (executionMode === 'frame-to-frame' || executionMode === 'motion-control') {
        return imageBase64;
    }

    return imageBase64;
}

const IMAGE_TOOL_PROMPT_INSTRUCTIONS = {
    enhance: [
        '图片工具：enhance',
        '高清增强：提升纹理细节、边缘清晰度、局部对比和整体画质；保持原主体、构图、姿态和风格不发生明显变化。',
    ],
    grid: [
        '图片工具：grid',
        '九宫格：生成规则网格构图或多宫格变体，保持主体连续性和统一风格，避免随机拼贴或无关画面。',
    ],
    split: [
        '图片工具：split',
        '分块：按清晰可分离的宫格/分镜块组织画面，保证每个分块边界明确、内容连续且便于后续拆分使用。',
    ],
    mark: [
        '图片工具：mark',
        '标记区域：优先遵循当前标记、箭头、文字或涂抹意图，对被强调区域做明显编辑响应，同时尽量保留未标记区域。',
    ],
    focus: [
        '图片工具：focus',
        '焦点编辑：只强化或修改选定焦点区域，保留区域外的主体身份、背景、构图、色彩和光影一致性。',
    ],
    lighting: [
        '图片工具：lighting',
        '打光：调整画面照明方向、强度、色温、明暗层次和轮廓光，让光源变化真实落在主体与环境上。',
    ],
    'multi-angle': [
        '图片工具：multi-angle',
        '多角度：根据相机旋转、俯仰、焦距或提示要求改变拍摄视角；保持主体身份、服装、场景连续性和构图可信。',
    ],
};

function getImageToolActionInstructions({ imageToolMode, imageToolAction }) {
    if (!imageToolAction) return [];

    const exactInstructions = {
        '高清': [
            '动作：高清。执行真实高清增强，提升纹理细节、边缘清晰度和局部对比，避免改变主体身份或构图。',
        ],
        '扩图': [
            '动作：扩图。向画面外侧自然延展背景、光影和透视，原图主体位置和比例必须保持稳定。',
        ],
        '重绘': [
            '动作：重绘。只重做选定区域内容，让新增细节与周围材质、光线、透视和风格一致。',
        ],
        '擦除': [
            '动作：擦除。移除选定区域内的不需要内容，并用周围背景自然补全，不要影响未选中区域。',
        ],
        '抠图': [
            '动作：抠图。提取选定主体或素材，边缘要干净自然，背景应透明或尽量弱化为可复用素材。',
        ],
        '裁剪': [
            '动作：裁剪。按选定区域重新构图，只保留裁剪框内的有效画面并维持清晰度。',
        ],
        '打光': [
            '动作：打光。把照明变化真实作用在主体和环境上，包括明暗层次、色温、阴影方向和轮廓光。',
        ],
    };

    const instructions = exactInstructions[imageToolAction] ? [...exactInstructions[imageToolAction]] : [];

    if (imageToolMode === 'grid') {
        instructions.push(
            `九宫格动作：${imageToolAction}。输出多宫格结果时保持主体、时间线和风格连续，格子之间边界清楚且不要随机拼贴。`
        );
    }

    if (imageToolMode === 'split') {
        const gridMatch = imageToolAction.match(/(\d+)x(\d+)/i);
        if (gridMatch) {
            instructions.push(
                `宫格切分：按 ${Number(gridMatch[1])} 列 x ${Number(gridMatch[2])} 行组织画面，每个分块边界明确且可独立复用。`
            );
        } else {
            instructions.push(
                `宫格切分：${imageToolAction}。按画面内容划分清晰分块，保留连续关系并避免混叠。`
            );
        }
    }

    return instructions;
}

function getValidFocusSelection(focusSelection) {
    if (
        focusSelection &&
        Number.isFinite(focusSelection.x) &&
        Number.isFinite(focusSelection.y) &&
        Number.isFinite(focusSelection.width) &&
        Number.isFinite(focusSelection.height)
    ) {
        return focusSelection;
    }

    return null;
}

function buildImageToolContext({ focusSelection, imageToolMode, imageToolAction, imageCameraSettings, imageLightingSettings, imageAnnotations }) {
    const validFocusSelection = getValidFocusSelection(focusSelection);
    const instructions = [];

    if (validFocusSelection) {
        instructions.push(
            `聚焦区域（归一化坐标）：x=${validFocusSelection.x}, y=${validFocusSelection.y}, width=${validFocusSelection.width}, height=${validFocusSelection.height}。仅修改该区域，并尽量保持区域外内容、构图和主体一致。`
        );
    }

    if (imageToolMode) {
        instructions.push(...(IMAGE_TOOL_PROMPT_INSTRUCTIONS[imageToolMode] || [`图片工具：${imageToolMode}`]));

        if (imageToolAction) {
            instructions.push(`具体工具动作：${imageToolAction}`);
            instructions.push(...getImageToolActionInstructions({ imageToolMode, imageToolAction }));
        }

        if (imageToolMode === 'lighting' && imageLightingSettings) {
            instructions.push(
                `打光设置：mode=${imageLightingSettings.mode}, smartMode=${imageLightingSettings.smartMode}, brightness=${imageLightingSettings.brightness}, color=${imageLightingSettings.color}, keyLight=${imageLightingSettings.keyLight}, rimLight=${imageLightingSettings.rimLight}。`
            );
        }
    }

    if (imageCameraSettings) {
        instructions.push(
            `摄像机控制：camera=${imageCameraSettings.camera}, lens=${imageCameraSettings.lens}, focalLength=${imageCameraSettings.focalLengthMm}mm, aperture=${imageCameraSettings.aperture}。生成时按该相机、镜头、焦距和光圈控制透视、景深和镜头质感。`
        );
    }

    const validAnnotations = Array.isArray(imageAnnotations)
        ? imageAnnotations.filter((annotation) => annotation && getValidFocusSelection(annotation.selection))
        : [];

    if (validAnnotations.length > 0) {
        const annotationLines = validAnnotations.map((annotation, index) => {
            const selection = annotation.selection;
            return `${index + 1}. ${annotation.label || annotation.type}: x=${selection.x}, y=${selection.y}, width=${selection.width}, height=${selection.height}`;
        });
        instructions.push(`图片标记区域（归一化坐标）：\n${annotationLines.join('\n')}`);

        if (validAnnotations.some((annotation) => annotation.type === 'preserve')) {
            instructions.push('保留区域必须尽量保持不变。');
        }
        if (validAnnotations.some((annotation) => annotation.type === 'ignore')) {
            instructions.push('忽略区域不作为主体参考，不要围绕它生成关键内容。');
        }
    }

    return {
        mode: imageToolMode || null,
        focusSelection: validFocusSelection,
        lightingSettings: imageLightingSettings || null,
        annotations: validAnnotations,
        promptInstructions: instructions,
    };
}

function buildImagePromptWithToolContext({
    prompt,
    imageToolContext,
}) {
    const basePrompt = typeof prompt === 'string' ? prompt.trim() : '';
    const instructions = imageToolContext.promptInstructions;

    if (instructions.length === 0) return basePrompt;

    return [basePrompt, ...instructions].filter(Boolean).join('\n\n');
}

function buildVideoPromptContext({ cameraPresets, videoCameraControl }) {
    const instructions = [];

    if (videoCameraControl?.enabled) {
        instructions.push(
            `摄像机控制：camera=${videoCameraControl.camera}, lens=${videoCameraControl.lens}, focalLength=${videoCameraControl.focalLengthMm}mm, aperture=${videoCameraControl.aperture}。生成视频时按该相机、镜头、焦距和光圈控制透视、景深和镜头质感。`
        );
    }

    if (Array.isArray(cameraPresets) && cameraPresets.length > 0) {
        cameraPresets.forEach((preset, index) => {
            if (!preset?.name || !preset?.prompt) return;
            instructions.push(`{{CameraPreset ${index + 1}}} ${preset.name}：${preset.prompt}`);
        });
    }

    return {
        cameraPresets: Array.isArray(cameraPresets) ? cameraPresets : [],
        videoCameraControl: videoCameraControl || null,
        promptInstructions: instructions,
    };
}

function buildVideoPromptWithContext({ prompt, videoPromptContext }) {
    const basePrompt = typeof prompt === 'string' ? prompt.trim() : '';
    const instructions = videoPromptContext.promptInstructions || [];
    return [basePrompt, ...instructions].filter(Boolean).join('\n\n');
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

router.post('/generate-image', async (req, res) => {
    try {
        const {
            nodeId,
            prompt,
            aspectRatio,
            resolution,
            imageBase64: rawImageBase64,
            imageModel,
            klingReferenceMode,
            klingFaceIntensity,
            klingSubjectIntensity,
            focusSelection,
            imageAnnotations,
            imageToolMode,
            imageToolAction,
            imageCameraSettings,
            imageLightingSettings,
            providerApiKey,
            providerBaseUrl,
        } = req.body;
        const { GEMINI_API_KEY, KLING_ACCESS_KEY, KLING_SECRET_KEY, OPENAI_API_KEY, IMAGES_DIR } = req.app.locals;
        const hostedProviderApiKey = typeof providerApiKey === 'string' ? providerApiKey.trim() : '';
        const hostedProviderBaseUrl =
            typeof providerBaseUrl === 'string' && providerBaseUrl.trim()
                ? providerBaseUrl.trim()
                : 'https://openaiteach.com/v1';

        // Determine provider
        const isKlingModel = imageModel && imageModel.startsWith('kling-');
        const isOpenAIModel = imageModel && imageModel.startsWith('gpt-image-');
        const imageToolContext = buildImageToolContext({
            focusSelection,
            imageAnnotations,
            imageToolMode,
            imageToolAction,
            imageCameraSettings,
            imageLightingSettings,
        });
        const executionPrompt = buildImagePromptWithToolContext({
            prompt,
            imageToolContext,
        });

        let imageBuffer;
        let imageFormat = 'png';
        let executedImageModel = imageModel || DEFAULT_GEMINI_IMAGE_MODEL;
        let executionProvider = 'gemini';

        if (isKlingModel) {
            // --- KLING AI IMAGE GENERATION ---
            if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({
                            hostedProviderApiKey,
                            featureLabel: 'Kling 图片模型',
                        }) ||
                        'Kling 图片模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            console.log(`Using Kling AI model for image: ${imageModel}`);
            executedImageModel = imageModel;
            executionProvider = 'kling';

            // Resolve images if provided
            let resolvedImages = null;
            if (rawImageBase64) {
                const rawImages = Array.isArray(rawImageBase64) ? rawImageBase64 : [rawImageBase64];
                resolvedImages = rawImages.map(img => resolveImageToBase64(img)).filter(Boolean);
            }

            let klingImageUrl;

            // Determine which API to use based on model and reference images:
            // - kling-v1-5: Uses standard API with image_reference parameter
            // - kling-v2, kling-v2-1: Use Multi-Image API (image_reference not supported)
            const isV2Model = imageModel === 'kling-v2' || imageModel === 'kling-v2-1' || imageModel === 'kling-v2-new';
            const hasReferenceImages = resolvedImages && resolvedImages.length > 0;

            if (hasReferenceImages && isV2Model) {
                // V2 models: Use Multi-Image API for image-to-image
                console.log(`Using Kling Multi-Image API for ${imageModel} with ${resolvedImages.length} subject image(s)`);
                klingImageUrl = await generateKlingMultiImage({
                    prompt: executionPrompt,
                    subjectImages: resolvedImages,
                    modelId: imageModel,
                    aspectRatio,
                    resolution,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY
                });
            } else if (hasReferenceImages && resolvedImages.length > 1) {
                // Multiple images with non-V2 model: Use Multi-Image API
                console.log(`Using Kling Multi-Image API with ${resolvedImages.length} subject images`);
                klingImageUrl = await generateKlingMultiImage({
                    prompt: executionPrompt,
                    subjectImages: resolvedImages,
                    modelId: imageModel,
                    aspectRatio,
                    resolution,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY
                });
            } else {
                // V1.5 or text-to-image: Use standard API (V1.5 supports image_reference)
                klingImageUrl = await generateKlingImage({
                    prompt: executionPrompt,
                    imageBase64: resolvedImages,
                    modelId: imageModel,
                    aspectRatio,
                    resolution,
                    klingReferenceMode,
                    klingFaceIntensity,
                    klingSubjectIntensity,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY
                });
            }

            // Download from Kling's URL
            const imageResponse = await fetch(klingImageUrl);
            if (!imageResponse.ok) {
                throw new Error('Failed to download image from Kling');
            }
            imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

            if (klingImageUrl.includes('.jpg') || klingImageUrl.includes('.jpeg')) {
                imageFormat = 'jpg';
            }

        } else if (hostedProviderApiKey) {
            // --- OPENAITEACH HOSTED IMAGE GENERATION ---
            console.log(`Using OpenAiTeach hosted image model: ${imageModel}`);
            executedImageModel = resolveOpenAiTeachHostedImageModel(imageModel || 'gemini-3-pro-image-preview');
            executionProvider = 'openaiteach-hosted';

            let imageBase64Array = null;
            if (rawImageBase64) {
                const rawImages = Array.isArray(rawImageBase64) ? rawImageBase64 : [rawImageBase64];
                imageBase64Array = rawImages.map(img => resolveImageToBase64(img)).filter(Boolean);
            }

            if (executedImageModel.startsWith('gemini-')) {
                imageBuffer = await generateOpenAiTeachGeminiImage({
                    prompt: executionPrompt,
                    imageBase64Array,
                    imageModel: executedImageModel,
                    apiKey: hostedProviderApiKey,
                    baseUrl: hostedProviderBaseUrl,
                });
            } else {
                imageBuffer = await generateOpenAIImage({
                    prompt: executionPrompt,
                    imageBase64Array,
                    aspectRatio,
                    resolution,
                    imageModel: executedImageModel,
                    apiKey: hostedProviderApiKey,
                    baseUrl: hostedProviderBaseUrl,
                });
            }

        } else if (isOpenAIModel) {
            // --- OPENAI GPT IMAGE GENERATION ---
            if (!OPENAI_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({
                            hostedProviderApiKey,
                            featureLabel: 'OpenAI 图片模型',
                        }) ||
                        'OpenAI 图片模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            console.log(`Using OpenAI GPT Image model: ${imageModel}`);
            executedImageModel = imageModel;
            executionProvider = 'openai-image';

            // Resolve images if provided
            let imageBase64Array = null;
            if (rawImageBase64) {
                const rawImages = Array.isArray(rawImageBase64) ? rawImageBase64 : [rawImageBase64];
                imageBase64Array = rawImages.map(img => resolveImageToBase64(img)).filter(Boolean);
            }

            imageBuffer = await generateOpenAIImage({
                prompt: executionPrompt,
                imageBase64Array,
                aspectRatio,
                resolution,
                imageModel,
                apiKey: OPENAI_API_KEY
            });

        } else {
            // --- GEMINI IMAGE GENERATION (Default) ---
            if (!GEMINI_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({
                            hostedProviderApiKey,
                            featureLabel: 'Gemini 图片模型',
                            localKeyName: 'GEMINI_API_KEY',
                        }) ||
                        "Server missing API Key config"
                });
            }

            executedImageModel = resolveGeminiImageModel(imageModel);
            executionProvider = 'gemini';

            let imageBase64Array = null;
            if (rawImageBase64) {
                const rawImages = Array.isArray(rawImageBase64) ? rawImageBase64 : [rawImageBase64];
                imageBase64Array = rawImages.map(img => resolveImageToBase64(img)).filter(Boolean);
            }

            imageBuffer = await generateGeminiImage({
                prompt: executionPrompt,
                imageBase64Array,
                aspectRatio,
                resolution,
                imageModel: executedImageModel,
                apiKey: GEMINI_API_KEY
            });
        }

        imageFormat = detectImageExtensionFromBuffer(imageBuffer, imageFormat);

        // Save to library - use unique filename to preserve previous generations
        const saved = saveBufferToFile(imageBuffer, IMAGES_DIR, 'img', imageFormat);

        // Determine metadata ID: use nodeId for recovery if available, otherwise use file ID
        const metadataId = nodeId || saved.id;

        // Save metadata (id must match the metadata filename for delete to work)
        const metadata = {
            id: metadataId,  // Must match the filename for delete API to find it
            filename: saved.filename,
            prompt: executionPrompt,
            model: executedImageModel,
            requestedModel: imageModel || executedImageModel,
            executionProvider,
            focusSelection: focusSelection || null,
            imageAnnotations: imageToolContext.annotations,
            imageToolMode: imageToolMode || null,
            imageToolAction: imageToolAction || null,
            imageCameraSettings: imageCameraSettings || null,
            imageLightingSettings: imageLightingSettings || null,
            imageToolContext: imageToolContext.promptInstructions.length > 0 ? imageToolContext : null,
            createdAt: new Date().toISOString(),
            type: 'images'
        };
        fs.writeFileSync(path.join(IMAGES_DIR, `${metadataId}.json`), JSON.stringify(metadata, null, 2));

        console.log(`Image saved: ${saved.url} (model: ${executedImageModel})`);
        return res.json({ resultUrl: saved.url });

    } catch (error) {
        console.error("Server Image Gen Error:", error);
        res.status(500).json({ error: error.message || "Image generation failed" });
    }
});

// ============================================================================
// VIDEO GENERATION
// ============================================================================

router.post('/generate-video', async (req, res) => {
    try {
        const {
            nodeId,
            prompt,
            imageBase64: rawImageBase64,
            referenceImagesBase64: rawReferenceImagesBase64,
            lastFrameBase64: rawLastFrameBase64,
            motionReferenceUrl: rawMotionReferenceUrl,
            aspectRatio,
            resolution,
            duration,
            videoModel,
            cameraPresets,
            videoCameraControl,
            providerApiKey,
            providerBaseUrl,
        } = req.body;
        const { GEMINI_API_KEY, KLING_ACCESS_KEY, KLING_SECRET_KEY, HAILUO_API_KEY, OPENAI_API_KEY, XAI_API_KEY, SEEDANCE_API_KEY, VIDEOS_DIR } = req.app.locals;
        const hostedProviderApiKey = typeof providerApiKey === 'string' ? providerApiKey.trim() : '';
        const hostedProviderBaseUrl =
            typeof providerBaseUrl === 'string' && providerBaseUrl.trim()
                ? providerBaseUrl.trim()
                : 'https://openaiteach.com/v1';

        const imageBase64 = resolveImageToBase64(rawImageBase64);
        const referenceImagesBase64 = Array.isArray(rawReferenceImagesBase64)
            ? rawReferenceImagesBase64.map((item) => resolveImageToBase64(item)).filter(Boolean)
            : undefined;
        const lastFrameBase64 = resolveImageToBase64(rawLastFrameBase64);
        const motionReferenceUrl = resolveImageToBase64(rawMotionReferenceUrl);
        const videoPromptContext = buildVideoPromptContext({ cameraPresets, videoCameraControl });
        const executionPrompt = buildVideoPromptWithContext({ prompt, videoPromptContext });

        validateVideoRequest({
            videoModel,
            imageBase64,
            referenceImagesBase64,
            lastFrameBase64,
            motionReferenceUrl,
            duration,
            aspectRatio,
            resolution,
            generateAudio: req.body.generateAudio === true,
        });

        const { provider: videoProvider, normalizedModel, executionMode, executionProvider } = resolveVideoExecutionPlan({
            modelId: videoModel,
            imageBase64,
            referenceImagesBase64,
            lastFrameBase64,
            motionReferenceUrl,
        });
        assertVideoExecutionSupported({ provider: videoProvider, normalizedModel, executionMode });

        console.log(
            `[Route] Video plan -> provider: ${videoProvider}, runtime: ${executionProvider}, mode: ${executionMode}, model: ${normalizedModel}`
        );

        let videoBuffer;
        let resultVideoUrl;
        const requestedVideoModel = videoModel || normalizedModel || DEFAULT_VEO_VIDEO_MODEL;
        let executedVideoModel = normalizedModel || DEFAULT_VEO_VIDEO_MODEL;
        let executedMode = executionMode;
        let runtimeExecutionProvider = executionProvider;
        const canUseHostedStandardVideo =
            Boolean(hostedProviderApiKey) &&
            ['standard-text-to-video', 'standard-image-to-video'].includes(executionMode);
        const canUseHostedAdvancedFallback =
            Boolean(hostedProviderApiKey) &&
            ['frame-to-frame', 'motion-control', 'standard-reference-images'].includes(executionMode) &&
            !hasLocalVideoExecutionKey({
                executionProvider,
                GEMINI_API_KEY,
                KLING_ACCESS_KEY,
                KLING_SECRET_KEY,
                HAILUO_API_KEY,
                OPENAI_API_KEY,
                XAI_API_KEY,
                FAL_API_KEY: req.app.locals.FAL_API_KEY,
                SEEDANCE_API_KEY,
            });

        if (canUseHostedStandardVideo || canUseHostedAdvancedFallback) {
            const hostedFallbackImageBase64 = canUseHostedAdvancedFallback
                ? resolveHostedFallbackVideoInput({ executionMode, imageBase64, referenceImagesBase64 })
                : imageBase64;
            const hostedVideoModel = resolveOpenAiTeachHostedVideoModel(requestedVideoModel, {
                hasImageInput: Boolean(hostedFallbackImageBase64),
            });
            executedVideoModel = hostedVideoModel;
            runtimeExecutionProvider = 'openaiteach-hosted';
            if (canUseHostedAdvancedFallback) {
                executedMode = hostedFallbackImageBase64 ? 'standard-image-to-video' : 'standard-text-to-video';
            }
            if (hostedProviderBaseUrl.includes('openaiteach.com')) {
                videoBuffer = await generateOpenAiTeachUnifiedVideo({
                    prompt: executionPrompt,
                    imageBase64: hostedFallbackImageBase64,
                    aspectRatio,
                    resolution: resolution || '720p',
                    videoModel: hostedVideoModel,
                    apiKey: hostedProviderApiKey,
                    baseUrl: hostedProviderBaseUrl,
                });
            } else {
                videoBuffer = await generateOpenAIVideo({
                    prompt: executionPrompt,
                    imageBase64: hostedFallbackImageBase64,
                    aspectRatio,
                    duration: duration || (executionProvider === 'openai-video' ? 4 : 8),
                    resolution: resolution || '720p',
                    videoModel: hostedVideoModel,
                    apiKey: hostedProviderApiKey,
                    baseUrl: hostedProviderBaseUrl,
                    allowHostedModel: true,
                });
            }
        } else if (executionProvider === 'fal' || executionProvider === 'fal-wan') {
            if (executionProvider === 'fal') {
                const klingExecution = resolveKlingVideoExecutionDetails({
                    modelId: normalizedModel,
                    executionProvider,
                    executionMode,
                    lastFrameBase64,
                    motionReferenceUrl,
                });
                executedVideoModel = klingExecution.executedModel;
                executedMode = klingExecution.executedMode;
            } else {
                executedVideoModel = normalizedModel;
            }

            const { FAL_API_KEY } = req.app.locals;
            if (!FAL_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({ hostedProviderApiKey, featureLabel: 'Fal 托管视频模型' }) ||
                        'Fal 视频模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            if (executionProvider === 'fal-wan') {
                const {
                    generateFalWanImageToVideo,
                    generateFalWanImageToVideoFlash,
                } = await import('../services/fal.js');
                const wanHandler =
                    normalizedModel === 'wan2.6-i2v-flash'
                        ? generateFalWanImageToVideoFlash
                        : generateFalWanImageToVideo;

                resultVideoUrl = await wanHandler({
                    prompt: executionPrompt,
                    imageBase64,
                    duration: String(duration || 5),
                    resolution: resolution || '1080p',
                    apiKey: FAL_API_KEY,
                });
            } else if (executionMode === 'motion-control') {
                const { generateFalMotionControl } = await import('../services/fal.js');
                resultVideoUrl = await generateFalMotionControl({
                    prompt: executionPrompt,
                    characterImageBase64: imageBase64,
                    motionVideoBase64: motionReferenceUrl,
                    characterOrientation: 'video',
                    apiKey: FAL_API_KEY,
                });
            } else if (executionMode === 'standard-image-to-video' || executionMode === 'standard-text-to-video') {
                const { generateFalImageToVideo, generateFalTextToVideo } = await import('../services/fal.js');
                if (imageBase64) {
                    resultVideoUrl = await generateFalImageToVideo({
                        prompt: executionPrompt,
                        imageBase64,
                        duration: String(duration || 5),
                        aspectRatio: aspectRatio || '16:9',
                        generateAudio: req.body.generateAudio === true,
                        apiKey: FAL_API_KEY,
                    });
                } else {
                    resultVideoUrl = await generateFalTextToVideo({
                        prompt: executionPrompt,
                        duration: String(duration || 5),
                        aspectRatio: aspectRatio || '16:9',
                        generateAudio: req.body.generateAudio === true,
                        apiKey: FAL_API_KEY,
                    });
                }
            } else {
                throw new Error(`Kling 2.6 当前后端尚未接通模式：${executionMode}`);
            }

            const videoResponse = await fetch(resultVideoUrl);
            if (!videoResponse.ok) throw new Error('Failed to download generated video');
            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        } else if (executionProvider === 'kling') {
            if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({ hostedProviderApiKey, featureLabel: 'Kling 视频模型' }) ||
                        'Kling 视频模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            const klingExecution = resolveKlingVideoExecutionDetails({
                modelId: normalizedModel,
                executionProvider,
                executionMode,
                lastFrameBase64,
                motionReferenceUrl,
            });
            executedVideoModel = klingExecution.executedModel;
            executedMode = klingExecution.executedMode;

            if (executionMode === 'standard-text-to-video') {
                resultVideoUrl = await generateKlingTextToVideo({
                    prompt: executionPrompt,
                    modelId: normalizedModel,
                    aspectRatio,
                    duration: duration || 5,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY,
                });
            } else {
                resultVideoUrl = await generateKlingVideo({
                    prompt: executionPrompt,
                    imageBase64,
                    lastFrameBase64,
                    modelId: normalizedModel,
                    aspectRatio,
                    duration: duration || 5,
                    motionReferenceUrl: executionMode === 'frame-to-frame' ? undefined : motionReferenceUrl,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY,
                });
            }

            const videoResponse = await fetch(resultVideoUrl);
            if (!videoResponse.ok) throw new Error('Failed to download generated video');
            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        } else if (executionProvider === 'hailuo') {
            if (!HAILUO_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({ hostedProviderApiKey, featureLabel: 'Hailuo 视频模型' }) ||
                        'Hailuo 视频模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            const hailuoExecution =
                executionMode === 'standard-reference-images'
                    ? resolveHailuoSubjectExecutionDetails()
                    : resolveHailuoVideoExecutionDetails({
                        modelId: normalizedModel,
                        imageBase64,
                        lastFrameBase64,
                    });
            executedVideoModel = hailuoExecution.executedModel;
            executedMode = hailuoExecution.executedMode;

            const hailuoVideoUrl =
                executionMode === 'standard-reference-images'
                    ? await generateHailuoSubjectVideo({
                        prompt: executionPrompt,
                        subjectImagesBase64: referenceImagesBase64,
                        aspectRatio,
                        resolution,
                        duration: duration || 6,
                        apiKey: HAILUO_API_KEY,
                    })
                    : await generateHailuoVideo({
                        prompt: executionPrompt,
                        imageBase64,
                        lastFrameBase64,
                        modelId: normalizedModel,
                        aspectRatio,
                        resolution,
                        duration: duration || 6,
                        apiKey: HAILUO_API_KEY,
                    });

            const videoResponse = await fetch(hailuoVideoUrl);
            if (!videoResponse.ok) throw new Error('Failed to download video from Hailuo');
            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        } else if (executionProvider === 'openai-video') {
            if (!OPENAI_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({ hostedProviderApiKey, featureLabel: 'OpenAI 视频模型' }) ||
                        'OpenAI 视频模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            executedVideoModel = normalizedModel;
            videoBuffer = await generateOpenAIVideo({
                prompt: executionPrompt,
                imageBase64,
                aspectRatio,
                duration: duration || 4,
                resolution: resolution || '720p',
                videoModel: normalizedModel,
                apiKey: OPENAI_API_KEY,
            });
        } else if (executionProvider === 'xai-video') {
            if (!XAI_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({ hostedProviderApiKey, featureLabel: 'Grok 视频模型' }) ||
                        'Grok 视频模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            executedVideoModel = normalizedModel;
            videoBuffer = await generateXAIVideo({
                prompt: executionPrompt,
                imageBase64,
                referenceImagesBase64,
                aspectRatio: aspectRatio || '16:9',
                duration: duration || 8,
                resolution: resolution || '720p',
                videoModel: normalizedModel,
                executionMode,
                apiKey: XAI_API_KEY,
            });
        } else if (executionProvider === 'seedance') {
            if (!SEEDANCE_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({ hostedProviderApiKey, featureLabel: '即梦 / Seedance 视频模型' }) ||
                        '即梦 / Seedance 视频模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            executedVideoModel = normalizedModel;
            videoBuffer = await generateSeedanceVideo({
                prompt: executionPrompt,
                imageBase64,
                lastFrameBase64,
                aspectRatio: aspectRatio || '16:9',
                duration: duration || 5,
                resolution: resolution || '720p',
                videoModel: normalizedModel,
                generateAudio: req.body.generateAudio === true,
                apiKey: SEEDANCE_API_KEY,
            });
        } else if (executionProvider === 'veo') {
            if (!GEMINI_API_KEY) {
                return res.status(500).json({
                    error:
                        getHostedFallbackMessage({ hostedProviderApiKey, featureLabel: 'Veo 视频模型' }) ||
                        'Veo 视频模型执行链尚未接入；当前只保留前端参数与面板交互。'
                });
            }

            executedVideoModel = resolveVeoVideoModel(normalizedModel || requestedVideoModel);
            videoBuffer = await generateVeoVideo({
                prompt: executionPrompt,
                imageBase64,
                referenceImagesBase64,
                lastFrameBase64,
                aspectRatio,
                resolution,
                duration: duration || 8,
                videoModel: executedVideoModel,
                generateAudio: req.body.generateAudio === true,
                apiKey: GEMINI_API_KEY,
            });
        } else {
            throw new Error(`Unsupported video runtime provider: ${executionProvider}`);
        }

        const saved = saveBufferToFile(videoBuffer, VIDEOS_DIR, 'vid', 'mp4');
        const metadataId = nodeId || saved.id;
        const metadata = {
            id: metadataId,
            filename: saved.filename,
            prompt: executionPrompt,
            originalPrompt: prompt,
            videoPromptContext,
            model: executedVideoModel,
            requestedModel: requestedVideoModel,
            executionMode,
            executedMode,
            executionProvider: runtimeExecutionProvider,
            aspectRatio: aspectRatio || 'Auto',
            resolution: resolution || 'Auto',
            createdAt: new Date().toISOString(),
            type: 'videos',
        };
        fs.writeFileSync(path.join(VIDEOS_DIR, `${metadataId}.json`), JSON.stringify(metadata, null, 2));

        console.log(`Video saved: ${saved.url} (model: ${executedVideoModel})`);
        return res.json({
            resultUrl: saved.url,
            requestedModel: requestedVideoModel,
            executedModel: executedVideoModel,
            executionMode,
            executedMode,
            executionProvider: runtimeExecutionProvider,
        });
    } catch (error) {
        console.error("Server Video Gen Error:", error);
        res.status(500).json({ error: error.message || "Video generation failed" });
    }
});

// ============================================================================
// GENERATION STATUS / RECOVERY
// ============================================================================

/**
 * Check if a generation has finished for a specific nodeId.
 * Returns the resultUrl if it exists.
 */
router.get('/generation-status/:nodeId', async (req, res) => {
    try {
        const { nodeId } = req.params;
        const { IMAGES_DIR, VIDEOS_DIR } = req.app.locals;

        // Check images metadata
        const imageMetaPath = path.join(IMAGES_DIR, `${nodeId}.json`);
        if (fs.existsSync(imageMetaPath)) {
            const meta = JSON.parse(fs.readFileSync(imageMetaPath, 'utf8'));
            return res.json({
                status: 'success',
                resultUrl: `/library/images/${meta.filename}`,
                type: 'image',
                createdAt: meta.createdAt,
                requestedModel: meta.requestedModel,
                executedModel: meta.model,
                executionProvider: meta.executionProvider,
            });
        }

        // Check videos metadata
        const videoMetaPath = path.join(VIDEOS_DIR, `${nodeId}.json`);
        if (fs.existsSync(videoMetaPath)) {
            const meta = JSON.parse(fs.readFileSync(videoMetaPath, 'utf8'));
            return res.json({
                status: 'success',
                resultUrl: `/library/videos/${meta.filename}`,
                type: 'video',
                createdAt: meta.createdAt,
                requestedModel: meta.requestedModel,
                executedModel: meta.model,
                executionMode: meta.executionMode,
                executedMode: meta.executedMode,
                executionProvider: meta.executionProvider,
            });
        }

        res.json({ status: 'pending' });
    } catch (error) {
        console.error("Status Check Error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-audio', async (req, res) => {
    try {
        const { nodeId, prompt, audioModel, providerApiKey } = req.body;

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ error: '语音生成需要输入文本内容。' });
        }

        return res.status(501).json({
            error:
                (typeof providerApiKey === 'string' && providerApiKey.trim()
                    ? `语音模型 ${audioModel || 'default'} 已识别到 OpenAiTeach Token，但当前后端尚未接通对应语音 provider 执行链。`
                    : `语音模型 ${audioModel || 'default'} 当前后端尚未接通 provider，请先完成语音 provider 接入。`),
            nodeId: nodeId || null,
        });
    } catch (error) {
        console.error('Server Audio Gen Error:', error);
        return res.status(500).json({ error: error.message || 'Audio generation failed' });
    }
});

export default router;
