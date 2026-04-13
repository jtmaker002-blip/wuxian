/**
 * useGeneration.ts
 * 
 * Custom hook for handling AI content generation (images and videos).
 * Manages generation state, API calls, and error handling.
 */

import { NodeData, NodeType, NodeStatus } from '../types';
import { generateAudio, generateImage, generateVideo } from '../services/generationService';
import { generateLocalImage } from '../services/localModelService';
import { extractVideoLastFrame } from '../utils/videoHelpers';
import { useStoredOpenAiTeachProviderConfig } from '../shared/provider/openaiteach-config';
import {
    DEFAULT_REGISTRY_IMAGE_ID,
    canonicalizeImageModelId,
    canonicalizeVideoModelId,
    mapRegistryImageIdToServerImageId,
    mapRegistryVideoIdToServerVideoId,
} from '../config/registryModelBridge';
import { getAllVoiceCapabilities, getVideoCapability, getVoiceCapability } from '../config/modelCapabilities';
import { getImageExecutionSupport, getVideoExecutionSupportForContext, getVoiceExecutionSupport } from '../config/modelExecutionSupport';
import { resolveStandardVideoCapabilityState, sanitizeVideoNodeState } from '../utils/videoCapabilityState';
import { getVideoModeAvailabilityState, resolveEffectiveVideoMode } from '../utils/videoModeResolution';
import {
    getLegacyVideoModeForPanelMode,
    getVideoPanelInputCounts,
    getVideoPanelModeValidation,
    resolveVideoPanelModeKey,
} from '../utils/videoPanelModes';

interface UseGenerationProps {
    nodes: NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
}

