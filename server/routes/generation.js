/**
 * generation.js
 * 
 * Routes for AI image and video generation.
 * Supports Gemini, Veo, Kling AI, Hailuo AI, and OpenAI GPT Image providers.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { generateKlingVideo, generateKlingImage, generateKlingMultiImage, generateKlingTextToVideo } from '../services/kling.js';
import {
    DEFAULT_GEMINI_IMAGE_MODEL,
    DEFAULT_VEO_VIDEO_MODEL,
    generateGeminiImage,
    generateVeoVideo,
    resolveGeminiImageModel,
    resolveVeoVideoModel
} from '../services/gemini.js';
import { generateHailuoSubjectVideo, generateHailuoVideo } from '../services/hailuo.js';
import { generateOpenAIImage, generateOpenAIVideo } from '../services/openai.js';
import { generateXAIVideo } from '../services/xai.js';
import { generateSeedanceVideo } from '../services/seedance.js';
import { resolveImageToBase64, saveBufferToFile } from '../utils/imageHelpers.js';
import { validateVideoRequest } from '../utils/videoRequestValidation.js';
import { assertVideoExecutionSupported, resolveVideoExecutionPlan } from '../utils/videoProviderRouting.js';

const router = express.Router();

// ============================================================================
// IMAGE GENERATION
// ============================================================================

router.post('/generate-image', async (req, res) => {
    try {
        const { nodeId, prompt, aspectRatio, resolution, imageBase64: rawImageBase64, imageModel, klingReferenceMode, klingFaceIntensity, klingSubjectIntensity } = req.body;
        const { GEMINI_API_KEY, KLING_ACCESS_KEY, KLING_SECRET_KEY, OPENAI_API_KEY, IMAGES_DIR } = req.app.locals;

        // Determine provider
        const isKlingModel = imageModel && imageModel.startsWith('kling-');
        const isOpenAIModel = imageModel && imageModel.startsWith('gpt-image-');

        let imageBuffer;
        let imageFormat = 'png';
        let executedImageModel = imageModel || DEFAULT_GEMINI_IMAGE_MODEL;

        if (isKlingModel) {
            // --- KLING AI IMAGE GENERATION ---
            if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
                return res.status(500).json({
                    error: "Kling API credentials not configured. Add KLING_ACCESS_KEY and KLING_SECRET_KEY to .env"
                });
            }

            console.log(`Using Kling AI model for image: ${imageModel}`);
            executedImageModel = imageModel;

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
                    prompt,
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
                    prompt,
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
                    prompt,
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

        } else if (isOpenAIModel) {
            // --- OPENAI GPT IMAGE GENERATION ---
            if (!OPENAI_API_KEY) {
                return res.status(500).json({
                    error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env"
                });
            }

            console.log(`Using OpenAI GPT Image model: ${imageModel}`);
            executedImageModel = imageModel;

            // Resolve images if provided
            let imageBase64Array = null;
            if (rawImageBase64) {
                const rawImages = Array.isArray(rawImageBase64) ? rawImageBase64 : [rawImageBase64];
                imageBase64Array = rawImages.map(img => resolveImageToBase64(img)).filter(Boolean);
            }

            imageBuffer = await generateOpenAIImage({
                prompt,
                imageBase64Array,
                aspectRatio,
                resolution,
                apiKey: OPENAI_API_KEY
            });

        } else {
            // --- GEMINI IMAGE GENERATION (Default) ---
            if (!GEMINI_API_KEY) {
                return res.status(500).json({ error: "Server missing API Key config" });
            }

            executedImageModel = resolveGeminiImageModel(imageModel);

            let imageBase64Array = null;
            if (rawImageBase64) {
                const rawImages = Array.isArray(rawImageBase64) ? rawImageBase64 : [rawImageBase64];
                imageBase64Array = rawImages.map(img => resolveImageToBase64(img)).filter(Boolean);
            }

            imageBuffer = await generateGeminiImage({
                prompt,
                imageBase64Array,
                aspectRatio,
                resolution,
                imageModel: executedImageModel,
                apiKey: GEMINI_API_KEY
            });
        }

        // Save to library - use unique filename to preserve previous generations
        const saved = saveBufferToFile(imageBuffer, IMAGES_DIR, 'img', imageFormat);

        // Determine metadata ID: use nodeId for recovery if available, otherwise use file ID
        const metadataId = nodeId || saved.id;

        // Save metadata (id must match the metadata filename for delete to work)
        const metadata = {
            id: metadataId,  // Must match the filename for delete API to find it
            filename: saved.filename,
            prompt: prompt,
            model: executedImageModel,
            requestedModel: imageModel || executedImageModel,
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
            videoModel
        } = req.body;
        const { GEMINI_API_KEY, KLING_ACCESS_KEY, KLING_SECRET_KEY, HAILUO_API_KEY, OPENAI_API_KEY, XAI_API_KEY, SEEDANCE_API_KEY, VIDEOS_DIR } = req.app.locals;

        // Resolve file URLs to base64
        const imageBase64 = resolveImageToBase64(rawImageBase64);
        const referenceImagesBase64 = Array.isArray(rawReferenceImagesBase64)
            ? rawReferenceImagesBase64.map((item) => resolveImageToBase64(item)).filter(Boolean)
            : undefined;
        const lastFrameBase64 = resolveImageToBase64(rawLastFrameBase64);
        const motionReferenceUrl = resolveImageToBase64(rawMotionReferenceUrl);

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

        // Determine provider
        const { provider: videoProvider, normalizedModel, executionMode, executionProvider } = resolveVideoExecutionPlan({
            modelId: videoModel,
            imageBase64,
            referenceImagesBase64,
            lastFrameBase64,
            motionReferenceUrl,
        });
        assertVideoExecutionSupported({
            provider: videoProvider,
            normalizedModel,
            executionMode,
        });

        console.log(
            `[Route] Video plan -> provider: ${videoProvider}, runtime: ${executionProvider}, mode: ${executionMode}, model: ${normalizedModel}`
        );

        let videoBuffer;
        let executedVideoModel = normalizedModel || DEFAULT_VEO_VIDEO_MODEL;

        let resultVideoUrl;

        if (executionProvider === 'fal' || executionProvider === 'fal-wan') {
            // --- FAL.AI BACKED VIDEO GENERATION ---
            executedVideoModel = normalizedModel;

            const { FAL_API_KEY } = req.app.locals;
            if (!FAL_API_KEY) {
                return res.status(500).json({
                    error: "FAL_API_KEY not configured. Add FAL_API_KEY to .env for Fal-backed video models."
                });
            }

            if (executionProvider === 'fal-wan') {
                console.log(`\n[Route] WAN image-to-video detected - routing to fal.ai`);
                console.log(`[Route] Model: ${normalizedModel}`);
                console.log(`[Route] Image: ${imageBase64 ? 'YES (' + Math.round(imageBase64.length / 1024) + ' KB)' : 'NO'}`);
                console.log(`[Route] Duration: ${duration || 5}s`);
                console.log(`[Route] Resolution: ${resolution || '1080p'}`);

                const {
                    generateFalWan25PreviewImageToVideo,
                    generateFalWanImageToVideo,
                    generateFalWanImageToVideoFlash,
                } = await import('../services/fal.js');

                const wanHandler =
                    normalizedModel === 'wan2.5-i2v-preview'
                        ? generateFalWan25PreviewImageToVideo
                        : normalizedModel === 'wan2.6-i2v-flash'
                        ? generateFalWanImageToVideoFlash
                        : generateFalWanImageToVideo;

                resultVideoUrl = await wanHandler({
                    prompt,
                    imageBase64,
                    duration: String(duration || 5),
                    resolution: resolution || '1080p',
                    apiKey: FAL_API_KEY,
                });
            } else if (executionMode === 'motion-control') {
                console.log(`\n[Route] Kling 2.6 Motion Control detected - routing to fal.ai`);
                console.log(`[Route] Motion Reference: ${motionReferenceUrl ? 'YES (' + Math.round(motionReferenceUrl.length / 1024) + ' KB)' : 'NO'}`);
                console.log(`[Route] Character Image: ${imageBase64 ? 'YES (' + Math.round(imageBase64.length / 1024) + ' KB)' : 'NO'}`);
                console.log(`[Route] Prompt: ${prompt ? prompt.substring(0, 50) + '...' : '(none)'}`);

                const { generateFalMotionControl } = await import('../services/fal.js');

                resultVideoUrl = await generateFalMotionControl({
                    prompt,
                    characterImageBase64: imageBase64,
                    motionVideoBase64: motionReferenceUrl,
                    characterOrientation: 'video',
                    apiKey: FAL_API_KEY
                });
            } else if (executionMode === 'standard-image-to-video' || executionMode === 'standard-text-to-video') {
                console.log(
                    `\n[Route] Kling 2.6 ${
                        executionMode === 'standard-text-to-video' ? 'Text-to-Video' : 'Image-to-Video'
                    } - routing to fal.ai`
                );
                console.log(`[Route] Image: ${imageBase64 ? 'YES (' + Math.round(imageBase64.length / 1024) + ' KB)' : 'NO'}`);
                console.log(`[Route] Duration: ${duration || 5}s`);
                console.log(`[Route] Generate Audio: ${req.body.generateAudio === true}`);

                const { generateFalImageToVideo, generateFalTextToVideo } = await import('../services/fal.js');

                if (imageBase64) {
                    resultVideoUrl = await generateFalImageToVideo({
                        prompt,
                        imageBase64,
                        duration: String(duration || 5),
                        aspectRatio: aspectRatio || '16:9',
                        generateAudio: req.body.generateAudio === true,
                        apiKey: FAL_API_KEY
                    });
                } else {
                    resultVideoUrl = await generateFalTextToVideo({
                        prompt,
                        duration: String(duration || 5),
                        aspectRatio: aspectRatio || '16:9',
                        generateAudio: req.body.generateAudio === true,
                        apiKey: FAL_API_KEY
                    });
                }
            } else {
                throw new Error(`Kling 2.6 当前后端尚未接通模式：${executionMode}`);
            }

            // Download from the result URL
            const videoResponse = await fetch(resultVideoUrl);
            if (!videoResponse.ok) {
                throw new Error('Failed to download generated video');
            }
            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        } else if (executionProvider === 'kling') {
            // --- STANDARD KLING VIDEO GENERATION ---
            if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
                return res.status(500).json({
                    error: "Kling API credentials not configured. Add KLING_ACCESS_KEY and KLING_SECRET_KEY to .env"
                });
            }

            console.log(`Using Kling AI model: ${normalizedModel}, duration: ${duration || 5}s, mode: ${executionMode}`);

            if (executionMode === 'standard-text-to-video') {
                resultVideoUrl = await generateKlingTextToVideo({
                    prompt,
                    modelId: normalizedModel,
                    aspectRatio,
                    duration: duration || 5,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY
                });
            } else if (executionMode === 'frame-to-frame') {
                resultVideoUrl = await generateKlingVideo({
                    prompt,
                    imageBase64,
                    lastFrameBase64,
                    modelId: normalizedModel,
                    aspectRatio,
                    duration: duration || 5,
                    motionReferenceUrl: undefined,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY
                });
            } else {
                resultVideoUrl = await generateKlingVideo({
                    prompt,
                    imageBase64,
                    lastFrameBase64,
                    modelId: normalizedModel,
                    aspectRatio,
                    duration: duration || 5,
                    motionReferenceUrl,
                    accessKey: KLING_ACCESS_KEY,
                    secretKey: KLING_SECRET_KEY
                });
            }

            const videoResponse = await fetch(resultVideoUrl);
            if (!videoResponse.ok) {
                throw new Error('Failed to download generated video');
            }
            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        } else if (executionProvider === 'hailuo') {
            // --- HAILUO AI VIDEO GENERATION ---
            if (!HAILUO_API_KEY) {
                return res.status(500).json({
                    error: "Hailuo API key not configured. Add HAILUO_API_KEY to .env"
                });
            }

            const hailuoModelId = normalizedModel;
            executedVideoModel = hailuoModelId;
            console.log(`Using Hailuo AI model: ${hailuoModelId}, duration: ${duration || 6}s`);

            const hailuoVideoUrl =
                executionMode === 'standard-reference-images'
                    ? await generateHailuoSubjectVideo({
                        prompt,
                        subjectImagesBase64: referenceImagesBase64,
                        aspectRatio,
                        resolution,
                        duration: duration || 6,
                        apiKey: HAILUO_API_KEY
                    })
                    : await generateHailuoVideo({
                        prompt,
                        imageBase64,
                        lastFrameBase64,
                        modelId: hailuoModelId,
                        aspectRatio,
                        resolution,
                        duration: duration || 6,
                        apiKey: HAILUO_API_KEY
                    });

            // Download from Hailuo's URL
            const videoResponse = await fetch(hailuoVideoUrl);
            if (!videoResponse.ok) {
                throw new Error('Failed to download video from Hailuo');
            }
            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        } else if (executionProvider === 'openai-video') {
            if (!OPENAI_API_KEY) {
                return res.status(500).json({
                    error: "OpenAI API key not configured. Add OPENAI_API_KEY to .env"
                });
            }

            executedVideoModel = normalizedModel;
            videoBuffer = await generateOpenAIVideo({
                prompt,
                imageBase64,
                aspectRatio,
                duration: duration || 4,
                resolution: resolution || '720p',
                videoModel: normalizedModel,
                apiKey: OPENAI_API_KEY
            });
        } else if (executionProvider === 'xai-video') {
            if (!XAI_API_KEY) {
                return res.status(500).json({
                    error: "XAI_API_KEY not configured. Add XAI_API_KEY to .env"
                });
            }

            executedVideoModel = normalizedModel;
            console.log(
                `Using xAI video model: ${normalizedModel}, mode: ${executionMode}, singleImage: ${Boolean(imageBase64)}, referenceImages: ${referenceImagesBase64?.length || 0}`
            );
            videoBuffer = await generateXAIVideo({
                prompt,
                imageBase64,
                referenceImagesBase64,
                aspectRatio: aspectRatio || '16:9',
                duration: duration || 8,
                resolution: resolution || '720p',
                videoModel: normalizedModel,
                executionMode,
                apiKey: XAI_API_KEY
            });
        } else if (executionProvider === 'seedance') {
            if (!SEEDANCE_API_KEY) {
                return res.status(500).json({
                    error: "SEEDANCE_API_KEY not configured. Add SEEDANCE_API_KEY to .env"
                });
            }

            executedVideoModel = normalizedModel;
            console.log(`Using Seedance video model: ${normalizedModel}, mode: ${executionMode}`);
            videoBuffer = await generateSeedanceVideo({
                prompt,
                imageBase64,
                lastFrameBase64,
                aspectRatio: aspectRatio || '16:9',
                duration: duration || 5,
                resolution: resolution || '720p',
                videoModel: normalizedModel,
                generateAudio: req.body.generateAudio === true,
                apiKey: SEEDANCE_API_KEY
            });
        } else if (executionProvider === 'veo') {
            // --- VEO VIDEO GENERATION (Default) ---
            if (!GEMINI_API_KEY) {
                return res.status(500).json({ error: "Server missing API Key config" });
            }

            executedVideoModel = resolveVeoVideoModel(videoModel);

            const shouldGenerateVeoAudio = req.body.generateAudio === true;
            console.log(`Using Veo model: ${executedVideoModel}, duration: ${duration || 8}s, generateAudio: ${shouldGenerateVeoAudio}`);

            videoBuffer = await generateVeoVideo({
                prompt,
                imageBase64,
                lastFrameBase64,
                aspectRatio,
                resolution,
                duration: duration || 8,
                videoModel: executedVideoModel,
                generateAudio: shouldGenerateVeoAudio,
                apiKey: GEMINI_API_KEY
            });

        } else {
            throw new Error(`Unsupported video runtime provider: ${executionProvider}`);
        }

        // Save to library - use unique filename to preserve previous generations
        const saved = saveBufferToFile(videoBuffer, VIDEOS_DIR, 'vid', 'mp4');

        // Determine metadata ID: use nodeId for recovery if available, otherwise use file ID
        const metadataId = nodeId || saved.id;

        // Save metadata (id must match the metadata filename for delete to work)
        const metadata = {
            id: metadataId,  // Must match the filename for delete API to find it
            filename: saved.filename,
            prompt: prompt,
            model: executedVideoModel,
            requestedModel: videoModel || executedVideoModel,
            aspectRatio: aspectRatio || 'Auto',
            resolution: resolution || 'Auto',
            createdAt: new Date().toISOString(),
            type: 'videos'
        };
        fs.writeFileSync(path.join(VIDEOS_DIR, `${metadataId}.json`), JSON.stringify(metadata, null, 2));

        console.log(`Video saved: ${saved.url} (model: ${executedVideoModel})`);
        return res.json({ resultUrl: saved.url });

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
            return res.json({ status: 'success', resultUrl: `/library/images/${meta.filename}`, type: 'image', createdAt: meta.createdAt });
        }

        // Check videos metadata
        const videoMetaPath = path.join(VIDEOS_DIR, `${nodeId}.json`);
        if (fs.existsSync(videoMetaPath)) {
            const meta = JSON.parse(fs.readFileSync(videoMetaPath, 'utf8'));
            return res.json({ status: 'success', resultUrl: `/library/videos/${meta.filename}`, type: 'video', createdAt: meta.createdAt });
        }

        res.json({ status: 'pending' });
    } catch (error) {
        console.error("Status Check Error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-audio', async (req, res) => {
    try {
        const { nodeId, prompt, audioModel } = req.body;

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ error: '语音生成需要输入文本内容。' });
        }

        return res.status(501).json({
            error: `语音模型 ${audioModel || 'default'} 当前后端尚未接通 provider，请先完成语音 provider 接入。`,
            nodeId: nodeId || null,
        });
    } catch (error) {
        console.error('Server Audio Gen Error:', error);
        return res.status(500).json({ error: error.message || 'Audio generation failed' });
    }
});

export default router;
