import React from 'react';
import { Download, Loader2, Play, RotateCcw } from 'lucide-react';
import { getSceneDefinition } from '../../services/scenes/registry';
import { SCENES } from '../../types/scene';
import type { NodeData } from '../../types';
import { makeMockImageDataUrl } from '../../services/mock/sceneAssets';
import { pollTasks, retryTask } from '../../services/tasks/taskClient';
import type { GenerationRequest } from '../../types/scene';

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

export const SceneResultPanel: React.FC<SceneResultPanelProps> = ({ data, isLoading, selected, onGenerate, onUpdate, onSendImageToNode }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const definition = getSceneDefinition(data.scene);
  const images = data.outputs?.imageList || [];
  const structuredData = data.structuredData || data.outputs?.structuredData;
  const storyboard = structuredData?.storyboard || [];
  const frameDeduction = structuredData?.frameDeduction;
  const lightingRequest = structuredData?.lightingRequest;
  const providerFallback = structuredData?.providerFallback;
  const progress = data.taskInfo?.progressPercent ?? 0;
  const isStoryboard25 = data.scene === SCENES.COHERENT_STORYBOARD_25;
  const isLightCorrection = data.scene === SCENES.CINEMATIC_LIGHT_CORRECTION;
  const isUpscale = data.scene === SCENES.UPSCALE;
  const isFourGrid = data.scene === SCENES.PLOT_DEDUCTION_FOUR_GRID;
  const isThreeView = data.scene === SCENES.CHARACTER_THREE_VIEW_GENERATE;
  const isFrameDeduction = data.scene === SCENES.FRAME_DEDUCTION_PLUS_3S || data.scene === SCENES.FRAME_DEDUCTION_MINUS_5S;
  const selectedShot = storyboard[selectedIndex];
  const selectedImage = images[selectedIndex];
  const childTasks = data.taskInfo && 'childTasks' in data.taskInfo ? (data.taskInfo as any).childTasks || [] : [];
  const maxConcurrency = data.taskInfo && 'maxConcurrency' in data.taskInfo ? (data.taskInfo as any).maxConcurrency || 4 : 4;

  const updateParam = (key: string, value: unknown) => {
    const nextParams = {
      ...(data.params || {}),
      [key]: value,
    };
    onUpdate?.(data.id, {
      params: nextParams,
      prompt: key === 'storyText' || key === 'prompt' ? String(value) : data.prompt,
    });
  };

  const retryGridItem = async (index: number) => {
    const currentImage = images[index];
    const label = currentImage?.label || `Result ${index + 1}`;
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
        provider: (data.params?.executionMode === 'real' || data.params?.providerMode === 'real') ? 'openai' : 'mock',
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

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-white/12 bg-[#151515] text-white shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-wide">{definition?.label || data.title || 'Scene Pipeline'}</div>
            <div className="mt-1 text-xs text-neutral-400">{definition?.description || '统一 scene registry + pipeline 任务节点'}</div>
          </div>
          <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] text-neutral-300">
            {data.taskInfo?.taskId ? `taskId · ${data.taskInfo.taskId.slice(0, 12)}` : 'ready'}
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
            {images.length > 0 ? '重新生成' : '运行 pipeline'}
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
          {selected && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onUpdate?.(data.id, {
                  outputs: undefined,
                  structuredData: undefined,
                  resultUrl: undefined,
                  status: 'idle' as NodeData['status'],
                  taskInfo: undefined,
                });
              }}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white"
            >
              <RotateCcw size={13} />
              清空
            </button>
          )}
        </div>

        {isLoading && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div className="p-4">
        {selected && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/28 p-3">
            {(isFourGrid || isStoryboard25) && (
              <label className="block text-xs text-neutral-400">
                故事文本
                <textarea
                  value={(data.params?.storyText as string) || data.prompt || ''}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => updateParam('storyText', event.target.value)}
                  className="mt-1 min-h-[76px] w-full resize-none rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-400/70"
                />
              </label>
            )}
            {(isLightCorrection || isThreeView || isFrameDeduction || isUpscale) && (
              <label className="block text-xs text-neutral-400">
                描述 / Prompt
                <textarea
                  value={(data.params?.prompt as string) || data.prompt || ''}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => updateParam('prompt', event.target.value)}
                  className="mt-1 min-h-[68px] w-full resize-none rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-400/70"
                />
              </label>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-neutral-400">
                执行模式
                <select
                  value={(data.params?.executionMode as string) || 'mock'}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => updateParam('executionMode', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="mock">Mock 全流程</option>
                  <option value="real">真实服务优先</option>
                </select>
              </label>
              <label className="text-xs text-neutral-400">
                图片模型
                <select
                  value={(data.params?.imageModel as string) || 'gpt-image-1.5'}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => updateParam('imageModel', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="gpt-image-1.5">gpt-image-1.5</option>
                  <option value="gpt-image-1">gpt-image-1</option>
                </select>
              </label>
              {(isLightCorrection || isUpscale || isFrameDeduction || isThreeView) && (
                <label className="col-span-2 text-xs text-neutral-400">
                  输入图片 URL
                  <input
                    value={(isLightCorrection ? data.params?.originImage : data.params?.imageUrl || data.params?.characterImageUrl) as string || ''}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const key = isLightCorrection
                        ? 'originImage'
                        : isThreeView
                          ? 'characterImageUrl'
                          : 'imageUrl';
                      updateParam(key, event.target.value);
                    }}
                    placeholder="可填 /library/images/... 或 data:image/..."
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-400/70"
                  />
                </label>
              )}
              {(isFourGrid || isStoryboard25) && (
                <label className="text-xs text-neutral-400">
                  画幅
                  <select
                    value={(data.params?.ratio as string) || '16:9'}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => updateParam('ratio', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                    <option value="1:1">1:1</option>
                  </select>
                </label>
              )}
              {(isFourGrid || isStoryboard25 || isThreeView) && (
                <label className="text-xs text-neutral-400">
                  风格
                  <select
                    value={(data.params?.visualStyle as string) || (data.params?.style as string) || 'cinematic realistic'}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => updateParam(isThreeView ? 'style' : 'visualStyle', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="cinematic realistic">cinematic realistic</option>
                    <option value="anime">anime</option>
                    <option value="concept-art">concept-art</option>
                    <option value="documentary">documentary</option>
                  </select>
                </label>
              )}
              {isLightCorrection && (
                <>
                  <label className="text-xs text-neutral-400">
                    主光方向
                    <select
                      value={(data.params?.keyLight as string) || 'front'}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => updateParam('keyLight', event.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="front">front</option>
                      <option value="left">left</option>
                      <option value="right">right</option>
                      <option value="back">back</option>
                    </select>
                  </label>
                  <label className="text-xs text-neutral-400">
                    亮度
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Number(data.params?.brightness ?? 55)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => updateParam('brightness', Number(event.target.value))}
                      className="mt-3 w-full"
                    />
                  </label>
                </>
              )}
              {isUpscale && (
                <label className="text-xs text-neutral-400">
                  目标清晰度
                  <select
                    value={(data.params?.targetResolution as string) || '2x'}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => updateParam('targetResolution', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="2x">2x</option>
                    <option value="4x">4x</option>
                    <option value="2048">2048</option>
                    <option value="4096">4096</option>
                  </select>
                </label>
              )}
            </div>
          </div>
        )}

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

        {images.length > 0 ? (
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
                  <div className="absolute left-2 right-2 top-8 flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSendImageToNode?.(data.id, image, 'upscale-node');
                      }}
                      className="rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[9px] font-semibold text-white"
                    >
                      单格放大
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSendImageToNode?.(data.id, image, 'image-node');
                      }}
                      className="rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[9px] font-semibold text-white"
                    >
                      新节点
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadGridItem(image, index);
                      }}
                      className="rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[9px] font-semibold text-white"
                    >
                      下载
                    </button>
                  </div>
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
        ) : (
          <div className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-white/[0.03] text-center">
            <div className="text-sm font-semibold">等待运行统一任务</div>
            <div className="mt-1 max-w-[320px] text-xs text-neutral-500">
              点击运行后会创建 taskId、轮询状态，并把 mock 结果回填到 outputs / structuredData。
            </div>
          </div>
        )}

        {providerFallback && (
          <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-500/12 p-3 text-xs text-amber-100">
            <div className="font-semibold">真实服务未执行，已回退 Mock</div>
            <div className="mt-1 text-amber-100/78">{providerFallback}</div>
          </div>
        )}

        {(selectedShot || selectedImage) && images.length > 1 && (
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
                      onSendImageToNode?.(data.id, selectedImage, 'upscale-node');
                    }}
                    className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white"
                  >
                    创建高清节点
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSendImageToNode?.(data.id, selectedImage, 'image-node');
                    }}
                    className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white"
                  >
                    发送到新节点
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

        {frameDeduction && (
          <div className="mt-3 grid gap-2 text-xs text-neutral-300">
            <div>运动变化：{frameDeduction.motionDelta}</div>
            <div>镜头变化：{frameDeduction.cameraDelta}</div>
            <div>环境变化：{frameDeduction.environmentDelta}</div>
          </div>
        )}

        {(isLightCorrection || isUpscale) && (lightingRequest || structuredData?.upscale) && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
            {lightingRequest ? `打光参数：${lightingRequest.UI_KeyLight} / ${lightingRequest.UI_LightColor} / ${lightingRequest.UI_LightBrightness}` : `高清参数：${structuredData.upscale.targetResolution} / ${structuredData.upscale.detailMode}`}
          </div>
        )}
      </div>
    </div>
  );
};
