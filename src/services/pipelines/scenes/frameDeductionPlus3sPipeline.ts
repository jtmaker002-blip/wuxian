import type { ScenePipeline } from '../../../types/scene';
import { createSceneRequest } from '../shared';

export const frameDeductionPlus3sPipeline: ScenePipeline = {
  validate(input) {
    if (!input?.imageUrl) {
      throw new Error('画面推演需要输入图片。');
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
