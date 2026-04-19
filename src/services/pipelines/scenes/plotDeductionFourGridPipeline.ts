import type { ScenePipeline } from '../../../types/scene';
import { createSceneRequest } from '../shared';

export const plotDeductionFourGridPipeline: ScenePipeline = {
  validate(input) {
    if (!input?.storyText && !input?.prompt) {
      throw new Error('剧情推演四宫格需要故事文本。');
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
