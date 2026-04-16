/**
 * CanvasNode.tsx
 * 
 * Main canvas node component.
 * Orchestrates NodeContent, NodeControls, and NodeConnectors sub-components.
 */

import React from 'react';
import { NodeData, NodeStatus, NodeType } from '../../types';
import type { SceneId } from '../../types/scene';
import { NodeConnectors } from './NodeConnectors';
import { NodeContent } from './NodeContent';
import { NodeControls } from './NodeControls';
import { ChangeAnglePanel } from './ChangeAnglePanel';
import { LightingPanel } from './image-node/LightingPanel';
import { ImageToolMenuPanel } from './image-node/ImageToolMenuPanel';
import { GridSplitMenu, type GridSplitSelection } from '../menus/GridSplitMenu';
import { getControlPanelScale, getControlPanelWidthClassName } from './controlPanelLayout';
import { GRID_SCENE_BY_LABEL } from './libtvSceneLaunchMap';
import { shouldShowImageSuccessToolbar } from './imageToolbarVisibility';
import { getCanvasNodeAspectRatioStyle, getCanvasNodeDimensions } from '../../utils/canvasNodeLayout';
import {
  cropImageBySelection,
  cutoutImageBySelection,
  eraseImageSelection,
  expandImageCanvas,
  applyLightingEffect,
  createNineGridVariant,
  repaintImageSelection,
  upscaleImage2x,
} from '../../utils/imageNodeActions';
import {
  type SwitchableNodeType,
} from '../../config/nodeTypeRegistry';

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

