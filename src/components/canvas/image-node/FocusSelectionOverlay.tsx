import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface FocusSelectionOverlayProps {
  imageUrl: string;
  initialSelection?: { x: number; y: number; width: number; height: number };
  onChange: (selection: { x: number; y: number; width: number; height: number }) => void;
  onClose: () => void;
}

export function FocusSelectionOverlay({
  imageUrl,
  initialSelection,
  onChange,
  onClose,
}: FocusSelectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState(initialSelection ?? null);

  const normalizedRect = useMemo(() => currentRect, [currentRect]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateRectFromPointer = (clientX: number, clientY: number) => {
    if (!dragStart || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const nextX = Math.max(0, Math.min(clientX - bounds.left, bounds.width));
    const nextY = Math.max(0, Math.min(clientY - bounds.top, bounds.height));
    const width = Math.abs(nextX - dragStart.x);
    const height = Math.abs(nextY - dragStart.y);
    const rect = {
      x: Math.min(dragStart.x, nextX),
      y: Math.min(dragStart.y, nextY),
      width,
      height,
    };
    setCurrentRect(rect);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60">
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="relative flex h-[min(66vh,720px)] w-[min(78vw,1180px)] items-end justify-center rounded-[36px] border border-white/10 bg-[#171717] shadow-[0_32px_120px_rgba(0,0,0,0.45)]"
        >
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-2xl p-3 text-neutral-400 transition-colors hover:bg-white/6 hover:text-white"
          >
            <X size={24} />
          </button>

          <div className="pointer-events-none absolute inset-x-0 top-[20%] text-center text-white">
            <div className="mb-3 text-5xl font-semibold tracking-tight">聚焦模式</div>
            <div className="text-2xl text-neutral-200">请选择一张图像进行「局部框选」操作</div>
            <div className="mt-4 text-xl text-neutral-400">按 ESC 键可退出当前模式</div>
          </div>

          <div
            ref={containerRef}
            className="absolute bottom-10 left-16 overflow-hidden rounded-[26px] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
            onPointerDown={(event) => {
              if (!containerRef.current) return;
              const bounds = containerRef.current.getBoundingClientRect();
              setDragStart({
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
              });
              setCurrentRect(null);
            }}
            onPointerMove={(event) => updateRectFromPointer(event.clientX, event.clientY)}
            onPointerUp={() => {
              if (normalizedRect) {
                onChange(normalizedRect);
              }
              setDragStart(null);
            }}
          >
            <img src={imageUrl} alt="聚焦模式预览" className="max-h-[32vh] w-auto max-w-[32vw] object-contain" />
            {normalizedRect && (
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
                style={{
                  left: normalizedRect.x,
                  top: normalizedRect.y,
                  width: normalizedRect.width,
                  height: normalizedRect.height,
                }}
              />
            )}
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#232323] px-8 py-4 text-center text-xl text-neutral-100 shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
            请在图片上框选聚焦区域
          </div>
        </div>
      </div>
    </div>
  );
}
