import type { ImageLightingSettings } from '../../../types';
import type { ScenePipeline } from '../../../types/scene';
import { applyLightingEffect } from '../../../utils/imageNodeActions';
import { createMockScenePipeline } from '../shared';

function mapLightColor(value: unknown) {
  if (value === 'warm') return '#ffd2a1';
  if (value === 'cold') return '#b9d7ff';
  if (value === 'sunset') return '#ff9c5a';
  if (value === 'neon') return '#68f7ff';
  return '#ffffff';
}

export const cinematicLightCorrectionPipeline: ScenePipeline = {
  ...createMockScenePipeline('image'),
  async runLocal(ctx) {
    if (!ctx.params.originImage) return undefined;
    const brightness = Number(ctx.params.brightness ?? 55);
    const settings: ImageLightingSettings = {
      mode: 'global',
      smartMode: true,
      brightness,
      color: mapLightColor(ctx.params.lightColor),
      keyLight: ctx.params.keyLight || 'front',
      rimLight: Boolean(ctx.params.rimLightEnabled),
    };
    const result = await applyLightingEffect(ctx.params.originImage, settings);
    const structuredData = {
      lightingRequest: {
        originImage: ctx.params.originImage,
        UI_KeyLight: ctx.params.keyLight || 'front',
        UI_RimLight: Boolean(ctx.params.rimLightEnabled),
        UI_LightColor: ctx.params.lightColor || 'neutral',
        UI_LightBrightness: brightness,
        prompt: ctx.params.prompt || '',
        Reference_Image_Intent: ctx.params.referenceImage || '',
        localAction: 'applyLightingEffect',
      },
    };
    return {
      outputs: {
        imageList: [{
          url: result.dataUrl,
          label: 'Relit',
          status: 'succeeded',
        }],
        structuredData,
      },
      structuredData,
    };
  },
};