interface CanvasNodeProps {
  data: NodeData;
  inputUrl?: string;
  inputMediaType?: NodeType;
  connectedImageNodes?: { id: string; url: string; type?: NodeType }[]; // For frame-to-frame video mode and motion control
  onUpdate: (id: string, updates: Partial<NodeData>) => void;
  onSwitchType?: (id: string, nextType: SwitchableNodeType) => void;
  onGenerate: (id: string) => void;
  onAddNext: (id: string, type: 'left' | 'right') => void;
  selected: boolean;
  showControls?: boolean; // Only show controls when single node is selected (not in group selection)
  onSelect: (id: string) => void;
  onNodePointerDown: (e: React.PointerEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onConnectorDown: (e: React.PointerEvent, id: string, side: 'left' | 'right') => void;
  isHoveredForConnection?: boolean;
  isImageToVideoDropTarget?: boolean;
  onOpenEditor?: (nodeId: string) => void;
  onUpload?: (nodeId: string, imageDataUrl: string) => void;
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
  onChangeAngleGenerate?: (nodeId: string) => void;
  onQuickAddInputNode?: (nodeId: string, inputType: 'image' | 'video') => void;
  onSplitImageGrid?: (nodeId: string) => void;
  onCreateNineGridTiles?: (nodeId: string, actionLabel: string) => void;
  onLaunchSceneFromImage?: (sourceNodeId: string, scene: SceneId) => void;
  zoom: number;
  // Mouse event callbacks for chat panel drag functionality
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  // Theme
  canvasTheme?: 'dark' | 'light';
  // Social sharing
  onPostToX?: (nodeId: string, mediaUrl: string, mediaType: 'image' | 'video') => void;
  onPostToTikTok?: (nodeId: string, mediaUrl: string) => void;
  onSendSceneImageToNode?: (sourceNodeId: string, image: { url: string; label?: string }, action: 'image-node' | 'upscale-node') => void;
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  data,
  inputUrl,
  inputMediaType,
  connectedImageNodes,
  onUpdate,
  onSwitchType,
  onGenerate,
  onAddNext,
  selected,
  showControls = true, // Default to true for backward compatibility
  onSelect,
  onNodePointerDown,
  onContextMenu,
  onConnectorDown,
  isHoveredForConnection,
  isImageToVideoDropTarget = false,
  onOpenEditor,
  onUpload,
  onExpand,
  onDragStart,
  onDragEnd,
  onWriteContent,
  onTextToVideo,
  onTextToImage,
  onImageToImage,
  onImageToVideo,
  onChangeAngleGenerate,
  onQuickAddInputNode,
  onSplitImageGrid,
  onCreateNineGridTiles,
  onLaunchSceneFromImage,
  zoom,
  onMouseEnter,
  onMouseLeave,
  canvasTheme = 'dark',
  onPostToX,
  onPostToTikTok,
  onSendSceneImageToNode
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(data.title || data.type);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const nodeCardRef = React.useRef<HTMLDivElement>(null);
  const imageToolbarButtonRefs = React.useRef<Partial<Record<'style' | 'mark' | 'grid' | 'enhance' | 'split', HTMLButtonElement | null>>>({});

  const isIdle = data.status === NodeStatus.IDLE || data.status === NodeStatus.ERROR;
  const isLoading = data.status === NodeStatus.LOADING;
  const isSuccess = data.status === NodeStatus.SUCCESS;
  const isLiblibImageNode = data.type === NodeType.IMAGE;
  const isVideoLikeNode = data.type === NodeType.VIDEO || data.type === NodeType.LOCAL_VIDEO_MODEL;
  const isImageToVideoNode = data.type === NodeType.VIDEO && Boolean(inputUrl);
  const imageToolMode = data.imageToolMode || null;
  const lightingSettings = data.imageLightingSettings || {
    mode: 'global' as const,
    smartMode: false,
    brightness: 50,
    color: '#ffffff',
    keyLight: 'front' as const,
    rimLight: false
  };
  const requestedVideoModelLabel = isVideoLikeNode ? (data.requestedVideoModel || data.videoModel) : undefined;
  const actualVideoModelLabel = isVideoLikeNode ? data.executedVideoModel : undefined;
  const executedVideoModeLabel = isVideoLikeNode ? data.executedVideoMode : undefined;
  const executionProviderLabel = isVideoLikeNode ? formatExecutionProviderLabel(data.executionProvider) : undefined;
  const shouldShowVideoModelDiff =
    Boolean(requestedVideoModelLabel) &&
    Boolean(actualVideoModelLabel) &&
    requestedVideoModelLabel !== actualVideoModelLabel;
  const titlePositionStyle = data.type === NodeType.VIDEO
    ? { left: 0, right: 'auto', top: '-44px' }
    : { right: 'calc(100% + 8px)' };
  const activeImageDropdownMode =
    imageToolMode === 'style' || imageToolMode === 'mark' || imageToolMode === 'grid' || imageToolMode === 'enhance' || imageToolMode === 'split'
      ? imageToolMode
      : null;
  const [activeImageDropdownAnchor, setActiveImageDropdownAnchor] = React.useState<{ left: number; top: number } | null>(null);

  const appendPromptHint = React.useCallback((hint: string) => {
    const currentPrompt = data.prompt || '';
    const nextPrompt = currentPrompt.includes(hint)
      ? currentPrompt
      : `${currentPrompt}${currentPrompt ? '\n\n' : ''}${hint}`;
    onUpdate(data.id, { prompt: nextPrompt, imageToolMode: null, imageToolAction: undefined });
  }, [data.id, data.prompt, onUpdate]);

  const applyImageToolAction = React.useCallback(async (mode: 'enhance' | 'grid' | 'split' | 'style', item: string, promptPrefix: string) => {
    const gridScene = mode === 'grid' ? GRID_SCENE_BY_LABEL[item] : undefined;
    if (gridScene && data.resultUrl && onLaunchSceneFromImage) {
      onLaunchSceneFromImage(data.id, gridScene);
      onUpdate(data.id, {
        imageToolMode: null,
        imageToolAction: item,
      });
      return;
    }

    const focusRequiredActions = ['擦除', '重绘', '裁剪', '抠图'];
    if (mode === 'enhance' && focusRequiredActions.includes(item) && data.resultUrl && !data.focusSelection) {
      onUpdate(data.id, {
        imageToolMode: 'focus',
        imageToolAction: item,
        angleMode: false,
      });
      return;
    }

    if (mode === 'enhance' && data.resultUrl && item === '高清') {
      try {
        const result = await upscaleImage2x(data.resultUrl);
        onUpdate(data.id, {
          resultUrl: result.dataUrl,
          resultAspectRatio: result.resultAspectRatio,
          imageToolMode: null,
          imageToolAction: '高清',
          title: `${data.title || 'image'}-hd`,
        });
        return;
      } catch (error) {
        console.error('[ImageNode] Failed to upscale image:', error);
      }
    }

    if (mode === 'enhance' && data.resultUrl && item === '扩图') {
      try {
        const result = await expandImageCanvas(data.resultUrl);
        onUpdate(data.id, {
          resultUrl: result.dataUrl,
          resultAspectRatio: result.resultAspectRatio,
          imageToolMode: null,
          imageToolAction: '扩图',
          title: `${data.title || 'image'}-expand`,
        });
        return;
      } catch (error) {
        console.error('[ImageNode] Failed to expand image canvas:', error);
      }
    }

    if (mode === 'enhance' && data.resultUrl && item === '擦除' && data.focusSelection) {
      try {
        const result = await eraseImageSelection(data.resultUrl, data.focusSelection);
        onUpdate(data.id, {
          resultUrl: result.dataUrl,
          resultAspectRatio: result.resultAspectRatio,
          imageToolMode: null,
          imageToolAction: '擦除',
          title: `${data.title || 'image'}-erase`,
        });
        return;
      } catch (error) {
        console.error('[ImageNode] Failed to erase image selection:', error);
      }
    }

    if (mode === 'enhance' && data.resultUrl && item === '重绘' && data.focusSelection) {
      try {
        const result = await repaintImageSelection(data.resultUrl, data.focusSelection);
        onUpdate(data.id, {
          resultUrl: result.dataUrl,
          resultAspectRatio: result.resultAspectRatio,
          imageToolMode: null,
          imageToolAction: '重绘',
          title: `${data.title || 'image'}-repaint`,
        });
        return;
      } catch (error) {
        console.error('[ImageNode] Failed to repaint image selection:', error);
      }
    }

    if (mode === 'grid' && data.resultUrl) {
      try {
        const result = await createNineGridVariant(data.resultUrl);
        onCreateNineGridTiles?.(data.id, item);
        onUpdate(data.id, {
          resultUrl: result.dataUrl,
          resultAspectRatio: result.resultAspectRatio,
          imageToolMode: null,
          imageToolAction: item,
          title: `${data.title || 'image'}-grid`,
        });
        return;
      } catch (error) {
        console.error('[ImageNode] Failed to create nine-grid variant:', error);
      }
    }

    if (mode === 'enhance' && item === '裁剪' && data.resultUrl && data.focusSelection) {
      try {
        const cropResult = await cropImageBySelection(data.resultUrl, data.focusSelection);
        onUpdate(data.id, {
          resultUrl: cropResult.dataUrl,
          resultAspectRatio: cropResult.resultAspectRatio,
          imageToolMode: null,
          imageToolAction: '裁剪',
          title: `${data.title || 'image'}-crop`,
        });
        return;
      } catch (error) {
        console.error('[ImageNode] Failed to crop image by focus selection:', error);
      }
    }

    if (mode === 'enhance' && item === '抠图' && data.resultUrl && data.focusSelection) {
      try {
        const cropResult = await cutoutImageBySelection(data.resultUrl, data.focusSelection);
        onUpdate(data.id, {
          resultUrl: cropResult.dataUrl,
          resultAspectRatio: cropResult.resultAspectRatio,
          imageToolMode: null,
          imageToolAction: '抠图',
          title: `${data.title || 'image'}-cutout`,
        });
        return;
      } catch (error) {
        console.error('[ImageNode] Failed to cut out image by focus selection:', error);
      }
    }

    const currentPrompt = data.prompt || '';
    const hint = `${promptPrefix}：${item}`;
    const nextPrompt = currentPrompt.includes(hint)
      ? currentPrompt
      : `${currentPrompt}${currentPrompt ? '\n\n' : ''}${hint}`;

    onUpdate(data.id, {
      prompt: nextPrompt,
      imageToolMode: mode,
      imageToolAction: item,
    });
  }, [data.focusSelection, data.id, data.prompt, data.resultUrl, data.title, onCreateNineGridTiles, onLaunchSceneFromImage, onUpdate]);

  const applyGridSplitSelection = React.useCallback((selection: GridSplitSelection) => {
    if (!data.resultUrl) return;
    const actionLabel = selection.mode === 'custom'
      ? `自定义 ${selection.rows}x${selection.cols}`
      : `${selection.rows}x${selection.cols}`;
    onUpdate(data.id, {
      imageToolMode: 'grid-split-select',
      imageToolAction: `宫格切分 · ${actionLabel}`,
      angleMode: false,
      gridSplit: {
        mode: selection.mode,
        rows: selection.rows,
        cols: selection.cols,
        gridType: selection.gridType,
        selectedIndexes: [],
      },
    });
  }, [data.id, data.resultUrl, onUpdate]);

  const startImageAnnotation = React.useCallback((label: string) => {
    const typeByLabel: Record<string, 'reference' | 'note' | 'preserve' | 'ignore'> = {
      添加引用点: 'reference',
      添加局部说明: 'note',
      保留区域: 'preserve',
      忽略区域: 'ignore',
    };
    const annotationType = typeByLabel[label] || 'note';
    const currentPrompt = data.prompt || '';
    const hint = `标记操作：${label}`;
    const nextPrompt = currentPrompt.includes(hint)
      ? currentPrompt
      : `${currentPrompt}${currentPrompt ? '\n\n' : ''}${hint}`;

    onUpdate(data.id, {
      prompt: nextPrompt,
      imageToolMode: 'mark',
      imageToolAction: undefined,
      activeImageAnnotationType: annotationType,
      angleMode: false,
    });
  }, [data.id, data.prompt, onUpdate]);

  const applyLocalLighting = React.useCallback(async () => {
    if (!data.resultUrl) {
      onGenerate(data.id);
      return;
    }

    try {
      const result = await applyLightingEffect(data.resultUrl, lightingSettings);
      onUpdate(data.id, {
        resultUrl: result.dataUrl,
        resultAspectRatio: result.resultAspectRatio,
        imageLightingSettings: lightingSettings,
        imageToolMode: null,
        imageToolAction: '打光',
        title: `${data.title || 'image'}-lighting`,
      });
    } catch (error) {
      console.error('[ImageNode] Failed to apply local lighting:', error);
      onGenerate(data.id);
    }
  }, [data.id, data.resultUrl, data.title, lightingSettings, onGenerate, onUpdate]);

  const setImageToolbarButtonRef = React.useCallback(
    (mode: 'style' | 'mark' | 'grid' | 'enhance' | 'split') => (element: HTMLButtonElement | null) => {
      imageToolbarButtonRefs.current[mode] = element;
    },
    []
  );

  const getImageToolbarButtonClass = React.useCallback(
    (active: boolean) =>
      `group/tool flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[14px] px-3 text-[14px] font-semibold transition-all active:scale-[0.98] ${
        active
          ? 'bg-white text-black shadow-[0_12px_26px_rgba(255,255,255,0.12)]'
          : 'text-white hover:bg-white/10'
      }`,
    []
  );

  const getImageToolbarIconButtonClass = React.useCallback(
    (active: boolean) =>
      `flex h-10 w-10 items-center justify-center rounded-[14px] transition-all active:scale-[0.96] ${
        active
          ? 'bg-white text-black shadow-[0_12px_26px_rgba(255,255,255,0.12)]'
          : 'text-neutral-200 hover:bg-white/8 hover:text-white'
      }`,
    []
  );

  const enhanceMenuItems = [
    {
      label: '高清',
      description: '提升画质细节',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M8 10h8" />
        </svg>
      ),
    },
    {
      label: '扩图',
      description: '向外延展画面',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="m21 3-7 7" />
          <path d="m3 21 7-7" />
        </svg>
      ),
    },
    {
      label: '重绘',
      description: '重做局部内容',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 21 3-3" />
          <path d="m14.5 4.5 5 5" />
          <path d="m12 7 5 5" />
          <path d="m5 19 7-7 5 5-7 7H5v-5Z" />
        </svg>
      ),
    },
    {
      label: '擦除',
      description: '移除不需要区域',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m7 11 7-7 6 6-7 7" />
          <path d="M4 20h11" />
        </svg>
      ),
    },
    {
      label: '抠图',
      description: '提取主体素材',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M9 9h6v6H9z" />
        </svg>
      ),
    },
    {
      label: '裁剪',
      description: '裁掉多余边界',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      ),
    },
  ];
  const gridMenuItems = [
    {
      label: '剧情推演四宫格',
      description: '单镜头拆成四段',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1.2" /><rect x="13" y="3" width="8" height="8" rx="1.2" /><rect x="3" y="13" width="8" height="8" rx="1.2" /><rect x="13" y="13" width="8" height="8" rx="1.2" /></svg>,
    },
    {
      label: '25宫格连贯分镜',
      description: '长镜头连续推演',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" /><path d="M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16" /></svg>,
    },
    {
      label: '电影级光影校正',
      description: '自动统一光色',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><path d="M3 12h18" /><path d="m5 5 14 14" /></svg>,
    },
    {
      label: '角色三视图生成',
      description: '正侧背统一角色',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><circle cx="12" cy="16" r="2.5" /></svg>,
    },
    {
      label: '画面推演 - 3秒后',
      description: '继续延展画面',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v8l5 3" /><circle cx="12" cy="12" r="8" /></svg>,
    },
    {
      label: '画面推演 - 5秒前',
      description: '回推前序画面',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4 scale-x-[-1]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v8l5 3" /><circle cx="12" cy="12" r="8" /></svg>,
    },
  ];
  const styleMenuItems = [
    {
      label: '电影质感',
      description: '高对比电影调色',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16v12H4z" /><path d="M8 6v12M16 6v12" /></svg>,
    },
    {
      label: '电商棚拍',
      description: '干净白棚商品感',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h16" /><path d="m8 20 4-12 4 12" /></svg>,
    },
    {
      label: '胶片颗粒',
      description: '模拟胶片噪点',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></svg>,
    },
    {
      label: '日系清透',
      description: '柔和通透氛围',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><path d="M3 12h18" /><circle cx="12" cy="12" r="4" /></svg>,
    },
    {
      label: '赛博光效',
      description: '高饱和霓虹感',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 5 12h5l-1 10 8-12h-5l0-8Z" /></svg>,
    },
  ];
  const markMenuItems = [
    {
      label: '添加引用点',
      description: '标出后续引用位置',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></svg>,
    },
    {
      label: '添加局部说明',
      description: '补充局部文本提示',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    },
    {
      label: '保留区域',
      description: '告诉模型别动这里',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 12 5 5L20 6" /></svg>,
      badge: 'Keep',
    },
    {
      label: '忽略区域',
      description: '告诉模型忽略这里',
      icon: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>,
      badge: 'Skip',
    },
  ];

  const triggerInlineImageUpload = React.useCallback(() => {
    if (!onUpload) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(data.id, { title: file.name.replace(/\.[^.]+$/, '') || file.name });
        onUpload(data.id, reader.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [data.id, onUpdate, onUpload]);

  // Theme helper
  const isDark = canvasTheme === 'dark';
  // Inverse scaling for toolbar to keep it readable when zooming out
  // Same logic as NodeControls prompt bar
  const minEffectiveScale = 0.8;
  const effectiveScale = Math.max(zoom, minEffectiveScale);
  const localScale = effectiveScale / zoom;
  const controlPanelScale = getControlPanelScale(zoom);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Update local state when data.title changes
  React.useEffect(() => {
    setEditedTitle(data.title || data.type);
  }, [data.title, data.type]);

  // Auto-detect aspect ratio for legacy images/videos that don't have resultAspectRatio
  React.useEffect(() => {
    // Only detect if we have a result but no stored aspect ratio
    if (!isSuccess || !data.resultUrl || data.resultAspectRatio) return;
    if (data.type === NodeType.AUDIO) return;

    if (data.type === NodeType.VIDEO) {
      // Detect video dimensions
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        if (video.videoWidth && video.videoHeight) {
          onUpdate(data.id, { resultAspectRatio: `${video.videoWidth}/${video.videoHeight}` });
        }
      };
      video.src = data.resultUrl;
    } else {
      // Detect image dimensions
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          onUpdate(data.id, { resultAspectRatio: `${img.naturalWidth}/${img.naturalHeight}` });
        }
      };
      img.src = data.resultUrl;
    }
  }, [isSuccess, data.resultUrl, data.resultAspectRatio, data.type, data.id, onUpdate]);

  React.useLayoutEffect(() => {
    if (!activeImageDropdownMode || !nodeCardRef.current) {
      setActiveImageDropdownAnchor(null);
      return;
    }

    const button = imageToolbarButtonRefs.current[activeImageDropdownMode];
    if (!button) {
      setActiveImageDropdownAnchor(null);
      return;
    }

    const updateAnchor = () => {
      const wrapperRect = nodeCardRef.current?.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      if (!wrapperRect) return;

      setActiveImageDropdownAnchor({
        left: (buttonRect.left + buttonRect.width / 2 - wrapperRect.left) / localScale,
        top: (buttonRect.bottom - wrapperRect.top + 10) / localScale,
      });
    };

    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    return () => window.removeEventListener('resize', updateAnchor);
  }, [activeImageDropdownMode, localScale]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getAspectRatioStyle = () => {
    return getCanvasNodeAspectRatioStyle(data);
  };

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== data.type) {
      onUpdate(data.id, { title: trimmed });
    } else if (!trimmed) {
      setEditedTitle(data.title || data.type);
    }
  };

  const nodeDimensions = getCanvasNodeDimensions(data);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Special rendering for Image Editor node
  if (data.type === NodeType.IMAGE_EDITOR) {
    return (
      <div
        className={`absolute flex items-center group/node touch-none pointer-events-auto`}
        style={{
          transform: `translate(${data.x}px, ${data.y}px)`,
          transition: 'box-shadow 0.2s',
          zIndex: selected ? 50 : 10
        }}
        onPointerDown={(e) => onNodePointerDown(e, data.id)}
        onContextMenu={(e) => onContextMenu(e, data.id)}
      >
        <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} selected={selected} canvasTheme={canvasTheme} />

        {/* Image Editor Node Card */}
        <div
          className={`relative rounded-2xl transition-all duration-200 flex flex-col ${inputUrl ? '' : isDark ? 'bg-[#0f0f0f] border border-neutral-700 shadow-2xl' : 'bg-white border border-neutral-200 shadow-lg'} ${selected ? 'ring-1 ring-blue-500/30' : ''}`}
          style={{
            width: inputUrl ? 'auto' : '340px',
            maxWidth: inputUrl ? '500px' : 'none'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onOpenEditor) {
              onOpenEditor(data.id);
            }
          }}
        >
          {/* Header */}
          <div className="absolute -top-8 left-0 text-sm px-2 py-0.5 rounded font-medium text-neutral-600">
            图片编辑器
          </div>

          {/* Content Area */}
          <div
            className={`flex flex-col items-center justify-center ${inputUrl || data.resultUrl ? 'p-0' : 'p-6'}`}
            style={{ minHeight: inputUrl || data.resultUrl ? 'auto' : '380px' }}
          >
            {inputUrl || data.resultUrl ? (
              <img
                src={data.resultUrl || inputUrl}
                alt="Content"
                className={`rounded-xl w-full h-full object-cover ${selected ? 'ring-2 ring-blue-500 shadow-2xl' : ''}`}
                style={{ maxHeight: '500px' }}
                draggable={false}
              />
            ) : (
              <div className="text-neutral-500 text-center text-sm">
                双击打开编辑器
              </div>
            )}
          </div>


        </div>
      </div>
    );
  }

  // Special rendering for Camera Angle node (result view)
  if (data.type === NodeType.CAMERA_ANGLE) {
    return (
      <div
        className={`absolute flex items-center group/node touch-none pointer-events-auto`}
        style={{
          transform: `translate(${data.x}px, ${data.y}px)`,
          transition: 'box-shadow 0.2s',
          zIndex: selected ? 50 : 10
        }}
        onPointerDown={(e) => onNodePointerDown(e, data.id)}
        onContextMenu={(e) => onContextMenu(e, data.id)}
      >
        <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} selected={selected} canvasTheme={canvasTheme} />

        {/* Relative wrapper for the Card */}
        <div className="relative group/nodecard">
          {/* 顶部工具条 - 悬停时显示 */}
          {data.resultUrl && (
            <div
              className="absolute -top-20 left-0 right-0 flex justify-center opacity-0 group-hover/nodecard:opacity-100 transition-opacity z-20"
              style={{
                transform: `scale(${localScale})`,
                transformOrigin: 'bottom center'
              }}
            >
              <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-900/95 rounded-full border border-neutral-700 shadow-xl backdrop-blur-md">
                {/* 多角度按钮 - 重新开启角度调节 */}
                <button
                  onClick={() => onUpdate(data.id, {
                    angleMode: !data.angleMode,
                    angleSettings: data.angleSettings || { rotation: 0, tilt: 0, scale: 0, wideAngle: false }
                  })}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${data.angleMode
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                    }`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  多角度
                </button>
                {/* Separator */}
                <div className="w-px h-4 bg-neutral-600 mx-1" />

                {/* 展开按钮 */}
                <button
                  onClick={() => onExpand?.(data.resultUrl!)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                  title="查看大图"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
                {/* 发布到 X */}
                <button
                  onClick={(e) => { e.stopPropagation(); onPostToX?.(data.id, data.resultUrl!, 'image'); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                  title="发布到 X"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                {/* 下载按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (data.resultUrl) {
                      const filename = `image_${data.id}.png`;
                      const cleanUrl = data.resultUrl.split('?')[0];
                      if (data.resultUrl.startsWith('data:')) {
                        const link = document.createElement('a');
                        link.href = data.resultUrl;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      } else {
                        fetch(cleanUrl, { cache: 'no-store' })
                          .then(res => res.blob())
                          .then(blob => {
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          })
                          .catch(() => {
                            const link = document.createElement('a');
                            link.href = cleanUrl;
                            link.download = filename;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          });
                      }
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                  title="下载"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                {/* 拖到聊天 */}
                <div
                  draggable
                  onPointerDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      nodeId: data.id,
                      url: data.resultUrl,
                      type: 'image'
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                    onDragStart?.(data.id, true);
                  }}
                  onDragEnd={() => onDragEnd?.()}
                  className="p-1.5 bg-cyan-500/80 hover:bg-cyan-400 rounded-full text-white cursor-grab active:cursor-grabbing"
                  title="拖到聊天"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="5" r="1" fill="currentColor" />
                    <circle cx="9" cy="12" r="1" fill="currentColor" />
                    <circle cx="9" cy="19" r="1" fill="currentColor" />
                    <circle cx="15" cy="5" r="1" fill="currentColor" />
                    <circle cx="15" cy="12" r="1" fill="currentColor" />
                    <circle cx="15" cy="19" r="1" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Node Card */}
          <div
            className={`relative rounded-2xl transition-all duration-200 flex flex-col ${isDark ? 'bg-[#0f0f0f] border border-neutral-700 shadow-2xl' : 'bg-white border border-neutral-200 shadow-lg'} ${selected ? 'ring-1 ring-blue-500/30' : ''}`}
            style={{
              width: '340px',
            }}
          >
            {/* Header */}
          <div className="absolute -top-8 left-0 text-sm px-2 py-0.5 rounded font-medium text-blue-400">
            多角度结果
            </div>

            {/* Content Area */}
            <div
              className={`flex flex-col items-center justify-center ${data.resultUrl ? 'p-0' : 'p-6'}`}
              style={{ minHeight: data.resultUrl ? 'auto' : '340px' }}
            >
              {data.resultUrl ? (
                <img
                  src={data.resultUrl}
                  alt="Content"
                  className={`rounded-xl w-full h-auto object-cover ${selected ? 'ring-2 ring-blue-500 shadow-2xl' : ''}`}
                  draggable={false}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-neutral-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="text-sm">正在生成新的角度...</span>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel (Only for re-adjusting angle if needed) */}
          {selected && showControls && data.angleMode && data.resultUrl && (
            <div className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex justify-center z-[100]">
              <div
                style={{
                  transform: `scale(${localScale})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.1s ease-out'
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ChangeAnglePanel
                  imageUrl={data.resultUrl}
                  settings={data.angleSettings || { rotation: 0, tilt: 0, scale: 0, wideAngle: false }}
                  onSettingsChange={(settings) => onUpdate(data.id, { angleSettings: settings })}
                  onClose={() => onUpdate(data.id, { angleMode: false })}
                  onGenerate={onChangeAngleGenerate ? () => onChangeAngleGenerate(data.id) : () => { }}
                  isLoading={isLoading}
                  canvasTheme={canvasTheme}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Special rendering for Video Editor node
  if (data.type === NodeType.VIDEO_EDITOR) {
    // Get video URL from parent node or own resultUrl
    const videoUrl = inputUrl || data.resultUrl;

    return (
      <div
        className={`absolute flex items-center group/node touch-none pointer-events-auto`}
        style={{
          transform: `translate(${data.x}px, ${data.y}px)`,
          transition: 'box-shadow 0.2s',
          zIndex: selected ? 50 : 10
        }}
        onPointerDown={(e) => onNodePointerDown(e, data.id)}
        onContextMenu={(e) => onContextMenu(e, data.id)}
      >
        <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} selected={selected} canvasTheme={canvasTheme} />

        {/* Video Editor Node Card */}
        <div
          className={`relative rounded-2xl transition-all duration-200 flex flex-col ${videoUrl ? '' : isDark ? 'bg-[#0f0f0f] border border-neutral-700 shadow-2xl' : 'bg-white border border-neutral-200 shadow-lg'} ${selected ? 'ring-1 ring-purple-500/30' : ''}`}
          style={{
            width: videoUrl ? 'auto' : '340px',
            maxWidth: videoUrl ? '500px' : 'none'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onOpenEditor) {
              onOpenEditor(data.id);
            }
          }}
        >
          {/* Header */}
          <div className="absolute -top-8 left-0 text-sm px-2 py-0.5 rounded font-medium text-purple-400">
            视频编辑器
          </div>

          {/* Content Area */}
          <div
            className={`flex flex-col items-center justify-center ${videoUrl ? 'p-0' : 'p-6'}`}
            style={{ minHeight: videoUrl ? 'auto' : '380px' }}
          >
            {videoUrl ? (
              <video
                src={videoUrl}
                className={`rounded-xl w-full h-auto object-cover ${selected ? 'ring-2 ring-purple-500 shadow-2xl' : ''}`}
                style={{ maxHeight: '500px', aspectRatio: '16/9' }}
                muted
                playsInline
                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                onMouseLeave={(e) => {
                  const video = e.currentTarget as HTMLVideoElement;
                  video.pause();
                  video.currentTime = 0;
                }}
              />
            ) : (
              <div className="text-neutral-500 text-center text-sm">
                <p>请先连接一个视频节点</p>
                <p className="text-xs mt-1 text-neutral-600">双击打开编辑器</p>
              </div>
            )}
          </div>

          {/* Trim indicator (if trimmed) */}
          {data.trimStart !== undefined && data.trimEnd !== undefined && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/70 rounded-lg px-2 py-1 text-xs text-purple-300 flex justify-between">
              <span>已裁剪：{data.trimStart.toFixed(1)}s - {data.trimEnd.toFixed(1)}s</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute group/node touch-none pointer-events-auto`}
      data-node-id={data.id}
      data-node-type={data.type}
      style={{
        transform: `translate(${data.x}px, ${data.y}px)`,
        transition: 'box-shadow 0.2s',
        zIndex: selected ? 50 : 10,
        transformOrigin: 'top left'
      }}
      onPointerDown={(e) => onNodePointerDown(e, data.id)}
      onContextMenu={(e) => onContextMenu(e, data.id)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeConnectors nodeId={data.id} onConnectorDown={onConnectorDown} selected={selected} canvasTheme={canvasTheme} />

      {/* Relative wrapper for the Image Card to allow absolute positioning of controls below it */}
      <div ref={nodeCardRef} className="relative group/nodecard">
        {/* Unified Toolbar - 图片成功态仅在选中时显示，靠近 Liblib 的稳定工具条 */}
        {shouldShowImageSuccessToolbar({
          type: data.type,
          scene: data.scene,
          showControls,
          isSuccess,
          resultUrl: data.resultUrl,
        }) && (
          <div
            className={`absolute -top-[58px] left-0 right-0 flex justify-center transition-opacity z-[120] ${
              selected ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            style={{
              transform: `scale(${localScale})`,
              transformOrigin: 'bottom center'
            }}
          >
            <div className="flex min-h-[50px] w-max items-center gap-1.5 rounded-[20px] border border-white/18 bg-[#1f1f1f] px-2 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.62)]">
              {/* Image tool buttons */}
              {!(data.prompt && data.prompt.startsWith('Extract panel #')) && (
                <>
                  {/* 多角度 */}
                  <button
                    onClick={() => onUpdate(data.id, {
                      angleMode: !data.angleMode,
                      imageToolMode: !data.angleMode ? 'multi-angle' : null,
                      imageToolAction: undefined,
                      angleSettings: data.angleSettings || { rotation: 0, tilt: 0, scale: 0, wideAngle: false }
                    })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarButtonClass(data.angleMode)}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    多角度
                  </button>
                  <button
                    onClick={() => onUpdate(data.id, { imageToolMode: imageToolMode === 'lighting' ? null : 'lighting', imageToolAction: undefined, angleMode: false })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarButtonClass(imageToolMode === 'lighting')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4" />
                      <path d="M12 18v4" />
                      <path d="m4.93 4.93 2.83 2.83" />
                      <path d="m16.24 16.24 2.83 2.83" />
                      <path d="M2 12h4" />
                      <path d="M18 12h4" />
                      <path d="m4.93 19.07 2.83-2.83" />
                      <path d="m16.24 7.76 2.83-2.83" />
                    </svg>
                    打光
                  </button>
                  <button
                    ref={setImageToolbarButtonRef('grid')}
                    onClick={() => onUpdate(data.id, { imageToolMode: imageToolMode === 'grid' ? null : 'grid', imageToolAction: undefined, angleMode: false })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarButtonClass(imageToolMode === 'grid')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1.2" />
                      <rect x="14" y="3" width="7" height="7" rx="1.2" />
                      <rect x="3" y="14" width="7" height="7" rx="1.2" />
                      <rect x="14" y="14" width="7" height="7" rx="1.2" />
                    </svg>
                    九宫格
                    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${imageToolMode === 'grid' ? 'text-black/60' : 'text-white/75 group-hover/tool:text-white'}`} fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <button
                    ref={setImageToolbarButtonRef('enhance')}
                    onClick={() => onUpdate(data.id, { imageToolMode: imageToolMode === 'enhance' ? null : 'enhance', imageToolAction: undefined, angleMode: false })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarButtonClass(imageToolMode === 'enhance')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="16" rx="3" />
                      <path d="M8 10h8" />
                    </svg>
                    高清
                    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${imageToolMode === 'enhance' ? 'text-black/60' : 'text-white/75 group-hover/tool:text-white'}`} fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <button
                    ref={setImageToolbarButtonRef('split')}
                    onClick={() => onUpdate(data.id, { imageToolMode: imageToolMode === 'split' ? null : 'split', imageToolAction: undefined, angleMode: false })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarButtonClass(imageToolMode === 'split')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12h16" />
                      <path d="M12 4v16" />
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                    宫格切分
                    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${imageToolMode === 'split' ? 'text-black/60' : 'text-white/75 group-hover/tool:text-white'}`} fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <div className="mx-0.5 h-6 w-px bg-white/12" />
                  <button
                    ref={setImageToolbarButtonRef('style')}
                    onClick={() => onUpdate(data.id, { imageToolMode: imageToolMode === 'style' ? null : 'style', imageToolAction: undefined, angleMode: false })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarIconButtonClass(imageToolMode === 'style')}
                    title="风格"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m3 21 3-3" />
                      <path d="m14.5 4.5 5 5" />
                      <path d="m12 7 5 5" />
                      <path d="m5 19 7-7 5 5-7 7H5v-5Z" />
                    </svg>
                  </button>
                  <button
                    ref={setImageToolbarButtonRef('mark')}
                    onClick={() => onUpdate(data.id, { imageToolMode: imageToolMode === 'mark' ? null : 'mark', imageToolAction: undefined, angleMode: false })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarIconButtonClass(imageToolMode === 'mark')}
                    title="标记"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (data.resultUrl) {
                        const filename = `image_${data.id}.png`;
                        const cleanUrl = data.resultUrl.split('?')[0];
                        if (data.resultUrl.startsWith('data:')) {
                          const link = document.createElement('a');
                          link.href = data.resultUrl;
                          link.download = filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } else {
                          fetch(cleanUrl, { cache: 'no-store' })
                            .then(res => res.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = filename;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                            })
                            .catch(() => {
                              const link = document.createElement('a');
                              link.href = cleanUrl;
                              link.download = filename;
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            });
                        }
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarIconButtonClass(false)}
                    title="下载"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onExpand?.(data.resultUrl!)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={getImageToolbarIconButtonClass(false)}
                    title="展开"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Video Toolbar - Appears above the card for Video nodes on hover */}
        {data.type === NodeType.VIDEO && isSuccess && data.resultUrl && (
          <div
            className="absolute -top-20 left-0 right-0 flex justify-center opacity-0 group-hover/nodecard:opacity-100 transition-opacity z-20"
            style={{
              transform: `scale(${localScale})`,
              transformOrigin: 'bottom center'
            }}
          >
            <div className="flex items-center gap-1 px-2 py-1.5 bg-neutral-900/95 rounded-full border border-neutral-700 shadow-xl backdrop-blur-md">
              {/* Expand Button */}
              <button
                onClick={() => onExpand?.(data.resultUrl!)}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                  title="查看大图"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
              {/* Post to X Button */}
              <button
                onClick={(e) => { e.stopPropagation(); onPostToX?.(data.id, data.resultUrl!, 'video'); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                  title="发布到 X"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>
              {/* Post to TikTok Button */}
              <button
                onClick={(e) => { e.stopPropagation(); onPostToTikTok?.(data.id, data.resultUrl!); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                title="发布到 TikTok"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </button>
              {/* Download Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.resultUrl) {
                    const filename = `video_${data.id}.mp4`;
                    const cleanUrl = data.resultUrl.split('?')[0];
                    fetch(cleanUrl, { cache: 'no-store' })
                      .then(res => res.blob())
                      .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      })
                      .catch(() => {
                        const link = document.createElement('a');
                        link.href = cleanUrl;
                        link.download = filename;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      });
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded-full transition-colors"
                  title="下载"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              {/* Drag to Chat Handle */}
              <div
                draggable
                onPointerDown={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    nodeId: data.id,
                    url: data.resultUrl,
                    type: 'video'
                  }));
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragStart?.(data.id, true);
                }}
                onDragEnd={() => onDragEnd?.()}
                className="p-1.5 bg-cyan-500/80 hover:bg-cyan-400 rounded-full text-white cursor-grab active:cursor-grabbing"
                  title="拖到聊天"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="5" r="1" fill="currentColor" />
                  <circle cx="9" cy="12" r="1" fill="currentColor" />
                  <circle cx="9" cy="19" r="1" fill="currentColor" />
                  <circle cx="15" cy="5" r="1" fill="currentColor" />
                  <circle cx="15" cy="12" r="1" fill="currentColor" />
                  <circle cx="15" cy="19" r="1" fill="currentColor" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Main Node Card */}
        <div
          className={`relative rounded-2xl border transition-all duration-300 flex flex-col shadow-2xl ${isDark ? 'bg-[#0f0f0f]' : 'bg-white'} ${
            isLiblibImageNode
              ? selected
                ? 'border-white/60 ring-0 shadow-[0_30px_90px_rgba(0,0,0,0.48)]'
                : isDark
                  ? 'border-white/10'
                  : 'border-neutral-200'
              : data.type === NodeType.VIDEO
                ? selected
                  ? 'rounded-[30px] border-[2px] border-white/55 bg-[#2b2b2b] ring-0 shadow-[0_30px_90px_rgba(0,0,0,0.48)]'
                  : isDark
                    ? 'rounded-[30px] border-white/18 bg-[#2b2b2b]'
                    : 'rounded-[30px] border-neutral-300'
              : selected
                ? 'border-blue-500/50 ring-1 ring-blue-500/30'
                : isDark
                  ? 'border-neutral-800'
                  : 'border-neutral-200'
          }`}
          style={{
            width: nodeDimensions.width,
          }}
        >
          {isImageToVideoDropTarget && (
            <div className="pointer-events-none absolute inset-0 z-[90] flex items-center justify-center rounded-2xl border-2 border-cyan-300/80 bg-cyan-500/10 shadow-[0_0_0_8px_rgba(34,211,238,0.12),0_24px_70px_rgba(8,145,178,0.38)] backdrop-blur-[1px]">
              <div className="rounded-[22px] border border-white/16 bg-black/72 px-5 py-4 text-center text-white shadow-[0_18px_46px_rgba(0,0,0,0.38)]">
                <div className="text-[15px] font-semibold tracking-[0.03em]">图生视频</div>
                <div className="mt-1 text-[12px] text-white/78">释放鼠标，接入当前图片素材</div>
              </div>
            </div>
          )}

          {/* Header (Editable Title) - Positioned horizontally on top-left side */}
          {isEditingTitle && !isLiblibImageNode ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTitleSave();
                } else if (e.key === 'Escape') {
                  setEditedTitle(data.title || data.type);
                  setIsEditingTitle(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-2 text-sm px-2 py-0.5 rounded font-medium bg-blue-500/20 text-blue-200 outline-none border border-blue-400 whitespace-nowrap"
              style={{ ...titlePositionStyle, minWidth: '60px' }}
            />
          ) : (
            <div
              className={`absolute top-2 text-sm px-2 py-0.5 rounded font-medium transition-colors ${isLiblibImageNode ? 'cursor-default' : 'cursor-text'} whitespace-nowrap ${
                isLiblibImageNode
                  ? selected
                    ? 'text-white/90'
                    : 'text-neutral-400'
                  : data.type === NodeType.VIDEO
                    ? 'text-white/58'
                  : selected
                    ? 'bg-blue-500/20 text-blue-200'
                    : 'text-neutral-600'
              }`}
              style={titlePositionStyle}
              onDoubleClick={(e) => {
                if (isLiblibImageNode) return;
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
              title={isLiblibImageNode ? (data.title || data.type) : 'Double-click to edit'}
            >
              <span className="flex items-center gap-1.5">
                {isLiblibImageNode && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 opacity-80" fill="currentColor">
                    <path d="M21 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5Zm-2 0v8.59l-2.3-2.3a1 1 0 0 0-1.4 0L11 15.59l-1.3-1.3a1 1 0 0 0-1.4 0L5 17.59V5h14ZM8.5 11A1.5 1.5 0 1 0 8.5 8a1.5 1.5 0 0 0 0 3Z" />
                  </svg>
                )}
                {data.type === NodeType.VIDEO && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-white/14 text-white/80">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
                <span>{data.title || data.type}</span>
              </span>
            </div>
          )}

          {isVideoLikeNode && (requestedVideoModelLabel || actualVideoModelLabel) && (
            <div
              className="absolute top-9 flex flex-col items-end gap-1 whitespace-nowrap"
              style={{ right: 'calc(100% + 8px)' }}
            >
              {shouldShowVideoModelDiff && requestedVideoModelLabel && (
                <span className="rounded-md bg-neutral-900/85 px-2 py-1 text-[10px] font-medium text-white/90 shadow-lg">
                  请求模型：{requestedVideoModelLabel}
                </span>
              )}
              <span className={`rounded-md px-2 py-1 text-[10px] font-medium shadow-lg ${shouldShowVideoModelDiff
                ? 'bg-amber-500/90 text-white'
                : 'bg-neutral-900/85 text-white/90'
                }`}>
                {shouldShowVideoModelDiff ? '实际执行' : '模型'}：{actualVideoModelLabel || requestedVideoModelLabel}
              </span>
              {executedVideoModeLabel && (
                <span className="rounded-md bg-sky-500/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                  执行档位：{executedVideoModeLabel}
                </span>
              )}
              {executionProviderLabel && (
                <span className="rounded-md bg-indigo-500/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                  执行通道：{executionProviderLabel}
                </span>
              )}
            </div>
          )}

          {/* Content Area */}
          <NodeContent
            data={data}
            inputUrl={inputUrl}
            inputMediaType={inputMediaType}
            selected={selected}
            isIdle={isIdle}
            isLoading={isLoading}
            isSuccess={isSuccess}
            getAspectRatioStyle={getAspectRatioStyle}
            onUpload={onUpload}
            onExpand={onExpand}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onWriteContent={onWriteContent}
            onTextToVideo={onTextToVideo}
            onTextToImage={onTextToImage}
            onImageToImage={onImageToImage}
            onImageToVideo={onImageToVideo}
            onUpdate={onUpdate}
            onPostToX={onPostToX}
            onGenerate={onGenerate}
            onSendSceneImageToNode={onSendSceneImageToNode}
            canvasTheme={canvasTheme}
          />
        </div>

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && imageToolMode === 'grid-split-select' && data.gridSplit && (
          <div className="absolute -top-14 left-1/2 z-[145] -translate-x-1/2">
            <div
              className="flex h-11 items-center gap-3 rounded-[10px] border border-white/10 bg-[#242424]/96 px-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdate(data.id, { imageToolMode: null, imageToolAction: undefined, gridSplit: undefined });
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-white/8 hover:text-white"
                title="退出宫格切分"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div className="h-5 w-px bg-white/10" />
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/8 text-neutral-200">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16v16H4z" />
                  <path d="M4 12h16M12 4v16" />
                </svg>
              </div>
              <div className="whitespace-nowrap text-[13px] font-semibold text-neutral-100">
                {data.gridSplit.rows * data.gridSplit.cols} 宫格切分
              </div>
              <div className="whitespace-nowrap rounded-md bg-black/30 px-2 py-1 text-[12px] text-neutral-300">
                已选 {data.gridSplit.selectedIndexes.length} 个宫格
              </div>
              <button
                type="button"
                disabled={data.gridSplit.selectedIndexes.length === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  onSplitImageGrid?.(data.id);
                }}
                className="h-8 whitespace-nowrap rounded-md bg-white px-3 text-[12px] font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
              >
                创建生图节点
              </button>
            </div>
          </div>
        )}

        {/* Control Panel - Only show when single node is selected (not in group selection) */}
        {/* Hide controls for storyboard-generated scenes */}
        {selected &&
          showControls &&
          data.type !== NodeType.TEXT &&
          !data.scene &&
          !(data.prompt && data.prompt.startsWith('Extract panel #')) &&
          imageToolMode !== 'grid-split-select' &&
          !(data.type === NodeType.IMAGE && data.resultUrl && (data.angleMode || imageToolMode === 'lighting')) && (
          <div className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex justify-center z-[100]">
            <div
              className={`${getControlPanelWidthClassName({
            isLiblibImageNode,
            isVideoNode: data.type === NodeType.VIDEO,
            isImageToVideoNode,
          })} flex justify-center`}
              style={{
                transform: `scale(${controlPanelScale})`,
                transformOrigin: 'top center',
              }}
            >
              <NodeControls
              data={data}
              inputUrl={inputUrl}
              isLoading={isLoading}
              isSuccess={isSuccess}
              connectedImageNodes={connectedImageNodes}
              onUpdate={onUpdate}
              onSwitchType={onSwitchType}
              onGenerate={onGenerate}
              onUploadAsset={isLiblibImageNode ? triggerInlineImageUpload : undefined}
              onChangeAngleGenerate={onChangeAngleGenerate}
              onQuickAddInputNode={onQuickAddInputNode}
              onSelect={onSelect}
              zoom={zoom}
              canvasTheme={canvasTheme}
              />
            </div>
          </div>
        )}

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && data.angleMode && (
          <div className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex justify-center z-[110]">
            <div
              style={{
                transform: `scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <ChangeAnglePanel
                imageUrl={data.resultUrl}
                settings={data.angleSettings || { rotation: 0, tilt: 0, scale: 0, wideAngle: false }}
                onSettingsChange={(settings) => onUpdate(data.id, { angleSettings: settings })}
                onClose={() => onUpdate(data.id, { angleMode: false, imageToolMode: null, imageToolAction: undefined })}
                onGenerate={onChangeAngleGenerate ? () => onChangeAngleGenerate(data.id) : () => { }}
                isLoading={isLoading}
                canvasTheme={canvasTheme}
                titleLabel="多角度编辑器"
              />
            </div>
          </div>
        )}

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && imageToolMode === 'lighting' && (
          <div className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex justify-center z-[110]">
            <div
              style={{
                transform: `scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <LightingPanel
                settings={lightingSettings}
                onChange={(settings) => onUpdate(data.id, { imageLightingSettings: settings })}
                onClose={() => onUpdate(data.id, { imageToolMode: null, imageToolAction: undefined })}
                onGenerate={applyLocalLighting}
              />
            </div>
          </div>
        )}

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && imageToolMode === 'enhance' && activeImageDropdownAnchor && (
          <div
            className="absolute z-[140]"
            style={{
              top: activeImageDropdownAnchor.top,
              left: activeImageDropdownAnchor.left,
            }}
          >
            <div
              style={{
                transform: `translateX(-50%) scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <ImageToolMenuPanel
                title="高清"
                items={enhanceMenuItems}
                onClose={() => onUpdate(data.id, { imageToolMode: null, imageToolAction: undefined })}
                onSelect={(item) => applyImageToolAction('enhance', item, '图片增强')}
                variant="dropdown"
                showCloseButton={false}
                showTitle={false}
                widthClassName="w-[230px]"
              />
            </div>
          </div>
        )}

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && imageToolMode === 'grid' && activeImageDropdownAnchor && (
          <div
            className="absolute z-[140]"
            style={{
              top: activeImageDropdownAnchor.top,
              left: activeImageDropdownAnchor.left,
            }}
          >
            <div
              style={{
                transform: `translateX(-50%) scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <ImageToolMenuPanel
                title="九宫格"
                items={gridMenuItems}
                onClose={() => onUpdate(data.id, { imageToolMode: null, imageToolAction: undefined })}
                onSelect={(item) => applyImageToolAction('grid', item, '九宫格预设')}
                variant="dropdown"
                showCloseButton={false}
                showTitle={false}
                widthClassName="w-[260px]"
              />
            </div>
          </div>
        )}

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && imageToolMode === 'split' && activeImageDropdownAnchor && (
          <div
            className="absolute z-[140]"
            style={{
              top: activeImageDropdownAnchor.top,
              left: activeImageDropdownAnchor.left,
            }}
          >
            <div
              style={{
                transform: `translateX(-50%) scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <GridSplitMenu onSelect={applyGridSplitSelection} />
            </div>
          </div>
        )}

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && imageToolMode === 'style' && activeImageDropdownAnchor && (
          <div
            className="absolute z-[140]"
            style={{
              top: activeImageDropdownAnchor.top,
              left: activeImageDropdownAnchor.left,
            }}
          >
            <div
              style={{
                transform: `translateX(-50%) scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <ImageToolMenuPanel
                title="风格"
                items={styleMenuItems}
                onClose={() => onUpdate(data.id, { imageToolMode: null, imageToolAction: undefined })}
                onSelect={(item) => applyImageToolAction('style', item, '风格预设')}
                variant="dropdown"
                showCloseButton={false}
                showTitle={false}
                widthClassName="w-[232px]"
              />
            </div>
          </div>
        )}

        {selected && showControls && data.type === NodeType.IMAGE && data.resultUrl && imageToolMode === 'mark' && activeImageDropdownAnchor && (
          <div
            className="absolute z-[140]"
            style={{
              top: activeImageDropdownAnchor.top,
              left: activeImageDropdownAnchor.left,
            }}
          >
            <div
              style={{
                transform: `translateX(-50%) scale(${localScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <ImageToolMenuPanel
                title="标记"
                items={markMenuItems}
                onClose={() => onUpdate(data.id, { imageToolMode: null, imageToolAction: undefined })}
                onSelect={startImageAnnotation}
                variant="dropdown"
                showCloseButton={false}
                showTitle={false}
                widthClassName="w-[236px]"
              />
            </div>
          </div>
        )}
      </div>
    </div >
  );
};
