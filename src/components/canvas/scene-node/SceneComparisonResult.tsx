import React from 'react';

type SceneComparisonResultProps = {
  beforeUrl?: string;
  afterImage?: { url: string; label?: string };
  beforeLabel: string;
  afterLabel: string;
  footer?: React.ReactNode;
};

export function SceneComparisonResult({
  beforeUrl,
  afterImage,
  beforeLabel,
  afterLabel,
  footer,
}: SceneComparisonResultProps) {
  if (!beforeUrl && !afterImage) return null;

  const panels = [
    beforeUrl ? { url: beforeUrl, label: beforeLabel } : null,
    afterImage ? { url: afterImage.url, label: afterImage.label || afterLabel } : null,
  ].filter(Boolean) as Array<{ url: string; label: string }>;

  return (
    <div className="mb-4 space-y-3">
      <div className={`grid gap-3 ${panels.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {panels.map((panel) => (
          <div key={`${panel.label}-${panel.url}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black/32">
            <div className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {panel.label}
            </div>
            <img src={panel.url} alt={panel.label} className="aspect-video w-full object-cover p-3" />
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
