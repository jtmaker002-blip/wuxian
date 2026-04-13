import React from 'react';
import { Film, Grid3X3, Lamp, Maximize2, Sparkles, SplitSquareHorizontal, TimerReset, UserRound } from 'lucide-react';
import { SCENE_DEFINITIONS } from '../../services/scenes/registry';
import type { SceneId } from '../../types/scene';

const iconMap = {
  grid: Grid3X3,
  story: Film,
  storyboard: SplitSquareHorizontal,
  light: Lamp,
  character: UserRound,
  future: TimerReset,
  past: TimerReset,
  upscale: Maximize2,
  gridSplit: SplitSquareHorizontal,
};

type NineGridMenuProps = {
  isDark: boolean;
  onSelectScene: (scene: SceneId) => void;
};

export const NineGridMenu: React.FC<NineGridMenuProps> = ({ isDark, onSelectScene }) => {
  return (
    <div className={`w-full overflow-hidden border-y py-2 ${
      isDark ? 'border-neutral-800 bg-[#171717]' : 'border-neutral-200 bg-neutral-50'
    }`}>
      <div className={`px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        isDark ? 'text-neutral-500' : 'text-neutral-400'
      }`}>
        Liblib Scene Pipelines
      </div>
      {SCENE_DEFINITIONS.map((definition) => {
        const Icon = iconMap[definition.icon as keyof typeof iconMap] || Sparkles;
        return (
          <button
            key={definition.scene}
            type="button"
            onClick={() => onSelectScene(definition.scene)}
            className={`group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
            }`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              isDark ? 'bg-neutral-800 text-neutral-200 group-hover:text-white' : 'bg-neutral-200 text-neutral-700'
            }`}>
              <Icon size={17} />
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-medium ${isDark ? 'text-neutral-100' : 'text-neutral-800'}`}>
                {definition.label}
              </div>
              <div className={`mt-0.5 line-clamp-1 text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                {definition.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
