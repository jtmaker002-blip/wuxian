import React from 'react';
import { Download, Loader2, Play, RotateCcw } from 'lucide-react';
import { getSceneDefinition } from '../../services/scenes/registry';
import { SCENES } from '../../types/scene';
import type { NodeData } from '../../types';
import { makeMockImageDataUrl } from '../../services/mock/sceneAssets';

type SceneResultPanelProps = {
  data: NodeData;
  isLoading: boolean;
  selected: boolean;
  onGenerate?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, updates: Partial<NodeData>) => void;
};

function getGridClass(count: number) {
  if (count === 25) return 'grid-cols-5';
  if (count === 9) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-1';
}

export const SceneResultPanel: React.FC<SceneResultPanelProps> = ({ data, isLoading, selected, onGenerate, onUpdate }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const definition = getSceneDefinition(data.scene);
  const images = data.outputs?.imageList || [];
  const structuredData = data.structuredData || data.outputs?.structuredData;
  const storyboard = structuredData?.storyboard || [];
  const frameDeduction = structuredData?.frameDeduction;
  const lightingRequest = structuredData?.lightingRequest;
  const progress = data.taskInfo?.progressPercent ?? 0;
  const isStoryboard25 = data.scene === SCENES.COHERENT_STORYBOARD_25;
  const isLightCorrection = data.scene === SCENES.CINEMATIC_LIGHT_CORRECTION;
  const isUpscale = data.scene === SCENES.UPSCALE;
  const selectedShot = storyboard[selectedIndex];
  const selectedImage = images[selectedIndex];

  const retryGridItem = (index: number) => {
    const nextImages = images.map((image, imageIndex) => {
      if (imageIndex !== index) return image;
      const label = image.label || `Result ${index + 1}`;
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
