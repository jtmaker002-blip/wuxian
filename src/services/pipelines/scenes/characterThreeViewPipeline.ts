import type { ScenePipeline } from '../../../types/scene';
import { createSceneRequest } from '../shared';

export const characterThreeViewPipeline: ScenePipeline = {
  validate(input) {
    if (!input?.characterImageUrl) {
      throw new Error('角色三视图生成需要角色图片。');
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
