import { SCENES, type SceneId } from '../../types/scene';

export const GRID_SCENE_BY_LABEL: Record<string, SceneId> = {
  '剧情推演四宫格': SCENES.PLOT_DEDUCTION_FOUR_GRID,
  '25宫格连贯分镜': SCENES.COHERENT_STORYBOARD_25,
  '电影级光影校正': SCENES.CINEMATIC_LIGHT_CORRECTION,
  '角色三视图生成': SCENES.CHARACTER_THREE_VIEW_GENERATE,
  '画面推演 - 3秒后': SCENES.FRAME_DEDUCTION_PLUS_3S,
  '画面推演 - 5秒前': SCENES.FRAME_DEDUCTION_MINUS_5S,
};
