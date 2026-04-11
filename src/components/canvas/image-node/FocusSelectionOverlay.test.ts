import { describe, expect, it } from 'vitest';

import {
  getFocusSelectionDisplayRect,
  normalizeFocusSelectionFromDisplayRect,
} from './FocusSelectionOverlay';

describe('FocusSelectionOverlay selection coordinates', () => {
  it('persists selections as normalized image-relative ratios', () => {
    expect(
      normalizeFocusSelectionFromDisplayRect(
        { x: 120, y: 60, width: 240, height: 180 },
        { width: 480, height: 360 }
      )
    ).toEqual({
      x: 0.25,
      y: 1 / 6,
      width: 0.5,
      height: 0.5,
    });
  });

  it('renders normalized selections back into current display-space dimensions', () => {
    expect(
      getFocusSelectionDisplayRect(
        { x: 0.25, y: 0.2, width: 0.5, height: 0.4 },
        { width: 800, height: 500 }
      )
    ).toEqual({
      x: 200,
      y: 100,
      width: 400,
      height: 200,
    });
  });

  it('keeps legacy pixel selections renderable while old drafts migrate naturally on next edit', () => {
    expect(
      getFocusSelectionDisplayRect(
        { x: 120, y: 60, width: 240, height: 180 },
        { width: 800, height: 500 }
      )
    ).toEqual({
      x: 120,
      y: 60,
      width: 240,
      height: 180,
    });
  });
});
