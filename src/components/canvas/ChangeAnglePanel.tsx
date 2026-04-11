/**
 * ChangeAnglePanel.tsx
 * 
 * Panel for adjusting image viewing angle with 3D orbit camera control.
 * Users drag balls on arcs to adjust rotation, tilt, and zoom.
 */

import React, { useCallback } from 'react';
import { X, RotateCcw, Zap } from 'lucide-react';
import { OrbitCameraControl } from './OrbitCameraControl';
import { useTranslation } from 'react-i18next';

// ============================================================================
// TYPES
// ============================================================================

interface AngleSettings {
    rotation: number;  // -180 to 180 degrees
    tilt: number;      // -90 to 90 degrees
    scale: number;     // 0 to 100
    wideAngle: boolean;
}

interface ChangeAnglePanelProps {
    imageUrl: string;
    settings: AngleSettings;
    onSettingsChange: (settings: AngleSettings) => void;
    onClose: () => void;
    onGenerate: () => void;
    isLoading?: boolean;
    canvasTheme?: 'dark' | 'light';
    titleLabel?: string;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: AngleSettings = {
    rotation: 0,
    tilt: 0,
    scale: 0,
    wideAngle: false
};

const ANGLE_PRESETS = [
    { key: 'custom', label: '自定义', settings: DEFAULT_SETTINGS },
    { key: 'fisheye', label: '鱼眼视角', settings: { rotation: 0, tilt: 0, scale: 16, wideAngle: true } },
    { key: 'tilt', label: '倾斜视角', settings: { rotation: 24, tilt: -12, scale: 18, wideAngle: false } },
    { key: 'top-front', label: '正面俯拍', settings: { rotation: 0, tilt: -28, scale: 12, wideAngle: false } },
    { key: 'bottom-front', label: '正面仰拍', settings: { rotation: 0, tilt: 24, scale: 14, wideAngle: false } },
    { key: 'wide-top', label: '全景俯拍', settings: { rotation: 0, tilt: -34, scale: 6, wideAngle: true } },
    { key: 'rear', label: '背面视角', settings: { rotation: 180, tilt: 0, scale: 12, wideAngle: false } },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const ChangeAnglePanel: React.FC<ChangeAnglePanelProps> = ({
    imageUrl,
    settings,
    onSettingsChange,
    onClose,
    onGenerate,
    isLoading = false,
    canvasTheme = 'dark',
    titleLabel
}) => {
    const isDark = canvasTheme === 'dark';
    const { t } = useTranslation();
    const selectedPresetKey = React.useMemo(() => {
        const matchedPreset = ANGLE_PRESETS.find((preset) =>
            preset.settings.rotation === settings.rotation &&
            preset.settings.tilt === settings.tilt &&
            preset.settings.scale === settings.scale &&
            preset.settings.wideAngle === settings.wideAngle
        );
        return matchedPreset?.key ?? 'custom';
    }, [settings]);

    // --- Event Handlers ---
    const handleRotationChange = useCallback((value: number) => {
        onSettingsChange({ ...settings, rotation: value });
    }, [settings, onSettingsChange]);

    const handleTiltChange = useCallback((value: number) => {
        onSettingsChange({ ...settings, tilt: value });
    }, [settings, onSettingsChange]);

    const handleScaleChange = useCallback((value: number) => {
        onSettingsChange({ ...settings, scale: value });
    }, [settings, onSettingsChange]);

    const handleReset = useCallback(() => {
        onSettingsChange(DEFAULT_SETTINGS);
    }, [onSettingsChange]);

    // --- Render ---
    return (
        <div
            className={`p-5 rounded-[28px] shadow-2xl cursor-default w-[560px] transition-colors duration-300 ${isDark ? 'bg-[#1f1f1f] border border-neutral-700' : 'bg-white border border-neutral-200'}`}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <span className={`text-[28px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                    {titleLabel || t('changeAngle.title')}
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg transition-colors ${isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900'}`}
                    >
                        <RotateCcw size={12} />
                        {t('changeAngle.reset')}
                    </button>
                    <button
                        onClick={onClose}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-neutral-700 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'}`}
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                {ANGLE_PRESETS.map((preset) => {
                    const active = selectedPresetKey === preset.key;
                    return (
                        <button
                            key={preset.key}
                            type="button"
                            onClick={() => onSettingsChange({ ...preset.settings })}
                            className={`rounded-2xl px-4 py-2 text-sm transition-colors ${
                                active
                                    ? 'bg-white text-black'
                                    : isDark
                                        ? 'border border-neutral-700 bg-[#272727] text-neutral-200 hover:bg-[#313131]'
                                        : 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                            }`}
                        >
                            {preset.label}
                        </button>
                    );
                })}
            </div>

            {/* 3D Orbit Camera Control */}
            <OrbitCameraControl
                imageUrl={imageUrl}
                rotation={settings.rotation}
                tilt={settings.tilt}
                zoom={settings.scale}
                onRotationChange={handleRotationChange}
                onTiltChange={handleTiltChange}
                onZoomChange={handleScaleChange}
            />

            <div className="mt-6 flex items-center justify-between">
                <button
                    onClick={handleReset}
                    className={`flex items-center gap-2 text-base ${isDark ? 'text-neutral-300 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
                >
                    <RotateCcw size={18} />
                    重置参数
                </button>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1 text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        <Zap size={14} className="text-neutral-500" />
                        <span>1</span>
                    </div>
                    <button
                        onClick={onGenerate}
                        disabled={isLoading}
                        className={`group rounded-2xl px-5 py-4 font-medium text-sm flex items-center justify-center gap-2.5 transition-all duration-200 ${isLoading
                            ? 'bg-neutral-700/50 text-neutral-500 cursor-not-allowed'
                            : isDark
                                ? 'bg-white text-neutral-900 hover:bg-neutral-100 active:scale-[0.98]'
                                : 'bg-neutral-900 text-white hover:bg-neutral-800 active:scale-[0.98]'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                {t('changeAngle.generating')}
                            </>
                        ) : (
                            <>
                                <svg
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M12 19V5" />
                                    <path d="m7 10 5-5 5 5" />
                                </svg>
                                生成
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChangeAnglePanel;

