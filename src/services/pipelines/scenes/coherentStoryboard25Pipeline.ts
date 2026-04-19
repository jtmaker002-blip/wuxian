import type { ScenePipeline } from '../../../types/scene';
import { createSceneRequest } from '../shared';

export const coherentStoryboard25Pipeline: ScenePipeline = {
  validate(input) {
    if (!input?.storyText && !input?.prompt) {
      throw new Error('25宫格连贯分镜需要故事文本。');
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
