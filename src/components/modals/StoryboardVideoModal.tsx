/**
 * StoryboardVideoModal.tsx
 * 
 * Modal for batch generating videos from storyboard scene images.
 * Allows users to write/generate prompts for each scene and configure video settings.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Film, Loader2, Play, Check, ChevronDown, Wand2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeData } from '../../types';
import { OpenAIIcon, GoogleIcon, KlingIcon, HailuoIcon } from '../icons/BrandIcons';
import { useEnabledModelIdsFromStorage } from '../../hooks/useApiSettings';
import {
    getStoryboardVideoModalState,
    getStoryboardVideoOptions,
    normalizeStoryboardVideoSettings,
    type StoryboardVideoSettings,
} from './storyboardVideoOptions';

interface StoryboardVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenes: NodeData[];
    onCreateVideos: (
        prompts: Record<string, string>,
        settings: {
            model: string;
            duration: number;
            resolution: string;
        },
        activeNodeIds: string[]
    ) => void;
    storyContext?: {
        story: string;
        scripts: any[];
    };
}

const EMPTY_SETTINGS: StoryboardVideoSettings = {
    model: '',
    duration: 5,
    resolution: 'Auto',
};

export const StoryboardVideoModal: React.FC<StoryboardVideoModalProps> = ({
    isOpen,
    onClose,
    scenes,
    onCreateVideos,
    storyContext
}) => {
    const { t } = useTranslation();
    const enabledIds = useEnabledModelIdsFromStorage();

    // Track removed scenes (locally within modal session)
    const [removedSceneIds, setRemovedSceneIds] = useState<Set<string>>(new Set());

    // Reset removed scenes when modal opens/closes or scenes change significantly
    useEffect(() => {
        if (isOpen) {
            setRemovedSceneIds(new Set());
        }
    }, [isOpen]);

    // Filter out removed scenes, then sort by X position
    const activeScenes = scenes.filter(s => !removedSceneIds.has(s.id));
    const sortedScenes = [...activeScenes].sort((a, b) => a.x - b.x);

    const [prompts, setPrompts] = useState<Record<string, string>>({});
    const [settings, setSettings] = useState<StoryboardVideoSettings>(() =>
        normalizeStoryboardVideoSettings(EMPTY_SETTINGS, getStoryboardVideoOptions(enabledIds)) ?? EMPTY_SETTINGS,
    );
    const [generatingPrompts, setGeneratingPrompts] = useState<Record<string, boolean>>({});
    const [optimizingPrompts, setOptimizingPrompts] = useState<Record<string, boolean>>({});
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const {
        options: storyboardVideoOptions,
        sections: storyboardVideoSections,
        currentSettings: effectiveSettings,
        currentOption,
    } = getStoryboardVideoModalState(enabledIds, settings);
    const currentSettings = effectiveSettings ?? EMPTY_SETTINGS;
    const currentModel = currentOption?.model;
    const availableDurations = currentOption?.durations ?? [];
    const availableResolutions = currentOption?.resolutions ?? [];
    const optionsSignature = storyboardVideoOptions
        .map((option) => `${option.model.id}:${option.durations.join(',')}:${option.resolutions.join(',')}`)
        .join('|');

    useEffect(() => {
        if (effectiveSettings) {
            if (
                settings.model !== effectiveSettings.model ||
                settings.duration !== effectiveSettings.duration ||
                settings.resolution !== effectiveSettings.resolution
            ) {
                setSettings(effectiveSettings);
            }
            return;
        }

        if (
            settings.model !== EMPTY_SETTINGS.model ||
            settings.duration !== EMPTY_SETTINGS.duration ||
            settings.resolution !== EMPTY_SETTINGS.resolution
        ) {
            setSettings(EMPTY_SETTINGS);
        }
    }, [
        effectiveSettings,
        optionsSignature,
        settings.duration,
        settings.model,
        settings.resolution,
    ]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize prompts with existing node prompts or empty
    useEffect(() => {
        if (isOpen) {
            const initialPrompts: Record<string, string> = {};
            sortedScenes.forEach(scene => {
                // If the scene prompt is an "Extract panel" command, we probably want a fresh description
                // If it's a creative prompt, use it
                if (scene.prompt && !scene.prompt.startsWith('Extract panel')) {
                    initialPrompts[scene.id] = scene.prompt;
                } else {
                    initialPrompts[scene.id] = '';
                }
            });
            setPrompts(initialPrompts);
        }
    }, [isOpen, scenes]);

    // Handle single prompt generation using Gemini
    const handleGeneratePrompt = async (nodeId: string) => {
        const scene = scenes.find(s => s.id === nodeId);
        if (!scene || !scene.resultUrl) return;

        setGeneratingPrompts(prev => ({ ...prev, [nodeId]: true }));

        try {
            // Using a simple text generation endpoint that supports image input
            // Construct a context-rich prompt
            let systemPrompt = "Describe this image in detail to be used as a prompt for video generation. Focus on the action, movement, and atmosphere. Keep it under 50 words.";

            if (storyContext) {
                systemPrompt += `\n\nContext from Story: "${storyContext.story}"`;
                // Try to find specific script info if possible (assuming index matches or title match)
                const sceneIndex = sortedScenes.findIndex(s => s.id === nodeId);
                if (sceneIndex !== -1 && storyContext.scripts[sceneIndex]) {
                    const script = storyContext.scripts[sceneIndex];
                    console.log(`[StoryboardModal] Injecting script for scene #${sceneIndex + 1}:`, script.description);
                    systemPrompt += `\n\nScene Script: ${script.description}`;
                    if (script.cameraAngle) systemPrompt += `\nCamera: ${script.cameraAngle} ${script.cameraMovement ? `(${script.cameraMovement})` : ''}`;
                    if (script.lighting) systemPrompt += `\nLighting: ${script.lighting}`;
                    if (script.mood) systemPrompt += `\nMood: ${script.mood}`;
                }
            }

            const response = await fetch('/api/gemini/describe-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: scene.resultUrl,
                    prompt: systemPrompt
                })
            });

            if (!response.ok) throw new Error('Failed to generate prompt');

            const data = await response.json();
            setPrompts(prev => ({ ...prev, [nodeId]: data.description }));
        } catch (error) {
            console.error('Prompt generation failed:', error);
            // Fallback or error notification could go here
        } finally {
            setGeneratingPrompts(prev => ({ ...prev, [nodeId]: false }));
        }
    };

    // Handle optimizing manually entered prompts using Gemini
    const handleOptimizePrompt = async (nodeId: string) => {
        const currentPrompt = prompts[nodeId];
        if (!currentPrompt) return; // Nothing to optimize

        setOptimizingPrompts(prev => ({ ...prev, [nodeId]: true }));

        try {
            const response = await fetch('/api/gemini/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: currentPrompt
                })
            });

            if (!response.ok) throw new Error('Failed to optimize prompt');

            const data = await response.json();
            setPrompts(prev => ({ ...prev, [nodeId]: data.optimizedPrompt }));
        } catch (error) {
            console.error('Prompt optimization failed:', error);
            // Fallback or error notification could go here
        } finally {
            setOptimizingPrompts(prev => ({ ...prev, [nodeId]: false }));
        }
    };

    const handleRemoveScene = (nodeId: string) => {
        setRemovedSceneIds(prev => {
            const newSet = new Set(prev);
            newSet.add(nodeId);
            return newSet;
        });
    };

    const handleModelChange = (modelId: string) => {
        const nextSettings = normalizeStoryboardVideoSettings(
            { ...currentSettings, model: modelId },
            storyboardVideoOptions,
        );
        if (!nextSettings) return;

        setSettings(nextSettings);
        setShowModelDropdown(false);
    };

    const renderVideoModelIcon = (provider?: string, selected = false) => {
        if (provider === 'openai') {
            return <OpenAIIcon size={14} className={selected ? 'text-blue-400' : 'text-green-400'} />;
        }
        if (provider === 'google') {
            return <GoogleIcon size={14} className={selected ? 'text-blue-400' : 'text-neutral-400'} />;
        }
        if (provider === 'kling') {
            return <KlingIcon size={16} />;
        }
        if (provider === 'hailuo') {
            return <HailuoIcon size={16} />;
        }
        return <Film size={14} />;
    };

    // Use currentModel derived from settings state
    // ...

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-neutral-800 flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-[#1a1a1a] z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                            <Film size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">{t('storyboardVideo.title')}</h2>
                            <p className="text-xs text-neutral-500">{t('storyboardVideo.subtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable List of Scenes */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {sortedScenes.length === 0 ? (
                        <div className="text-center text-neutral-500 py-12">
                            {t('storyboardVideo.noScenesAvailable')}
                        </div>
                    ) : (
                        sortedScenes.map((scene, index) => (
                            <div key={scene.id} className="flex gap-2 items-center group/card">
                                {/* Remove Button - Left side */}
                                <button
                                    onClick={() => handleRemoveScene(scene.id)}
                                    className="p-2 text-neutral-600 hover:text-red-400 hover:bg-neutral-800/50 rounded-full transition-all opacity-0 group-hover/card:opacity-100 flex-shrink-0"
                                    title={t('storyboardVideo.removeScene')}
                                >
                                    <Trash2 size={16} />
                                </button>

                                <div className="flex-1 flex gap-4 bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                                    {/* Scene Image Helper */}
                                    <div className="w-48 aspect-video bg-black rounded-lg overflow-hidden border border-neutral-800 shrink-0 relative group">
                                        {scene.resultUrl ? (
                                            <img src={scene.resultUrl} alt={`Scene ${index + 1}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-neutral-700">{t('storyboardVideo.noImage')}</div>
                                        )}
                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-medium text-white border border-white/10">
                                            {t('storyboardVideo.scene', { number: index + 1 })}
                                        </div>
                                    </div>

                                    {/* Prompt Input Area */}
                                    <div className="flex-1 flex flex-col gap-2 relative">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-medium text-neutral-400">{t('storyboardVideo.videoPrompt')}</label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleOptimizePrompt(scene.id)}
                                                    disabled={generatingPrompts[scene.id] || optimizingPrompts[scene.id] || !prompts[scene.id]}
                                                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                                                    title={t('storyboardVideo.enhancePrompt')}
                                                >
                                                    {optimizingPrompts[scene.id] ? (
                                                        <Loader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <Wand2 size={12} />
                                                    )}
                                                    {t('storyboardVideo.optimize')}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative flex-1">
                                            <textarea
                                                value={prompts[scene.id] || ''}
                                                onChange={(e) => setPrompts(prev => ({ ...prev, [scene.id]: e.target.value }))}
                                                placeholder={t('storyboardVideo.describeMotion')}
                                                className="w-full h-full min-h-[100px] bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none"
                                            />

                                            {/* Auto-Generate Overlay Button */}
                                            {(!prompts[scene.id] || prompts[scene.id].trim() === '') && (
                                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                                    <button
                                                        onClick={() => handleGeneratePrompt(scene.id)}
                                                        disabled={generatingPrompts[scene.id]}
                                                        className="pointer-events-auto flex items-center gap-2 text-purple-400 hover:text-purple-300 hover:scale-105 transition-all opacity-80 hover:opacity-100"
                                                    >
                                                        {generatingPrompts[scene.id] ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <Sparkles size={14} />
                                                        )}
                                                        <span className="text-sm font-medium">{t('storyboardVideo.autoGenerate')}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer - Global Settings & Action */}
                <div className="px-6 py-4 border-t border-neutral-800 bg-[#151515]">
                    <div className="flex items-center justify-between">
                        {/* Settings */}
                        <div className="flex items-center gap-4">
                            {/* Model Selector */}
                            <div className="flex flex-col gap-1" ref={modelDropdownRef}>
                                <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">{t('storyboardVideo.model')}</label>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        disabled={!currentModel}
                                        className="flex items-center gap-2 bg-neutral-800 text-white text-xs px-3 py-2 rounded-lg border border-neutral-700 hover:bg-neutral-700 transition-colors min-w-[160px] justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            {renderVideoModelIcon(currentModel?.provider)}
                                            <span>{currentModel?.name ?? 'No available models'}</span>
                                        </div>
                                        <ChevronDown size={14} className="opacity-50" />
                                    </button>

                                    {/* Dropdown */}
                                    {showModelDropdown && (
                                        <div className="absolute bottom-full mb-2 left-0 w-64 bg-[#1f1f1f] border border-neutral-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[400px] overflow-y-auto">
                                            {storyboardVideoSections.map((section, index) => (
                                                <React.Fragment key={section.provider}>
                                                    <div className={`px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1a1a1a] ${index > 0 ? 'border-t border-neutral-700' : ''}`}>
                                                        {section.label}
                                                    </div>
                                                    {section.models.map((model) => (
                                                        <button
                                                            key={model.id}
                                                            onClick={() => handleModelChange(model.id)}
                                                            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs hover:bg-[#2a2a2a] transition-colors ${currentSettings.model === model.id ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-300'}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {renderVideoModelIcon(model.provider, currentSettings.model === model.id)}
                                                                {model.name}
                                                                {model.recommended && (
                                                                    <span className="text-[9px] px-1 py-0.5 bg-green-500/20 text-green-400 rounded font-medium">{t('imageEditor.recommended')}</span>
                                                                )}
                                                            </div>
                                                            {currentSettings.model === model.id && <Check size={14} />}
                                                        </button>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Duration Selector - Dynamic based on model */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">{t('storyboardVideo.duration')}</label>
                                <select
                                    value={currentSettings.duration}
                                    onChange={(e) => {
                                        const nextSettings = normalizeStoryboardVideoSettings(
                                            { ...currentSettings, duration: Number(e.target.value) },
                                            storyboardVideoOptions,
                                        );
                                        if (nextSettings) {
                                            setSettings(nextSettings);
                                        }
                                    }}
                                    disabled={!currentModel}
                                    className="bg-neutral-800 text-white text-xs px-3 py-2 rounded-lg border border-neutral-700 focus:outline-none focus:border-purple-500 min-w-[80px]"
                                >
                                    {availableDurations.map(d => (
                                        <option key={d} value={d}>{d}s</option>
                                    ))}
                                </select>
                            </div>

                            {/* Resolution Selector */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">{t('storyboardVideo.resolution')}</label>
                                <select
                                    value={currentSettings.resolution}
                                    onChange={(e) => {
                                        const nextSettings = normalizeStoryboardVideoSettings(
                                            { ...currentSettings, resolution: e.target.value },
                                            storyboardVideoOptions,
                                        );
                                        if (nextSettings) {
                                            setSettings(nextSettings);
                                        }
                                    }}
                                    disabled={!currentModel}
                                    className="bg-neutral-800 text-white text-xs px-3 py-2 rounded-lg border border-neutral-700 focus:outline-none focus:border-purple-500 min-w-[80px]"
                                >
                                    {availableResolutions.map(res => (
                                        <option key={res} value={res}>{res}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Generate Action */}
                        <div className="flex items-center gap-3">
                            <div className="text-right mr-2">
                                <div className="text-xs text-neutral-400">{t('storyboardVideo.estCost')}</div>
                                <div className="text-sm font-medium text-white">~{(sortedScenes.length * 0.1 * (currentSettings.duration / 5)).toFixed(2)} {t('storyboardVideo.credits')}</div>
                            </div>
                            <button
                                onClick={() => effectiveSettings && onCreateVideos(prompts, effectiveSettings, sortedScenes.map(s => s.id))}
                                disabled={!effectiveSettings}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white pl-4 pr-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-purple-900/40 flex items-center gap-2"
                            >
                                <Play size={16} fill="currentColor" />
                                {t('storyboardVideo.generateStoryVideos')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