export const useGeneration = ({ nodes, updateNode }: UseGenerationProps) => {
    const providerConfig = useStoredOpenAiTeachProviderConfig();

    // ============================================================================
    // HELPERS
    // ============================================================================

    /**
     * Convert pixel dimensions to closest standard aspect ratio
     */
    const getClosestAspectRatio = (width: number, height: number): string => {
        const ratio = width / height;
        const standardRatios = [
            { label: '1:1', value: 1 },
            { label: '16:9', value: 16 / 9 },
            { label: '9:16', value: 9 / 16 },
            { label: '4:3', value: 4 / 3 },
            { label: '3:4', value: 3 / 4 },
            { label: '3:2', value: 3 / 2 },
            { label: '2:3', value: 2 / 3 },
            { label: '5:4', value: 5 / 4 },
            { label: '4:5', value: 4 / 5 },
            { label: '21:9', value: 21 / 9 }
        ];

        let closest = standardRatios[0];
        let minDiff = Math.abs(ratio - closest.value);

        for (const r of standardRatios) {
            const diff = Math.abs(ratio - r.value);
            if (diff < minDiff) {
                minDiff = diff;
                closest = r;
            }
        }

        return closest.label;
    };

    /**
     * Detect the actual aspect ratio of an image
     * @param imageUrl - URL or base64 of the image
     * @returns Promise with resultAspectRatio (exact) and aspectRatio (closest standard)
     */
    const getImageAspectRatio = (imageUrl: string): Promise<{ resultAspectRatio: string; aspectRatio: string }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const resultAspectRatio = `${img.naturalWidth}/${img.naturalHeight}`;
                const aspectRatio = getClosestAspectRatio(img.naturalWidth, img.naturalHeight);
                resolve({ resultAspectRatio, aspectRatio });
            };
            img.onerror = () => {
                resolve({ resultAspectRatio: '16/9', aspectRatio: '16:9' });
            };
            img.src = imageUrl;
        });
    };

    // ============================================================================
    // GENERATION HANDLER
    // ============================================================================

    /**
     * Handles content generation for a node
     * Supports image and video generation with parent node chaining
     * 
     * @param id - ID of the node to generate content for
     */
    const handleGenerate = async (id: string) => {
        const node = nodes.find(n => n.id === id);
        if (!node) return;
        const hasHostedToken = Boolean(providerConfig.providerApiKey);

        // Get prompts from connected TEXT nodes (if any)
        const getTextNodePrompts = (): string[] => {
            if (!node.parentIds) return [];
            return node.parentIds
                .map(pid => nodes.find(n => n.id === pid))
                .filter(n => n?.type === NodeType.TEXT && n.prompt)
                .map(n => n!.prompt);
        };

        // Combine prompts: TEXT node prompts + node's own prompt
        const textNodePrompts = getTextNodePrompts();
        const combinedPrompt = [...textNodePrompts, node.prompt].filter(Boolean).join('\n\n');

        const canonicalVideoModel =
            node.type === NodeType.VIDEO
                ? (node.videoModel ? canonicalizeVideoModelId(node.videoModel) : undefined)
                : node.videoModel;
        const videoCapability = node.type === NodeType.VIDEO ? getVideoCapability(canonicalVideoModel) : undefined;
        const hasExplicitVideoPanelMode = node.type === NodeType.VIDEO && Boolean(node.videoPanelMode);
        const requestedVideoPanelMode =
            node.type === NodeType.VIDEO
                ? resolveVideoPanelModeKey(node)
                : 'text2video';
        const panelLegacyVideoMode =
            node.type === NodeType.VIDEO
                ? getLegacyVideoModeForPanelMode(requestedVideoPanelMode)
                : node.videoMode;
        const normalizedVideoNode =
            node.type === NodeType.VIDEO && videoCapability
                ? {
                    ...node,
                    videoModel: canonicalVideoModel,
                    videoPanelMode: requestedVideoPanelMode,
                    ...sanitizeVideoNodeState(
                        { ...node, videoModel: canonicalVideoModel, videoMode: panelLegacyVideoMode },
                        videoCapability
                    ),
                }
                : node;
        const connectedParentNodes =
            normalizedVideoNode.type === NodeType.VIDEO
                ? (normalizedVideoNode.parentIds ?? [])
                    .map((pid) => nodes.find((candidate) => candidate.id === pid))
                    .filter(Boolean)
                : [];
        const connectedParentPreviews =
            normalizedVideoNode.type === NodeType.VIDEO
                ? connectedParentNodes.map((candidate) => ({ type: candidate?.type }))
                : [];
        const connectedFrameSourceNodes =
            normalizedVideoNode.type === NodeType.VIDEO
                ? connectedParentNodes.filter(
                    (candidate): candidate is NodeData =>
                        Boolean(candidate) &&
                        candidate.type === NodeType.IMAGE &&
                        Boolean(candidate.resultUrl)
                )
                : [];
        const connectedVideoSourceNodes =
            normalizedVideoNode.type === NodeType.VIDEO
                ? connectedParentNodes.filter(
                    (candidate): candidate is NodeData =>
                        Boolean(candidate) &&
                        candidate.type === NodeType.VIDEO &&
                        Boolean(candidate.resultUrl)
                )
                : [];
        const videoPanelInputCounts =
            normalizedVideoNode.type === NodeType.VIDEO
                ? getVideoPanelInputCounts(
                    connectedParentNodes
                        .filter(Boolean)
                        .map((candidate) => ({
                            id: candidate!.id,
                            type: candidate!.type,
                            url: candidate!.resultUrl,
                        }))
                )
                : { imageCount: 0, videoCount: 0, audioCount: 0 };
        const canUseMixedMotionReference =
            requestedVideoPanelMode === 'mixed2video' &&
            connectedFrameSourceNodes.length > 0 &&
            connectedVideoSourceNodes.length > 0 &&
            Boolean(videoCapability?.modes.motionControl.enabled && videoCapability.modes.motionControl.supportsMotionReference);
        const activeVideoMode =
            normalizedVideoNode.type === NodeType.VIDEO
                ? !hasExplicitVideoPanelMode && normalizedVideoNode.videoMode
                    ? normalizedVideoNode.videoMode
                    : canUseMixedMotionReference
                    ? 'motion-control'
                    : resolveEffectiveVideoMode(
                        { ...normalizedVideoNode, videoMode: panelLegacyVideoMode },
                        connectedParentPreviews
                    )
                : 'standard';
        const executionVideoNode =
            normalizedVideoNode.type === NodeType.VIDEO && videoCapability
                ? {
                    ...normalizedVideoNode,
                    videoMode: activeVideoMode,
                    ...sanitizeVideoNodeState({ ...normalizedVideoNode, videoMode: activeVideoMode }, videoCapability),
                }
                : normalizedVideoNode;
        const selectedVideoModeAvailability =
            executionVideoNode.type === NodeType.VIDEO
                ? getVideoModeAvailabilityState(executionVideoNode, videoCapability)
                : undefined;
        const standardVideoSources =
            executionVideoNode.type === NodeType.VIDEO
                ? connectedParentNodes.flatMap((candidate) => {
                    if (!candidate) return [];
                    if (hasExplicitVideoPanelMode && requestedVideoPanelMode === 'text2video') return [];
                    if (candidate.type === NodeType.IMAGE && candidate.resultUrl) {
                        if (
                            hasExplicitVideoPanelMode &&
                            (requestedVideoPanelMode === 'video2video' ||
                                requestedVideoPanelMode === 'videoEdit2video' ||
                                requestedVideoPanelMode === 'audio2video')
                        ) {
                            return [];
                        }
                        return [{
                            nodeId: candidate.id,
                            type: 'image' as const,
                            url: candidate.resultUrl,
                            previewUrl: candidate.resultUrl,
                        }];
                    }

                    if (
                        candidate.type === NodeType.VIDEO &&
                        (
                            !hasExplicitVideoPanelMode ||
                            requestedVideoPanelMode === 'mixed2video' ||
                            requestedVideoPanelMode === 'video2video' ||
                            requestedVideoPanelMode === 'videoEdit2video'
                        ) &&
                        candidate.lastFrame &&
                        !canUseMixedMotionReference
                    ) {
                        return [{
                            nodeId: candidate.id,
                            type: 'image' as const,
                            url: candidate.lastFrame,
                            previewUrl: candidate.lastFrame,
                        }];
                    }

                    return [];
                })
                : [];
        const hasLegacyFrameFallback = connectedFrameSourceNodes.length >= 2;
        const resolvedExplicitFrameInputs =
            normalizedVideoNode.type === NodeType.VIDEO
                ? (() => {
                    const frameInputs = normalizedVideoNode.frameInputs ?? [];
                    if (frameInputs.length < 2) return undefined;

                    const startFrameInput = frameInputs.find((input) => input.order === 'start');
                    const endFrameInput = frameInputs.find((input) => input.order === 'end');
                    if (!startFrameInput || !endFrameInput) return undefined;

                    const startNode = nodes.find((candidate) => candidate.id === startFrameInput.nodeId);
                    const endNode = nodes.find((candidate) => candidate.id === endFrameInput.nodeId);

                    return {
                        startUrl: startNode?.type === NodeType.IMAGE ? startNode.resultUrl : undefined,
                        endUrl: endNode?.type === NodeType.IMAGE ? endNode.resultUrl : undefined,
                    };
                })()
                : undefined;

        // Check if prompt is required
        const isVideoFrameDriven =
            executionVideoNode.type === NodeType.VIDEO &&
            activeVideoMode === 'frame-to-frame' &&
            Boolean(
                (executionVideoNode.frameInputs && executionVideoNode.frameInputs.length >= 2) ||
                hasLegacyFrameFallback
            );
        const isImageToolDriven =
            (node.type === NodeType.IMAGE || node.type === NodeType.IMAGE_EDITOR) &&
            Boolean(node.focusSelection || node.imageToolMode || node.imageLightingSettings);

        if (!combinedPrompt && !isVideoFrameDriven && !isImageToolDriven) return;

        if (node.type === NodeType.LOCAL_VIDEO_MODEL) {
            updateNode(id, {
                status: NodeStatus.ERROR,
                errorMessage: '本地视频模型生成功能链尚未接通，请先使用普通视频节点。',
            });
            return;
        }

        if (node.type === NodeType.VIDEO && !node.videoModel) {
            updateNode(id, {
                status: NodeStatus.ERROR,
                errorMessage: '请先为当前视频节点选择模型，再开始生成。',
            });
            return;
        }

        if (node.type === NodeType.VIDEO && !videoCapability) {
            updateNode(id, {
                status: NodeStatus.ERROR,
                errorMessage: node.videoModel
                    ? '当前视频模型在后端尚未接通真实执行链，请切换到已接通的可执行视频模型。'
                    : '当前没有可用的视频模型，请先在设置里启用支持的模型。',
            });
            return;
        }

        if (
            executionVideoNode.type === NodeType.VIDEO &&
            activeVideoMode !== 'standard' &&
            !selectedVideoModeAvailability?.selectedModeEnabled
        ) {
            updateNode(id, {
                status: NodeStatus.ERROR,
                errorMessage: activeVideoMode === 'frame-to-frame'
                    ? '当前视频模型尚未接通首尾帧模式，请切换到支持该模式的模型。'
                    : '当前视频模型尚未接通运动参考模式，请切换到支持该模式的模型。',
            });
            return;
        }

        updateNode(id, { status: NodeStatus.LOADING, generationStartTime: Date.now() });

        try {
            if (node.type === NodeType.IMAGE || node.type === NodeType.IMAGE_EDITOR) {
                const canonicalImageModel = canonicalizeImageModelId(node.imageModel) ?? DEFAULT_REGISTRY_IMAGE_ID;
                const imageExecutionSupport = getImageExecutionSupport(canonicalImageModel);
                if (canonicalImageModel !== node.imageModel) {
                    updateNode(id, { imageModel: canonicalImageModel });
                }

                if (imageExecutionSupport?.mode === 'hosted-token' && !hasHostedToken) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: '当前图片模型需要先在设置里绑定 OpenAiTeach Token 后才能生成。',
                    });
                    return;
                }

                // Collect ALL parent images for multi-input generation
                const imageBase64s: string[] = [];

                // Get images from all direct parents (excluding TEXT nodes)
                if (node.parentIds && node.parentIds.length > 0) {
                    for (const parentId of node.parentIds) {
                        let currentId: string | undefined = parentId;

                        // Traverse up the chain to find an image source (skip TEXT nodes)
                        while (currentId && imageBase64s.length < 14) { // Gemini 3 Pro limit
                            const parent = nodes.find(n => n.id === currentId);
                            // Skip TEXT nodes - they provide prompts, not images
                            if (parent?.type === NodeType.TEXT) {
                                break;
                            }
                            if (parent?.resultUrl) {
                                imageBase64s.push(parent.resultUrl);
                                break; // Found image for this parent chain
                            } else {
                                // Continue up this chain
                                currentId = parent?.parentIds?.[0];
                            }
                        }
                    }
                }

                // Add character reference URLs from storyboard nodes (for maintaining character consistency)
                if (node.characterReferenceUrls && node.characterReferenceUrls.length > 0) {
                    for (const charUrl of node.characterReferenceUrls) {
                        if (imageBase64s.length < 14) { // Respect Gemini's limit
                            imageBase64s.push(charUrl);
                        }
                    }
                }

                // Generate image with all parent images and character references
                const rawResultUrl = await generateImage({
                    prompt: combinedPrompt,
                    aspectRatio: node.aspectRatio,
                    resolution: node.resolution,
                    imageBase64: imageBase64s.length > 0 ? imageBase64s : undefined,
                    imageModel: mapRegistryImageIdToServerImageId(canonicalImageModel),
                    nodeId: id,
                    // Kling V1.5 reference settings
                    klingReferenceMode: node.klingReferenceMode,
                    klingFaceIntensity: node.klingFaceIntensity,
                    klingSubjectIntensity: node.klingSubjectIntensity,
                    focusSelection: node.focusSelection,
                    imageAnnotations: node.imageAnnotations,
                    imageToolMode: node.imageToolMode ?? undefined,
                    imageToolAction:
                        node.imageToolMode === 'enhance' ||
                        node.imageToolMode === 'grid' ||
                        node.imageToolMode === 'split' ||
                        node.imageToolMode === 'style'
                            ? node.imageToolAction
                            : undefined,
                    imageCameraSettings: node.imageCameraSettings,
                    imageLightingSettings:
                        node.imageToolMode === 'lighting'
                            ? node.imageLightingSettings
                            : undefined,
                });

                // Add cache-busting parameter to force browser to fetch new image
                // (Backend uses nodeId as filename, so URL is the same for regenerated images)
                const resultUrl = `${rawResultUrl}?t=${Date.now()}`;

                // Detect actual image dimensions (for display purposes only)
                const { resultAspectRatio } = await getImageAspectRatio(resultUrl);

                // Keep user's selected aspectRatio - don't overwrite it with detected ratio
                updateNode(id, {
                    status: NodeStatus.SUCCESS,
                    resultUrl,
                    resultAspectRatio,
                    // Note: aspectRatio is intentionally NOT updated to preserve user's selection
                    errorMessage: undefined
                });


            } else if (node.type === NodeType.LOCAL_IMAGE_MODEL) {
                // --- LOCAL MODEL GENERATION ---
                // Check if model is selected
                if (!node.localModelId && !node.localModelPath) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: 'No local model selected. Please select a model first.'
                    });
                    return;
                }

                // Get parent images if any
                const imageBase64s: string[] = [];
                if (node.parentIds && node.parentIds.length > 0) {
                    for (const parentId of node.parentIds) {
                        const parent = nodes.find(n => n.id === parentId);
                        if (parent?.type !== NodeType.TEXT && parent?.resultUrl) {
                            imageBase64s.push(parent.resultUrl);
                        }
                    }
                }

                // Call local generation API
                const result = await generateLocalImage({
                    modelId: node.localModelId,
                    modelPath: node.localModelPath,
                    prompt: combinedPrompt,
                    aspectRatio: node.aspectRatio,
                    resolution: node.resolution || '512'
                });

                if (result.success && result.resultUrl) {
                    // Add cache-busting parameter
                    const resultUrl = `${result.resultUrl}?t=${Date.now()}`;

                    // Detect actual image dimensions
                    const { resultAspectRatio } = await getImageAspectRatio(resultUrl);

                    updateNode(id, {
                        status: NodeStatus.SUCCESS,
                        resultUrl,
                        resultAspectRatio,
                        errorMessage: undefined
                    });
                } else {
                    throw new Error(result.error || 'Local generation failed');
                }

            } else if (node.type === NodeType.VIDEO) {
                if (
                    activeVideoMode === 'frame-to-frame' &&
                    !(
                        (resolvedExplicitFrameInputs?.startUrl && resolvedExplicitFrameInputs?.endUrl) ||
                        hasLegacyFrameFallback
                    )
                ) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: '首尾帧模式需要两张图片输入后才能生成。',
                    });
                    return;
                }

                if (activeVideoMode === 'motion-control') {
                    const hasVideoReference = connectedVideoSourceNodes.length > 0;
                    const hasCharacterImage = connectedFrameSourceNodes.length > 0;
                    if (!hasVideoReference || !hasCharacterImage) {
                        updateNode(id, {
                            status: NodeStatus.ERROR,
                            errorMessage: '运动参考模式需要同时连接一个视频参考和一张角色图片。',
                        });
                        return;
                    }
                }

                // Get first parent image for video generation (start frame)
                let imageBase64: string | undefined;
                let lastFrameBase64: string | undefined;

                const frameImageParentIds = connectedFrameSourceNodes.map((parent) => parent.id);
                const panelValidation = hasExplicitVideoPanelMode
                    ? getVideoPanelModeValidation(requestedVideoPanelMode, videoPanelInputCounts)
                    : { isValid: true };
                if (!panelValidation.isValid) {
                    const panelReason = 'reason' in panelValidation ? panelValidation.reason : undefined;
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: panelReason ?? '当前视频模式输入条件不满足。',
                    });
                    return;
                }

                const standardVideoCapabilityState =
                    activeVideoMode === 'standard'
                        ? resolveStandardVideoCapabilityState(videoCapability, {
                            sources: standardVideoSources,
                        })
                        : undefined;

                // Motion Reference logic (Kling 2.6)
                let motionReferenceUrl: string | undefined;
                let isMotionControl = false;
                if (activeVideoMode === 'motion-control') {
                    // Find a parent video node that has a result
                    const videoParent = connectedVideoSourceNodes[0];

                    if (videoParent) {
                        motionReferenceUrl = videoParent.resultUrl;
                        isMotionControl = true;
                    }
                }

                // Only evaluate as frame-to-frame if NOT in motion control mode
                const isFrameToFrame = !isMotionControl && activeVideoMode === 'frame-to-frame';
                const referenceImagesBase64 = standardVideoCapabilityState?.referenceImageUrls;
                const standardPrimaryInputBase64 = standardVideoCapabilityState?.primaryInputUrl;

                if (activeVideoMode === 'standard' && standardVideoCapabilityState?.isBlocked) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: standardVideoCapabilityState.blockedReason,
                    });
                    return;
                }

                const videoExecutionSupport = getVideoExecutionSupportForContext(executionVideoNode.videoModel, {
                    videoMode: activeVideoMode,
                    usesReferenceImages: Boolean(standardVideoCapabilityState?.usesReferenceImages),
                    hasHostedToken,
                });

                if (videoExecutionSupport?.mode === 'hosted-token' && !hasHostedToken) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: '当前视频模式需要先在设置里绑定 OpenAiTeach Token 后才能生成。',
                    });
                    return;
                }

                if (isFrameToFrame && frameImageParentIds.length >= 2) {
                    // Get start and end frames from frameInputs (if user reordered) or default order
                    const parent1 = nodes.find(n => n.id === frameImageParentIds[0]);
                    const parent2 = nodes.find(n => n.id === frameImageParentIds[1]);

                    // Check if user has explicitly set frame order
                    if (normalizedVideoNode.frameInputs && normalizedVideoNode.frameInputs.length >= 2) {
                        imageBase64 = resolvedExplicitFrameInputs?.startUrl;
                        lastFrameBase64 = resolvedExplicitFrameInputs?.endUrl;
                    } else {
                        // Default: first parent = start, second parent = end
                        if (parent1?.resultUrl) imageBase64 = parent1.resultUrl;
                        if (parent2?.resultUrl) lastFrameBase64 = parent2.resultUrl;
                    }
                } else if (isMotionControl) {
                    // For Motion Control, look specifically for an IMAGE parent as character reference
                    const characterParent = connectedFrameSourceNodes[0];

                    if (characterParent?.resultUrl) {
                        imageBase64 = characterParent.resultUrl;
                    }
                } else if (!referenceImagesBase64) {
                    imageBase64 = standardPrimaryInputBase64;
                }

                // Generate video
                const mappedVideoModel = mapRegistryVideoIdToServerVideoId(executionVideoNode.videoModel);
                const requestVideoModel =
                    videoExecutionSupport?.mode === 'hosted-token'
                        ? executionVideoNode.videoModel
                        : mappedVideoModel;
                if (!requestVideoModel) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: '当前视频模型在后端尚未接通真实执行链，请切换到已接通的可执行视频模型。',
                    });
                    return;
                }

                const videoGenerationResult = await generateVideo({
                    prompt: combinedPrompt,
                    imageBase64,
                    referenceImagesBase64,
                    lastFrameBase64,
                    aspectRatio: executionVideoNode.aspectRatio,
                    resolution: executionVideoNode.resolution,
                    duration: executionVideoNode.videoDuration,
                    videoModel: requestVideoModel,
                    motionReferenceUrl,
                    generateAudio: executionVideoNode.generateAudio === true,
                    nodeId: id
                });
                const rawResultUrl = videoGenerationResult.resultUrl;

                // Add cache-busting parameter to force browser to fetch new video
                // (Backend uses nodeId as filename, so URL is the same for regenerated videos)
                const resultUrl = `${rawResultUrl}?t=${Date.now()}`;

                // Extract last frame for chaining
                const lastFrame = await extractVideoLastFrame(resultUrl);

                // Detect video aspect ratio
                let resultAspectRatio: string | undefined;
                let aspectRatio: string | undefined;
                try {
                    const video = document.createElement('video');
                    await new Promise<void>((resolve) => {
                        video.onloadedmetadata = () => {
                            resultAspectRatio = `${video.videoWidth}/${video.videoHeight}`;
                            aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight);
                            resolve();
                        };
                        video.onerror = () => resolve();
                        video.src = resultUrl;
                    });
                } catch (e) {
                    // Ignore errors, use undefined aspect ratio
                }

                updateNode(id, {
                    status: NodeStatus.SUCCESS,
                    resultUrl,
                    resultAspectRatio,
                    aspectRatio,
                    lastFrame,
                    requestedVideoModel: videoGenerationResult.requestedModel,
                    executedVideoModel: videoGenerationResult.executedModel,
                    executedVideoMode: videoGenerationResult.executedMode,
                    executionProvider: videoGenerationResult.executionProvider,
                    errorMessage: undefined // Clear any previous error
                });

            } else if (node.type === NodeType.AUDIO) {
                const availableVoiceCapabilities = getAllVoiceCapabilities();
                const selectedAudioModel = node.audioModel || node.model;
                if (!selectedAudioModel) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: '请先为当前语音节点选择模型，再开始生成。',
                    });
                    return;
                }
                const voiceCapability = getVoiceCapability(selectedAudioModel);
                const voiceExecutionSupport = getVoiceExecutionSupport(selectedAudioModel);

                if (!voiceCapability) {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: '当前语音模型在前端能力表中不存在，请先切换到可用语音模型。',
                    });
                    return;
                }

                if (voiceExecutionSupport?.mode === 'unimplemented') {
                    updateNode(id, {
                        status: NodeStatus.ERROR,
                        errorMessage: voiceExecutionSupport.note,
                    });
                    return;
                }

                const rawResultUrl = await generateAudio({
                    prompt: combinedPrompt,
                    audioModel: voiceCapability.serverModelId,
                    nodeId: id,
                });

                const resultUrl = `${rawResultUrl}${rawResultUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

                updateNode(id, {
                    status: NodeStatus.SUCCESS,
                    resultUrl,
                    errorMessage: undefined,
                });


            }
        } catch (error: any) {
            // Handle errors
            const msg = error.toString().toLowerCase();
            let errorMessage = error.message || 'Generation failed';

            if (msg.includes('permission_denied') || msg.includes('403')) {
                errorMessage = '权限不足，请检查当前账号额度、模型权限或 API Key 配置。';
            } else if (msg.includes('unable to process input image') || msg.includes('invalid_argument')) {
                errorMessage = '输入图片与当前视频模型不兼容。请优先使用 JPEG，比例保持 16:9 或 9:16，或者先切回无参考图生成。';
            }

            updateNode(id, { status: NodeStatus.ERROR, errorMessage });
            console.error('Generation failed:', error);
        }
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        handleGenerate
    };
};
