import { describe, expect, it } from 'vitest';
import { NodeType } from '../../types';
import { SCENES } from '../../types/scene';
import { getControlPanelScale, getControlPanelWidthClassName } from './controlPanelLayout';
import { GRID_SCENE_BY_LABEL } from './libtvSceneLaunchMap';
import { shouldShowImageSuccessToolbar } from './imageToolbarVisibility';

describe('getControlPanelWidthClassName', () => {
  it('caps the video panel to the viewport instead of using a fixed width only', () => {
    expect(
      getControlPanelWidthClassName({
        isLiblibImageNode: false,
        isVideoNode: true,
        isImageToVideoNode: false,
      })
    ).toContain('min(620px,calc(100vw-32px))');
  });

  it('keeps existing non-video panel target widths while adding viewport caps', () => {
    expect(
      getControlPanelWidthClassName({
        isLiblibImageNode: true,
        isVideoNode: false,
        isImageToVideoNode: false,
      })
    ).toContain('min(620px,calc(100vw-32px))');

    expect(
      getControlPanelWidthClassName({
        isLiblibImageNode: false,
        isVideoNode: false,
        isImageToVideoNode: true,
      })
    ).toContain('min(520px,calc(100vw-32px))');
  });

  it('counter-scales the control panel against canvas zoom', () => {
    expect(getControlPanelScale(2)).toBe(0.5);
    expect(getControlPanelScale(1)).toBe(1);
    expect(getControlPanelScale(0.25)).toBe(1.25);
  });
});

describe('shouldShowImageSuccessToolbar', () => {
  it('shows the image toolbar for successful generated image results', () => {
    expect(shouldShowImageSuccessToolbar({
      type: NodeType.IMAGE,
      showControls: true,
      isSuccess: true,
      resultUrl: 'data:image/png;base64,result',
    })).toBe(true);

    expect(shouldShowImageSuccessToolbar({
      type: NodeType.IMAGE,
      scene: SCENES.CHARACTER_THREE_VIEW_GENERATE,
      showControls: true,
      isSuccess: true,
      resultUrl: 'data:image/png;base64,result',
    })).toBe(true);
  });

  it('still hides the image toolbar when controls are suppressed', () => {
    expect(shouldShowImageSuccessToolbar({
      type: NodeType.IMAGE,
      showControls: false,
      isSuccess: true,
      resultUrl: 'data:image/png;base64,result',
    })).toBe(false);
  });
});

describe('GRID_SCENE_BY_LABEL', () => {
  it('routes LibTV grid menu entries into scene ids instead of local nine-grid variants', () => {
    expect(GRID_SCENE_BY_LABEL['角色三视图生成']).toBe(SCENES.CHARACTER_THREE_VIEW_GENERATE);
    expect(GRID_SCENE_BY_LABEL['剧情推演四宫格']).toBe(SCENES.PLOT_DEDUCTION_FOUR_GRID);
    expect(GRID_SCENE_BY_LABEL['25宫格连贯分镜']).toBe(SCENES.COHERENT_STORYBOARD_25);
    expect(GRID_SCENE_BY_LABEL['电影级光影校正']).toBe(SCENES.CINEMATIC_LIGHT_CORRECTION);
    expect(GRID_SCENE_BY_LABEL['画面推演 - 3秒后']).toBe(SCENES.FRAME_DEDUCTION_PLUS_3S);
    expect(GRID_SCENE_BY_LABEL['画面推演 - 5秒前']).toBe(SCENES.FRAME_DEDUCTION_MINUS_5S);
  });
});
