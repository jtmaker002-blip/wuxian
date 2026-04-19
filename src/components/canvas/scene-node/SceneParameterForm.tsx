import React from 'react';
import { SCENES } from '../../../types/scene';
import type { NodeData } from '../../../types';

type SceneParameterFormProps = {
  data: NodeData;
  onUpdate?: (nodeId: string, updates: Partial<NodeData>) => void;
};

export const SceneParameterForm: React.FC<SceneParameterFormProps> = ({ data, onUpdate }) => {
  const isStoryboard25 = data.scene === SCENES.COHERENT_STORYBOARD_25;
  const isGridSplit = data.scene === SCENES.GRID_SPLIT;
  const isLightCorrection = data.scene === SCENES.CINEMATIC_LIGHT_CORRECTION;
  const isUpscale = data.scene === SCENES.UPSCALE;
  const isFourGrid = data.scene === SCENES.PLOT_DEDUCTION_FOUR_GRID;
  const isThreeView = data.scene === SCENES.CHARACTER_THREE_VIEW_GENERATE;
  const isFrameDeduction = data.scene === SCENES.FRAME_DEDUCTION_PLUS_3S || data.scene === SCENES.FRAME_DEDUCTION_MINUS_5S;

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

  const referenceImagesText = Array.isArray(data.params?.referenceImages)
    ? data.params.referenceImages.join('\n')
    : '';
  const sourceImageUrl = (
    isLightCorrection
      ? data.params?.originImage
      : data.params?.imageUrl || data.params?.characterImageUrl
  ) as string | undefined;
  const sourceParamKey =
    isLightCorrection
      ? 'originImage'
      : isThreeView
        ? 'characterImageUrl'
        : 'imageUrl';

  return (
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
        {!isGridSplit && (
          <>
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
                value={(data.params?.imageModel as string) || 'gemini-3-pro-image-preview'}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam('imageModel', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="gemini-3-pro-image-preview">Nano Banana Pro</option>
                <option value="gemini-3.1-flash-image-preview">Nano Banana 2</option>
                <option value="gemini-2.5-flash-image-preview">Nano Banana 1</option>
                <option value="gpt-image-1.5">gpt-image-1.5</option>
                <option value="gpt-image-1">gpt-image-1</option>
              </select>
            </label>
          </>
        )}
        {(isGridSplit || isLightCorrection || isUpscale || isFrameDeduction || isThreeView) && (
          <div className="col-span-2 rounded-xl border border-white/10 bg-[#101010] p-2">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">输入素材</div>
            {sourceImageUrl ? (
              <div className="flex items-center gap-2">
                <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-black">
                  <img src={sourceImageUrl} alt="source" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 text-xs text-neutral-400">
                  <div className="text-neutral-200">来自已连接图片节点</div>
                  <input
                    value={sourceImageUrl}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => updateParam(sourceParamKey, event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/24 px-2 py-1 text-[11px] text-neutral-300 outline-none focus:border-blue-400/70"
                  />
                </div>
              </div>
            ) : (
              <input
                value=""
                placeholder="粘贴图片 URL，或从图片节点连接后自动带入"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam(sourceParamKey, event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/24 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-blue-400/70"
              />
            )}
          </div>
        )}
        {isGridSplit && (
          <div className="col-span-2 rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-xs text-neutral-300">
            当前规格：{data.params?.mode === 'custom' ? '自定义 ' : ''}{Number(data.params?.rows || 2)} × {Number(data.params?.cols || 2)}
          </div>
        )}
        {(isFourGrid || isStoryboard25 || isLightCorrection) && (
          <label className="col-span-2 text-xs text-neutral-400">
            参考图 URL（每行一个）
            <textarea
              value={referenceImagesText}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => updateParam(
                isLightCorrection ? 'referenceImage' : 'referenceImages',
                isLightCorrection
                  ? event.target.value.split('\n').map((item) => item.trim()).filter(Boolean)[0] || ''
                  : event.target.value.split('\n').map((item) => item.trim()).filter(Boolean)
              )}
              className="mt-1 min-h-[58px] w-full resize-none rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-400/70"
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
        {isFourGrid && (
          <label className="text-xs text-neutral-400">
            一致性
            <select
              value={(data.params?.consistencyLevel as string) || 'high'}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => updateParam('consistencyLevel', event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        )}
        {isStoryboard25 && (
          <label className="text-xs text-neutral-400">
            分镜时长
            <input
              type="number"
              min="25"
              max="300"
              value={Number(data.params?.durationSeconds ?? 100)}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => updateParam('durationSeconds', Number(event.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
            />
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
              色温
              <select
                value={(data.params?.lightColor as string) || 'neutral'}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam('lightColor', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="neutral">neutral</option>
                <option value="warm">warm</option>
                <option value="cold">cold</option>
                <option value="sunset">sunset</option>
                <option value="neon">neon</option>
              </select>
            </label>
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
              轮廓光
              <select
                value={data.params?.rimLightEnabled === false ? 'off' : 'on'}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam('rimLightEnabled', event.target.value === 'on')}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="on">开启</option>
                <option value="off">关闭</option>
              </select>
            </label>
            <label className="text-xs text-neutral-400">
              轮廓光方向
              <select
                value={(data.params?.rimLightDirection as string) || 'back'}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam('rimLightDirection', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
              >
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
        {isThreeView && (
          <>
            <label className="text-xs text-neutral-400">
              背景
              <select
                value={(data.params?.background as string) || 'plain'}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam('background', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="plain">plain</option>
                <option value="gray">gray</option>
                <option value="transparent-look">transparent-look</option>
              </select>
            </label>
            <label className="text-xs text-neutral-400">
              排版
              <select
                value={(data.params?.outputLayout as string) || 'grid'}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam('outputLayout', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="grid">grid</option>
                <option value="split">split</option>
              </select>
            </label>
          </>
        )}
        {isUpscale && (
          <>
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
            <label className="text-xs text-neutral-400">
              细节模式
              <select
                value={(data.params?.detailMode as string) || 'cinematic'}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateParam('detailMode', event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#101010] px-3 py-2 text-sm text-white outline-none"
              >
                <option value="natural">natural</option>
                <option value="sharp">sharp</option>
                <option value="cinematic">cinematic</option>
              </select>
            </label>
          </>
        )}
      </div>
    </div>
  );
};
