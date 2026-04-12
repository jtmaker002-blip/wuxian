/**
 * NodeControls.tsx
 * 
 * Control panel for canvas nodes.
 * Handles prompt input, model selection, size/ratio settings, and generation button.
 * For Video nodes: includes Advanced Settings for frame-to-frame mode.
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Banana, Settings2, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, Film, Clock, Expand, Shrink, Monitor, Crop, HardDrive, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeData, NodeStatus, NodeType } from '../../types';
import { OpenAIIcon, GoogleIcon, KlingIcon, HailuoIcon } from '../icons/BrandIcons';
import { ChangeAnglePanel } from './ChangeAnglePanel';
import { LightingPanel } from './image-node/LightingPanel';
import { getLiblibImageReferenceState } from './image-node/imageNodeUiState';
import { LocalModel, getLocalModels } from '../../services/localModelService';
import { useEnabledModelIdsFromStorage } from '../../hooks/useApiSettings';
import {
    getRegistryVideoModels,
    REGISTRY_IMAGE_MODELS,
    type CanvasVideoModel,
} from '../../config/registryCanvasModels';
import { MODEL_REGISTRY } from '../../config/modelRegistry';
import { getImageExecutionSupport, getVideoExecutionSupportForContext, getVoiceExecutionSupport } from '../../config/modelExecutionSupport';
import {
    getNodeTypeOptionLabels,
    isSwitchableNodeType,
    type SwitchableNodeType,
} from '../../config/nodeTypeRegistry';
import {
    canonicalizeVideoModelId,
    canonicalizeImageModelId,
    DEFAULT_REGISTRY_IMAGE_ID,
    DEFAULT_REGISTRY_VIDEO_ID,
} from '../../config/registryModelBridge';
import { getAllVoiceCapabilities, getNativeVideoCapability, getNativeVideoFeatureKeys, getNativeVideoModelNotes, getNativeVideoModelSources, getVideoCapability, type NativeVideoFeatureKey } from '../../config/modelCapabilities';
import { canQuickAddStandardVideoImage, getEnabledVideoModes, resolveStandardVideoCapabilityState, sanitizeVideoNodeState } from '../../utils/videoCapabilityState';
import { getVideoModeAvailabilityState, resolveEffectiveVideoMode } from '../../utils/videoModeResolution';
import { useStoredOpenAiTeachProviderConfig } from '../../shared/provider/openaiteach-config';

const CAMERA_CONTROL_OPTIONS = {
    camera: ['Arri Alexa 65', 'Panavision DXL2', 'RED V-Raptor', 'Sony Venice 2'],
    lens: ['Arri Signature Prime', 'Panavision C-series', 'Cooke S4/i', 'Zeiss Supreme Prime'],
    focal: ['24', '35', '50', '85'],
    aperture: ['f/2.8', 'f/4', 'f/5.6', 'f/8'],
};

type CameraControlSelection = {
    camera: number;
    lens: number;
    focal: number;
    aperture: number;
};

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

function renderExecutionBadge(
    support: { mode: 'hosted-token' | 'local-key' | 'unimplemented' } | undefined
) {
    if (!support) return null;

    const config =
        support.mode === 'hosted-token'
            ? { label: 'Token', className: 'bg-emerald-600/20 text-emerald-300' }
            : support.mode === 'local-key'
                ? { label: '本地', className: 'bg-amber-600/20 text-amber-300' }
                : { label: '未实现', className: 'bg-rose-600/20 text-rose-300' };

    return (
        <span className={`text-[9px] px-1 py-0.5 rounded ${config.className}`}>
            {config.label}
        </span>
    );
}

function getExecutionSupportBadgeClasses(
    mode: 'hosted-token' | 'local-key' | 'unimplemented' | undefined
) {
    if (mode === 'hosted-token') {
        return 'bg-emerald-600/20 text-emerald-400';
    }
    if (mode === 'local-key') {
        return 'bg-amber-600/20 text-amber-400';
    }
    if (mode === 'unimplemented') {
        return 'bg-rose-600/20 text-rose-400';
    }
    return 'bg-neutral-700/40 text-neutral-400';
}

function getExecutionSupportBadgeLabel(
    mode: 'hosted-token' | 'local-key' | 'unimplemented' | undefined
) {
    if (mode === 'hosted-token') return 'TOKEN';
    if (mode === 'local-key') return '本地Key';
    if (mode === 'unimplemented') return '未实现';
    return null;
}

interface NodeControlsProps {
    data: NodeData;
    inputUrl?: string;
    isLoading: boolean;
    isSuccess: boolean;
    connectedImageNodes?: { id: string; url: string; type?: NodeType }[]; // Connected parent nodes
    onUpdate: (id: string, updates: Partial<NodeData>) => void;
    onSwitchType?: (id: string, nextType: SwitchableNodeType) => void;
    onGenerate: (id: string) => void;
    onUploadAsset?: () => void;
    onChangeAngleGenerate?: (nodeId: string) => void;
    onQuickAddInputNode?: (nodeId: string, inputType: 'image' | 'video') => void;
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
    onUploadAsset,
    onChangeAngleGenerate,
    onQuickAddInputNode,
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
    const [showImageCountDropdown, setShowImageCountDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showCameraControl, setShowCameraControl] = useState(false);
    const [cameraControlSelection, setCameraControlSelection] = useState<CameraControlSelection>({
        camera: 1,
        lens: 1,
        focal: 1,
        aperture: 1,
    });
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [localPrompt, setLocalPrompt] = useState(data.prompt || '');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const aspectRatioDropdownRef = useRef<HTMLDivElement>(null);
    const durationDropdownRef = useRef<HTMLDivElement>(null);
    const resolutionDropdownRef = useRef<HTMLDivElement>(null);
    const imageCountDropdownRef = useRef<HTMLDivElement>(null);
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
            if (imageCountDropdownRef.current && !imageCountDropdownRef.current.contains(event.target as Node)) {
                setShowImageCountDropdown(false);
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
            ? canonicalizeVideoModelId(data.videoModel)
            : DEFAULT_REGISTRY_VIDEO_ID;
        if (next && next !== data.videoModel) {
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

    const executableRegistryVideoModels = React.useMemo(
        () => getRegistryVideoModels(),
        []
    );
    const registryVideoPool = React.useMemo(
        () =>
            executableRegistryVideoModels.filter((m) => enabledIds === null || enabledIds.has(m.id)),
        [enabledIds, executableRegistryVideoModels]
    );
    const registryImagePool = React.useMemo(
        () =>
            REGISTRY_IMAGE_MODELS.filter((m) => enabledIds === null || enabledIds.has(m.id)),
        [enabledIds]
    );
    const hostedProviderConfig = useStoredOpenAiTeachProviderConfig();
    const hasHostedToken = Boolean(hostedProviderConfig.providerApiKey);

    const isVideoNode = data.type === NodeType.VIDEO;
    const isAudioNode = data.type === NodeType.AUDIO;
    const isLocalVideoNode = data.type === NodeType.LOCAL_VIDEO_MODEL;
    const isRegistryImageNode = data.type === NodeType.IMAGE || data.type === NodeType.IMAGE_EDITOR;
    const isImageNode = isRegistryImageNode || data.type === NodeType.LOCAL_IMAGE_MODEL;
    const hasConnectedImages = connectedImageNodes.length > 0;

    const connectedFrameSourceNodes = connectedImageNodes.filter(n => n.type === NodeType.IMAGE);
    const hasVideoReferenceInput = connectedImageNodes.some(n => n.type === NodeType.VIDEO);
    const hasCharacterImageInput = connectedFrameSourceNodes.length > 0;
    const standardVideoSources = isVideoNode
        ? connectedImageNodes
            .filter((node) => node.type === NodeType.IMAGE)
            .map((node) => ({
                nodeId: node.id,
                type: 'image' as const,
                url: node.url,
                previewUrl: node.url,
            }))
        : [];
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
            : executableRegistryVideoModels.find((model) => model.id === data.videoModel)
            || undefined;
    const currentVideoCapability =
        data.videoModel === 'tiktok-import' ? undefined : getVideoCapability(currentVideoModel?.id);
    const nativeVideoCapability =
        data.videoModel === 'tiktok-import' ? undefined : getNativeVideoCapability(currentVideoModel?.id || data.videoModel);
    const nativeVideoFeatureKeys = getNativeVideoFeatureKeys(currentVideoModel?.id || data.videoModel);
    const nativeVideoModelNotes = getNativeVideoModelNotes(currentVideoModel?.id || data.videoModel);
    const nativeVideoModelSources = getNativeVideoModelSources(currentVideoModel?.id || data.videoModel);
    const nativeVideoModeCapability =
        nativeVideoCapability?.modes[capabilityMode]
        ?? nativeVideoCapability?.modes.standard;
    const rawCurrentVideoModeCapability = currentVideoCapability?.modes[capabilityMode];
    const currentVideoModeCapability =
        selectedVideoMode === 'standard'
            ? rawCurrentVideoModeCapability ?? currentVideoCapability?.modes.standard
            : rawCurrentVideoModeCapability?.enabled
                ? rawCurrentVideoModeCapability
                : undefined;
    const standardVideoCapabilityState = isVideoNode
        ? resolveStandardVideoCapabilityState(currentVideoCapability, {
            sources: standardVideoSources,
        })
        : undefined;
    const standardVideoInputMode = standardVideoCapabilityState?.inputMode ?? 'text-to-video';
    const currentVideoExecutionSupport =
        data.videoModel === 'tiktok-import'
            ? undefined
            : getVideoExecutionSupportForContext(currentVideoModel?.id || data.videoModel, {
                videoMode: selectedVideoMode,
                usesReferenceImages: Boolean(standardVideoCapabilityState?.usesReferenceImages),
                hasHostedToken,
            });

    // Auto-open Advanced Settings when the current capability exposes extra controls.
    useEffect(() => {
        if (data.type === NodeType.VIDEO) {
            const shouldAutoExpand =
                connectedImageNodes.length >= 2 ||
                Boolean(currentVideoCapability?.modes.frameToFrame.enabled && currentVideoCapability?.modes.frameToFrame.supportsStartEndFrames) ||
                Boolean(currentVideoCapability?.modes.standard.supportsFullReference) ||
                Boolean(currentVideoCapability?.modes.standard.supportsMultiImage) ||
                Boolean(currentVideoModeCapability?.supportsAudio) ||
                Boolean(currentVideoModeCapability?.supportsMotionReference);
            if (shouldAutoExpand) {
                setShowAdvanced(true);
            }
        }
    }, [
        data.type,
        connectedImageNodes.length,
        currentVideoCapability?.modes.frameToFrame.enabled,
        currentVideoCapability?.modes.frameToFrame.supportsStartEndFrames,
        currentVideoCapability?.modes.standard.supportsFullReference,
        currentVideoCapability?.modes.standard.supportsMultiImage,
        currentVideoModeCapability?.supportsAudio,
        currentVideoModeCapability?.supportsMotionReference,
    ]);

    const videoGenerationMode = selectedVideoMode === 'motion-control'
        ? 'motion-control'
        : selectedVideoMode === 'frame-to-frame'
            ? 'frame-to-frame'
            : standardVideoInputMode;
    const standardReferenceSources =
        selectedVideoMode === 'standard'
            ? (standardVideoCapabilityState?.referenceImageSources ?? [])
            : [];
    const standardReferencePreviewItems =
        standardReferenceSources.length > 0
            ? standardReferenceSources
                .map((source, index) => ({
                    nodeId: source.nodeId ?? `standard-reference-${index}`,
                    url: source.previewUrl,
                    type: source.type === 'video' ? NodeType.VIDEO : NodeType.IMAGE,
                    label:
                        standardReferenceSources.length > 1
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
    const standardVideoBlockedReason =
        selectedVideoMode === 'standard' ? standardVideoCapabilityState?.blockedReason : undefined;
    const getVideoDropdownExecutionSupport = (modelId: string) =>
        getVideoExecutionSupportForContext(modelId, {
            videoMode: selectedVideoMode,
            usesReferenceImages: Boolean(standardVideoCapabilityState?.usesReferenceImages),
            hasHostedToken,
        });

    const availableVideoModels = registryVideoPool.filter((model) => {
        const capability = getVideoCapability(model.id);
        if (!capability) return false;

        const modeCapability =
            selectedVideoMode === 'frame-to-frame' ? capability.modes.frameToFrame
                : selectedVideoMode === 'motion-control' ? capability.modes.motionControl
                    : capability.modes.standard;

        if (!modeCapability.enabled) return false;
        if (selectedVideoMode === 'standard') {
            return !resolveStandardVideoCapabilityState(capability, {
                sources: standardVideoSources,
            }).isBlocked;
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
            : availableVideoModels.find((model) => model.id === data.videoModel);
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
        !executableRegistryVideoModels.some((model) => model.id === data.videoModel);

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

        const changed = Object.entries(sanitized).some(([key, value]) => (data as unknown as Record<string, unknown>)[key] !== value);
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

    const shouldLockVideoParameterControls = Boolean(isCurrentVideoModelOffline);
    const canEditVideoParameters = !shouldLockVideoParameterControls;
    const isOfflineReadonlyVideoNode = isVideoNode && shouldLockVideoParameterControls;
    const hailuoFrameExecutionNotice =
        isVideoNode &&
        selectedVideoMode === 'frame-to-frame' &&
        selectedVideoModel?.provider === 'hailuo'
            ? '当前首尾帧模式会实际使用 Hailuo-02 执行。'
            : undefined;
    const hailuoStandardReferenceNotice =
        isVideoNode &&
        selectedVideoMode === 'standard' &&
        selectedVideoModel?.provider === 'hailuo' &&
        standardVideoCapabilityState?.usesReferenceImages
            ? '当前标准模式会按 Hailuo 参考图链执行（S2V），不是普通单图图生视频。'
            : undefined;
    const currentVideoModelLabel =
        currentVideoModel?.name
            ? (hailuoFrameExecutionNotice
                ? `${currentVideoModel.name}（首尾帧执行 Hailuo-02）`
                : currentVideoModel.name)
            : (data.videoModel ? `模型已下线：${data.videoModel}` : '请选择视频模型');
    const nativeFeatureLabelMap: Record<NativeVideoFeatureKey, string> = {
        textToVideo: '文生视频',
        imageToVideo: '图生视频',
        multiImage: '多图参考',
        fullReference: '全图参考',
        startEndFrame: '首尾帧',
        motionReference: '运动参考',
        audio: '音频',
        subjectReference: '主体参考',
        referenceVideo: '参考视频',
        characterConsistency: '角色一致性',
    };
    const nativeFeatureConnectedMap: Record<NativeVideoFeatureKey, boolean> = {
        textToVideo: Boolean(currentVideoCapability?.modes.standard.supportsTextToVideo),
        imageToVideo: Boolean(currentVideoCapability?.modes.standard.supportsImageToVideo),
        multiImage: Boolean(currentVideoCapability?.modes.standard.supportsMultiImage),
        fullReference: Boolean(currentVideoCapability?.modes.standard.supportsFullReference),
        startEndFrame: Boolean(currentVideoCapability?.modes.frameToFrame.enabled && currentVideoCapability?.modes.frameToFrame.supportsStartEndFrames),
        motionReference: Boolean(currentVideoCapability?.modes.motionControl.enabled && currentVideoCapability?.modes.motionControl.supportsMotionReference),
        audio: Boolean(currentVideoCapability && Object.values(currentVideoCapability.modes).some((mode) => mode.supportsAudio)),
        subjectReference: Boolean(
            (selectedVideoModel?.provider === 'hailuo' &&
                (currentVideoCapability?.modes.standard.supportsFullReference || currentVideoCapability?.modes.standard.supportsMultiImage)) ||
            Boolean(currentVideoCapability?.modes.motionControl.enabled && currentVideoCapability?.modes.motionControl.supportsMotionReference)
        ),
        referenceVideo: false,
        characterConsistency: false,
    };
    const backendConnectedFeatureKeys = (Object.entries(nativeFeatureConnectedMap) as Array<[NativeVideoFeatureKey, boolean]>)
        .filter(([, connected]) => connected)
        .map(([key]) => key);
    const capabilityFeatureKeys = Array.from(new Set([
        ...backendConnectedFeatureKeys,
        ...nativeVideoFeatureKeys,
    ]));
    const currentVideoCapabilitySummary = nativeVideoModeCapability
        ? {
            durations: nativeVideoModeCapability.durations.join(' / '),
            resolutions: nativeVideoModeCapability.resolutions.join(' / '),
            aspectRatios: nativeVideoModeCapability.aspectRatios.join(' / '),
          }
        : undefined;
    const shouldShowVideoCapabilitySummary = isVideoNode && (capabilityFeatureKeys.length > 0 || Boolean(currentVideoCapabilitySummary));
    const videoFeatureChips = isVideoNode
        ? capabilityFeatureKeys.map((key) => {
            const onClick =
                key === 'textToVideo' || key === 'imageToVideo' || key === 'multiImage' || key === 'fullReference'
                    ? () => handleVideoModeChange('standard')
                    : key === 'subjectReference'
                        ? () => handleVideoModeChange('standard')
                    : key === 'startEndFrame'
                        ? () => handleVideoModeChange('frame-to-frame')
                    : key === 'motionReference'
                            ? () => handleVideoModeChange('motion-control')
                        : key === 'audio' && currentVideoCapability && Object.values(currentVideoCapability.modes).some((mode) => mode.supportsAudio)
                            ? () => {
                                if (currentVideoModeCapability?.supportsAudio) {
                                    onUpdate(data.id, { generateAudio: !Boolean(data.generateAudio) });
                                    return;
                                }
                                if (currentVideoCapability.modes.standard.supportsAudio) {
                                    onUpdate(data.id, {
                                        videoMode: 'standard',
                                        generateAudio: true,
                                    });
                                }
                            }
                            : undefined;
            const active =
                (key === 'textToVideo' && selectedVideoMode === 'standard' && standardVideoInputMode === 'text-to-video' && !standardVideoCapabilityState?.usesReferenceImages) ||
                (key === 'imageToVideo' && selectedVideoMode === 'standard' && standardVideoInputMode === 'image-to-video' && !standardVideoCapabilityState?.usesReferenceImages) ||
                ((key === 'multiImage' || key === 'fullReference') && selectedVideoMode === 'standard' && Boolean(standardVideoCapabilityState?.usesReferenceImages)) ||
                (key === 'subjectReference' && selectedVideoMode === 'standard' && Boolean(standardVideoCapabilityState?.usesReferenceImages)) ||
                (key === 'startEndFrame' && selectedVideoMode === 'frame-to-frame') ||
                (key === 'motionReference' && selectedVideoMode === 'motion-control') ||
                (key === 'audio' && Boolean(data.generateAudio));

            return {
                id: key,
                key,
                label: nativeFeatureLabelMap[key],
                active,
                onClick,
                disabled: !nativeFeatureConnectedMap[key] || !onClick,
                connected: nativeFeatureConnectedMap[key],
            };
        })
        : [];
    const connectedVideoFeatureChips = videoFeatureChips.filter((chip) => chip.connected);
    const pendingVideoFeatureChips = videoFeatureChips.filter((chip) => !chip.connected);
    const hasOnlyPendingCapabilities = connectedVideoFeatureChips.length === 0 && pendingVideoFeatureChips.length > 0;
    const canQuickAddStandardImage =
        selectedVideoMode === 'standard'
            && canQuickAddStandardVideoImage(
                currentVideoCapability,
                standardVideoCapabilityState,
                connectedFrameSourceNodes.length
            );
    const shouldShowQuickAddImage = Boolean(onQuickAddInputNode) && isVideoNode && (
        canQuickAddStandardImage ||
        (selectedVideoMode === 'frame-to-frame' && connectedFrameSourceNodes.length < 2) ||
        (selectedVideoMode === 'motion-control' && !hasCharacterImageInput)
    );
    const shouldShowQuickAddVideo = Boolean(onQuickAddInputNode) && isVideoNode && selectedVideoMode === 'motion-control' && !hasVideoReferenceInput;

    // Get available durations for current model
    const availableDurations = shouldLockVideoParameterControls ? [] : currentVideoModeCapability?.durations ?? [];
    const currentDuration = shouldLockVideoParameterControls
        ? (data.videoDuration || 5)
        : data.videoDuration || currentVideoModeCapability?.defaultDuration || availableDurations[0] || 5;
    const availableResolutions = shouldLockVideoParameterControls ? [] : currentVideoModeCapability?.resolutions ?? [];
    const availableVideoAspectRatios = shouldLockVideoParameterControls ? [] : currentVideoModeCapability?.aspectRatios ?? [];

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
    const currentImageExecutionSupport = getImageExecutionSupport(currentImageModel?.id || data.imageModel);
    const imageAspectRatioOptions = currentImageModel?.aspectRatios || IMAGE_RATIOS;
    const hasAvailableImageModels = data.type === NodeType.LOCAL_IMAGE_MODEL || availableImageModels.length > 0;

    // sizeOptions: For video nodes use model-specific resolutions, for image nodes use aspect ratios
    const sizeOptions = (data.type === NodeType.VIDEO || data.type === NodeType.LOCAL_VIDEO_MODEL)
        ? availableResolutions
        : imageAspectRatioOptions;

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
    const currentVoiceExecutionSupport = getVoiceExecutionSupport(currentVoiceModel?.id || data.audioModel || data.model);
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

    const handleImageCountSelect = (value: number) => {
        onUpdate(data.id, { imageCount: value });
        setShowImageCountDropdown(false);
    };

    const applyCameraControlSelection = () => {
        const camera = CAMERA_CONTROL_OPTIONS.camera[cameraControlSelection.camera];
        const lens = CAMERA_CONTROL_OPTIONS.lens[cameraControlSelection.lens];
        const focal = CAMERA_CONTROL_OPTIONS.focal[cameraControlSelection.focal];
        const aperture = CAMERA_CONTROL_OPTIONS.aperture[cameraControlSelection.aperture];
        const hint = `摄像机控制：${camera} / ${lens} / ${focal}mm / ${aperture}`;
        const currentPrompt = data.prompt || '';
        const nextPrompt = currentPrompt.includes(hint)
            ? currentPrompt
            : `${currentPrompt}${currentPrompt ? '\n\n' : ''}${hint}`;

        onUpdate(data.id, {
            prompt: nextPrompt,
            imageToolAction: '摄像机控制',
            imageToolMode: null,
        });
        setShowCameraControl(false);
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
    const isLiblibImagePanel = isImageNode && !isLocalModelNode;
    const imageToolMode = data.imageToolMode || null;
    const imageReferenceState = getLiblibImageReferenceState({
        connectedImageNodes,
        inputUrl,
        resultUrl: data.resultUrl,
    });
    const imageReferenceCount = imageReferenceState.count;
    const imageModeHint =
        imageToolMode === 'focus'
            ? data.focusSelection
                ? '已记录聚焦区域，可继续描述局部改动意图'
                : '请在图片上框选聚焦区域'
            : imageToolMode === 'style'
                ? '风格模式已启用，选择预设后会写入当前图片节点提示词'
                : imageToolMode === 'mark'
                    ? '标记模式已启用，可继续标注当前图片的局部意图'
                    : null;
    const imageAnnotations = data.imageAnnotations || [];
    const canUseImageRegionTools = Boolean(data.resultUrl);
    const isLiblibVideoFromImagePanel = isVideoNode && Boolean(inputUrl) && selectedVideoMode === 'standard';
    const panelBg = isLiblibImagePanel
        ? 'bg-[#232323]/98 border-white/10 text-white shadow-[0_26px_80px_rgba(0,0,0,0.52)] backdrop-blur-xl'
        : isLiblibVideoFromImagePanel
            ? 'bg-[#232323]/98 border-white/10 text-white shadow-[0_26px_80px_rgba(0,0,0,0.52)] backdrop-blur-xl'
        : isDark ? 'bg-[#1a1a1a] border-neutral-800' : 'bg-white border-neutral-200';
    const useDarkControlChrome = isDark || isLiblibImagePanel || isLiblibVideoFromImagePanel;
    const promptText = useDarkControlChrome ? 'text-white placeholder-neutral-600' : 'text-neutral-900 placeholder-neutral-400';
    const selectBtn = useDarkControlChrome
        ? 'bg-[#252525] hover:bg-[#333] border-neutral-700 text-white'
        : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-900';
    const dropdownPanel = useDarkControlChrome ? 'bg-[#252525] border-neutral-700' : 'bg-white border-neutral-200';
    const dropdownHeader = useDarkControlChrome
        ? 'bg-[#1a1a1a] border-neutral-700 text-neutral-400'
        : 'bg-neutral-50 border-neutral-200 text-neutral-500';
    const switchableOptions = getNodeTypeOptionLabels();
    const isStoryboardGeneratedScene = Boolean(data.prompt && data.prompt.startsWith('Extract panel #'));

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
                    onClose={() => onUpdate(data.id, { angleMode: false, imageToolMode: null, imageToolAction: undefined })}
                    onGenerate={handleAngleGenerate}
                    isLoading={isLoading}
                    canvasTheme={canvasTheme}
                    titleLabel="多角度编辑器"
                />
            </div>
        );
    }

    if (imageToolMode === 'lighting' && data.type === NodeType.IMAGE && isSuccess && data.resultUrl) {
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
                <LightingPanel
                    settings={data.imageLightingSettings || {
                        mode: 'global',
                        smartMode: false,
                        brightness: 50,
                        color: '#ffffff',
                        keyLight: 'front',
                        rimLight: false,
                    }}
                    onChange={(settings) => onUpdate(data.id, { imageLightingSettings: settings })}
                    onClose={() => onUpdate(data.id, { imageToolMode: null, imageToolAction: undefined })}
                    onGenerate={() => onGenerate(data.id)}
                />
            </div>
        );
    }

    return (
        <div
            className={`${isLiblibImagePanel || isLiblibVideoFromImagePanel ? 'relative rounded-[28px] p-4' : 'p-4 rounded-2xl shadow-2xl'} cursor-default w-full transition-colors duration-300 border ${panelBg}`}
            style={{
                transform: `scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
            }}
            onPointerDown={(e) => e.stopPropagation()} // Allow selecting text/interacting without dragging
            onClick={() => onSelect(data.id)} // Ensure clicking here selects the node
        >
            {/* Prompt Textarea with Expand Button - Hidden for storyboard-generated scenes */}
            {!isOfflineReadonlyVideoNode && !isStoryboardGeneratedScene && (
                <div className="mb-3">
                    {isLiblibImagePanel && (
                        <div className="mb-0 space-y-3">
                            <button
                                type="button"
                                onClick={() => onUpdate(data.id, { isPromptExpanded: !data.isPromptExpanded })}
                                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-[#2b2b2b] text-neutral-400 transition-colors hover:bg-[#313131] hover:text-white"
                                title={data.isPromptExpanded ? '收起面板' : '展开面板'}
                            >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15 3 21 3 21 9" />
                                    <polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            </button>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    {[
                                        { key: 'style' as const, label: '风格', icon: <Sparkles size={16} /> },
                                        { key: 'mark' as const, label: '标记', icon: <Settings2 size={16} /> },
                                        { key: 'focus' as const, label: '聚焦', icon: <Crop size={16} /> },
                                    ].map((tool) => {
                                        const active = imageToolMode === tool.key;
                                        const disabled = (tool.key === 'mark' || tool.key === 'focus') && !canUseImageRegionTools;
                                        return (
                                            <button
                                                key={tool.key}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => {
                                                    if (disabled) return;
                                                    onUpdate(data.id, { imageToolMode: active ? null : tool.key, imageToolAction: undefined });
                                                }}
                                                className={`flex h-[68px] w-[72px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border text-xs font-medium transition-all active:scale-[0.98] ${
                                                    disabled
                                                        ? 'cursor-not-allowed border-white/6 bg-[#242424] text-neutral-600'
                                                        : active
                                                            ? 'border-white/70 bg-white text-black shadow-[0_12px_28px_rgba(255,255,255,0.12)]'
                                                            : 'border-white/10 bg-[#2a2a2a] text-neutral-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:bg-[#343434] hover:border-white/14 hover:text-white'
                                                }`}
                                                title={disabled ? '上传或生成图片后可用' : tool.label}
                                            >
                                                <span className={disabled ? 'text-neutral-600' : active ? 'text-black' : 'text-neutral-300'}>{tool.icon}</span>
                                                <span>{tool.label}</span>
                                            </button>
                                        );
                                    })}
                                    {imageReferenceState.previewUrl ? (
                                        <div className="relative flex h-[68px] w-[72px] shrink-0 items-center justify-center rounded-[18px] border border-white/14 bg-[#2a2a2a] p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.26)]">
                                            <img
                                                src={imageReferenceState.previewUrl}
                                                alt="素材缩略图"
                                                className="h-full w-full rounded-[12px] object-cover"
                                            />
                                            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-black shadow">
                                                {imageReferenceCount}
                                            </span>
                                            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
                                                素材
                                            </span>
                                        </div>
                                    ) : onUploadAsset ? (
                                        <button
                                            type="button"
                                            onClick={onUploadAsset}
                                            className="flex h-[68px] w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-white/14 bg-[#2a2a2a] text-[11px] font-medium text-neutral-300 transition-colors hover:bg-[#343434] hover:border-white/20 hover:text-white"
                                        >
                                            <ImageIcon size={18} />
                                            <span>上传素材</span>
                                        </button>
                                    ) : null}
                                </div>
                                <div className="flex min-h-[68px] items-center gap-2 pr-12">
                                    <div className="flex flex-col items-end gap-2">
                                        {!imageReferenceState.hasReference && (
                                            <div className="rounded-full border border-white/8 bg-[#2b2b2b] px-3 py-1 text-[11px] font-medium text-neutral-400 shadow-[0_10px_18px_rgba(0,0,0,0.18)]">
                                                等待素材或描述
                                            </div>
                                        )}
                                        {imageReferenceState.hasReference && (
                                            <div className="rounded-full border border-white/10 bg-[#2b2b2b] px-3 py-1 text-[11px] font-medium text-neutral-200 shadow-[0_10px_18px_rgba(0,0,0,0.18)]">
                                                已引用素材 · {imageReferenceCount}
                                            </div>
                                        )}
                                        {data.focusSelection && imageToolMode !== 'focus' && (
                                            <div className="flex items-center gap-1 rounded-full border border-sky-300/20 bg-[#1f2d36] px-3 py-1 text-[11px] font-medium text-sky-100 shadow-[0_10px_18px_rgba(12,74,110,0.18)]">
                                                <span>已聚焦局部</span>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onUpdate(data.id, { focusSelection: undefined });
                                                    }}
                                                    className="rounded-full px-1 text-sky-100/70 transition-colors hover:bg-sky-300/12 hover:text-white"
                                                    title="清除聚焦区域"
                                                >
                                                    清除
                                                </button>
                                            </div>
                                        )}
                                        {data.imageToolAction && (
                                            <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-100 shadow-[0_10px_18px_rgba(120,53,15,0.18)]">
                                                当前动作 · {data.imageToolAction}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {imageModeHint && (
                                imageToolMode === 'focus' ? (
                                    <div className="inline-flex h-11 items-center self-start rounded-2xl border border-white/8 bg-black px-5 text-[16px] font-medium text-white shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                                        请在图片上框选聚焦区域
                                    </div>
                                ) : (
                                    <div className="flex min-h-11 items-center rounded-[18px] border border-white/10 bg-[#2a2a2a] px-4 text-sm text-neutral-200">
                                        {imageModeHint}
                                    </div>
                                )
                            )}
                            {data.focusSelection && imageToolMode !== 'focus' && (
                                <div className="flex min-h-11 items-center justify-between gap-3 rounded-[18px] border border-sky-300/16 bg-[#1f2d36] px-4 text-sm text-sky-100">
                                    <span>已记录聚焦区域。继续在下方描述你希望局部变化的内容后再生成。</span>
                                    <button
                                        type="button"
                                        onClick={() => onUpdate(data.id, { focusSelection: undefined })}
                                        className="shrink-0 rounded-full border border-sky-300/16 px-2.5 py-1 text-[11px] text-sky-100/80 transition-colors hover:bg-sky-300/12 hover:text-white"
                                    >
                                        清除
                                    </button>
                                </div>
                            )}
                            {imageAnnotations.length > 0 && (
                                <div className="rounded-[18px] border border-white/10 bg-[#292929] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.015)]">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <span className="text-[11px] font-medium text-neutral-400">标记区域 · {imageAnnotations.length}</span>
                                        <button
                                            type="button"
                                            onClick={() => onUpdate(data.id, { imageAnnotations: [] })}
                                            className="rounded-full px-2 py-1 text-[10px] font-medium text-neutral-400 transition-colors hover:bg-white/8 hover:text-white"
                                        >
                                            全部清除
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {imageAnnotations.map((annotation, index) => {
                                            const tone =
                                                annotation.type === 'preserve'
                                                    ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                                                    : annotation.type === 'ignore'
                                                        ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
                                                        : annotation.type === 'reference'
                                                            ? 'border-sky-300/20 bg-sky-400/10 text-sky-100'
                                                            : 'border-amber-300/20 bg-amber-400/10 text-amber-100';

                                            return (
                                                <div
                                                    key={annotation.id}
                                                    className={`flex h-8 max-w-[170px] items-center gap-1.5 rounded-full border pl-2 pr-1 text-[11px] font-medium ${tone}`}
                                                    title={annotation.label}
                                                >
                                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-black/24 text-[9px] text-white">
                                                        {index + 1}
                                                    </span>
                                                    <span className="min-w-0 truncate">{annotation.label}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onUpdate(data.id, {
                                                                imageAnnotations: imageAnnotations.filter((item) => item.id !== annotation.id),
                                                            })
                                                        }
                                                        className="rounded-full px-1.5 py-0.5 text-[10px] text-white/64 transition-colors hover:bg-white/10 hover:text-white"
                                                        title="删除标记"
                                                    >
                                                        删除
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="rounded-[22px] border border-white/8 bg-[#1f1f1f] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.015)]">
                                <textarea
                                    className="min-h-[132px] w-full resize-none bg-transparent text-[16px] font-light leading-8 text-neutral-100 outline-none placeholder:text-neutral-500"
                                    placeholder="描述你想要生成的画面内容，按/呼出指令，@引用素材"
                                    rows={data.isPromptExpanded ? 12 : 4}
                                    style={{ minHeight: data.isPromptExpanded ? 220 : 132 }}
                                    value={localPrompt}
                                    onChange={(e) => handlePromptChange(e.target.value)}
                                    onWheel={(e) => e.stopPropagation()}
                                    onBlur={() => {
                                        if (updateTimeoutRef.current) {
                                            clearTimeout(updateTimeoutRef.current);
                                        }
                                        if (localPrompt !== data.prompt) {
                                            onUpdate(data.id, { prompt: localPrompt });
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#262626] px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
                                <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-100">
                                    <div className="relative" ref={modelDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowModelDropdown(!showModelDropdown)}
                                            className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-neutral-100 transition-colors hover:bg-white/8"
                                        >
                                            <Banana size={15} className="text-yellow-400" />
                                            <span>{currentImageModel?.name ?? 'Lib Nano Pro'}</span>
                                            {renderExecutionBadge(currentImageExecutionSupport)}
                                            <ChevronDown size={12} className="opacity-60" />
                                        </button>
                                        {showModelDropdown && (
                                            <div className={`absolute bottom-full mb-2 left-0 w-56 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto border ${dropdownPanel}`}>
                                                {availableImageModels.filter(m => m.provider === 'openai').length > 0 && (
                                                    <>
                                                        <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                                            OpenAI
                                                        </div>
                                                        {availableImageModels.filter(m => m.provider === 'openai').map(model => (
                                                            <button
                                                                key={model.id}
                                                                onClick={() => handleImageModelChange(model.id)}
                                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <OpenAIIcon size={12} className="text-green-400" />
                                                                    {model.name}
                                                                    {renderExecutionBadge(getImageExecutionSupport(model.id))}
                                                                </span>
                                                                {currentImageModel?.id === model.id && <Check size={12} />}
                                                            </button>
                                                        ))}
                                                    </>
                                                )}
                                                {availableImageModels.filter(m => m.provider === 'google').length > 0 && (
                                                    <>
                                                        <div className={`px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] ${availableImageModels.some((m) => m.provider === 'openai') ? 'border-t border-neutral-700' : ''}`}>
                                                            Google
                                                        </div>
                                                        {availableImageModels.filter(m => m.provider === 'google').map(model => (
                                                            <button
                                                                key={model.id}
                                                                onClick={() => handleImageModelChange(model.id)}
                                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <Banana size={12} className="text-yellow-400" />
                                                                    {model.name}
                                                                    {renderExecutionBadge(getImageExecutionSupport(model.id))}
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
                                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <ImageIcon size={12} className="text-cyan-400" />
                                                                    {model.name}
                                                                    {renderExecutionBadge(getImageExecutionSupport(model.id))}
                                                                </span>
                                                                {currentImageModel?.id === model.id && <Check size={12} />}
                                                            </button>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-neutral-500">•</div>
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowSizeDropdown(!showSizeDropdown)}
                                            className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-neutral-100 transition-colors hover:bg-white/8"
                                        >
                                            <Crop size={14} className="text-neutral-300" />
                                            <span>{data.aspectRatio || '16:9'}</span>
                                            <ChevronDown size={12} className="opacity-60" />
                                        </button>
                                        {showSizeDropdown && (
                                            <div className={`absolute bottom-full mb-2 right-0 w-28 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border ${dropdownPanel}`}>
                                                <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                                    比例
                                                </div>
                                                {sizeOptions.map((option) => (
                                                    <button
                                                        key={option}
                                                        onClick={() => handleSizeSelect(option)}
                                                        className={`flex items-center justify-between w-full px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentSizeLabel === option ? 'text-blue-400' : 'text-neutral-300'}`}
                                                    >
                                                        <span>{option}</span>
                                                        {currentSizeLabel === option && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-neutral-500">•</div>
                                    <div className="relative" ref={resolutionDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowResolutionDropdown(!showResolutionDropdown)}
                                            className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-neutral-100 transition-colors hover:bg-white/8"
                                        >
                                            <Monitor size={14} className="text-neutral-300" />
                                            <span>{data.resolution || '2K'}</span>
                                            <ChevronDown size={12} className="opacity-60" />
                                        </button>
                                        {showResolutionDropdown && (
                                            <div className={`absolute bottom-full mb-2 right-0 w-24 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 border ${dropdownPanel}`}>
                                                <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                                    清晰度
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
                                    <button
                                        type="button"
                                        onClick={() => setShowCameraControl(true)}
                                        className="flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm text-neutral-100 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
                                    >
                                        <Film size={14} className="text-neutral-300" />
                                        <span>摄像机控制</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative" ref={imageCountDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowImageCountDropdown(!showImageCountDropdown)}
                                            className="flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/8 hover:text-white"
                                        >
                                            {data.imageCount || 1}张
                                            <ChevronDown size={12} className="opacity-60" />
                                        </button>
                                        {showImageCountDropdown && (
                                            <div className="absolute bottom-full mb-2 right-0 w-20 rounded-2xl border border-neutral-700 bg-[#2b2b2b] py-1 shadow-xl">
                                                {[1, 2, 3, 4].map((count) => (
                                                    <button
                                                        key={count}
                                                        type="button"
                                                        onClick={() => handleImageCountSelect(count)}
                                                        className={`flex w-full items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#363636] ${(data.imageCount || 1) === count ? 'text-white' : 'text-neutral-300'}`}
                                                    >
                                                        <span>{count}张</span>
                                                        {(data.imageCount || 1) === count && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-sm font-medium text-neutral-400">
                                        <Zap size={12} className="text-neutral-500" />
                                        <span>{Math.max(14, (data.imageCount || 1) * 14)}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onGenerate(data.id)}
                                        disabled={isLoading || !hasAvailableImageModels}
                                        className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-all ${
                                            isLoading || !hasAvailableImageModels
                                                ? 'cursor-not-allowed bg-[#5f5f5f] opacity-55'
                                                : 'bg-[#9b9b9b] hover:bg-[#b8b8b8] active:scale-[0.96]'
                                        }`}
                                        title={!hasAvailableImageModels ? '当前输入条件下没有可用的图片模型' : '生成图片'}
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 19V5" />
                                            <path d="m7 10 5-5 5 5" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {shouldShowVideoCapabilitySummary && !isLiblibVideoFromImagePanel && (
                        <div className="mb-3 space-y-2">
                            <div className="space-y-2">
                                {connectedVideoFeatureChips.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                                            当前已接通
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {connectedVideoFeatureChips.map((chip) => (
                                                <button
                                                    key={chip.id}
                                                    type="button"
                                                    disabled={chip.disabled}
                                                    onClick={chip.onClick}
                                                    className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                                        chip.active
                                                            ? 'bg-blue-600 text-white border-blue-500'
                                                            : chip.disabled
                                                                ? (isDark ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-default' : 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-default')
                                                                : (isDark ? 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800' : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100')
                                                    }`}
                                                >
                                                    {chip.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {pendingVideoFeatureChips.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                                            官方原生支持
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {pendingVideoFeatureChips.map((tag) => (
                                                <span
                                                    key={`native-${tag.key}`}
                                                    className={`px-2.5 py-1 rounded-full text-[11px] border border-dashed ${isDark ? 'bg-neutral-950 text-amber-300 border-amber-700/60' : 'bg-amber-50 text-amber-700 border-amber-300'}`}
                                                    title="模型原生能力，执行时会按当前可用后端能力路由"
                                                >
                                                    {tag.label}·原生支持
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {connectedVideoFeatureChips.length === 0 && pendingVideoFeatureChips.length === 0 && (
                                    <span className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                                        当前模型能力表暂无可展示能力
                                    </span>
                                )}
                                {hasOnlyPendingCapabilities && (
                                    <div className={`text-[10px] ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                                        当前模型官方有这些能力，但你这个版本后端还没全部接通。
                                    </div>
                                )}
                                {shouldShowQuickAddImage && (
                                    <button
                                        type="button"
                                        onClick={() => onQuickAddInputNode?.(data.id, 'image')}
                                        className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${isDark ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700 hover:bg-emerald-900/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                                    >
                                        添加图片
                                    </button>
                                )}
                                {shouldShowQuickAddVideo && (
                                    <button
                                        type="button"
                                        onClick={() => onQuickAddInputNode?.(data.id, 'video')}
                                        className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${isDark ? 'bg-violet-950/40 text-violet-300 border-violet-700 hover:bg-violet-900/40' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'}`}
                                    >
                                        添加视频
                                    </button>
                                )}
                            </div>
                            {currentVideoCapabilitySummary && (
                                <div className={`space-y-1 text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                                    <div>时长：{currentVideoCapabilitySummary.durations}s</div>
                                    <div>分辨率：{currentVideoCapabilitySummary.resolutions}</div>
                                    <div>比例：{currentVideoCapabilitySummary.aspectRatios}</div>
                                </div>
                            )}
                            {nativeVideoModelNotes.length > 0 && (
                                <div className={`space-y-1 text-[10px] leading-5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                                    {nativeVideoModelNotes.map((note) => (
                                        <div key={note}>官方备注：{note}</div>
                                    ))}
                                </div>
                            )}
                            {nativeVideoModelSources.length > 0 && (
                                <div className={`space-y-1 text-[10px] leading-5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                                    <div>官方来源：</div>
                                    <div className="flex flex-col gap-1">
                                        {nativeVideoModelSources.map((source) => (
                                            <a
                                                key={source}
                                                href={source}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={isDark ? 'text-sky-300 hover:text-sky-200 underline break-all' : 'text-sky-700 hover:text-sky-800 underline break-all'}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                {source}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {currentVideoExecutionSupport && (
                                <div className={`space-y-1 text-[10px] leading-5 ${currentVideoExecutionSupport.mode === 'hosted-token'
                                    ? (isDark ? 'text-emerald-300' : 'text-emerald-700')
                                    : currentVideoExecutionSupport.mode === 'local-key'
                                        ? (isDark ? 'text-amber-300' : 'text-amber-700')
                                        : (isDark ? 'text-rose-300' : 'text-rose-700')
                                    }`}>
                                    <div>执行说明：{currentVideoExecutionSupport.note}</div>
                                </div>
                            )}
                        </div>
                    )}
                    {isRegistryImageNode && currentImageExecutionSupport && !isLiblibImagePanel && (
                        <div className={`mb-3 text-[10px] leading-5 ${currentImageExecutionSupport.mode === 'hosted-token'
                            ? (isDark ? 'text-emerald-300' : 'text-emerald-700')
                            : currentImageExecutionSupport.mode === 'local-key'
                                ? (isDark ? 'text-amber-300' : 'text-amber-700')
                                : (isDark ? 'text-rose-300' : 'text-rose-700')
                            }`}>
                            执行说明：{currentImageExecutionSupport.note}
                        </div>
                    )}
                    {isAudioNode && currentVoiceExecutionSupport && (
                        <div className={`mb-3 text-[10px] leading-5 ${currentVoiceExecutionSupport.mode === 'hosted-token'
                            ? (isDark ? 'text-emerald-300' : 'text-emerald-700')
                            : currentVoiceExecutionSupport.mode === 'local-key'
                                ? (isDark ? 'text-amber-300' : 'text-amber-700')
                                : (isDark ? 'text-rose-300' : 'text-rose-700')
                            }`}>
                            执行说明：{currentVoiceExecutionSupport.note}
                        </div>
                    )}
                    {isLiblibVideoFromImagePanel && (
                        <div className="mb-3 rounded-[22px] border border-emerald-400/20 bg-[#1f2a26] p-3 text-white shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
                            <div className="flex items-center gap-3">
                                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[16px] bg-black">
                                    <img src={inputUrl} alt="图生视频首帧素材" className="h-full w-full object-cover" />
                                    <div className="absolute inset-0 ring-1 ring-inset ring-white/12" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold text-black">图生视频</span>
                                        <span className="text-sm font-semibold text-white">
                                            首帧素材已接入
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-emerald-100/78">
                                        继续描述动作、镜头和运镜，生成会以这张图片作为视频起点。
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        <span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[10px] text-emerald-50/82">
                                            主路径
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[10px] text-emerald-50/82">
                                            标准模式
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {!isLiblibImagePanel && (
                        <textarea
                            className={`w-full text-sm outline-none resize-none font-light ${
                                isLiblibVideoFromImagePanel
                                    ? 'rounded-[18px] border border-white/8 bg-[#1f1f1f] px-4 py-3 leading-7 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.015)]'
                                    : 'bg-transparent'
                            } ${promptText}`}
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
                    )}
                    {/* Expand/Shrink Button - Below textarea */}
                    {!isLiblibImagePanel && (
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
                    )}
                </div>
            )}

            {!isOfflineReadonlyVideoNode && data.errorMessage && (
                <div className="text-red-400 text-xs mb-2 p-1 bg-red-900/20 rounded border border-red-900/50">
                    {data.errorMessage}
                </div>
            )}

            {!isOfflineReadonlyVideoNode && isSelectedVideoModeUnsupported && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    当前模型尚未接通{selectedModeUnsupportedLabel}模式，设置已保留，请切换到支持该模式的模型后再生成。
                </div>
            )}

            {/* Motion Control Warning - when motion mode detected but prerequisites are missing */}
            {!isOfflineReadonlyVideoNode && isVideoNode && videoGenerationMode === 'motion-control' && !canUseMotionMode && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                        请先同时连接一个视频参考和一张角色图片，再使用运动参考模式。
                    </span>
                </div>
            )}

            {!isOfflineReadonlyVideoNode && isVideoNode && selectedVideoMode === 'frame-to-frame' && frameInputsWithUrls.length < 2 && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    请先连接两张图片，再使用首尾帧模式。
                </div>
            )}

            {!isOfflineReadonlyVideoNode && isVideoNode && selectedVideoMode === 'standard' && standardVideoBlockedReason && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    {standardVideoBlockedReason}
                </div>
            )}

            {isLocalVideoNode && (
                <div className="text-amber-400 text-xs mb-2 p-2 bg-amber-900/20 rounded border border-amber-700/50">
                    本地视频模型节点当前只支持选择本地模型，视频生成功能链还未接通。
                </div>
            )}

            {/* Controls - Hidden for storyboard-generated scenes */}
            {!isStoryboardGeneratedScene && !isLiblibImagePanel && (
                <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2">
                        {!isOfflineReadonlyVideoNode && isSwitchableNodeType(data.type) && onSwitchType && !isLiblibImagePanel && (
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
                                    ) : currentVideoModel?.provider === 'seedance' ? (
                                        <Sparkles size={12} className="text-violet-400" />
                                    ) : currentVideoModel?.provider === 'kling' ? (
                                        <KlingIcon size={14} />
                                    ) : currentVideoModel?.provider === 'hailuo' ? (
                                        <HailuoIcon size={14} />
                                    ) : (
                                        <Film size={12} className="text-cyan-400" />
                                    )}
                                    <span className="font-medium">{currentVideoModelLabel}</span>
                                    {renderExecutionBadge(currentVideoExecutionSupport)}
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
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <OpenAIIcon size={12} className="text-green-400" />
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
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
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            {model.provider === 'google' ? (
                                                                <GoogleIcon size={12} className="text-white" />
                                                            ) : (
                                                                <Film size={12} className="text-cyan-400" />
                                                            )}
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
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
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Sparkles size={12} className="text-orange-400" />
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
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
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <KlingIcon size={14} />
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                            {model.recommended && (
                                                                <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                                            )}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
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
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <HailuoIcon size={14} />
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
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
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Film size={12} className="text-cyan-400" />
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {availableVideoModels.filter(m => m.provider === 'seedance').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    即梦 / Seedance
                                                </div>
                                                {availableVideoModels.filter(m => m.provider === 'seedance').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleVideoModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Sparkles size={12} className="text-violet-400" />
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
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
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedVideoModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Film size={12} className="text-cyan-400" />
                                                            {model.name}
                                                            {renderExecutionBadge(getVideoDropdownExecutionSupport(model.id))}
                                                        </span>
                                                        {selectedVideoModel?.id === model.id && <Check size={12} />}
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
                                    {renderExecutionBadge(currentVoiceExecutionSupport)}
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
                                                    {renderExecutionBadge(getVoiceExecutionSupport(model.id))}
                                                </span>
                                                {currentVoiceModel?.id === model.id && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : !isLiblibImagePanel ? (
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
                                    ) : currentImageModel?.provider === 'hosted' ? (
                                        <Sparkles size={12} className="text-violet-400" />
                                    ) : (
                                        <ImageIcon size={12} className="text-cyan-400" />
                                    )}
                                    <span className="font-medium">{currentImageModel?.name ?? 'No available models'}</span>
                                    {renderExecutionBadge(currentImageExecutionSupport)}
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
                                                            {renderExecutionBadge(getImageExecutionSupport(model.id))}
                                                            {model.recommended && (
                                                                <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                                            )}
                                                        </span>
                                                        {currentImageModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                        {availableImageModels.filter(m => m.provider === 'hosted').length > 0 && (
                                            <>
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                                    OpenAiTeach
                                                </div>
                                                {availableImageModels.filter(m => m.provider === 'hosted').map(model => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleImageModelChange(model.id)}
                                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel?.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Sparkles size={12} className="text-violet-400" />
                                                            {model.name}
                                                            {renderExecutionBadge(getImageExecutionSupport(model.id))}
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
                                                            {renderExecutionBadge(getImageExecutionSupport(model.id))}
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
                                                            {renderExecutionBadge(getImageExecutionSupport(model.id))}
                                                        </span>
                                                        {currentImageModel?.id === model.id && <Check size={12} />}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {hailuoFrameExecutionNotice && !isOfflineReadonlyVideoNode && (
                            <div className={`px-2.5 py-1.5 rounded-lg text-[11px] border ${isDark ? 'bg-sky-500/10 border-sky-500/30 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                                {hailuoFrameExecutionNotice}
                            </div>
                        )}
                        {hailuoStandardReferenceNotice && !isOfflineReadonlyVideoNode && (
                            <div className={`px-2.5 py-1.5 rounded-lg text-[11px] border ${isDark ? 'bg-sky-500/10 border-sky-500/30 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                                {hailuoStandardReferenceNotice}
                            </div>
                        )}
                    </div>

                    {!isOfflineReadonlyVideoNode && !isLiblibImagePanel && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Unified Size/Ratio Dropdown (hidden for video nodes in motion-control mode) */}
                            {(isVideoNode || isImageNode || isLocalVideoNode) && !(isVideoNode && videoGenerationMode === 'motion-control') && (!isVideoNode || canEditVideoParameters) && (
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => !shouldLockVideoParameterControls && setShowSizeDropdown(!showSizeDropdown)}
                                        disabled={shouldLockVideoParameterControls}
                                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${selectBtn} ${shouldLockVideoParameterControls ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        {!isVideoNode && currentImageModel?.resolutions?.length && !isLiblibImagePanel && (
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
                        {isVideoNode && canEditVideoParameters && videoGenerationMode !== 'motion-control' && availableVideoAspectRatios.length > 0 && (
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
                        {isVideoNode && canEditVideoParameters && videoGenerationMode !== 'motion-control' && availableDurations.length > 0 && (
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
                            const isStandardVideoInputBlocked = selectedVideoMode === 'standard' && Boolean(standardVideoBlockedReason);
                            const isImageToVideoPrimary = isVideoNode && Boolean(inputUrl) && selectedVideoMode === 'standard';
                            const isHostedTokenMissing =
                                (isVideoNode && currentVideoExecutionSupport?.mode === 'hosted-token' && !hasHostedToken) ||
                                (isRegistryImageNode && currentImageExecutionSupport?.mode === 'hosted-token' && !hasHostedToken);
                            const isModelUnavailable =
                                (isVideoNode && !hasAvailableVideoModels) ||
                                (isRegistryImageNode && !hasAvailableImageModels) ||
                                (isAudioNode && !hasAvailableVoiceModels);
                            const isGenerateBlocked = isFaceModeBlocked || isLocalVideoBlocked || isInvalidFrameMode || isInvalidMotionMode || isUnsupportedSelectedMode || isStandardVideoInputBlocked || isHostedTokenMissing || isModelUnavailable || shouldLockVideoParameterControls;
                            const generateTitle = isModelUnavailable
                                ? isVideoNode
                                    ? '当前模式下没有可用的视频模型'
                                    : isAudioNode
                                        ? '当前没有可用的语音模型'
                                    : '当前输入条件下没有可用的图片模型'
                                : isHostedTokenMissing
                                ? isVideoNode
                                    ? '当前视频模式需要先在设置里绑定 OpenAiTeach Token。'
                                    : '当前图片模型需要先在设置里绑定 OpenAiTeach Token。'
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
                                        : isStandardVideoInputBlocked
                                            ? (standardVideoBlockedReason ?? '当前视频模型尚未接通当前标准输入模式，请切换模型或调整输入后再试。')
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
                                    className={`group ${isImageToVideoPrimary ? 'h-10 rounded-full px-4 gap-2' : 'w-9 h-9 rounded-full'} flex items-center justify-center transition-all duration-200 ${isGenerateBlocked
                                        ? 'bg-neutral-700/50 cursor-not-allowed opacity-50'
                                        : isDark
                                            ? 'bg-white text-neutral-900 hover:bg-neutral-100 active:scale-95'
                                            : 'bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95'
                                        }`}
                                    title={generateTitle}
                                    >
                                    {isImageToVideoPrimary && (
                                        <span className="text-sm font-semibold whitespace-nowrap">生成视频</span>
                                    )}
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
                    )}
                </div>
            )}

            {isVideoNode && shouldLockVideoParameterControls && (
                <div className={`mt-2 pt-2 border-t ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                    <div className={`rounded-xl border px-3 py-3 text-xs leading-6 ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        当前视频模型已下线，参数区和高级设置已切换为只读提示态。
                        请先从模型下拉切换到仍可执行的视频模型，再继续调整秒数、比例、分辨率或高级模式。
                    </div>
                </div>
            )}


            {/* Advanced Settings Drawer - Only for Video nodes */}
            {
                isVideoNode && canEditVideoParameters && (
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
                                {/* Audio Toggle - Capability driven */}
                                {!shouldLockVideoParameterControls && currentVideoModeCapability?.supportsAudio && (
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

                                {!shouldLockVideoParameterControls && standardReferencePreviewItems.length > 0 && (
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
                                                                        alt={input.label}
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                )
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
                                                                        alt={t('nodeControls.characterRef')}
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
            {showCameraControl && createPortal(
                <CameraControlOverlay
                    selection={cameraControlSelection}
                    onChange={setCameraControlSelection}
                    onClose={() => setShowCameraControl(false)}
                    onUse={applyCameraControlSelection}
                />,
                document.body
            )}
        </div >
    );
};

function CameraControlOverlay({
    selection,
    onChange,
    onClose,
    onUse,
}: {
    selection: CameraControlSelection;
    onChange: (selection: CameraControlSelection) => void;
    onClose: () => void;
    onUse: () => void;
}) {
    const update = (key: keyof CameraControlSelection, direction: 1 | -1) => {
        const values = CAMERA_CONTROL_OPTIONS[key];
        const next = (selection[key] + direction + values.length) % values.length;
        onChange({ ...selection, [key]: next });
    };

    const columns: Array<{
        key: keyof CameraControlSelection;
        label: string;
        image?: string;
        value: string;
        suffix?: string;
    }> = [
        { key: 'camera', label: '相机', value: CAMERA_CONTROL_OPTIONS.camera[selection.camera], image: '▧' },
        { key: 'lens', label: '镜头', value: CAMERA_CONTROL_OPTIONS.lens[selection.lens], image: '▭' },
        { key: 'focal', label: '焦距', value: CAMERA_CONTROL_OPTIONS.focal[selection.focal], suffix: 'mm' },
        { key: 'aperture', label: '光圈', value: CAMERA_CONTROL_OPTIONS.aperture[selection.aperture], image: '◉' },
    ];

    return (
        <div className="fixed inset-0 z-[2400] flex items-center justify-center bg-black/38 backdrop-blur-[1px]">
            <div className="w-[1080px] overflow-hidden rounded-[18px] border border-white/10 bg-[#242424] text-white shadow-[0_34px_120px_rgba(0,0,0,0.55)]">
                <div className="flex h-[82px] items-center justify-between border-b border-white/8 px-8">
                    <div className="text-[24px] font-semibold tracking-[0.02em]">摄像机控制</div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-12 w-12 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/8 hover:text-white"
                        aria-label="关闭摄像机控制"
                    >
                        <span className="text-[42px] leading-none">×</span>
                    </button>
                </div>

                <div className="px-16 py-12">
                    <div className="grid grid-cols-4 gap-12">
                        {columns.map((column) => (
                            <div key={column.key} className="flex flex-col items-center">
                                <button
                                    type="button"
                                    onClick={() => update(column.key, -1)}
                                    className="mb-4 text-neutral-400 transition-colors hover:text-white"
                                    aria-label={`${column.label}上一个`}
                                >
                                    ˄
                                </button>
                                <div className="flex h-[160px] w-[156px] flex-col items-center justify-center rounded-[22px] border border-white/10 bg-[#2b2b2b] shadow-[inset_0_0_40px_rgba(255,255,255,0.025)]">
                                    <div className="mb-5 text-[20px] font-medium text-neutral-400">{column.label}</div>
                                    {column.image ? (
                                        <div className="text-[54px] font-semibold text-neutral-300">{column.image}</div>
                                    ) : (
                                        <div className="text-[44px] font-semibold text-white">{column.value}</div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => update(column.key, 1)}
                                    className="mt-8 text-neutral-500 transition-colors hover:text-white"
                                    aria-label={`${column.label}下一个`}
                                >
                                    ˅
                                </button>
                                <div className="mt-9 min-h-8 text-center text-[20px] font-medium text-neutral-500">
                                    {column.suffix ? `${column.value} ${column.suffix}` : column.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 flex justify-end">
                        <button
                            type="button"
                            onClick={onUse}
                            className="rounded-[16px] bg-[#2f8cff] px-8 py-4 text-[22px] font-medium text-white shadow-[0_16px_34px_rgba(47,140,255,0.25)] transition-colors hover:bg-[#4b9dff] active:scale-[0.98]"
                        >
                            使用
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Memoize to prevent re-renders when parent state changes
export const NodeControls = memo(NodeControlsComponent);
