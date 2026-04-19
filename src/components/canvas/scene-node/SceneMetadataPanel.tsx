import React from 'react';

type SceneMetadataPanelProps = {
  title: string;
  items: Array<{ label: string; value: React.ReactNode }>;
};

export function SceneMetadataPanel({ title, items }: SceneMetadataPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
      <div className="mb-2 font-semibold text-white">{title}</div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.label}>
            <span className="text-neutral-500">{item.label}：</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
