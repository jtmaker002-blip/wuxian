import React from 'react';

type SceneThreeViewResultProps = {
  images: Array<{ url: string; label?: string }>;
  onUpscale?: () => void;
  onSendToNode?: () => void;
};

function downloadThreeViewContactSheet(images: Array<{ url: string; label?: string }>) {
  const viewImages = images.slice(0, 3);
  if (viewImages.length === 0) return;
  if (viewImages.length === 1) {
    const anchor = document.createElement('a');
    anchor.href = viewImages[0].url;
    anchor.download = 'character-three-view-sheet.png';
    anchor.click();
    return;
  }
  const width = 360 * viewImages.length;
  const height = 280;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#111111"/>
      ${viewImages.map((image, index) => `
        <g transform="translate(${index * 360},0)">
          <rect x="12" y="12" width="336" height="220" rx="18" fill="#1d1d1d" stroke="#444"/>
          <image href="${image.url}" x="24" y="24" width="312" height="196" preserveAspectRatio="xMidYMid meet"/>
          <text x="180" y="258" fill="#ffffff" font-size="18" font-family="Arial, sans-serif" text-anchor="middle">${image.label || ['front', 'side', 'back'][index] || `view ${index + 1}`}</text>
        </g>
      `).join('')}
    </svg>
  `;
  const anchor = document.createElement('a');
  anchor.href = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  anchor.download = 'character-three-view-contact-sheet.svg';
  anchor.click();
}

export function SceneThreeViewResult({ images, onUpscale, onSendToNode }: SceneThreeViewResultProps) {
  const image = images[0];
  if (!image) return null;

  return (
    <div className="mb-4 space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#f4f1ea]">
        <img
          src={image.url}
          alt={image.label || 'three view'}
          className="aspect-[16/10] w-full object-contain p-4"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadThreeViewContactSheet(images)}
          className="rounded-full border border-white/14 px-3 py-1.5 text-[11px] text-white"
        >
          下载成品
        </button>
        <button
          type="button"
          onClick={onUpscale}
          className="rounded-full border border-white/14 px-3 py-1.5 text-[11px] text-white"
        >
          高清放大
        </button>
        <button
          type="button"
          onClick={onSendToNode}
          className="rounded-full border border-white/14 px-3 py-1.5 text-[11px] text-white"
        >
          新节点
        </button>
      </div>
    </div>
  );
}
