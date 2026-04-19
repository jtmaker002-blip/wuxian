import type { ScenePipeline } from '../../../types/scene';
import { createSceneRequest } from '../shared';

export const multiViewNineGridPipeline: ScenePipeline = {
  validate(input) {
    if (!input?.imageUrl && !(Array.isArray(input?.referenceImages) && input.referenceImages.length > 0)) {
      throw new Error('多机位九宫格需要输入图片或参考图。');
    }
  },
  buildRequest(ctx) {
    return createSceneRequest(ctx, 'image');
  },
  handleResult(_ctx, result) {
    return {
      outputs: result,
      structuredData: result.structuredData,
    };
  },
};
