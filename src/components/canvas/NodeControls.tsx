/**
 * NodeControls.tsx
 * 
 * Control panel for canvas nodes.
 * Handles prompt input, model selection, size/ratio settings, and generation button.
 * For Video nodes: includes Advanced Settings for frame-to-frame mode.
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import { Sparkles, Banana, Settings2, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, Film, Clock, Expand, Shrink, Monitor, Crop, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeData, NodeStatus, NodeType } from '../../types';
import { OpenAIIcon, GoogleIcon, KlingIcon, HailuoIcon } from '../icons/BrandIcons';
import { ChangeAnglePanel } from './ChangeAnglePanel';
import { LocalModel, getLocalModels } from '../../services/localModelService';
import { useEnabledModelIdsFromStorage } from '../../hooks/useApiSettings';
import {
    getRegistryVideoModels,
    REGISTRY_IMAGE_MODELS,
    type CanvasVideoModel,
} from '../../config/registryCanvasModels';
import { MODEL_REGISTRY } from '../../config/modelRegistry';
import {
    getNodeTypeOptionLabels,
    isSwitchableNodeType,
    type SwitchableNodeType,
} from '../../config/nodeTypeRegistry';
import {
    canonicalizeVideoModelId,
    canonicalizeImageModelId,
    DEFAULT_REGISTRY_VIDEO_ID,
    DEFAULT_REGISTRY_IMAGE_ID,
} from '../../config/registryModelBridge';
import { getAllVoiceCapabilities, getVideoCapability } from '../../config/modelCapabilities';
import { getEnabledVideoModes, resolveStandardVideoExecutionState, sanitizeVideoNodeState } from '../../utils/videoCapabilityState';
import { getVideoModeAvailabilityState, resolveEffectiveVideoMode } from '../../utils/videoModeResolution';

const TIKTOK_VIDEO_MODEL_PLACEHOLDER: CanvasVideoModel = {
    id: 'tiktok-import',
    name: 'TikTok Import',
    provider: 'other',
    supportsTextToVideo: true,
    supportsImageToVideo: false,
    supportsMultiImage: false,
    durations: [5],
    resolutions: ['Auto'],
    aspectRatios: ['9:16', '16:9'],
};

interface NodeControlsProps {
    data: NodeData;
    inputUrl?: string;
    isLoading: boolean;
    isSuccess: boolean;
    connectedImageNodes?: { id: string; url: string; type?: NodeType }[]; // Connected parent nodes
    onUpdate: (id: string, updates: Partial<NodeData>) => void;
    onSwitchType?: (id: string, nextType: SwitchableNodeType) => void;
    onGenerate: (id: string) => void;
    onChangeAngleGenerate?: (nodeId: string) => void;
    onSelect: (id: string) => void;
    zoom: number;
    canvasTheme?: 'dark' | 'light';
}

const IMAGE_RATIOS = [
    "Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9"
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build a prompt that includes angle transformation instructions
 * for generating the image from a different viewing angle
 */
function buildAnglePrompt(
    basePrompt: string,
    settings: { rotation: number; tilt: number; scale: number; wideAngle: boolean }
): string {
    const parts: string[] = [];

    // Base instruction
    parts.push('Generate this same image from a different camera angle.');

    // Rotation (horizontal)
    if (settings.rotation !== 0) {
        const direction = settings.rotation > 0 ? 'right' : 'left';
        parts.push(`The camera has rotated ${Math.abs(settings.rotation)}° to the ${direction}.`);
    }

    // Tilt (vertical)
    if (settings.tilt !== 0) {
        const direction = settings.tilt > 0 ? 'upward' : 'downward';
        parts.push(`The camera has tilted ${Math.abs(settings.tilt)}° ${direction}.`);
    }

    // Scale
    if (settings.scale !== 0) {
        if (settings.scale > 50) {
            parts.push('The camera is positioned closer to the subject.');
        } else if (settings.scale < 50 && settings.scale > 0) {
            parts.push('The camera is positioned slightly closer.');
        }
    }

    // Wide-angle lens
    if (settings.wideAngle) {
        parts.push('Use a wide-angle lens perspective with visible distortion at the edges.');
    }

    // Add original prompt context if provided
    if (basePrompt.trim()) {
        parts.push(`Original scene description: ${basePrompt}`);
    }

    return parts.join(' ');
}

