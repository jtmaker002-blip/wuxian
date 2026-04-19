import React from 'react';
import { Download, Loader2, Play, RotateCcw } from 'lucide-react';
import { getSceneDefinition } from '../../services/scenes/registry';
import { SCENES } from '../../types/scene';
import { NodeStatus, type NodeData } from '../../types';
import { makeMockImageDataUrl } from '../../services/mock/sceneAssets';
import { calculateTaskCost, cancelTask, pollTasks, retryTask } from '../../services/tasks/taskClient';
import type { GenerationRequest } from '../../types/scene';
import { SceneParameterForm } from './scene-node/SceneParameterForm';
import { GridSplitNode } from './GridSplitNode';
import { SceneThreeViewResult } from './scene-node/SceneThreeViewResult';
import { SceneStoryboardGridResult } from './scene-node/SceneStoryboardGridResult';
import { SceneComparisonResult } from './scene-node/SceneComparisonResult';
import { SceneReferenceCard } from './scene-node/SceneReferenceCard';
import { SceneMetadataPanel } from './scene-node/SceneMetadataPanel';
import { SceneBibleSummary } from './scene-node/SceneBibleSummary';
import { SceneMultiViewSummary } from './scene-node/SceneMultiViewSummary';

type SceneResultPanelProps = {
  data: NodeData;
  isLoading: boolean;
  selected: boolean;
  onGenerate?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, updates: Partial<NodeData>) => void;
  onSendImageToNode?: (sourceNodeId: string, image: { url: string; label?: string }, action: 'image-node' | 'upscale-node') => void;
};

function getGridClass(count: number) {
  if (count === 25) return 'grid-cols-5';
  if (count === 9) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-1';
}

function getPrimaryReferenceUrl(data: NodeData) {
  if (data.scene === SCENES.CHARACTER_THREE_VIEW_GENERATE) {
    return data.params?.characterImageUrl as string | undefined;
  }
  if (data.scene === SCENES.CINEMATIC_LIGHT_CORRECTION) {
    return (data.params?.originImage || data.params?.referenceImage) as string | undefined;
  }
  if (data.scene === SCENES.FRAME_DEDUCTION_PLUS_3S || data.scene === SCENES.FRAME_DEDUCTION_MINUS_5S || data.scene === SCENES.GRID_SPLIT || data.scene === SCENES.UPSCALE) {
    return data.params?.imageUrl as string | undefined;
  }
  const refs = data.params?.referenceImages;
  if (Array.isArray(refs) && refs.length > 0) return refs[0] as string;
  return undefined;
}

