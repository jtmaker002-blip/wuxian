/**
 * NodeContent.tsx
 * 
 * Displays the content area of a canvas node.
 * Handles result display (image/video) and placeholder states.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Loader2, Maximize2, ImageIcon as ImageIcon, Film, Upload, Pencil, Video, GripVertical, Download, Expand, Shrink, HardDrive, AudioLines, Sparkles, Layers3 } from 'lucide-react';
import { NodeData, NodeStatus, NodeType } from '../../types';
import { useTranslation } from 'react-i18next';
import { getLiblibBlankImageNodeState } from './image-node/imageNodeUiState';
import { SceneResultPanel } from './SceneResultPanel';

function formatExecutionProviderLabel(provider?: string): string | undefined {
    if (!provider) return undefined;
    switch (provider) {
        case 'fal':
            return 'FAL';
        case 'fal-wan':
            return 'FAL / Wan';
        case 'hailuo':
            return 'Hailuo';
        case 'kling':
            return 'Kling';
        case 'openai-video':
            return 'OpenAI';
        case 'xai-video':
            return 'xAI';
        case 'seedance':
            return '即梦 / Seedance';
        case 'veo':
            return 'Google Veo';
        default:
            return provider;
    }
}

interface NodeContentProps {
    data: NodeData;
    inputUrl?: string;
    inputMediaType?: NodeType;
    selected: boolean;
    isIdle: boolean;
    isLoading: boolean;
    isSuccess: boolean;
    getAspectRatioStyle: () => { aspectRatio: string };
    onUpload?: (nodeId: string, dataUrl: string) => void;
    onExpand?: (imageUrl: string) => void;
    onDragStart?: (nodeId: string, hasContent: boolean) => void;
    onDragEnd?: () => void;
    // Text node callbacks
    onWriteContent?: (nodeId: string) => void;
    onTextToVideo?: (nodeId: string) => void;
    onTextToImage?: (nodeId: string) => void;
    // Image node callbacks
    onImageToImage?: (nodeId: string) => void;
    onImageToVideo?: (nodeId: string) => void;
    onUpdate?: (nodeId: string, updates: Partial<NodeData>) => void;
    // Social sharing
    onPostToX?: (nodeId: string, mediaUrl: string, mediaType: 'image' | 'video') => void;
    onGenerate?: (nodeId: string) => void;
    onCancelGeneration?: (nodeId: string) => void;
    onSendSceneImageToNode?: (sourceNodeId: string, image: { url: string; label?: string }, action: 'image-node' | 'upscale-node') => void;
    canvasTheme?: 'dark' | 'light';
}

export const NodeContent: React.FC<NodeContentProps> = ({
    data,
    inputUrl,
    inputMediaType,
    selected,
    isIdle,
    isLoading,
    isSuccess,
    getAspectRatioStyle,
    onUpload,
    onExpand,
    onDragStart,
    onDragEnd,
    onWriteContent,
    onTextToVideo,
    onTextToImage,
    onImageToImage,
    onImageToVideo,
    onUpdate,
    onPostToX,
    onGenerate,
    onCancelGeneration,
    onSendSceneImageToNode,
    canvasTheme = 'dark'
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isDark = canvasTheme === 'dark';

    // Local state for text node textarea to prevent lag
    const [localPrompt, setLocalPrompt] = useState(data.prompt || '');
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentPromptRef = useRef<string | undefined>(data.prompt); // Track what we sent

    // Helper: Check if node is image-type (includes local image model)
    const isImageType = data.type === NodeType.IMAGE || data.type === NodeType.LOCAL_IMAGE_MODEL;
    // Helper: Check if node is video-type (includes local video model)
    const isVideoType = data.type === NodeType.VIDEO || data.type === NodeType.LOCAL_VIDEO_MODEL;
    const isAudioType = data.type === NodeType.AUDIO;
    // Helper: Check if node is local model
    const isLocalModel = data.type === NodeType.LOCAL_IMAGE_MODEL || data.type === NodeType.LOCAL_VIDEO_MODEL;
    const blankImageUiState = getLiblibBlankImageNodeState({
        selected,
        isImageType,
        isLocalModel,
        hasUploadHandler: Boolean(onUpload),
    });
    const effectiveInputUrl = inputUrl || data.inputUrl;
    const effectiveInputMediaType = inputMediaType || (data.inputUrl ? NodeType.IMAGE : undefined);
    const isVideoFromImageFlow = isVideoType && Boolean(effectiveInputUrl);
    const activeGridSplit = data.imageToolMode === 'grid-split-select' ? data.gridSplit : undefined;
    const progressPercent = typeof data.taskInfo?.progressPercent === 'number'
        ? Math.max(0, Math.min(100, Math.round(data.taskInfo.progressPercent)))
        : undefined;
    const requestedVideoModelLabel = isVideoType ? (data.requestedVideoModel || data.videoModel) : undefined;
    const actualVideoModelLabel = isVideoType ? data.executedVideoModel : undefined;
    const executedVideoModeLabel = isVideoType ? data.executedVideoMode : undefined;
    const executionProviderLabel = isVideoType ? formatExecutionProviderLabel(data.executionProvider) : undefined;
    const shouldShowVideoModelDiff =
        Boolean(requestedVideoModelLabel) &&
        Boolean(actualVideoModelLabel) &&
        requestedVideoModelLabel !== actualVideoModelLabel;

    const renderVideoModelBadges = (extraClassName = '') => {
        if (!isVideoType) return null;

        if (shouldShowVideoModelDiff && requestedVideoModelLabel && actualVideoModelLabel) {
            return (
                <div className={`absolute left-2 top-2 z-10 flex flex-col gap-1 ${extraClassName}`.trim()}>
                    <span className="rounded-md bg-black/65 px-2 py-1 text-[10px] font-medium text-white/90">
                        请求模型：{requestedVideoModelLabel}
                    </span>
                    <span className="rounded-md bg-amber-500/85 px-2 py-1 text-[10px] font-medium text-white">
                        实际执行：{actualVideoModelLabel}
                    </span>
                    {executedVideoModeLabel && (
                        <span className="rounded-md bg-sky-500/85 px-2 py-1 text-[10px] font-medium text-white">
                            执行档位：{executedVideoModeLabel}
                        </span>
                    )}
                    {executionProviderLabel && (
                        <span className="rounded-md bg-indigo-500/85 px-2 py-1 text-[10px] font-medium text-white">
                            执行通道：{executionProviderLabel}
                        </span>
                    )}
                </div>
            );
        }

        const singleModelLabel = actualVideoModelLabel || requestedVideoModelLabel;
        if (!singleModelLabel) return null;

        return (
            <div className={`absolute left-2 top-2 z-10 flex flex-col gap-1 ${extraClassName}`.trim()}>
                <span className="rounded-md bg-black/65 px-2 py-1 text-[10px] font-medium text-white/90">
                    模型：{singleModelLabel}
                </span>
                {executedVideoModeLabel && (
                    <span className="rounded-md bg-sky-500/85 px-2 py-1 text-[10px] font-medium text-white">
                        执行档位：{executedVideoModeLabel}
                    </span>
                )}
                {executionProviderLabel && (
                    <span className="rounded-md bg-indigo-500/85 px-2 py-1 text-[10px] font-medium text-white">
                        执行通道：{executionProviderLabel}
                    </span>
                )}
            </div>
        );
    };

    // Sync local state ONLY when data.prompt changes externally (not from our own update)
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

    const handleTextChange = (value: string) => {
        setLocalPrompt(value); // Update local state immediately
        lastSentPromptRef.current = value; // Track that we're about to send this

        // Debounce parent update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
            onUpdate?.(data.id, { prompt: value });
        }, 150);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUpload) return;
        onUpdate?.(data.id, { title: file.name.replace(/\.[^.]+$/, '') || file.name });

        const reader = new FileReader();
        reader.onloadend = () => {
            onUpload(data.id, reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const progressOverlay = isLoading ? (
        <div className="pointer-events-auto absolute inset-0 z-[80] flex items-center justify-center bg-black/18 backdrop-blur-[1px]">
            <div className="flex h-12 items-center overflow-hidden rounded-[12px] border border-white/18 bg-[#2a2a2a]/92 text-white shadow-[0_18px_54px_rgba(0,0,0,0.42)]">
                <div className="px-4 text-[16px] font-semibold tracking-[0.01em]">
                    生成中 {progressPercent !== undefined ? `${progressPercent}%...` : '...'}
                </div>
                <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        onCancelGeneration?.(data.id);
                    }}
                    className="h-full border-l border-white/12 px-4 text-[15px] font-medium text-white/48 transition-colors hover:bg-white/8 hover:text-white"
                >
                    取消
                </button>
            </div>
        </div>
    ) : null;

    return (
        <div className={`relative transition-all duration-200 ${!selected ? 'p-0 rounded-[28px] overflow-hidden' : 'p-0'}`}>
            {/* Hidden File Input - Always rendered for upload functionality */}
            {(isImageType || isVideoType) && onUpload && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={isVideoType ? 'video/*' : 'image/*'}
                    className="hidden"
                    onChange={handleFileChange}
                />
            )}

            {data.scene ? (
                <>
                    <SceneResultPanel
                        data={data}
                        selected={selected}
                        isLoading={isLoading}
                        onGenerate={onGenerate}
                        onUpdate={onUpdate}
                        onSendImageToNode={onSendSceneImageToNode}
                    />
                    {progressOverlay}
                </>
            ) : (isSuccess || isLoading) && data.resultUrl ? (
                <div
                    className={`relative w-full bg-black group/image ${!selected ? '' : 'rounded-[28px] overflow-hidden'}`}
                    style={getAspectRatioStyle()}
                >
                    {isAudioType ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800 p-6">
                            <audio src={data.resultUrl} controls className="w-full max-w-[280px]" />
                        </div>
                    ) : isVideoType ? (
                        <>
                            <video src={data.resultUrl} controls loop className="w-full h-full object-cover" />
                            {renderVideoModelBadges()}
                        </>
                    ) : (
                        <>
                            <img src={data.resultUrl} alt="Generated" className="w-full h-full object-cover pointer-events-none" />
                            {selected && isImageType && activeGridSplit && onUpdate && (
                                <div
                                    className="absolute inset-0 z-20 grid overflow-hidden rounded-[inherit] border border-blue-300/80 bg-black/10"
                                    style={{
                                        gridTemplateColumns: `repeat(${activeGridSplit.cols}, minmax(0, 1fr))`,
                                        gridTemplateRows: `repeat(${activeGridSplit.rows}, minmax(0, 1fr))`,
                                    }}
                                >
                                    {Array.from({ length: activeGridSplit.rows * activeGridSplit.cols }, (_, index) => {
                                        const row = Math.floor(index / activeGridSplit.cols);
                                        const col = index % activeGridSplit.cols;
                                        const isChosen = activeGridSplit.selectedIndexes.includes(index);
                                        return (
                                            <button
                                                key={index}
                                                type="button"
                                                onPointerDown={(event) => event.stopPropagation()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    const batchIndexes = Array.from(
                                                        { length: activeGridSplit.rows * activeGridSplit.cols },
                                                        (_, cellIndex) => cellIndex
                                                    ).filter((cellIndex) => {
                                                        const cellRow = Math.floor(cellIndex / activeGridSplit.cols);
                                                        const cellCol = cellIndex % activeGridSplit.cols;
                                                        return cellRow <= row && cellCol <= col;
                                                    });
                                                    const selectedIndexes = event.shiftKey
                                                        ? Array.from(new Set([...activeGridSplit.selectedIndexes, ...batchIndexes])).sort((a, b) => a - b)
                                                        : isChosen
                                                        ? activeGridSplit.selectedIndexes.filter((item) => item !== index)
                                                        : [...activeGridSplit.selectedIndexes, index].sort((a, b) => a - b);
                                                    onUpdate(data.id, {
                                                        gridSplit: {
                                                            ...activeGridSplit,
                                                            selectedIndexes,
                                                        },
                                                    });
                                                }}
                                                className={`relative border border-blue-300/70 transition-colors ${
                                                    isChosen ? 'bg-blue-500/18 ring-2 ring-inset ring-blue-300' : 'bg-transparent hover:bg-blue-300/10'
                                                }`}
                                                title={`${row + 1}-${col + 1}`}
                                            >
                                                {isChosen && (
                                                    <span className="absolute left-1/2 top-1/2 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/58 px-1.5 text-[11px] font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
                                                        {row + 1}-{col + 1}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                    <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/62 px-2.5 py-1 text-[10px] font-medium text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                                        按住 Shift 键可批量选择
                                    </div>
                                </div>
                            )}
                            {data.imageAnnotations?.map((annotation, annotationIndex) => {
                                const colorClass =
                                    annotation.type === 'preserve'
                                        ? 'border-emerald-300 bg-emerald-400/15 text-emerald-100'
                                        : annotation.type === 'ignore'
                                            ? 'border-rose-300 bg-rose-400/15 text-rose-100'
                                            : annotation.type === 'reference'
                                                ? 'border-sky-300 bg-sky-400/15 text-sky-100'
                                                : 'border-amber-300 bg-amber-400/15 text-amber-100';

                                return (
                                    <div
                                        key={annotation.id}
                                        className={`absolute z-20 rounded-[10px] border-2 ${colorClass} shadow-[0_0_18px_rgba(255,255,255,0.28),0_10px_28px_rgba(0,0,0,0.35)] ring-1 ring-black/35`}
                                        style={{
                                            left: `${annotation.selection.x * 100}%`,
                                            top: `${annotation.selection.y * 100}%`,
                                            width: `${annotation.selection.width * 100}%`,
                                            height: `${annotation.selection.height * 100}%`,
                                        }}
                                    >
                                        <div className={`absolute left-1 top-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-md ${colorClass}`}>
                                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-black/35 text-[9px] text-white">
                                                {annotationIndex + 1}
                                            </span>
                                            <span className="min-w-0 truncate">{annotation.label}</span>
                                            {selected && onUpdate && (
                                                <button
                                                    type="button"
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onUpdate(data.id, {
                                                            imageAnnotations: (data.imageAnnotations || []).filter((item) => item.id !== annotation.id),
                                                        });
                                                    }}
                                                    className="ml-0.5 rounded-full bg-black/32 px-1.5 py-0.5 text-[9px] text-white/86 transition-colors hover:bg-black/55 hover:text-white"
                                                    title="删除标记"
                                                >
                                                    删除
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {selected && isImageType && !isLocalModel && !activeGridSplit && (
                                <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-[14px] border border-white/14 bg-black/58 px-3 py-2 text-[11px] font-medium text-white/92 shadow-[0_14px_34px_rgba(0,0,0,0.34)] backdrop-blur-md">
                                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-black">1</span>
                                    <span>素材 · 当前节点</span>
                                </div>
                            )}
                            {selected && onUpload && !activeGridSplit && (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/14 bg-[#303030]/90 text-white shadow-[0_16px_34px_rgba(0,0,0,0.3)] backdrop-blur transition-colors hover:bg-[#3d3d3d]"
                                    title="替换素材"
                                >
                                    <Upload size={18} />
                                </button>
                            )}
                        </>
                    )}

                    {progressOverlay}
                </div>
            ) : data.type === NodeType.TEXT ? (
                /* Text Node - Menu or Editing Mode */
                <div className={`relative w-full rounded-2xl overflow-hidden ${selected ? 'ring-1 ring-blue-500/30' : ''} ${isDark ? 'bg-[#1a1a1a]' : 'bg-neutral-50 border border-neutral-200'}`}>
                    {data.textMode === 'editing' ? (
                        /* Editing Mode - Text Area */
                        <div className="p-4">
                            <textarea
                                value={localPrompt}
                                onChange={(e) => handleTextChange(e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onBlur={() => {
                                    // Ensure final value is saved on blur
                                    if (updateTimeoutRef.current) {
                                        clearTimeout(updateTimeoutRef.current);
                                    }
                                    if (localPrompt !== data.prompt) {
                                        onUpdate?.(data.id, { prompt: localPrompt });
                                    }
                                }}
                                placeholder={t('nodeContent.writeTextHere')}
                                className={`w-full bg-transparent text-sm resize-none outline-none ${isDark ? 'text-white placeholder:text-neutral-600' : 'text-neutral-900 placeholder:text-neutral-400'}`}
                                style={{ minHeight: data.isPromptExpanded ? '300px' : '150px' }}
                                autoFocus
                            />
                            {/* Expand/Shrink Button */}
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={() => onUpdate?.(data.id, { isPromptExpanded: !data.isPromptExpanded })}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${isDark ? 'text-neutral-500 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'}`}
                                    title={data.isPromptExpanded ? t('nodeContent.shrinkPrompt') : t('nodeContent.expandPrompt')}
                                >
                                    {data.isPromptExpanded ? <Shrink size={12} /> : <Expand size={12} />}
                                    <span>{data.isPromptExpanded ? t('nodeContent.shrink') : t('nodeContent.expand')}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Menu Mode - Show Options */
                        <div className="p-5 flex flex-col gap-4">
                            {/* Header */}
                            <div className="text-neutral-500 text-sm font-medium">
                                {t('nodeContent.tryTo')}
                            </div>

                            {/* Menu Options */}
                            <div className="flex flex-col gap-1">
                                <TextNodeMenuItem
                                    icon={<Pencil size={16} />}
                                    label={t('nodeContent.writeOwnContent')}
                                    onClick={() => onWriteContent?.(data.id)}
                                    canvasTheme={canvasTheme}
                                />
                                <TextNodeMenuItem
                                    icon={<Video size={16} />}
                                    label={t('nodeContent.textToVideo')}
                                    onClick={() => onTextToVideo?.(data.id)}
                                    canvasTheme={canvasTheme}
                                />
                                <TextNodeMenuItem
                                    icon={<ImageIcon size={16} />}
                                    label={t('nodeContent.textToImage')}
                                    onClick={() => onTextToImage?.(data.id)}
                                    canvasTheme={canvasTheme}
                                />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Placeholder / Empty State for Image/Video */
                <div
                    className={`relative w-full flex flex-col items-center justify-center gap-3 overflow-hidden
            ${isLoading ? 'animate-pulse' : ''} 
            ${!selected
                ? isVideoType ? 'rounded-[18px]' : 'rounded-[28px]'
                : isImageType && !isLocalModel
                    ? (isDark ? 'rounded-[28px] border border-white/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]' : 'rounded-[28px] border border-neutral-300')
                    : isVideoType
                        ? `rounded-[30px] border-2 ${isDark ? 'border-white/55 bg-[#2b2b2b]' : 'border-neutral-500 bg-[#2b2b2b]'}`
                        : `rounded-xl border border-dashed ${isDark ? 'border-white/10' : 'border-neutral-300'}`}
            ${isVideoType ? 'bg-[#242424]' : isDark ? (isImageType && !isLocalModel && selected ? 'bg-[#1b1b1b]' : 'bg-[#141414]') : 'bg-neutral-50'}`
                    }
                    style={getAspectRatioStyle()}
                >
                    {blankImageUiState.showSelectedBlankFrame && (
                        <div className="pointer-events-none absolute inset-3 rounded-[24px] border border-dashed border-white/16 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))]" />
                    )}
                    {blankImageUiState.showSelectedBlankFrame && (
                        <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/28 px-3 py-1 text-[10px] font-medium text-neutral-300">
                            图片素材
                        </div>
                    )}
                    {renderVideoModelBadges()}

                    {/* Input Image Preview for Video Nodes */}
                    {isVideoType && effectiveInputUrl && (
                        <div className="absolute inset-0 z-0">
                            {effectiveInputMediaType === NodeType.VIDEO ? (
                                <video
                                    src={effectiveInputUrl}
                                    className="w-full h-full object-cover opacity-65 blur-[1px] saturate-[0.9]"
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            ) : (
                                <img src={effectiveInputUrl} alt="Input Frame" className="w-full h-full object-cover opacity-65 blur-[1px] saturate-[0.9]" />
                            )}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.36),rgba(0,0,0,0.64))]" />
                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] text-white font-medium flex items-center gap-1">
                                {effectiveInputMediaType === NodeType.VIDEO ? <Film size={10} /> : <ImageIcon size={10} />}
                                {effectiveInputMediaType === NodeType.VIDEO ? t('nodeControls.motionRef') : t('nodeContent.inputFrame')}
                            </div>
                            {!selected && (
                                <div className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/38 px-3 py-1 text-[10px] font-medium tracking-[0.02em] text-white/88">
                                    图生视频
                                </div>
                            )}
                            {selected && (
                                <>
                                    <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-black/42 px-4 py-4 text-center text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm">
                                        <div className="text-[13px] font-semibold tracking-[0.02em]">图生视频主路径</div>
                                        <div className="mt-1 text-[11px] text-white/82">
                                            素材已接入，继续补充镜头、动作、运镜描述后即可生成
                                        </div>
                                    </div>
                                    <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-[11px] text-white/90">
                                        已引用图片素材，继续描述视频内容后即可生成
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="relative z-10 flex flex-col items-center gap-2">
                            <Loader2 size={32} className="animate-spin text-blue-400" />
                            <span className="text-xs text-neutral-500 font-medium">{t('nodeContent.generating')}</span>
                        </div>
                    ) : isVideoType && selected ? (
                        <>
                            {onUpload && !isVideoFromImageFlow && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="absolute left-1/2 top-0 z-20 flex h-14 -translate-x-1/2 -translate-y-[72px] items-center gap-2 rounded-[20px] border border-white/10 bg-[#2d2d2d] px-6 text-[16px] font-medium text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition-colors hover:bg-[#363636]"
                                >
                                    <Upload size={20} />
                                    上传
                                </button>
                            )}

                            <div className="relative z-10 h-full w-full">
                                <div className="absolute left-1/2 top-[34%] flex h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[16px] bg-white/16 text-black/70">
                                    <svg viewBox="0 0 24 24" className="ml-1 h-12 w-12" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>
                                <div className="absolute left-10 top-[49%] flex flex-col gap-6 text-white">
                                    <div className="text-[20px] font-medium tracking-[0.01em] text-white/56">尝试:</div>
                                    <button
                                        type="button"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onUpdate?.(data.id, { videoPanelMode: 'frames2video', videoMode: 'frame-to-frame' });
                                        }}
                                        className="flex items-center gap-3 text-[18px] font-medium text-white/92 transition-colors hover:text-white"
                                    >
                                        <Layers3 size={20} />
                                        <span>首尾帧生成视频</span>
                                    </button>
                                    <button
                                        type="button"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onUpdate?.(data.id, { videoPanelMode: 'singleImage2video', videoMode: 'standard' });
                                        }}
                                        className="flex items-center gap-3 text-[18px] font-medium text-white/92 transition-colors hover:text-white"
                                    >
                                        <Sparkles size={20} />
                                        <span>首帧生成视频</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            {/* Upload Button for Image/Video Nodes */}
                            {(isImageType || isVideoType) && onUpload && !isVideoType && !isVideoFromImageFlow && !(selected && isImageType && !isLocalModel) && (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={isVideoType ? 'video/*' : 'image/*'}
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'border border-white/10 bg-[#2a2a2a] hover:bg-[#343434] text-white' : 'bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200'}`}
                                    >
                                        <Upload size={16} />
                                        {t('nodeContent.upload')}
                                    </button>
                                </>
                            )}

                            {isAudioType && (
                                <>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-neutral-800 text-cyan-300' : 'bg-neutral-200 text-cyan-700'}`}>
                                        <AudioLines size={28} />
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-neutral-900'}`}>语音节点</div>
                                        <div className="text-xs text-neutral-500">输入文本后可走统一语音生成入口</div>
                                    </div>
                                </>
                            )}

                            <div className={`relative ${blankImageUiState.showMutedIcon ? 'text-neutral-500/55 opacity-55' : 'text-neutral-700'}`}>
                                {isVideoType ? (
                                    <div className="flex h-[72px] w-[96px] items-center justify-center rounded-[12px] bg-white/18 text-black/70">
                                        <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        {isLocalModel && <HardDrive size={16} className="absolute -bottom-1 -right-1 text-purple-400" />}
                                    </div>
                                ) : (
                                    isLocalModel ? <><ImageIcon size={selected ? 48 : 40} /><HardDrive size={16} className="absolute -bottom-1 -right-1 text-purple-400" /></> : <ImageIcon size={selected ? 48 : 40} />
                                )}
                            </div>
                            {blankImageUiState.showSelectedUploadCta && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="flex items-center gap-2 rounded-[14px] border border-white/12 bg-[#252525]/92 px-4 py-2.5 text-xs font-medium text-neutral-100 shadow-[0_16px_36px_rgba(0,0,0,0.34)] transition-colors hover:border-white/18 hover:bg-[#303030] hover:text-white"
                                >
                                    <Upload size={14} />
                                    上传或拖入素材
                                </button>
                            )}
                            {selected && (
                                <>
                                    {!isVideoType && (() => {
                                        const placeholderHeadline = isVideoFromImageFlow
                                            ? '图生视频准备就绪'
                                            : isVideoType
                                                ? t('nodeContent.waitingForInput')
                                                : isImageType && !isLocalModel
                                                    ? blankImageUiState.headline
                                                : isLocalModel
                                                    ? t('nodeContent.selectModelAndPrompt')
                                                    : t('nodeContent.tryTo');

                                        return placeholderHeadline ? (
                                            <div className={`${isDark ? 'text-neutral-400' : 'text-neutral-500'} text-sm font-medium`}>
                                                {placeholderHeadline}
                                            </div>
                                        ) : null;
                                    })()}
                                    {isVideoFromImageFlow && (
                                        <div className={`rounded-xl border px-3 py-2 text-center text-xs ${isDark ? 'border-white/10 bg-black/25 text-neutral-200' : 'border-neutral-200 bg-white text-neutral-700'}`}>
                                            当前节点已切入图生视频主路径。保留连接素材，直接在下方描述镜头与动作即可。
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {progressOverlay}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface TextNodeMenuItemProps {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}

/**
 * Menu item component for Text node options
 */
const TextNodeMenuItem: React.FC<TextNodeMenuItemProps & { canvasTheme?: 'dark' | 'light' }> = ({ icon, label, onClick, canvasTheme = 'dark' }) => (
    <button
        className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-left transition-colors ${canvasTheme === 'dark' ? 'text-neutral-400 hover:bg-[#252525] hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClick}
    >
        <span className={canvasTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
    </button>
);
