import { getVideoCapability } from '../../config/modelCapabilities';
import { DEFAULT_REGISTRY_VIDEO_ID } from '../../config/registryModelBridge';
import { getRegistryVideoModels, type CanvasVideoModel } from '../../config/registryCanvasModels';

const FALLBACK_DURATION = 5;
const FALLBACK_RESOLUTION = 'Auto';

export interface StoryboardVideoOption {
  model: CanvasVideoModel;
  durations: number[];
  resolutions: string[];
  defaultDuration: number;
  defaultResolution: string;
}

export interface StoryboardVideoSettings {
  model: string;
  duration: number;
  resolution: string;
}

export interface StoryboardVideoSection {
  provider: CanvasVideoModel['provider'];
  label: string;
  models: CanvasVideoModel[];
}

export interface StoryboardVideoModalState {
  options: StoryboardVideoOption[];
  sections: StoryboardVideoSection[];
  currentSettings: StoryboardVideoSettings | null;
  currentOption: StoryboardVideoOption | null;
}

const STORYBOARD_VIDEO_SECTION_ORDER: Array<{
  provider: StoryboardVideoSection['provider'];
  label: string;
}> = [
  { provider: 'openai', label: 'OpenAI' },
  { provider: 'google', label: 'Google' },
  { provider: 'kling', label: 'Kling AI' },
  { provider: 'hailuo', label: 'Hailuo AI' },
  { provider: 'other', label: '其他' },
];

function pickDefaultDuration(durations: number[], preferred?: number): number {
  if (preferred !== undefined && durations.includes(preferred)) {
    return preferred;
  }
  return durations[0] ?? FALLBACK_DURATION;
}

function pickDefaultResolution(resolutions: string[], preferred?: string): string {
  if (preferred && resolutions.includes(preferred)) {
    return preferred;
  }
  return resolutions[0] ?? FALLBACK_RESOLUTION;
}

export function getStoryboardVideoOptions(enabledIds: Set<string> | null): StoryboardVideoOption[] {
  return getRegistryVideoModels()
    .filter((model) => enabledIds === null || enabledIds.has(model.id))
    .filter((model) => {
      const standardCapability = getVideoCapability(model.id)?.modes.standard;
      if (!standardCapability) {
        return model.supportsImageToVideo;
      }
      return standardCapability.enabled && standardCapability.supportsImageToVideo;
    })
    .map((model) => {
      const standardCapability = getVideoCapability(model.id)?.modes.standard;
      const durations = standardCapability?.durations ?? model.durations ?? [FALLBACK_DURATION];
      const resolutions = standardCapability?.resolutions ?? model.resolutions ?? [FALLBACK_RESOLUTION];

      return {
        model,
        durations,
        resolutions,
        defaultDuration: pickDefaultDuration(durations, standardCapability?.defaultDuration),
        defaultResolution: pickDefaultResolution(resolutions, standardCapability?.defaultResolution),
      };
    });
}

export function getStoryboardVideoSections(options: StoryboardVideoOption[]): StoryboardVideoSection[] {
  const pool = options.map((option) => option.model);

  return STORYBOARD_VIDEO_SECTION_ORDER.map((section) => ({
    ...section,
    models: pool.filter((model) => model.provider === section.provider),
  })).filter((section) => section.models.length > 0);
}

export function normalizeStoryboardVideoSettings(
  settings: StoryboardVideoSettings,
  options: StoryboardVideoOption[],
): StoryboardVideoSettings | null {
  if (options.length === 0) {
    return null;
  }

  const selectedOption =
    options.find((option) => option.model.id === settings.model) ??
    options.find((option) => option.model.id === DEFAULT_REGISTRY_VIDEO_ID) ??
    options[0];

  const duration = selectedOption.durations.includes(settings.duration)
    ? settings.duration
    : selectedOption.defaultDuration;
  const resolution = selectedOption.resolutions.includes(settings.resolution)
    ? settings.resolution
    : selectedOption.defaultResolution;

  return {
    model: selectedOption.model.id,
    duration,
    resolution,
  };
}

export function getStoryboardVideoModalState(
  enabledIds: Set<string> | null,
  settings: StoryboardVideoSettings,
): StoryboardVideoModalState {
  const options = getStoryboardVideoOptions(enabledIds);
  const currentSettings = normalizeStoryboardVideoSettings(settings, options);
  const currentOption = currentSettings
    ? options.find((option) => option.model.id === currentSettings.model) ?? null
    : null;

  return {
    options,
    sections: getStoryboardVideoSections(options),
    currentSettings,
    currentOption,
  };
}
