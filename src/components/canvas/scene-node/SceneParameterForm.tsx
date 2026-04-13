import React from 'react';
import { SCENES } from '../../../types/scene';
import type { NodeData } from '../../../types';

type SceneParameterFormProps = {
  data: NodeData;
  onUpdate?: (nodeId: string, updates: Partial<NodeData>) => void;
};

export const SceneParameterForm: React.FC<SceneParameterFormProps> = ({ data, onUpdate }) => {
  const isStoryboard25 = data.scene === SCENES.COHERENT_STORYBOARD_25;
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
  );
};
