import { describe, expect, it } from 'vitest';
import { getCanvasPointerAction } from './canvasPointerAction';

describe('getCanvasPointerAction', () => {
  it('uses blank-canvas left drag for panning by default', () => {
    expect(getCanvasPointerAction({ button: 0, shiftKey: false })).toBe('pan');
  });

  it('keeps selection box available behind Shift + left drag', () => {
    expect(getCanvasPointerAction({ button: 0, shiftKey: true })).toBe('select');
  });

  it('uses non-left pointer buttons for panning', () => {
    expect(getCanvasPointerAction({ button: 1, shiftKey: false })).toBe('pan');
    expect(getCanvasPointerAction({ button: 2, shiftKey: false })).toBe('pan');
  });
});
