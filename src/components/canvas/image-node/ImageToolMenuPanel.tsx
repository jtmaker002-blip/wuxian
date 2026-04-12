import React from 'react';
import { X } from 'lucide-react';

type ImageToolMenuItem = {
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  description?: string;
};

interface ImageToolMenuPanelProps {
  title: string;
  items: Array<string | ImageToolMenuItem>;
  description?: string;
  onClose: () => void;
  onSelect?: (item: string) => void;
  variant?: 'panel' | 'dropdown';
  showCloseButton?: boolean;
  showTitle?: boolean;
  widthClassName?: string;
}

export function ImageToolMenuPanel({
  title,
  items,
  description,
  onClose,
  onSelect,
  variant = 'panel',
  showCloseButton = true,
  showTitle = true,
  widthClassName,
}: ImageToolMenuPanelProps) {
  const isDropdown = variant === 'dropdown';

  return (
    <div
      className={[
        widthClassName || (isDropdown ? 'w-[260px]' : 'w-[420px]'),
        isDropdown
          ? 'rounded-[22px] border border-white/12 bg-[#242424]/96 p-2 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl'
          : 'rounded-[28px] border border-neutral-700 bg-[#1f1f1f] p-5 text-white shadow-2xl',
      ].join(' ')}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {(showTitle || showCloseButton) && (
        <div className={`${isDropdown ? 'mb-1.5' : 'mb-4'} flex items-center justify-between`}>
          {showTitle ? (
            <h3 className={isDropdown ? 'px-2 py-1 text-sm font-medium text-neutral-300' : 'text-[28px] font-semibold tracking-tight'}>
              {title}
            </h3>
          ) : (
            <div />
          )}
          {showCloseButton && (
            <button
              onClick={onClose}
              className={`rounded-full ${isDropdown ? 'p-1.5' : 'p-2'} text-neutral-400 hover:bg-neutral-800 hover:text-white`}
            >
              <X size={isDropdown ? 16 : 20} />
            </button>
          )}
        </div>
      )}

      {description && !isDropdown && <p className="mb-4 text-sm leading-6 text-neutral-300">{description}</p>}

      <div className="grid gap-2">
        {items.map((item) => {
          const normalized = typeof item === 'string' ? { label: item } : item;
          return (
            <button
              key={normalized.label}
              onClick={() => onSelect?.(normalized.label)}
              className={
                isDropdown
                  ? 'flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-[14px] font-medium text-neutral-100 transition-all hover:bg-white/8 hover:text-white active:scale-[0.99]'
                  : 'flex items-center justify-between gap-3 rounded-2xl border border-neutral-700 bg-[#2a2a2a] px-4 py-3 text-left text-lg text-neutral-100 transition-all hover:bg-[#333] hover:text-white active:scale-[0.99]'
              }
            >
              <span className="flex min-w-0 items-center gap-3">
                {normalized.icon && <span className="text-neutral-300">{normalized.icon}</span>}
                <span className="min-w-0">
                  <span className="block truncate">{normalized.label}</span>
                  {normalized.description && (
                    <span className={`mt-0.5 block truncate text-xs font-normal ${isDropdown ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {normalized.description}
                    </span>
                  )}
                </span>
              </span>
              {normalized.badge && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
                  {normalized.badge}
                </span>
              )}
            </button>
        )})}
      </div>
    </div>
  );
}
