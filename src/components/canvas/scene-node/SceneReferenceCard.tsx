import React from 'react';

type SceneReferenceCardProps = {
  imageUrl?: string;
  caption?: string;
  detail?: string;
};

export function SceneReferenceCard({ imageUrl, caption, detail }: SceneReferenceCardProps) {
  if (!imageUrl) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/28 p-3">
      <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-black">
        <img src={imageUrl} alt="reference" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Reference</div>
        {caption && <div className="mt-1 text-sm text-white/92">{caption}</div>}
        {detail && <div className="mt-1 line-clamp-1 text-xs text-neutral-500">{detail}</div>}
      </div>
    </div>
  );
}
