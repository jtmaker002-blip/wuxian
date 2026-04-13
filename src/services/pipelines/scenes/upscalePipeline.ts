import type { ScenePipeline } from '../../../types/scene';
import { upscaleImage2x } from '../../../utils/imageNodeActions';
import { createMockScenePipeline } from '../shared';

export const upscalePipeline: ScenePipeline = {
  ...createMockScenePipeline('image'),
  async runLocal(ctx) {
    if (!ctx.params.imageUrl) return undefined;
    const result = await upscaleImage2x(ctx.params.imageUrl);
    return {
      outputs: {
        imageList: [{
          url: result.dataUrl,
          label: ctx.params.targetResolution || '2x',
          status: 'succeeded',
        }],
        structuredData: {
          upscale: {
            targetResolution: ctx.params.targetResolution || '2x',
            detailMode: ctx.params.detailMode || 'cinematic',
            localAction: 'upscaleImage2x',
          },
        },
      },
      structuredData: {
        upscale: {
          targetResolution: ctx.params.targetResolution || '2x',
          detailMode: ctx.params.detailMode || 'cinematic',
          localAction: 'upscaleImage2x',
        },
      },
    };
  },
};