const NodeControlsComponent: React.FC<NodeControlsProps> = ({
    data,
    inputUrl,
    isLoading,
    isSuccess,
    connectedImageNodes = [],
    onUpdate,
    onSwitchType,
    onGenerate,
    onChangeAngleGenerate,
    onSelect,
    zoom,
    canvasTheme = 'dark'
}) => {
    const { t } = useTranslation();
    const enabledIds = useEnabledModelIdsFromStorage();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showSizeDropdown, setShowSizeDropdown] = useState(false);
    const [showAspectRatioDropdown, setShowAspectRatioDropdown] = useState(false);
    const [showDurationDropdown, setShowDurationDropdown] = useState(false);
    const [showResolutionDropdown, setShowResolutionDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [localPrompt, setLocalPrompt] = useState(data.prompt || '');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const aspectRatioDropdownRef = useRef<HTMLDivElement>(null);
    const durationDropdownRef = useRef<HTMLDivElement>(null);
    const resolutionDropdownRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentPromptRef = useRef<string | undefined>(data.prompt); // Track what we sent

    // Local model state for LOCAL_IMAGE_MODEL and LOCAL_VIDEO_MODEL nodes
    const [localModels, setLocalModels] = useState<LocalModel[]>([]);
    const [isLoadingLocalModels, setIsLoadingLocalModels] = useState(false);
    const isLocalModelNode = data.type === NodeType.LOCAL_IMAGE_MODEL || data.type === NodeType.LOCAL_VIDEO_MODEL;

    // Fetch local models when node is a local model type
    useEffect(() => {
        if (!isLocalModelNode) return;

        const fetchModels = async () => {
            setIsLoadingLocalModels(true);
            try {
                const models = await getLocalModels();
                // Filter based on node type
                const filtered = data.type === NodeType.LOCAL_VIDEO_MODEL
                    ? models.filter(m => m.type === 'video')
                    : models.filter(m => m.type === 'image' || m.type === 'lora' || m.type === 'controlnet');
                setLocalModels(filtered);
            } catch (error) {
                console.error('Error fetching local models:', error);
            } finally {
                setIsLoadingLocalModels(false);
            }
        };
        fetchModels();
    }, [isLocalModelNode, data.type]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSizeDropdown(false);
            }
            if (aspectRatioDropdownRef.current && !aspectRatioDropdownRef.current.contains(event.target as Node)) {
                setShowAspectRatioDropdown(false);
            }
            if (durationDropdownRef.current && !durationDropdownRef.current.contains(event.target as Node)) {
                setShowDurationDropdown(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
            if (resolutionDropdownRef.current && !resolutionDropdownRef.current.contains(event.target as Node)) {
                setShowResolutionDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync local prompt with data.prompt ONLY when it changes externally (not from our own update)
    useEffect(() => {
        if (data.prompt !== lastSentPromptRef.current) {
            setLocalPrompt(data.prompt || '');
            lastSentPromptRef.current = data.prompt;
        }
    }, [data.prompt]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    // 旧节点上的 legacy id → 与设置一致的 registry id
    useEffect(() => {
        if (data.type !== NodeType.VIDEO) return;
        if (data.videoModel === 'tiktok-import') return;
        const next = data.videoModel
            ? canonicalizeVideoModelId(data.videoModel)!
            : DEFAULT_REGISTRY_VIDEO_ID;
        if (next !== data.videoModel) {
            onUpdate(data.id, { videoModel: next });
        }
    }, [data.type, data.videoModel, data.id, onUpdate]);

    useEffect(() => {
        if (data.type !== NodeType.IMAGE && data.type !== NodeType.IMAGE_EDITOR) return;
        const next = data.imageModel
            ? canonicalizeImageModelId(data.imageModel)!
            : DEFAULT_REGISTRY_IMAGE_ID;
        if (next !== data.imageModel) {
            onUpdate(data.id, { imageModel: next });
        }
    }, [data.type, data.imageModel, data.id, onUpdate]);

    // Handle prompt change with debounce
    const handlePromptChange = (value: string) => {
        setLocalPrompt(value); // Update local state immediately for responsive typing
        lastSentPromptRef.current = value; // Track that we're about to send this

        // Debounce the parent update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
            onUpdate(data.id, { prompt: value });
        }, 300); // 300ms debounce - increased for smoother typing
    };

    const handleSizeSelect = (value: string) => {
        if (data.type === NodeType.VIDEO) {
            onUpdate(data.id, { resolution: value });
        } else {
            onUpdate(data.id, { aspectRatio: value });
        }
        setShowSizeDropdown(false);
    };

    const handleAspectRatioSelect = (value: string) => {
        onUpdate(data.id, { aspectRatio: value });
        setShowAspectRatioDropdown(false);
    };

    const handleVideoModeChange = (mode: 'standard' | 'frame-to-frame' | 'motion-control') => {
        if (mode === 'frame-to-frame') {
            // Preserve existing frame ordering when possible so switching away and back
            // does not silently wipe the user's frame-to-frame setup.
            const initialFrameInputs =
                data.frameInputs && data.frameInputs.length > 0
                    ? data.frameInputs
                    : connectedFrameSourceNodes.slice(0, 2).map((node, idx) => ({
                        nodeId: node.id,
                        order: idx === 0 ? 'start' : 'end' as 'start' | 'end'
                    }));
            onUpdate(data.id, { videoMode: mode, frameInputs: initialFrameInputs });
        } else {
            onUpdate(data.id, { videoMode: mode });
        }
    };

    const handleFrameReorder = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || connectedFrameSourceNodes.length < 2) return;

        // Get the two connected image nodes
        const node1 = connectedFrameSourceNodes[0];
        const node2 = connectedFrameSourceNodes[1];

        // Get current orders (from saved data or default)
        const current1Order = data.frameInputs?.find(f => f.nodeId === node1.id)?.order || 'start';
        const current2Order = data.frameInputs?.find(f => f.nodeId === node2.id)?.order || 'end';

        // Swap the orders
        const updatedFrameInputs = [
            { nodeId: node1.id, order: current1Order === 'start' ? 'end' : 'start' as 'start' | 'end' },
            { nodeId: node2.id, order: current2Order === 'start' ? 'end' : 'start' as 'start' | 'end' }
        ];

        onUpdate(data.id, { frameInputs: updatedFrameInputs });
    };

    const currentSizeLabel = (data.type === NodeType.VIDEO || data.type === NodeType.LOCAL_VIDEO_MODEL)
        ? (data.resolution || "Auto")
        : (data.aspectRatio || "Auto");

    const registryVideoPool = React.useMemo(
        () =>
            getRegistryVideoModels().filter((m) => enabledIds === null || enabledIds.has(m.id)),
        [enabledIds]
    );
    const registryImagePool = React.useMemo(
        () =>
            REGISTRY_IMAGE_MODELS.filter((m) => enabledIds === null || enabledIds.has(m.id)),
        [enabledIds]
    );

    const isVideoNode = data.type === NodeType.VIDEO;
    const isAudioNode = data.type === NodeType.AUDIO;
    const isLocalVideoNode = data.type === NodeType.LOCAL_VIDEO_MODEL;
    const isRegistryImageNode = data.type === NodeType.IMAGE || data.type === NodeType.IMAGE_EDITOR;
    const isImageNode = isRegistryImageNode || data.type === NodeType.LOCAL_IMAGE_MODEL;
    const hasConnectedImages = connectedImageNodes.length > 0;

    const imageInputCount = connectedImageNodes.filter(n => n.type === NodeType.IMAGE).length;
    const connectedFrameSourceNodes = connectedImageNodes.filter(n => n.type === NodeType.IMAGE);
    const hasVideoReferenceInput = connectedImageNodes.some(n => n.type === NodeType.VIDEO);
    const hasCharacterImageInput = connectedFrameSourceNodes.length > 0;
    const selectedVideoMode = resolveEffectiveVideoMode(data, connectedImageNodes);
    const capabilityMode =
        selectedVideoMode === 'frame-to-frame' ? 'frameToFrame'
            : selectedVideoMode === 'motion-control' ? 'motionControl'
                : 'standard';
    const canUseFrameMode = connectedFrameSourceNodes.length >= 2;
    const canUseMotionMode = hasVideoReferenceInput && hasCharacterImageInput;
    const currentVideoModel =
        data.videoModel === 'tiktok-import'
            ? TIKTOK_VIDEO_MODEL_PLACEHOLDER
            : registryVideoPool.find((model) => model.id === data.videoModel)
            || (!data.videoModel ? registryVideoPool[0] : undefined);
    const currentVideoCapability =
        data.videoModel === 'tiktok-import' ? undefined : getVideoCapability(currentVideoModel?.id);
    const currentVideoModeCapability = currentVideoCapability?.modes[capabilityMode]
        ?? currentVideoCapability?.modes.standard;
    const standardVideoInputState = isVideoNode
        ? resolveStandardVideoExecutionState(currentVideoCapability, {
            imageUrls: connectedFrameSourceNodes.map((node) => node.url),
            hasInputSource: Boolean(inputUrl) || imageInputCount > 0,
        })
        : undefined;
    const standardVideoInputMode = standardVideoInputState?.inputMode ?? (!inputUrl && imageInputCount === 0 ? 'text-to-video' : 'image-to-video');

    // Auto-open Advanced Settings when the current capability exposes extra controls.
    useEffect(() => {
        if (data.type === NodeType.VIDEO) {
            const shouldAutoExpand =
                connectedImageNodes.length >= 2 ||
                Boolean(currentVideoModeCapability?.supportsAudio) ||
                Boolean(currentVideoModeCapability?.supportsMotionReference);
            if (shouldAutoExpand) {
                setShowAdvanced(true);
            }
        }
    }, [data.type, connectedImageNodes.length, currentVideoModeCapability?.supportsAudio, currentVideoModeCapability?.supportsMotionReference]);

    const videoGenerationMode = selectedVideoMode === 'motion-control'
        ? 'motion-control'
        : selectedVideoMode === 'frame-to-frame'
            ? 'frame-to-frame'
            : standardVideoInputMode;
    const supportsCurrentStandardReferenceImages =
        Boolean(isVideoNode && standardVideoInputState?.supportsReferenceImages);
    const supportsCurrentStandardInputMode = selectedVideoMode !== 'standard'
        ? true
        : Boolean(standardVideoInputState?.supportsCurrentInputMode);
    const standardReferencePreviewItems =
        selectedVideoMode === 'standard' && standardVideoInputState?.usesReferenceImages
            ? connectedFrameSourceNodes
                .map((node, index) => ({
                    nodeId: node.id,
                    url: node.url,
                    label:
                        connectedFrameSourceNodes.length > 1
                            ? `参考图 ${index + 1}`
                            : currentVideoModeCapability?.supportsFullReference
                                ? '全图参考'
                                : '参考图',
                }))
            : [];
    const standardReferenceTitle =
        standardReferencePreviewItems.length > 1
            ? '多图参考'
            : currentVideoModeCapability?.supportsFullReference
                ? '全图参考'
                : '参考图';
    const hasUnavailableCurrentStandardVideoInput =
        isVideoNode &&
        selectedVideoMode === 'standard' &&
        !supportsCurrentStandardInputMode;
    const hasUnsupportedMultipleImageInputs =
        isVideoNode &&
        selectedVideoMode === 'standard' &&
        Boolean(standardVideoInputState?.hasUnsupportedMultipleImageInputs);

    const availableVideoModels = registryVideoPool.filter((model) => {
        const capability = getVideoCapability(model.id);
        if (!capability) return false;

        const modeCapability =
            selectedVideoMode === 'frame-to-frame' ? capability.modes.frameToFrame
                : selectedVideoMode === 'motion-control' ? capability.modes.motionControl
                    : capability.modes.standard;

        if (!modeCapability.enabled) return false;
        if (selectedVideoMode === 'standard' && videoGenerationMode === 'text-to-video') {
            return resolveStandardVideoInputState(capability, {
                imageInputCount,
                hasInputSource: Boolean(inputUrl) || imageInputCount > 0,
            }).supportsCurrentInputMode;
        }
        if (selectedVideoMode === 'standard' && videoGenerationMode === 'image-to-video') {
            return resolveStandardVideoInputState(capability, {
                imageInputCount,
                hasInputSource: Boolean(inputUrl) || imageInputCount > 0,
            }).supportsCurrentInputMode;
        }
        if (selectedVideoMode === 'frame-to-frame') {
            return modeCapability.supportsStartEndFrames;
        }
        if (selectedVideoMode === 'motion-control') {
            return modeCapability.supportsMotionReference;
        }
        return true;
    });
    const selectedVideoModel =
        data.videoModel === 'tiktok-import'
            ? TIKTOK_VIDEO_MODEL_PLACEHOLDER
            : availableVideoModels.find((model) => model.id === data.videoModel)
            || currentVideoModel;
    const selectedVideoCapability =
        data.videoModel === 'tiktok-import' ? undefined : getVideoCapability(selectedVideoModel?.id);
    const selectedVideoModeAvailability = isVideoNode
        ? getVideoModeAvailabilityState(data, selectedVideoCapability)
        : undefined;
    const isSelectedVideoModeUnsupported =
        isVideoNode &&
        selectedVideoMode !== 'standard' &&
        !Boolean(selectedVideoModeAvailability?.selectedModeEnabled);
    const selectedModeUnsupportedLabel =
        selectedVideoMode === 'frame-to-frame' ? '首尾帧' : '运动参考';
    const enabledVideoModes = selectedVideoCapability ? getEnabledVideoModes(selectedVideoCapability) : [];
    const videoModeOptions = enabledVideoModes.map((mode) => ({
        id: mode === 'frameToFrame' ? 'frame-to-frame' : mode === 'motionControl' ? 'motion-control' : 'standard',
        label: mode === 'frameToFrame' ? '首尾帧' : mode === 'motionControl' ? '运动参考' : '标准',
    }));
    const hasAvailableVideoModels = data.videoModel === 'tiktok-import' || availableVideoModels.length > 0;
    const isCurrentVideoModelOffline =
        isVideoNode &&
        data.videoModel !== 'tiktok-import' &&
        Boolean(data.videoModel) &&
        !registryVideoPool.some((model) => model.id === data.videoModel);

    // Only self-heal truly empty model ids.
    // If the current model has been removed from the executable list, keep it visible
    // as unavailable instead of silently swapping the node to the first available model.
    useEffect(() => {
        if (data.type !== NodeType.VIDEO) return;
        if (data.videoModel === 'tiktok-import') return;

        const pool = registryVideoPool;
        if (!data.videoModel && pool.length > 0) {
            const fallbackCapability = getVideoCapability(pool[0].id);
            const sanitized = fallbackCapability
                ? sanitizeVideoNodeState({ ...data, videoModel: pool[0].id }, fallbackCapability)
                : {};
            onUpdate(data.id, { videoModel: pool[0].id, ...sanitized });
        }
    }, [data, data.videoModel, data.type, data.id, registryVideoPool, onUpdate]);

    useEffect(() => {
        if (data.type !== NodeType.VIDEO) return;
        if (!currentVideoCapability) return;

        const sanitized = sanitizeVideoNodeState(
            {
                ...data,
                videoMode: data.videoMode || selectedVideoMode,
            },
            currentVideoCapability
        );

        const changed = Object.entries(sanitized).some(([key, value]) => (data as Record<string, unknown>)[key] !== value);
        if (changed) {
            onUpdate(data.id, sanitized);
        }
    }, [data, data.id, data.type, currentVideoCapability, onUpdate, selectedVideoMode]);

    const handleVideoModelChange = (modelId: string) => {
        const capability = getVideoCapability(modelId);
        const updates: Partial<typeof data> = capability
            ? sanitizeVideoNodeState({ ...data, videoModel: modelId }, capability)
            : {};
        onUpdate(data.id, { videoModel: modelId, ...updates });
        setShowModelDropdown(false);
    };

    const currentVideoModelLabel =
        currentVideoModel?.name
        ?? (data.videoModel ? `模型已下线：${data.videoModel}` : 'No available models');

    // Get available durations for current model
    const availableDurations = currentVideoModeCapability?.durations || currentVideoModel?.durations || [5];
    const currentDuration = data.videoDuration || currentVideoModeCapability?.defaultDuration || availableDurations[0];
    const availableResolutions = currentVideoModeCapability?.resolutions || currentVideoModel?.resolutions || ['Auto'];
    const availableVideoAspectRatios = currentVideoModeCapability?.aspectRatios || currentVideoModel?.aspectRatios || ['16:9', '9:16'];
    const shouldLockVideoParameterControls = Boolean(isCurrentVideoModelOffline);

    // sizeOptions: For video nodes use model-specific resolutions, for image nodes use aspect ratios
    const sizeOptions = (data.type === NodeType.VIDEO || data.type === NodeType.LOCAL_VIDEO_MODEL)
        ? availableResolutions
        : imageAspectRatioOptions;

    const handleDurationChange = (duration: number) => {
        onUpdate(data.id, { videoDuration: duration });
        setShowDurationDropdown(false);
    };

    const inputCount = connectedImageNodes.length;
    const availableImageModels = registryImagePool.filter((model) => {
        if (inputCount === 0) return true;
        if (inputCount === 1) return model.supportsImageToImage;
        return model.supportsMultiImage;
    });
    const currentImageModel =
        availableImageModels.find((model) => model.id === data.imageModel)
        || availableImageModels[0]
        || registryImagePool.find((model) => model.id === data.imageModel)
        || registryImagePool[0];
    const imageAspectRatioOptions = currentImageModel?.aspectRatios || IMAGE_RATIOS;
    const hasAvailableImageModels = data.type === NodeType.LOCAL_IMAGE_MODEL || availableImageModels.length > 0;

    useEffect(() => {
        if (data.type !== NodeType.IMAGE && data.type !== NodeType.IMAGE_EDITOR) return;

        const pool = availableImageModels;
        const isCurrentModelAvailable = pool.some((m) => m.id === data.imageModel);
        if (!isCurrentModelAvailable && pool.length > 0) {
            onUpdate(data.id, { imageModel: pool[0].id });
        }
    }, [inputCount, data.imageModel, data.type, data.id, availableImageModels, onUpdate]);

    // Determine current generation mode for display
    const imageGenerationMode = inputCount === 0 ? 'text-to-image'
        : inputCount === 1 ? 'image-to-image'
            : 'multi-image';

    const runtimeVoiceCapabilities = getAllVoiceCapabilities();
    const availableVoiceModels = React.useMemo(
        () =>
            MODEL_REGISTRY
                .filter((entry) => entry.category === 'voice')
                .filter((entry) => enabledIds === null || enabledIds.has(entry.id))
                .filter((entry) => Boolean(runtimeVoiceCapabilities[entry.id])),
        [enabledIds, runtimeVoiceCapabilities]
    );
    const currentVoiceModel =
        availableVoiceModels.find((model) => model.id === (data.audioModel || data.model))
        || availableVoiceModels[0];
    const hasAvailableVoiceModels = availableVoiceModels.length > 0;

    useEffect(() => {
        if (data.type !== NodeType.AUDIO) return;
        if (!hasAvailableVoiceModels) return;

        const nextModelId = currentVoiceModel?.id;
        if (!nextModelId) return;

        if (data.audioModel !== nextModelId || data.model !== nextModelId) {
            onUpdate(data.id, { audioModel: nextModelId, model: nextModelId });
        }
    }, [currentVoiceModel?.id, data.audioModel, data.id, data.model, data.type, hasAvailableVoiceModels, onUpdate]);

    const handleVoiceModelChange = (modelId: string) => {
        onUpdate(data.id, { audioModel: modelId, model: modelId });
        setShowModelDropdown(false);
    };

    const handleImageModelChange = (modelId: string) => {
        const newModel = availableImageModels.find((m) => m.id === modelId) || REGISTRY_IMAGE_MODELS.find((m) => m.id === modelId);
        const updates: Partial<typeof data> = { imageModel: modelId };

        // Reset aspect ratio if current ratio is not supported by new model
        if (newModel?.aspectRatios && data.aspectRatio && !newModel.aspectRatios.includes(data.aspectRatio)) {
            updates.aspectRatio = 'Auto';
        }

        // Reset resolution if current resolution is not supported by new model
        if (newModel?.resolutions && data.resolution && !newModel.resolutions.includes(data.resolution)) {
            updates.resolution = newModel.resolutions[0] || 'Auto';
        }

        onUpdate(data.id, updates);
        setShowModelDropdown(false);
    };

    // Handle local model selection
    const handleLocalModelChange = (model: LocalModel) => {
        onUpdate(data.id, {
            localModelId: model.id,
            localModelPath: model.path,
            localModelType: model.type as NodeData['localModelType'],
            localModelArchitecture: model.architecture
        });
        setShowModelDropdown(false);
    };

    // Get selected local model for display
    const selectedLocalModel = localModels.find(m => m.id === data.localModelId);

    const handleResolutionSelect = (value: string) => {
        onUpdate(data.id, { resolution: value });
        setShowResolutionDropdown(false);
    };

    // Get frame inputs with their image URLs
    // Auto-assign order: first connected = start, second = end
    // If user has explicitly set frameInputs, use those orders, otherwise auto-assign
    const frameInputsWithUrls = connectedFrameSourceNodes.slice(0, 2).map((node, idx) => {
        // Check if there's an explicit order from user reordering
        const existingInput = data.frameInputs?.find(f => f.nodeId === node.id);
        return {
            nodeId: node.id,
            url: node.url,
            type: node.type,
            order: existingInput?.order || (idx === 0 ? 'start' : 'end') as 'start' | 'end'
        };
    }).sort((a, b) => {
        // Sort by order: 'start' first, 'end' second
        if (a.order === 'start' && b.order === 'end') return -1;
        if (a.order === 'end' && b.order === 'start') return 1;
        return 0;
    });
    const motionReferenceItems = connectedImageNodes
        .filter((node) => node.type === NodeType.VIDEO || node.type === NodeType.IMAGE)
        .slice(0, 2)
        .map((node) => ({
            nodeId: node.id,
            url: node.url,
            type: node.type,
        }));

    // Inverse scaling for the prompt bar to keep it readable when zooming out
    // When zooming in (zoom > 0.8), we let it zoom 1:1 with the canvas (localScale = 1)
    // When zooming out (zoom < 0.8), we keep it at least at 0.8 effective scale
    const minEffectiveScale = 0.8;
    const effectiveScale = Math.max(zoom, minEffectiveScale);
    const localScale = effectiveScale / zoom;

    // Theme helper
    const isDark = canvasTheme === 'dark';
    const panelBg = isDark ? 'bg-[#1a1a1a] border-neutral-800' : 'bg-white border-neutral-200';
    const promptText = isDark ? 'text-white placeholder-neutral-600' : 'text-neutral-900 placeholder-neutral-400';
    const selectBtn = isDark
        ? 'bg-[#252525] hover:bg-[#333] border-neutral-700 text-white'
        : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-900';
    const dropdownPanel = isDark ? 'bg-[#252525] border-neutral-700' : 'bg-white border-neutral-200';
    const dropdownHeader = isDark
        ? 'bg-[#1a1a1a] border-neutral-700 text-neutral-400'
        : 'bg-neutral-50 border-neutral-200 text-neutral-500';
    const switchableOptions = getNodeTypeOptionLabels();

    // Handle angle mode generate - creates a new connected node
    const handleAngleGenerate = () => {
        if (onChangeAngleGenerate) {
            onChangeAngleGenerate(data.id);
        }
    };

    // If in angle mode for Image nodes with result, show ChangeAnglePanel
    if (data.angleMode && data.type === NodeType.IMAGE && isSuccess && data.resultUrl) {
        return (
            <div
                style={{
                    transform: `scale(${localScale})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.1s ease-out'
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelect(data.id)}
            >
                <ChangeAnglePanel
                    imageUrl={data.resultUrl}
                    settings={data.angleSettings || { rotation: 0, tilt: 0, scale: 0, wideAngle: false }}
                    onSettingsChange={(settings) => onUpdate(data.id, { angleSettings: settings })}
                    onClose={() => onUpdate(data.id, { angleMode: false })}
                    onGenerate={handleAngleGenerate}
                    isLoading={isLoading}
                    canvasTheme={canvasTheme}
                />
            </div>
        );
    }

    return (
        <div
            className={`p-4 rounded-2xl shadow-2xl cursor-default w-full transition-colors duration-300 border ${panelBg}`}
            style={{
                transform: `scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
            }}
            onPointerDown={(e) => e.stopPropagation()} // Allow selecting text/interacting without dragging
            onClick={() => onSelect(data.id)} // Ensure clicking here selects the node
        >
            {/* Prompt Textarea with Expand Button - Hidden for storyboard-generated scenes */}
            {!(data.prompt && data.prompt.startsWith('Extract panel #')) && (
                <div className="mb-3">
                    <textarea
                        className={`w-full bg-transparent text-sm outline-none resize-none font-light ${promptText}`}
                        placeholder={
                            data.type === NodeType.VIDEO && selectedVideoMode === 'frame-to-frame'
                                ? t('nodeControls.promptOptionalKling')
                                : data.type === NodeType.VIDEO && inputUrl
                                    ? t('nodeControls.describeAnimation')
                                    : t('nodeControls.describeGeneration')
                        }
                        rows={data.isPromptExpanded ? 12 : 4}
                        value={localPrompt}
                        onChange={(e) => handlePromptChange(e.target.value)}
                        onWheel={(e) => e.stopPropagation()}
                        onBlur={() => {
                            // Ensure final value is saved on blur
                            if (updateTimeoutRef.current) {
                                clearTimeout(updateTimeoutRef.current);
                            }
                            if (localPrompt !== data.prompt) {
                                onUpdate(data.id, { prompt: localPrompt });
                            }
                        }}
                    />
                    {/* Expand/Shrink Button - Below textarea */}
                    <div className="flex justify-end mt-1">
                        <button
                            onClick={() => onUpdate(data.id, { isPromptExpanded: !data.isPromptExpanded })}
                            className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'}`}
                            title={data.isPromptExpanded ? 'Shrink prompt' : 'Expand prompt'}
                        >
                            {data.isPromptExpanded ? <Shrink size={12} /> : <Expand size={12} />}
                            <span>{data.isPromptExpanded ? 'Shrink' : 'Expand'}</span>
                        </button>
                    </div>
                </div>
            )}

            {data.errorMessage && (
                <div className="text-red-400 text-xs mb-2 p-1 bg-red-900/20 rounded border border-red-900/50">
                    {data.errorMessage}
                </div>
            )}

            {isUnsupportedSelectedMode && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    当前模型尚未接通{selectedModeUnsupportedLabel}模式，设置已保留，请切换到支持该模式的模型后再生成。
                </div>
            )}

            {/* Motion Control Warning - when motion mode detected but prerequisites are missing */}
            {isVideoNode && videoGenerationMode === 'motion-control' && !canUseMotionMode && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                        请先同时连接一个视频参考和一张角色图片，再使用运动参考模式。
                    </span>
                </div>
            )}

            {isVideoNode && selectedVideoMode === 'frame-to-frame' && frameInputsWithUrls.length < 2 && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    请先连接两张图片，再使用首尾帧模式。
                </div>
            )}

            {isVideoNode && hasUnsupportedMultipleImageInputs && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。
                </div>
            )}

            {isVideoNode && hasUnavailableCurrentStandardVideoInput && !hasUnsupportedMultipleImageInputs && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    当前模型在现有输入条件下不可用，请手动切换到支持该模式的模型。
                </div>
            )}

            {isLocalVideoNode && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    本地视频模型节点当前只支持选择本地模型，视频生成功能链还未接通。
                </div>
            )}

            {/* Controls - Hidden for storyboard-generated scenes */}
            {!(data.prompt && data.prompt.startsWith('Extract panel #')) && (
                <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2">
                        {isSwitchableNodeType(data.type) && onSwitchType && (
                            <select
                                value={data.type}
                                onChange={(e) => onSwitchType(data.id, e.target.value as SwitchableNodeType)}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border outline-none ${selectBtn}`}
                                title="切换节点类型"
                            >
                                {switchableOptions.map((option) => (
                                    <option key={option.type} value={option.type}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        )}
                        {/* Model Selector - Local, Video, and Image nodes get different dropdowns */}
                        {isLocalModelNode ? (
                            <div className="relative" ref={modelDropdownRef}>
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn}`}
                                >
                                    <HardDrive size={12} className="text-purple-400" />
                                    <span className="font-medium">{selectedLocalModel?.name || t('nodeControls.selectModel')}</span>
                                    <ChevronDown size={12} className="ml-0.5 opacity-50" />
                                </button>

                                {/* Local Model Dropdown Menu */}
                                {showModelDropdown && (
                                    <div className={`absolute top-full mt-1 left-0 w-56 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto border ${dropdownPanel}`}>
                                        {/* Header */}
                                        <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5 ${dropdownHeader}`}>
                                            <HardDrive size={10} />
                                            Local Models
                                        </div>

                                        {isLoadingLocalModels ? (
                                            <div className="px-3 py-4 text-xs text-neutral-500 text-center">{t('nodeControls.loadingModels')}</div>
                                        ) : localModels.length === 0 ? (
                                            <div className="px-3 py-4 text-xs text-neutral-500 text-center">
                                                <p>{t('nodeControls.noModelsFound')}</p>
                                                <p className="text-[10px] mt-1">{t('nodeControls.addSafetensors')}</p>
                                            </div>
                                        ) : (
                                            localModels.map(model => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => handleLocalModelChange(model)}
                                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${data.localModelId === model.id ? 'text-purple-400' : 'text-neutral-300'}`}
                                                >
                                                    <span className="flex flex-col items-start gap-0.5">
                                                        <span className="flex items-center gap-2">
                                                            <HardDrive size={12} className="text-purple-400" />
                                                            {model.name}
                                                            {model.architecture && model.architecture !== 'unknown' && (
                                                                <span className="text-[9px] px-1 py-0.5 bg-purple-600/30 text-purple-400 rounded">{model.architecture.toUpperCase()}</span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-neutral-500 ml-5">{model.sizeFormatted}</span>
                                                    </span>
                                                    {data.localModelId === model.id && <Check size={12} />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : data.type === NodeType.VIDEO ? (
                            <div className="relative" ref={modelDropdownRef}>
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    disabled={!hasAvailableVideoModels}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn}`}
                                >
                                    {currentVideoModel?.provider === 'openai' ? (
                                        <OpenAIIcon size={12} className="text-green-400" />
                                    ) : currentVideoModel?.provider === 'google' ? (
                                        <GoogleIcon size={12} className="text-white" />
                                    ) : currentVideoModel?.provider === 'xai' ? (
                                        <Sparkles size={12} className="text-orange-400" />
                                    ) : currentVideoModel?.provider === 'kling' ? (
                                        <KlingIcon size={14} />
                                    ) : currentVideoModel?.provider === 'hailuo' ? (
                                        <HailuoIcon size={14} />
                                    ) : (
                                        <Film size={12} className="text-cyan-400" />
                                    )}
                                    <span className="font-medium">{currentVideoModelLabel}</span>
                                    <ChevronDown size={12} className="ml-0.5 opacity-50" />
                                </button>

                                {/* Model Dropdown Menu */}
                                {showModelDropdown && (
                                    <div className={`absolute top-full mt-1 left-0 w-52 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border ${dropdownPanel}`}>
                                        {/* Mode indicator */}
                                        <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5 ${dropdownHeader}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${videoGenerationMode === 'text-to-video' ? 'bg-blue-400' :
                                                videoGenerationMode === 'image-to-video' ? 'bg-green-400' :
                                                    videoGenerationMode === 'motion-control' ? 'bg-orange-400' : 'bg-purple-400'
                                                }`} />
                                            {videoGenerationMode === 'text-to-video' ? 'Text → Video' :
                                                videoGenerationMode === 'image-to-video' ? 'Image → Video' :
                                                    videoGenerationMode === 'motion-control' ? 'Motion Control' :
                                                        'Frame-to-Frame'}
                                        </div>
                                        {/* OpenAI Models */}
                                        {availableVideoModels.filter(m => m.provider === 'openai').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                                    OpenAI
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'openai').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <OpenAIIcon size={12} className="text-green-400" />
                                                            {model.name}
                                                        </span>
                                                        {currentVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                        {/* Google Models */}
                                        {availableVideoModels.filter(m => m.provider === 'google').length > 0 && (
                                            <>
                                                <div className={`px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] ${availableVideoModels.some((m) => m.provider === 'openai') ? 'border-t border-neutral-700' : ''}`}>
                                                    Google
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'google').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            {model.provider === 'google' ? (
                                                                <GoogleIcon size={12} className="text-white" />
                                                            ) : (
                                                                <Film size={12} className="text-cyan-400" />
                                                            )}
                                                            {model.name}
                                                        </span>
                                                        {currentVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {/* xAI Models */}
                                        {availableVideoModels.filter(m => m.provider === 'xai').length > 0 && (
                                            <>
                                                <div className={`px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] ${availableVideoModels.some((m) => m.provider === 'openai' || m.provider === 'google') ? 'border-t border-neutral-700' : ''}`}>
                                                    xAI
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'xai').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Sparkles size={12} className="text-orange-400" />
                                                            {model.name}
                                                        </span>
                                                        {currentVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {/* Kling Models */}
                                        {availableVideoModels.filter(m => m.provider === 'kling').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    Kling AI
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'kling').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <KlingIcon size={14} />
                                                            {model.name}
                                                            {model.recommended && (
                                                                <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                                            )}
                                                        </span>
                                                        {currentVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {/* Hailuo Models */}
                                        {availableVideoModels.filter(m => m.provider === 'hailuo').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    Hailuo AI
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'hailuo').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <HailuoIcon size={14} />
                                                            {model.name}
                                                        </span>
                                                        {currentVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {availableVideoModels.filter(m => m.provider === 'wan').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    Wan
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'wan').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Film size={12} className="text-cyan-400" />
                                                            {model.name}
                                                        </span>
                                                        {currentVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {availableVideoModels.filter(m => m.provider === 'other').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    其他
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'other').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Film size={12} className="text-cyan-400" />
                                                            {model.name}
                                                        </span>
                                                        {currentVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : data.type === NodeType.AUDIO ? (
                            <div className="relative" ref={modelDropdownRef}>
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    disabled={!hasAvailableVoiceModels}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn}`}
                                >
                                    <Sparkles size={12} className="text-cyan-400" />
                                    <span className="font-medium">{currentVoiceModel?.name ?? 'No available voice models'}</span>
                                    <ChevronDown size={12} className="ml-0.5 opacity-50" />
                                </button>

                                {showModelDropdown && (
                                    <div className={`absolute top-full mt-1 left-0 w-56 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border ${dropdownPanel}`}>
                                        <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5 ${dropdownHeader}`}>
                                            <Sparkles size={10} />
                                            Voice
                                        </div>
                                        {availableVoiceModels.map((model) => (
                                            <button
                                                key={model.id}
                                                onClick={() => handleVoiceModelChange(model.id)}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVoiceModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Sparkles size={12} className="text-cyan-400" />
                                                    {model.name}
                                                </span>
                                                {currentVoiceModel?.id === model.id && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative" ref={modelDropdownRef}>
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    disabled={!hasAvailableImageModels}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn}`}
                                >
                                    {currentImageModel?.provider === 'google' ? (
                                        <Banana size={12} className="text-yellow-400" />
                                    ) : currentImageModel?.provider === 'openai' ? (
                                        <OpenAIIcon size={12} className="text-green-400" />
                                    ) : (
                                        <ImageIcon size={12} className="text-cyan-400" />
                                    )}
                                    <span className="font-medium">{currentImageModel?.name ?? 'No available models'}</span>
                                    <ChevronDown size={12} className="ml-0.5 opacity-50" />
                                </button>

                                {/* Image Model Dropdown Menu */}
                                {showModelDropdown && (
                                    <div className={`absolute top-full mt-1 left-0 w-48 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border ${dropdownPanel}`}>
                                        {/* Mode indicator */}
                                        <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5 ${dropdownHeader}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${imageGenerationMode === 'text-to-image' ? 'bg-blue-400' :
                                                imageGenerationMode === 'image-to-image' ? 'bg-green-400' : 'bg-purple-400'
                                                }`} />
                                            {imageGenerationMode === 'text-to-image' ? 'Text → Image' :
                                                imageGenerationMode === 'image-to-image' ? `Image → Image` :
                                                    `${inputCount} Images → Image`}
                                        </div>
                                        {/* OpenAI Models */}
                                        {availableImageModels.filter(m => m.provider === 'openai').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                                    OpenAI
                                                </div>
                                                {availableImageModels.filter(m => m.provider === 'openai').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleImageModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <OpenAIIcon size={12} className="text-green-400" />
                                                            {model.name}
                                                            {model.recommended && (
                                                                <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                                            )}
                                                        </span>
                                                        {currentImageModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                        {/* Google Models */}
                                        {availableImageModels.filter(m => m.provider === 'google').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    Google
                                                </div>
                                                {availableImageModels.filter(m => m.provider === 'google').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleImageModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Banana size={12} className="text-yellow-400" />
                                                            {model.name}
                                                        </span>
                                                        {currentImageModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {availableImageModels.filter(m => m.provider === 'other').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    其他
                                                </div>
                                                {availableImageModels.filter(m => m.provider === 'other').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleImageModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <ImageIcon size={12} className="text-cyan-400" />
                                                            {model.name}
                                                        </span>
                                                        {currentImageModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {isCurrentVideoModelOffline && (
                            <div className={`px-2.5 py-1.5 rounded-lg text-[11px] border ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                当前视频模型已下线，参数区已锁定。请先从模型下拉中切换到仍可执行的模型。
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Unified Size/Ratio Dropdown (hidden for video nodes in motion-control mode) */}
                        {(isVideoNode || isImageNode || isLocalVideoNode) && !(isVideoNode && videoGenerationMode === 'motion-control') && (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setShowSizeDropdown(!showSizeDropdown)}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn}`}
                                >
                                    {isVideoNode && <Monitor size={12} className="text-green-400" />}
                                    {!isVideoNode && <Crop size={12} className="text-blue-400" />}
                                    {isVideoNode && currentSizeLabel === 'Auto' ? 'Auto' : currentSizeLabel}
                                </button>

                                {/* Dropdown Menu */}
                                {showSizeDropdown && (
                                    <div
                                        className={`absolute bottom-full mb-2 right-0 w-32 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-60 overflow-y-auto border ${dropdownPanel}`}
                                        onWheel={(e) => e.stopPropagation()}
                                    >
                                        <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-[#1f1f1f] text-neutral-500' : 'bg-neutral-50 text-neutral-500'}`}>
                                            {isVideoNode ? 'Resolution' : 'Aspect Ratio'}
                                        </div>
                                        {sizeOptions.map(option => (
                                            <button
                                                key={option}
                                                onClick={() => handleSizeSelect(option)}
                                                className={`flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentSizeLabel === option ? 'text-blue-400' : 'text-neutral-300'
                                                    }`}
                                            >
                                                <span>{option}</span>
                                                {currentSizeLabel === option && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Image Resolution Dropdown - Only for Image nodes */}
                        {!isVideoNode && currentImageModel?.resolutions?.length && (
                            <div className="relative" ref={resolutionDropdownRef}>
                                <button
                                    onClick={() => !shouldLockVideoParameterControls && setShowResolutionDropdown(!showResolutionDropdown)}
                                    disabled={shouldLockVideoParameterControls}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn}`}
                                >
                                    <Monitor size={12} className="text-green-400" />
                                    {data.resolution || 'Auto'}
                                </button>

                                {/* Dropdown Menu */}
                                {showResolutionDropdown && (
                                    <div
                                        className={`absolute bottom-full mb-2 right-0 w-24 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border ${dropdownPanel}`}
                                        onWheel={(e) => e.stopPropagation()}
                                    >
                                        <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                            Quality
                                        </div>
                                        {(currentImageModel?.resolutions ?? []).map((res: string) => (
                                            <button
                                                key={res}
                                                onClick={() => handleResolutionSelect(res)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${(data.resolution || 'Auto') === res ? 'text-blue-400' : 'text-neutral-300'}`}
                                            >
                                                <span>{res}</span>
                                                {(data.resolution || 'Auto') === res && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Video Aspect Ratio Dropdown - Only for video nodes (hidden in motion-control mode) */}
                        {isVideoNode && videoGenerationMode !== 'motion-control' && availableVideoAspectRatios.length > 0 && (
                            <div className="relative" ref={aspectRatioDropdownRef}>
                                <button
                                    onClick={() => !shouldLockVideoParameterControls && setShowAspectRatioDropdown(!showAspectRatioDropdown)}
                                    disabled={shouldLockVideoParameterControls}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn} ${shouldLockVideoParameterControls ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Film size={12} className="text-purple-400" />
                                    {data.aspectRatio || currentVideoModeCapability?.defaultAspectRatio || '16:9'}
                                </button>

                                {/* Aspect Ratio Dropdown Menu */}
                                {showAspectRatioDropdown && (
                                    <div className="absolute bottom-full mb-2 right-0 w-28 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                            Size
                                        </div>
                                        {availableVideoAspectRatios.map((option: string) => (
                                            <button
                                                key={option}
                                                onClick={() => handleAspectRatioSelect(option)}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${data.aspectRatio === option ? 'text-blue-400' : 'text-neutral-300'}`}
                                            >
                                                <span>{option}</span>
                                                {data.aspectRatio === option && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Duration Dropdown - Only for video nodes (hidden in motion-control mode) */}
                        {isVideoNode && videoGenerationMode !== 'motion-control' && availableDurations.length > 0 && (
                            <div className="relative" ref={durationDropdownRef}>
                                <button
                                    onClick={() => !shouldLockVideoParameterControls && setShowDurationDropdown(!showDurationDropdown)}
                                    disabled={shouldLockVideoParameterControls}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn} ${shouldLockVideoParameterControls ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Clock size={12} className="text-cyan-400" />
                                    {currentDuration}s
                                </button>

                                {/* Duration Dropdown Menu */}
                                {showDurationDropdown && (
                                    <div className="absolute bottom-full mb-2 right-0 w-24 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                            Duration
                                        </div>
                                        {availableDurations.map((dur: number) => (
                                            <button
                                                key={dur}
                                                onClick={() => handleDurationChange(dur)}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentDuration === dur ? 'text-blue-400' : 'text-neutral-300'}`}
                                            >
                                                <span>{dur}s</span>
                                                {currentDuration === dur && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Generate Button - Active even after success to allow re-generation */}
                        {!isLoading && (() => {
                            const isFaceModeBlocked = false;
                            const isLocalVideoBlocked = isLocalVideoNode;
                            const isInvalidFrameMode = isVideoNode && selectedVideoMode === 'frame-to-frame' && frameInputsWithUrls.length < 2;
                            const isInvalidMotionMode = isVideoNode && selectedVideoMode === 'motion-control' && !canUseMotionMode;
                            const isUnsupportedSelectedMode = isSelectedVideoModeUnsupported;
                            const isUnsupportedMultiImageVideo = hasUnsupportedMultipleImageInputs || (isVideoNode && !supportsCurrentStandardInputMode);
                            const isModelUnavailable =
                                (isVideoNode && !hasAvailableVideoModels) ||
                                (isRegistryImageNode && !hasAvailableImageModels) ||
                                (isAudioNode && !hasAvailableVoiceModels);
                            const isGenerateBlocked = isFaceModeBlocked || isLocalVideoBlocked || isInvalidFrameMode || isInvalidMotionMode || isUnsupportedSelectedMode || isUnsupportedMultiImageVideo || isModelUnavailable || shouldLockVideoParameterControls;
                            const generateTitle = isModelUnavailable
                                ? isVideoNode
                                    ? '当前模式下没有可用的视频模型'
                                    : isAudioNode
                                        ? '当前没有可用的语音模型'
                                    : '当前输入条件下没有可用的图片模型'
                                : shouldLockVideoParameterControls
                                ? '当前视频模型已下线，请先切换到仍可执行的模型。'
                                : isLocalVideoBlocked
                                ? '本地视频模型生成功能链尚未接通'
                                : isUnsupportedSelectedMode
                                    ? `当前模型尚未接通${selectedModeUnsupportedLabel}模式，请切换到支持该模式的模型。`
                                : isInvalidFrameMode
                                    ? '请先连接两张图片后再使用首尾帧模式'
                                        : isInvalidMotionMode
                                            ? '请先连接视频参考和角色图片后再使用运动参考模式'
                                        : isUnsupportedMultiImageVideo
                                            ? '当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。'
                                            : t('nodeControls.generate');

                            return (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isGenerateBlocked) {
                                            // Show a warning - this is handled by the warning component
                                            return;
                                        }
                                        onGenerate(data.id);
                                    }}
                                    disabled={isGenerateBlocked}
                                    className={`group w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${isGenerateBlocked
                                        ? 'bg-neutral-700/50 cursor-not-allowed opacity-50'
                                        : isDark
                                            ? 'bg-white text-neutral-900 hover:bg-neutral-100 active:scale-95'
                                            : 'bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95'
                                        }`}
                                    title={generateTitle}
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="w-4 h-4 transition-transform duration-200"
                                        fill="currentColor"
                                    >
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}


            {/* Advanced Settings Drawer - Only for Video nodes */}
            {
                isVideoNode && (
                    <div className="mt-2 pt-2 border-t border-neutral-800">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <span className="text-[10px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400">
                                {t('nodeControls.advancedSettings')}
                            </span>
                            {showAdvanced ? (
                                <ChevronUp size={12} className="text-neutral-600" />
                            ) : (
                                <ChevronDown size={12} className="text-neutral-600" />
                            )}
                        </button>

                        {/* Advanced Settings Content - Only for Video nodes */}
                        {showAdvanced && isVideoNode && (
                            <div className="mt-3 space-y-3">
                                {videoModeOptions.length > 1 && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                            生成模式
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {videoModeOptions.map((mode) => (
                                                (() => {
                                                    const isDisabled =
                                                        shouldLockVideoParameterControls ||
                                                        (mode.id === 'frame-to-frame' && !canUseFrameMode) ||
                                                        (mode.id === 'motion-control' && !canUseMotionMode);
                                                    const title =
                                                        mode.id === 'frame-to-frame'
                                                            ? '需要两张图片输入'
                                                            : mode.id === 'motion-control'
                                                                ? '需要一个视频参考和一张角色图片'
                                                                : undefined;
                                                    return (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => !isDisabled && handleVideoModeChange(mode.id as 'standard' | 'frame-to-frame' | 'motion-control')}
                                                    disabled={isDisabled}
                                                    title={title}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                                                        selectedVideoMode === mode.id
                                                            ? 'bg-indigo-600 text-white border-indigo-500'
                                                            : isDisabled
                                                                ? 'bg-neutral-900/40 text-neutral-500 border-neutral-800 cursor-not-allowed opacity-60'
                                                                : 'bg-neutral-800/60 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                                                    }`}
                                                >
                                                    {mode.label}
                                                </button>
                                                    );
                                                })()
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Audio Toggle - Capability driven */}
                                {currentVideoModeCapability?.supportsAudio && (
                                    <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-neutral-800/50 rounded-lg w-fit">
                                        <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        </svg>
                                        <span className="text-[11px] text-neutral-300">{t('nodeControls.audio')}</span>
                                        <button
                                            onClick={() => !shouldLockVideoParameterControls && onUpdate(data.id, { generateAudio: !Boolean(data.generateAudio) })}
                                            disabled={shouldLockVideoParameterControls}
                                            className={`relative w-8 h-4 rounded-full transition-colors ${Boolean(data.generateAudio) ? 'bg-cyan-600' : 'bg-neutral-700'}`}
                                        >
                                            <span
                                                className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-md ${Boolean(data.generateAudio) ? 'left-4' : 'left-0.5'}`}
                                            />
                                        </button>
                                    </div>
                                )}

                                {standardReferencePreviewItems.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                            {standardReferenceTitle}
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {standardReferencePreviewItems.map((input) => (
                                                <div
                                                    key={input.nodeId}
                                                    className="flex flex-col gap-2 p-2 bg-neutral-800 rounded-lg border border-neutral-700/50"
                                                >
                                                    <div className="relative w-full aspect-video overflow-hidden rounded bg-black flex items-center justify-center">
                                                        {input.url ? (
                                                            <img
                                                                src={input.url}
                                                                alt={input.label}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        ) : (
                                                            <div className="text-[10px] text-neutral-600">{t('nodeControls.noPreview')}</div>
                                                        )}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                        <div className="absolute bottom-1 left-1 right-1">
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded block text-center truncate bg-blue-600/80 text-white">
                                                                {input.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[11px] text-neutral-500">
                                            当前标准模式会把这些图片当作参考输入一起提交。
                                        </div>
                                    </div>
                                )}

                                {/* Frame Inputs - Show when current mode supports start/end frames or motion references */}
                                {(currentVideoModeCapability?.supportsStartEndFrames || currentVideoModeCapability?.supportsMotionReference) && (connectedFrameSourceNodes.length >= 2 || videoGenerationMode === 'motion-control') && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                            {videoGenerationMode === 'motion-control' ? t('nodeControls.inputReferences') : t('nodeControls.connectedFrames')}
                                        </label>

                                        {(videoGenerationMode === 'motion-control' ? motionReferenceItems.length : frameInputsWithUrls.length) === 0 ? (
                                            <div className="text-xs text-neutral-600 italic py-2">
                                                {videoGenerationMode === 'motion-control' ? 'Connect video and image nodes as references' : 'Connect image nodes to use as start/end frames'}
                                            </div>
                                        ) : videoGenerationMode === 'motion-control' ? (
                                            /* Horizontal layout for Motion Control */
                                            <div className="flex gap-2">
                                                {motionReferenceItems.map((input) => (
                                                    <div
                                                        key={input.nodeId}
                                                        className="flex-1 flex flex-col items-center gap-2 p-2 bg-neutral-800 rounded-lg border border-neutral-700/50"
                                                    >
                                                        <div className="relative w-full aspect-video overflow-hidden rounded bg-black flex items-center justify-center">
                                                            {input.url ? (
                                                                input.type === NodeType.VIDEO ? (
                                                                    <video
                                                                        src={input.url}
                                                                        className="w-full h-full object-cover"
                                                                        muted
                                                                        playsInline
                                                                        preload="metadata"
                                                                    />
                                                                ) : (
                                                                    <img
                                                                        src={input.url}
                                                                        alt={input.type === NodeType.VIDEO ? t('nodeControls.motionRef') : t('nodeControls.characterRef')}
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                )
                                                            ) : (
                                                                <div className="text-[10px] text-neutral-600">{t('nodeControls.noPreview')}</div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                            <div className="absolute bottom-1 left-1 right-1">
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded block text-center truncate ${input.type === NodeType.VIDEO
                                                                    ? 'bg-purple-600/80 text-white'
                                                                    : 'bg-blue-600/80 text-white'
                                                                    }`}>
                                                                    {input.type === NodeType.VIDEO ? t('nodeControls.motionRef').toUpperCase() : t('nodeControls.characterRef').toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            /* Vertical draggable layout for Frame-to-Frame */
                                            <div className="space-y-2">
                                                {frameInputsWithUrls.map((input, index) => (
                                                    <div
                                                        key={input.nodeId}
                                                        draggable
                                                        onDragStart={() => setDraggedIndex(index)}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={() => {
                                                            if (draggedIndex !== null) {
                                                                handleFrameReorder(draggedIndex, index);
                                                                setDraggedIndex(null);
                                                            }
                                                        }}
                                                        onDragEnd={() => setDraggedIndex(null)}
                                                        className={`flex items-center gap-2 p-2 bg-neutral-800 rounded-lg cursor-grab active:cursor-grabbing transition-all ${draggedIndex === index ? 'opacity-50 scale-95' : ''
                                                            }`}
                                                    >
                                                        <GripVertical size={14} className="text-neutral-600" />
                                                        <img
                                                            src={input.url}
                                                            alt={`Frame ${index + 1}`}
                                                            className="w-12 h-12 object-cover rounded"
                                                        />
                                                        <div className="flex-1">
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${input.order === 'start'
                                                                ? 'bg-green-600/30 text-green-400'
                                                                : 'bg-orange-600/30 text-orange-400'
                                                                }`}>
                                                                {input.order === 'start' ? t('nodeControls.start').toUpperCase() : t('nodeControls.end').toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {connectedFrameSourceNodes.length > frameInputsWithUrls.length && (
                                            <div className="text-xs text-neutral-500 mt-1">
                                                {t('nodeControls.moreInputsAvailable')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
};

// Memoize to prevent re-renders when parent state changes
export const NodeControls = memo(NodeControlsComponent);
