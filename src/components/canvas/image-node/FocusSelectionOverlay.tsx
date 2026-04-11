import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface FocusSelectionOverlayProps {
  imageUrl: string;
  initialSelection?: { x: number; y: number; width: number; height: number };
  onChange: (selection: { x: number; y: number; width: number; height: number }) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  instruction?: string;
}

type FocusRect = { x: number; y: number; width: number; height: number };

export function normalizeFocusSelectionFromDisplayRect(rect: FocusRect, bounds: { width: number; height: number }): FocusRect {
  return {
    x: rect.x / bounds.width,
    y: rect.y / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  };
}

export function getFocusSelectionDisplayRect(selection: FocusRect, bounds: { width: number; height: number }): FocusRect {
  const isNormalized =
    selection.x <= 1 &&
    selection.y <= 1 &&
    selection.width <= 1 &&
    selection.height <= 1;

  if (!isNormalized) {
    return selection;
  }

  return {
    x: selection.x * bounds.width,
    y: selection.y * bounds.height,
    width: selection.width * bounds.width,
    height: selection.height * bounds.height,
  };
}

export function FocusSelectionOverlay({
  imageUrl,
  initialSelection,
  onChange,
  onClose,
  title = '聚焦模式',
  subtitle = '请选择一张图像进行「局部框选」操作',
  instruction = '请在图片上框选聚焦区域',
}: FocusSelectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRectRef = useRef<FocusRect | null>(initialSelection ?? null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState(initialSelection ?? null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getSelectionFromPointer = (clientX: number, clientY: number) => {
    const start = dragStartRef.current || dragStart;
    if (!start || !containerRef.current) return null;
    const bounds = containerRef.current.getBoundingClientRect();
    const nextX = Math.max(0, Math.min(clientX - bounds.left, bounds.width));
    const nextY = Math.max(0, Math.min(clientY - bounds.top, bounds.height));
    const width = Math.abs(nextX - start.x);
    const height = Math.abs(nextY - start.y);
    const rect = {
      x: Math.min(start.x, nextX),
      y: Math.min(start.y, nextY),
      width,
      height,
    };
    return normalizeFocusSelectionFromDisplayRect(rect, bounds);
  };

  const updateRectFromPointer = (clientX: number, clientY: number) => {
    const normalizedSelection = getSelectionFromPointer(clientX, clientY);
    if (!normalizedSelection) return;
    currentRectRef.current = normalizedSelection;
    setCurrentRect(normalizedSelection);
  };

  const startSelection = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const start = {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
    dragStartRef.current = start;
    setDragStart(start);
    currentRectRef.current = null;
    setCurrentRect(null);
  };

  const finishSelection = (clientX: number, clientY: number) => {
    const finalSelection = getSelectionFromPointer(clientX, clientY) || currentRectRef.current;
    if (finalSelection) {
      currentRectRef.current = finalSelection;
      setCurrentRect(finalSelection);
      onChange(finalSelection);
    }
    dragStartRef.current = null;
    setDragStart(null);
  };

  return (
    <div className="fixed inset-0 z-[1200] overflow-hidden bg-[rgba(6,6,6,0.92)] backdrop-blur-[3px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_bottom,rgba(80,80,80,0.22),transparent_40%)]" />

      <button
        onClick={onClose}
        className="absolute right-8 top-8 z-20 rounded-2xl border border-white/10 bg-white/5 p-3 text-neutral-400 transition-colors hover:bg-white/8 hover:text-white"
      >
        <X size={22} />
      </button>

      <div className="relative flex h-full flex-col px-10 pb-10 pt-16 text-white">
        <div className="pointer-events-none mx-auto max-w-4xl text-center">
          <div className="text-[52px] font-semibold tracking-[-0.03em] text-white">{title}</div>
          <div className="mt-4 text-[24px] text-neutral-200">{subtitle}</div>
          <div className="mt-3 text-[17px] text-neutral-500">按 ESC 键可退出当前模式</div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-10">
          <div
            ref={containerRef}
            className="relative ml-10 overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-[0_30px_120px_rgba(0,0,0,0.58)]"
            onPointerDown={(event) => {
              if (!containerRef.current) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              startSelection(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => updateRectFromPointer(event.clientX, event.clientY)}
            onPointerUp={(event) => finishSelection(event.clientX, event.clientY)}
            onMouseDown={(event) => startSelection(event.clientX, event.clientY)}
            onMouseMove={(event) => updateRectFromPointer(event.clientX, event.clientY)}
            onMouseUp={(event) => finishSelection(event.clientX, event.clientY)}
          >
            <img
              src={imageUrl}
              alt="聚焦模式预览"
              draggable={false}
              className="pointer-events-none max-h-[34vh] w-auto max-w-[34vw] select-none object-contain"
            />
            {currentRect && (
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]"
                style={
                  currentRect.x <= 1 &&
                  currentRect.y <= 1 &&
                  currentRect.width <= 1 &&
                  currentRect.height <= 1
                    ? {
                      left: `${currentRect.x * 100}%`,
                      top: `${currentRect.y * 100}%`,
                      width: `${currentRect.width * 100}%`,
                      height: `${currentRect.height * 100}%`,
                    }
                    : {
                      left: currentRect.x,
                      top: currentRect.y,
                      width: currentRect.width,
                      height: currentRect.height,
                    }
                }
              />
            )}
          </div>

          <div className="mb-4 mr-8 flex-1">
            <div className="ml-auto flex w-fit max-w-[420px] items-center rounded-[22px] border border-white/10 bg-white/6 px-7 py-4 text-[20px] font-medium text-white shadow-[0_20px_45px_rgba(0,0,0,0.28)]">
              {instruction}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
