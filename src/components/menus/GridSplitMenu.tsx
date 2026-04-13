import React from 'react';
import { ChevronRight, Grid3X3 } from 'lucide-react';

export type GridSplitSelection = {
  mode: 'preset' | 'custom';
  rows: number;
  cols: number;
  gridType?: 4 | 9 | 16 | 25;
};

type GridSplitMenuProps = {
  onSelect: (selection: GridSplitSelection) => void;
};

const presetItems = [
  { type: 4 as const, label: '4宫格 (2×2)', rows: 2, cols: 2 },
  { type: 9 as const, label: '9宫格 (3×3)', rows: 3, cols: 3 },
  { type: 16 as const, label: '16宫格 (4×4)', rows: 4, cols: 4 },
  { type: 25 as const, label: '25宫格 (5×5)', rows: 5, cols: 5 },
];

export const GridSplitMenu: React.FC<GridSplitMenuProps> = ({ onSelect }) => {
  const [isCustomOpen, setIsCustomOpen] = React.useState(false);
  const [hoveredCell, setHoveredCell] = React.useState({ row: 0, col: 0 });
  const hoverRows = hoveredCell.row + 1;
  const hoverCols = hoveredCell.col + 1;

  return (
    <div
      className="relative flex items-start gap-2"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseLeave={() => setIsCustomOpen(false)}
    >
      <div className="w-[150px] overflow-hidden rounded-lg border border-white/10 bg-[#242424]/96 p-1.5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {presetItems.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => onSelect({
              mode: 'preset',
              gridType: item.type,
              rows: item.rows,
              cols: item.cols,
            })}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/8"
          >
            <Grid3X3 size={14} className="text-neutral-400" />
            <span>{item.label}</span>
          </button>
        ))}

        <div className="my-1 h-px bg-white/8" />

        <button
          type="button"
          onMouseEnter={() => setIsCustomOpen(true)}
          onFocus={() => setIsCustomOpen(true)}
          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/8"
        >
          <span>自定义</span>
          <ChevronRight size={14} className="text-neutral-400" />
        </button>
      </div>

      {isCustomOpen && (
        <div
          className="w-[168px] rounded-lg border border-white/10 bg-[#242424]/96 p-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          onMouseEnter={() => setIsCustomOpen(true)}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-neutral-300">自定义宫格</span>
            <span className="rounded bg-black/35 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {hoverRows} x {hoverCols}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 25 }, (_, index) => {
              const row = Math.floor(index / 5);
              const col = index % 5;
              const highlighted = row <= hoveredCell.row && col <= hoveredCell.col;
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={`${row + 1} x ${col + 1}`}
                  onMouseEnter={() => setHoveredCell({ row, col })}
                  onFocus={() => setHoveredCell({ row, col })}
                  onClick={() => onSelect({
                    mode: 'custom',
                    rows: row + 1,
                    cols: col + 1,
                  })}
                  className={`h-6 w-6 rounded border transition-colors ${
                    highlighted
                      ? 'border-blue-300 bg-blue-500/80'
                      : 'border-white/10 bg-white/10 hover:border-blue-300/60'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
