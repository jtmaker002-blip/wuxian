import React from 'react';
import { RotateCcw, X, Zap } from 'lucide-react';

type LightingSettings = {
  mode: 'global' | 'local';
  smartMode: boolean;
  brightness: number;
  color: string;
  keyLight: 'left' | 'top' | 'right' | 'front' | 'bottom' | 'back';
  rimLight: boolean;
};

interface LightingPanelProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
  onClose: () => void;
  onGenerate: () => void;
}

const LIGHT_POSITIONS: LightingSettings['keyLight'][] = ['left', 'top', 'right', 'front', 'bottom', 'back'];

export function LightingPanel({ settings, onChange, onClose, onGenerate }: LightingPanelProps) {
  return (
    <div
      className="w-[560px] rounded-[28px] border border-neutral-700 bg-[#1f1f1f] p-6 text-white shadow-2xl"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[32px] font-semibold tracking-tight">打光效果</h3>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <X size={22} />
        </button>
      </div>

      <div className="grid grid-cols-[220px,1fr] gap-6">
        <div className="rounded-[22px] bg-[#262626] p-4">
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => onChange({ ...settings, mode: 'global' })}
              className={`rounded-xl px-4 py-2 text-sm ${settings.mode === 'global' ? 'bg-white text-black' : 'bg-[#303030] text-neutral-300'}`}
            >
              全局
            </button>
            <button
              onClick={() => onChange({ ...settings, mode: 'local' })}
              className={`rounded-xl px-4 py-2 text-sm ${settings.mode === 'local' ? 'bg-white text-black' : 'bg-[#303030] text-neutral-300'}`}
            >
              局部
            </button>
          </div>
          <div className="aspect-square rounded-[22px] bg-[radial-gradient(circle_at_30%_70%,rgba(255,255,255,0.7),rgba(255,255,255,0.05)_30%,transparent_40%),#222] p-3">
            <div className="h-full w-full rounded-full border border-white/10" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xl font-medium">智能模式</span>
            <button
              onClick={() => onChange({ ...settings, smartMode: !settings.smartMode })}
              className={`relative h-7 w-14 rounded-full transition-colors ${settings.smartMode ? 'bg-white' : 'bg-neutral-700'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-black transition-all ${settings.smartMode ? 'left-8' : 'left-1 bg-white'}`}
              />
            </button>
          </div>

          <label className="block">
            <div className="mb-2 text-xl font-medium">亮度</div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.brightness}
              onChange={(event) => onChange({ ...settings, brightness: Number(event.target.value) })}
              className="w-full accent-white"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-xl font-medium">颜色</div>
            <input
              type="color"
              value={settings.color}
              onChange={(event) => onChange({ ...settings, color: event.target.value })}
              className="h-12 w-20 rounded-xl border border-neutral-700 bg-transparent"
            />
          </label>

          <div>
            <div className="mb-2 text-xl font-medium">主光源</div>
            <div className="grid grid-cols-3 gap-2">
              {LIGHT_POSITIONS.map((position) => (
                <button
                  key={position}
                  onClick={() => onChange({ ...settings, keyLight: position })}
                  className={`rounded-xl px-3 py-2 text-sm capitalize ${settings.keyLight === position ? 'bg-white text-black' : 'bg-[#2b2b2b] text-neutral-300'}`}
                >
                  {position}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xl font-medium">轮廓光</span>
            <button
              onClick={() => onChange({ ...settings, rimLight: !settings.rimLight })}
              className={`relative h-7 w-14 rounded-full transition-colors ${settings.rimLight ? 'bg-white' : 'bg-neutral-700'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-black transition-all ${settings.rimLight ? 'left-8' : 'left-1 bg-white'}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() =>
            onChange({
              mode: 'global',
              smartMode: false,
              brightness: 50,
              color: '#ffffff',
              keyLight: 'front',
              rimLight: false,
            })
          }
          className="flex items-center gap-2 text-base text-neutral-300 hover:text-white"
        >
          <RotateCcw size={18} />
          重置参数
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm text-neutral-400">
            <Zap size={14} className="text-neutral-500" />
            <span>1</span>
          </div>
          <button
            onClick={onGenerate}
            className="rounded-2xl bg-white px-5 py-4 text-lg font-semibold text-black hover:bg-neutral-100"
          >
            生成
          </button>
        </div>
      </div>
    </div>
  );
}