export const SceneResultPanel: React.FC<SceneResultPanelProps> = ({ data, isLoading, selected, onGenerate, onUpdate, onSendImageToNode }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [estimatedCost, setEstimatedCost] = React.useState<{ value: number; unit: string } | null>(null);
  const definition = getSceneDefinition(data.scene);
  const images = data.outputs?.imageList || [];
  const structuredData = data.structuredData || data.outputs?.structuredData;
  const storyboard = structuredData?.storyboard || [];
  const frameDeduction = structuredData?.frameDeduction;
  const lightingRequest = structuredData?.lightingRequest;
  const multiView = structuredData?.multiView;
  const characterProfile = structuredData?.characterProfile;
  const characterBible = structuredData?.characterBible;
  const worldBible = structuredData?.worldBible;
  const providerFallback = structuredData?.providerFallback;
  const progress = data.taskInfo?.progressPercent ?? 0;
  const isStoryboard25 = data.scene === SCENES.COHERENT_STORYBOARD_25;
  const isGridSplit = data.scene === SCENES.GRID_SPLIT;
  const isThreeView = data.scene === SCENES.CHARACTER_THREE_VIEW_GENERATE;
  const isLightCorrection = data.scene === SCENES.CINEMATIC_LIGHT_CORRECTION;
  const isFrameDeductionScene = data.scene === SCENES.FRAME_DEDUCTION_PLUS_3S || data.scene === SCENES.FRAME_DEDUCTION_MINUS_5S;
  const isUpscale = data.scene === SCENES.UPSCALE;
  const selectedShot = storyboard[selectedIndex];
  const selectedImage = images[selectedIndex];
  const heroImage = selectedImage || images[0];
  const heroShot = selectedShot || storyboard[0];
  const primaryReferenceUrl = getPrimaryReferenceUrl(data);
  const isGridOnlyScene =
    data.scene === SCENES.MULTI_VIEW_NINE_GRID ||
    data.scene === SCENES.PLOT_DEDUCTION_FOUR_GRID ||
    data.scene === SCENES.COHERENT_STORYBOARD_25;
  const sceneStatusLabel =
    images.length > 0
      ? data.scene === SCENES.CHARACTER_THREE_VIEW_GENERATE
        ? '成品图'
        : data.scene === SCENES.COHERENT_STORYBOARD_25
          ? `连续分镜 · ${images.length}格`
          : data.scene === SCENES.PLOT_DEDUCTION_FOUR_GRID
            ? `剧情分镜 · ${images.length}格`
            : data.scene === SCENES.MULTI_VIEW_NINE_GRID
              ? `${images.length}机位`
              : '已生成'
      : data.taskInfo?.taskId
        ? '生成中'
        : '待生成';
  const childTasks = data.taskInfo && 'childTasks' in data.taskInfo ? (data.taskInfo as any).childTasks || [] : [];
  const maxConcurrency = data.taskInfo && 'maxConcurrency' in data.taskInfo ? (data.taskInfo as any).maxConcurrency || 4 : 4;
  const taskError = data.status === NodeStatus.ERROR || data.taskInfo?.status === 'failed'
    ? (data.errorMessage || data.taskInfo?.failedReason || '任务执行失败')
    : undefined;

  React.useEffect(() => {
    if (!selected || !data.scene || isGridSplit) return;
    let cancelled = false;
    const request: GenerationRequest = {
      params: {
        ...(data.params || {}),
        scene: data.scene,
        prompt: data.prompt,
      },
      metadata: {
        node_id: data.id,
        project_id: 'scene-cost-preview',
      },
      provider: 'mock',
      model: 'mock-scene-pipeline',
      taskType: 'image',
      requestId: `cost-${data.id}`,
    };
    void calculateTaskCost(request)
      .then((cost) => {
        if (!cancelled) {
          setEstimatedCost({ value: cost.estimatedCost, unit: cost.unit });
        }
      })
      .catch(() => {
        if (!cancelled) setEstimatedCost(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data.id, data.params, data.prompt, data.scene, selected, isGridSplit]);

  const retryGridItem = async (index: number) => {
    const currentImage = images[index];
    const label = currentImage?.label || `Result ${index + 1}`;
    const isRealRetry = data.params?.executionMode === 'real' || data.params?.providerMode === 'real';
    const runningImages = images.map((image, imageIndex) => (
      imageIndex === index ? { ...image, status: 'running' } : image
    ));
    onUpdate?.(data.id, {
      outputs: {
        ...(data.outputs || {}),
        imageList: runningImages,
        structuredData,
      },
      structuredData,
    });

    try {
      const request: GenerationRequest = {
        params: {
          ...(data.params || {}),
          scene: data.scene,
          gridItemIndex: index,
          prompt: selectedShot?.imageGenerationPrompt || data.prompt || label,
          storyText: data.params?.storyText || data.prompt || label,
        },
        metadata: {
          node_id: data.id,
          project_id: 'scene-grid-retry',
        },
        provider: isRealRetry ? 'openai' : 'mock',
        model: (data.params?.imageModel as string) || 'mock-scene-pipeline',
        taskType: 'image',
        requestId: crypto.randomUUID(),
      };
      const { taskId } = await retryTask(request);
      let retriedImageUrl: string | undefined;
      let retriedLabel = label;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const [snapshot] = await pollTasks([taskId]);
        if (snapshot?.status === 'succeeded' && snapshot.result?.imageList?.[0]) {
          retriedImageUrl = snapshot.result.imageList[0].url;
          retriedLabel = snapshot.result.imageList[0].label || retriedLabel;
          break;
        }
        if (snapshot?.status === 'failed' || snapshot?.status === 'cancelled') {
          throw new Error(snapshot.errorMessage || '单格重试失败');
        }
      }
      if (!retriedImageUrl) {
        throw new Error('单格重试超时');
      }
      const nextImages = images.map((image, imageIndex) => (
        imageIndex === index
          ? { ...image, url: retriedImageUrl, label: retriedLabel, status: 'succeeded' }
          : image
      ));

      onUpdate?.(data.id, {
        outputs: {
          ...(data.outputs || {}),
          imageList: nextImages,
          structuredData,
        },
        resultUrl: nextImages[0]?.url,
        structuredData,
        taskInfo: data.taskInfo
          ? {
            ...data.taskInfo,
            status: 'succeeded',
            loading: false,
            progressPercent: 100,
          }
          : data.taskInfo,
      });
      return;
    } catch (error) {
      if (isRealRetry) {
        const message = error instanceof Error ? error.message : '单格重试失败';
        onUpdate?.(data.id, {
          status: NodeStatus.ERROR,
          outputs: {
            ...(data.outputs || {}),
            imageList: images,
            structuredData,
          },
          structuredData,
          taskInfo: {
            ...(data.taskInfo || {}),
            loading: false,
            status: 'failed',
            failedReason: message,
            progressPercent: 0,
          },
          errorMessage: message,
        });
        return;
      }
      console.warn('[SceneResultPanel] Falling back to local cell retry:', error);
    }

    const nextImages = images.map((image, imageIndex) => {
      if (imageIndex !== index) return image;
      return {
        ...image,
        url: makeMockImageDataUrl(`${definition?.label || 'scene'} · 单格重试 · ${label}`, '#22c55e', index + 1),
        status: 'succeeded',
      };
    });

    onUpdate?.(data.id, {
      outputs: {
        ...(data.outputs || {}),
        imageList: nextImages,
        structuredData,
      },
      resultUrl: nextImages[0]?.url,
      structuredData,
      taskInfo: data.taskInfo
        ? {
          ...data.taskInfo,
          status: 'succeeded',
          loading: false,
          progressPercent: 100,
        }
        : data.taskInfo,
    });
  };

  const downloadGridItem = (image: { url: string; label?: string }, index: number) => {
    const anchor = document.createElement('a');
    anchor.href = image.url;
    anchor.download = `${definition?.scene || 'scene'}-${index + 1}.png`;
    anchor.click();
  };

  const cancelCurrentTask = async () => {
    const taskId = data.taskInfo?.taskId;
    if (taskId) {
      await cancelTask(taskId).catch(() => false);
    }
    onUpdate?.(data.id, {
      status: NodeStatus.ERROR,
      taskInfo: {
        ...(data.taskInfo || {}),
        taskId,
        loading: false,
        status: 'cancelled',
        failedReason: '任务已取消',
        progressPercent: data.taskInfo?.progressPercent ?? 0,
      },
      errorMessage: '任务已取消',
    });
  };

  const exportStoryboard = () => {
    const payload = JSON.stringify(structuredData || {}, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${definition?.scene || 'scene'}-storyboard.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (images.length > 0 && !isGridSplit) {
    const compactImage = heroImage || images[0];
    const compactGridClass = getGridClass(images.length);

    return (
      <div className="group/scene-result relative h-full w-full overflow-hidden rounded-[18px] border border-white/10 bg-black">
        {isGridOnlyScene && images.length > 1 ? (
          <div className={`grid h-full w-full ${compactGridClass} gap-[2px] bg-black`}>
            {images.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedIndex(index);
                }}
                className={`relative overflow-hidden bg-black ${selectedIndex === index ? 'ring-2 ring-sky-300 ring-inset' : ''}`}
                title={image.label || `Result ${index + 1}`}
              >
                <img src={image.url} alt={image.label || `Result ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  {image.label || index + 1}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <img
            src={compactImage.url}
            alt={compactImage.label || definition?.label || 'scene result'}
            className={`h-full w-full ${isThreeView ? 'bg-[#edf3f8] object-contain' : 'object-cover'}`}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/78 via-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover/scene-result:opacity-100">
          <div className="min-w-0 truncate text-[11px] font-semibold text-white">
            {isGridOnlyScene ? (selectedImage?.label || `Result ${selectedIndex + 1}`) : (compactImage.label || sceneStatusLabel)}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                downloadGridItem(isGridOnlyScene ? (selectedImage || images[0]) : compactImage, isGridOnlyScene ? selectedIndex : 0);
              }}
              className="rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] text-white"
            >
              下载
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                const image = isGridOnlyScene ? (selectedImage || images[0]) : compactImage;
                onSendImageToNode?.(data.id, image, 'upscale-node');
              }}
              className="rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] text-white"
            >
              高清
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                const image = isGridOnlyScene ? (selectedImage || images[0]) : compactImage;
                onSendImageToNode?.(data.id, image, 'image-node');
              }}
              className="rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] text-white"
            >
              新节点
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isGridSplit) {
    return (
      <div className="group/scene-pending relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#232323] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%)]" />
        {isLoading ? (
          <div className="relative flex h-12 items-center overflow-hidden rounded-[12px] border border-white/18 bg-[#2a2a2a]/94 shadow-[0_18px_54px_rgba(0,0,0,0.42)]">
            <div className="px-4 text-[15px] font-semibold">
              生成中 {typeof data.taskInfo?.progressPercent === 'number' ? `${Math.round(progress)}%...` : '...'}
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                void cancelCurrentTask();
              }}
              className="h-full border-l border-white/12 px-4 text-[14px] font-medium text-neutral-400 hover:text-white"
            >
              取消
            </button>
          </div>
        ) : taskError ? (
          <div className="relative max-w-[82%] rounded-[12px] border border-rose-300/20 bg-black/32 px-4 py-3 text-center">
            <div className="text-[14px] font-semibold text-rose-100">真实生成失败</div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-rose-100/62">{taskError}</div>
          </div>
        ) : (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onGenerate?.(data.id);
            }}
            className="relative flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition-transform active:scale-95"
          >
            <Play size={14} />
            开始生成
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-white/12 bg-[#151515] text-white shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-wide">{definition?.label || data.title || 'Scene Pipeline'}</div>
            <div className="mt-1 text-xs text-neutral-400">{definition?.description || '图片工具生成任务'}</div>
          </div>
          <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] text-neutral-300">
            {sceneStatusLabel}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onGenerate?.(data.id);
            }}
            className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black transition-transform active:scale-95"
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {images.length > 0 ? '重新生成' : '开始生成'}
          </button>
          {isStoryboard25 && images.length > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                exportStoryboard();
              }}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white"
            >
              <Download size={13} />
              导出 JSON
            </button>
          )}
          {isThreeView && images.length >= 1 && (
            <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white">
              三视图成品
            </div>
          )}
          {selected && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onUpdate?.(data.id, {
                  outputs: undefined,
                  structuredData: undefined,
                  resultUrl: undefined,
                  status: NodeStatus.IDLE,
                  taskInfo: undefined,
                });
              }}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white"
            >
              <RotateCcw size={13} />
              清空
            </button>
          )}
          {isLoading && data.taskInfo?.taskId && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void cancelCurrentTask();
              }}
              className="flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-500/12 px-3 py-1.5 text-xs text-rose-100"
            >
              取消任务
            </button>
          )}
          {estimatedCost && !isLoading && (
            <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-neutral-300">
              预计消耗 · {estimatedCost.value} {estimatedCost.unit}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div className="p-4">
        <SceneReferenceCard
          imageUrl={!isGridSplit ? primaryReferenceUrl : undefined}
          caption={primaryReferenceUrl ? '当前结果基于已连接图片启动' : undefined}
          detail={data.prompt || data.params?.prompt || data.params?.storyText || '使用当前图片作为场景输入'}
        />

        {isGridSplit && images.length > 0 ? (
          <GridSplitNode data={data} onSendImageToNode={onSendImageToNode} />
        ) : isThreeView && images.length > 0 ? (
          <SceneThreeViewResult
            images={images}
            onUpscale={() => heroImage && onSendImageToNode?.(data.id, heroImage, 'upscale-node')}
            onSendToNode={() => heroImage && onSendImageToNode?.(data.id, heroImage, 'image-node')}
          />
        ) : isLightCorrection && images.length > 0 ? (
          <SceneComparisonResult
            beforeUrl={primaryReferenceUrl}
            afterImage={heroImage}
            beforeLabel="原图"
            afterLabel="光影校正结果"
            footer={lightingRequest ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
                打光参数：{lightingRequest.UI_KeyLight} / {lightingRequest.UI_LightColor} / {lightingRequest.UI_LightBrightness}
              </div>
            ) : null}
          />
        ) : isFrameDeductionScene && images.length > 0 ? (
          <SceneComparisonResult
            beforeUrl={primaryReferenceUrl}
            afterImage={heroImage}
            beforeLabel="输入帧"
            afterLabel={data.scene === SCENES.FRAME_DEDUCTION_PLUS_3S ? '3 秒后' : '5 秒前'}
            footer={frameDeduction ? (
              <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
                <div>运动变化：{frameDeduction.motionDelta}</div>
                <div>镜头变化：{frameDeduction.cameraDelta}</div>
                <div>环境变化：{frameDeduction.environmentDelta}</div>
              </div>
            ) : null}
          />
        ) : isGridOnlyScene && images.length > 0 ? (
          <>
            <SceneStoryboardGridResult
              images={images}
              storyboard={storyboard}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              gridClassName={getGridClass(images.length)}
              variant={
                data.scene === SCENES.MULTI_VIEW_NINE_GRID
                  ? 'multi-view'
                  : data.scene === SCENES.COHERENT_STORYBOARD_25
                    ? 'storyboard-25'
                    : 'four-grid'
              }
              selectedImage={selectedImage}
              onRetrySelected={() => retryGridItem(selectedIndex)}
              onDownloadSelected={() => selectedImage && downloadGridItem(selectedImage, selectedIndex)}
              onUpscaleSelected={() => selectedImage && onSendImageToNode?.(data.id, selectedImage, 'upscale-node')}
              onSendSelectedToNode={() => selectedImage && onSendImageToNode?.(data.id, selectedImage, 'image-node')}
            />
            {multiView && (
              <SceneMultiViewSummary cameraAngles={multiView.cameraAngles || []} />
            )}
            {isStoryboard25 && (characterBible || worldBible) && (
              <SceneBibleSummary characterBible={characterBible} worldBible={worldBible} />
            )}
          </>
        ) : images.length > 0 ? (
          <div className="mb-4 space-y-3">
            <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${isThreeView ? 'bg-[#f7f5ef]' : 'bg-black/40'}`}>
              <img
                src={heroImage?.url}
                alt={heroImage?.label || definition?.label || 'scene result'}
                className={`${isThreeView ? 'aspect-[4/3] object-contain p-4' : 'aspect-video object-cover'} w-full`}
              />
              {heroImage?.label && (
                <div className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${isThreeView ? 'bg-black/75 text-white' : 'bg-black/65 text-white'}`}>
                  {heroImage.label}
                </div>
              )}
              {heroShot?.plotDescription && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 to-transparent p-3">
                  <div className="text-xs font-semibold text-white">{heroShot.plotDescription}</div>
                  {(heroShot.shotSize || heroShot.lightingAndAtmosphere) && (
                    <div className="mt-1 text-[11px] text-white/72">
                      {[heroShot.shotSize, heroShot.lightingAndAtmosphere].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className={`grid ${getGridClass(images.length)} gap-2`}>
                {images.map((image, index) => {
                  const shot = storyboard[index];
                  return (
                    <button
                      key={`${image.url}-${index}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedIndex(index);
                      }}
                      className={`group relative overflow-hidden rounded-xl border bg-black/40 text-left transition-colors ${
                        selectedIndex === index ? 'border-blue-300/80' : 'border-white/10 hover:border-white/28'
                      }`}
                    >
                      <img src={image.url} alt={image.label || `scene ${index + 1}`} className="aspect-video w-full object-cover" />
                      <div className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-semibold text-white">
                        #{index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          retryGridItem(index);
                        }}
                        className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[9px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        单格重试
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 to-transparent p-2">
                        <div className="text-[10px] font-semibold">{image.label || `#${index + 1}`}</div>
                        {shot?.plotDescription && !isStoryboard25 && (
                          <div className="mt-0.5 line-clamp-2 text-[9px] text-white/72">{shot.plotDescription}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {selected && <SceneParameterForm data={data} onUpdate={onUpdate} />}

        {childTasks.length > 0 && isLoading && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/28 p-3">
            <div className="mb-2 text-xs font-semibold text-white">子任务队列 · 最大并发 {maxConcurrency}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {childTasks.map((task: any) => (
                <div
                  key={task.taskId}
                  className={`h-2 rounded-full ${
                    task.status === 'succeeded'
                      ? 'bg-emerald-400'
                      : task.status === 'running'
                        ? 'bg-blue-400'
                        : task.status === 'failed'
                          ? 'bg-rose-400'
                          : 'bg-white/12'
                  }`}
                  title={`${task.index + 1}: ${task.status} ${task.progressPercent}%`}
                />
              ))}
            </div>
          </div>
        )}

        {!images.length && !isGridSplit && (
          <div className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-white/[0.03] text-center">
            <div className={`text-sm font-semibold ${taskError ? 'text-rose-100' : ''}`}>{taskError ? '真实生成失败' : '等待生成'}</div>
            <div className="mt-1 max-w-[320px] text-xs text-neutral-500">
              {taskError || '点击开始生成后会按当前工具参数创建结果节点内容。'}
            </div>
          </div>
        )}

        {providerFallback && (
          <div className="mt-3 rounded-2xl border border-rose-300/30 bg-rose-500/12 p-3 text-xs text-rose-100">
            <div className="font-semibold">真实生成失败，当前是旧 Mock 回退结果</div>
            <div className="mt-1 text-rose-100/78">{providerFallback}</div>
          </div>
        )}

        {(selectedShot || selectedImage) && images.length > 1 && !isGridOnlyScene && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-semibold text-white">单格详情 · #{selectedIndex + 1}</div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  retryGridItem(selectedIndex);
                }}
                className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white"
              >
                只重试这一格
              </button>
              {selectedImage && (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      downloadGridItem(selectedImage, selectedIndex);
                    }}
                    className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white"
                  >
                    下载
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSendImageToNode?.(data.id, selectedImage, 'upscale-node');
                    }}
                    className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white"
                  >
                    单格放大
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSendImageToNode?.(data.id, selectedImage, 'image-node');
                    }}
                    className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white"
                  >
                    新节点
                  </button>
                </>
              )}
            </div>
            {selectedShot ? (
              <div className="grid gap-1.5">
                <div>剧情：{selectedShot.plotDescription}</div>
                <div>情绪：{selectedShot.emotion || '未指定'}</div>
                <div>景别：{selectedShot.shotSize || '未指定'}</div>
                <div>光影：{selectedShot.lightingAndAtmosphere || '未指定'}</div>
                <div className="text-neutral-500">Prompt：{selectedShot.imageGenerationPrompt}</div>
              </div>
            ) : (
              <div>{selectedImage?.label || `Result ${selectedIndex + 1}`}</div>
            )}
          </div>
        )}

        {frameDeduction && !isFrameDeductionScene && (
          <div className="mt-3 grid gap-2 text-xs text-neutral-300">
            <div>运动变化：{frameDeduction.motionDelta}</div>
            <div>镜头变化：{frameDeduction.cameraDelta}</div>
            <div>环境变化：{frameDeduction.environmentDelta}</div>
          </div>
        )}

        {isThreeView && characterProfile && (
          <div className="mt-3">
            <SceneMetadataPanel
              title="角色设定"
              items={[
                { label: '风格', value: characterProfile.style },
                { label: '背景', value: characterProfile.background },
                { label: '服装一致性', value: characterProfile.keepCostumeConsistency ? '开启' : '关闭' },
              ]}
            />
          </div>
        )}

        {((isLightCorrection && !images.length) || isUpscale) && (lightingRequest || structuredData?.upscale) && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
            {lightingRequest ? `打光参数：${lightingRequest.UI_KeyLight} / ${lightingRequest.UI_LightColor} / ${lightingRequest.UI_LightBrightness}` : `高清参数：${structuredData.upscale.targetResolution} / ${structuredData.upscale.detailMode}`}
          </div>
        )}
      </div>
    </div>
  );
};
