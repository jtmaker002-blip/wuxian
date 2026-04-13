import { SCENES, type SceneId, type ScenePipeline } from '../../types/scene';
import { characterThreeViewPipeline } from './scenes/characterThreeViewPipeline';
import { cinematicLightCorrectionPipeline } from './scenes/cinematicLightCorrectionPipeline';
import { coherentStoryboard25Pipeline } from './scenes/coherentStoryboard25Pipeline';
import { frameDeductionMinus5sPipeline } from './scenes/frameDeductionMinus5sPipeline';
import { frameDeductionPlus3sPipeline } from './scenes/frameDeductionPlus3sPipeline';
import { gridSplitPipeline } from './scenes/gridSplitPipeline';
import { multiViewNineGridPipeline } from './scenes/multiViewNineGridPipeline';
import { plotDeductionFourGridPipeline } from './scenes/plotDeductionFourGridPipeline';
import { upscalePipeline } from './scenes/upscalePipeline';

export const pipelineRegistry: Record<SceneId, ScenePipeline> = {
  [SCENES.GRID_SPLIT]: gridSplitPipeline,
  [SCENES.MULTI_VIEW_NINE_GRID]: multiViewNineGridPipeline,
  [SCENES.PLOT_DEDUCTION_FOUR_GRID]: plotDeductionFourGridPipeline,
  [SCENES.COHERENT_STORYBOARD_25]: coherentStoryboard25Pipeline,
  [SCENES.CINEMATIC_LIGHT_CORRECTION]: cinematicLightCorrectionPipeline,
  [SCENES.CHARACTER_THREE_VIEW_GENERATE]: characterThreeViewPipeline,
  [SCENES.FRAME_DEDUCTION_PLUS_3S]: frameDeductionPlus3sPipeline,
  [SCENES.FRAME_DEDUCTION_MINUS_5S]: frameDeductionMinus5sPipeline,
  [SCENES.UPSCALE]: upscalePipeline,
};

export function getScenePipeline(scene: SceneId | string | undefined) {
  if (!scene) return undefined;
  return pipelineRegistry[scene as SceneId];
}
