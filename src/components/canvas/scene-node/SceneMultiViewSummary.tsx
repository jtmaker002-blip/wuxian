import React from 'react';

type SceneMultiViewSummaryProps = {
  cameraAngles?: string[];
};

export function SceneMultiViewSummary({ cameraAngles = [] }: SceneMultiViewSummaryProps) {
  if (cameraAngles.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
      <div className="mb-2 font-semibold text-white">机位列表</div>
      <div className="flex flex-wrap gap-1.5">
        {cameraAngles.map((angle) => (
          <span key={angle} className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5">
            {angle}
          </span>
        ))}
      </div>
    </div>
  );
}
