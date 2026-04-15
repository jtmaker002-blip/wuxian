import { describe, expect, it } from 'vitest';
import { NodeType } from '../../types';
import { SCENES } from '../../types/scene';
import { getControlPanelScale, getControlPanelWidthClassName } from './controlPanelLayout';
import { shouldShowImageSuccessToolbar } from './imageToolbarVisibility';

describe('getControlPanelWidthClassName', () => {
  it('caps the video panel to the viewport instead of using a fixed width only', () => {
    expect(
      getControlPanelWidthClassName({
        isLiblibImageNode: false,
        isVideoNode: true,
        isImageToVideoNode: false,
      })
    ).toContain('min(820px,calc(100vw-32px))');
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
  it('shows the Liblib image toolbar only for a single normal successful image node', () => {
    expect(shouldShowImageSuccessToolbar({
      type: NodeType.IMAGE,
      showControls: true,
      isSuccess: true,
      resultUrl: 'data:image/png;base64,result',
    })).toBe(true);
  });

  it('hides the image toolbar for scene result nodes and multi-select control suppression', () => {
    expect(shouldShowImageSuccessToolbar({
      type: NodeType.IMAGE,
      scene: SCENES.CHARACTER_THREE_VIEW_GENERATE,
      showControls: true,
      isSuccess: true,
      resultUrl: 'data:image/png;base64,result',
    })).toBe(false);

    expect(shouldShowImageSuccessToolbar({
      type: NodeType.IMAGE,
      showControls: false,
      isSuccess: true,
      resultUrl: 'data:image/png;base64,result',
    })).toBe(false);
  });
});
