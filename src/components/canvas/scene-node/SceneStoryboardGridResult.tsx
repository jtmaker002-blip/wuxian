import React from 'react';
import type { StoryboardShot } from '../../../types/scene';

type SceneStoryboardGridResultProps = {
  images: Array<{ url: string; label?: string }>;
  storyboard?: StoryboardShot[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  gridClassName: string;
  variant: 'multi-view' | 'four-grid' | 'storyboard-25';
  selectedImage?: { url: string; label?: string };
  onRetrySelected?: () => void;
  onDownloadSelected?: () => void;
  onUpscaleSelected?: () => void;
  onSendSelectedToNode?: () => void;
};

export function SceneStoryboardGridResult({
  images,
  storyboard = [],
  selectedIndex,
  onSelect,
  gridClassName,
  variant,
  selectedImage,
  onRetrySelected,
  onDownloadSelected,
  onUpscaleSelected,
  onSendSelectedToNode,
}: SceneStoryboardGridResultProps) {
  if (images.length === 0) return null;
  const selectedShot = storyboard[selectedIndex];
  const title =
    variant === 'multi-view'
      ? '多机位镜头组'
      : variant === 'storyboard-25'
        ? '25宫格连贯分镜'
        : '剧情推演四宫格';
  const subtitle =
    variant === 'multi-view'
      ? '同一画面，不同机位与景别'
      : variant === 'storyboard-25'
        ? '连续短片分镜时间线'
        : '四段剧情推演结果';
  const cellClassName =
    variant === 'storyboard-25'
      ? 'rounded-lg'
      : 'rounded-xl';

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/24 px-3 py-2">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] text-neutral-300">
          {images.length} 格
        </div>
      </div>
      <div className={`grid ${gridClassName} gap-2`}>
        {images.map((image, index) => {
          const shot = storyboard[index];
          return (
            <button
              key={`${image.url}-${index}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(index);
              }}
              className={`group relative overflow-hidden ${cellClassName} border bg-black/40 text-left transition-colors ${
                selectedIndex === index ? 'border-blue-300/80' : 'border-white/10 hover:border-white/28'
              }`}
            >
              <img src={image.url} alt={image.label || `scene ${index + 1}`} className="aspect-video w-full object-cover" />
              <div className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-semibold text-white">
                {shot?.shotNumber || `#${index + 1}`}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 to-transparent p-2">
                <div className="text-[10px] font-semibold">{image.label || `#${index + 1}`}</div>
                {shot?.plotDescription && variant !== 'storyboard-25' && (
                  <div className="mt-0.5 line-clamp-2 text-[9px] text-white/72">{shot.plotDescription}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {(selectedShot || selectedImage) && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-white">
              {variant === 'multi-view' ? '机位详情' : '单格详情'} · #{selectedIndex + 1}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {onRetrySelected && (
                <button type="button" onClick={onRetrySelected} className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white">
                  重做本格
                </button>
              )}
              {selectedImage && onDownloadSelected && (
                <button type="button" onClick={onDownloadSelected} className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white">
                  下载
                </button>
              )}
              {selectedImage && onUpscaleSelected && (
                <button type="button" onClick={onUpscaleSelected} className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white">
                  高清
                </button>
              )}
              {selectedImage && onSendSelectedToNode && (
                <button type="button" onClick={onSendSelectedToNode} className="rounded-full border border-white/14 px-2 py-1 text-[10px] text-white">
                  新节点
                </button>
              )}
            </div>
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
    </div>
  );
}
