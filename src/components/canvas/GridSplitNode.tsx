import React from 'react';
import { Download } from 'lucide-react';
import type { GridTile } from '../../types/scene';
import type { NodeData } from '../../types';

type GridSplitNodeProps = {
  data: NodeData;
  onSendImageToNode?: (sourceNodeId: string, image: { url: string; label?: string }, action: 'image-node' | 'upscale-node') => void;
};

function downloadTile(tile: GridTile, sceneLabel: string) {
  const anchor = document.createElement('a');
  anchor.href = tile.imageUrl || tile.url;
  anchor.download = `${sceneLabel}-${tile.row + 1}-${tile.col + 1}.png`;
  anchor.click();
}

export const GridSplitNode: React.FC<GridSplitNodeProps> = ({ data, onSendImageToNode }) => {
  const images = (data.outputs?.imageList || []) as GridTile[];
  const split = data.structuredData?.split || data.outputs?.structuredData?.split;
  const rows = Number(split?.rows || data.params?.rows || 0);
  const cols = Number(split?.cols || data.params?.cols || 0);
  const isCustom = data.params?.mode === 'custom';
  const specLabel = rows && cols ? `${isCustom ? '自定义 ' : ''}${rows}×${cols}` : '待切分';

  return (
    <div className="rounded-lg border border-white/10 bg-black/24 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{specLabel}</div>
          <div className="mt-0.5 text-xs text-neutral-400">
            切片总数 · {split?.total || images.length}
          </div>
        </div>
        {split?.sourceWidth && split?.sourceHeight && (
          <div className="rounded bg-white/8 px-2 py-1 text-[11px] text-neutral-300">
            {split.sourceWidth} × {split.sourceHeight}
          </div>
        )}
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, cols || 1)}, minmax(0, 1fr))` }}
      >
        {images.map((tile, index) => (
          <div
            key={tile.id || `${tile.url}-${index}`}
            className="group relative overflow-hidden rounded-md border border-white/10 bg-black/40"
          >
            <img
              src={tile.imageUrl || tile.url}
              alt={tile.label || `tile ${index + 1}`}
              className="aspect-video w-full object-cover"
            />
            <div className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              {tile.row + 1}-{tile.col + 1}
            </div>
            <div className="absolute inset-x-1.5 top-7 flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSendImageToNode?.(data.id, tile, 'upscale-node');
                }}
                className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-black/85"
              >
                放大
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSendImageToNode?.(data.id, tile, 'image-node');
                }}
                className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-black/85"
              >
                新节点
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  downloadTile(tile, data.scene || 'grid-split');
                }}
                className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-black/85"
                title="下载"
              >
                <Download size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
