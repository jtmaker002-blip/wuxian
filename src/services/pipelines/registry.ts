import { SCENES, type SceneId, type ScenePipeline } from '../../types/scene';
import { createMockScenePipeline } from './shared';

export const pipelineRegistry: Record<SceneId, ScenePipeline> = {
  [SCENES.MULTI_VIEW_NINE_GRID]: createMockScenePipeline('image'),
  [SCENES.PLOT_DEDUCTION_FOUR_GRID]: createMockScenePipeline('image'),
  [SCENES.COHERENT_STORYBOARD_25]: createMockScenePipeline('image'),
  [SCENES.CINEMATIC_LIGHT_CORRECTION]: createMockScenePipeline('image'),
  [SCENES.CHARACTER_THREE_VIEW_GENERATE]: createMockScenePipeline('image'),
  [SCENES.FRAME_DEDUCTION_PLUS_3S]: createMockScenePipeline('image'),
  [SCENES.FRAME_DEDUCTION_MINUS_5S]: createMockScenePipeline('image'),
  [SCENES.UPSCALE]: createMockScenePipeline('image'),
};

export function getScenePipeline(scene: SceneId | string | undefined) {
  if (!scene) return undefined;
  return pipelineRegistry[scene as SceneId];
}
