import { describe, expect, it } from 'vitest';
import { getCanvasPointerAction } from './canvasPointerAction';

describe('getCanvasPointerAction', () => {
  it('uses blank-canvas left drag for selecting nodes', () => {
    expect(getCanvasPointerAction({ button: 0 })).toBe('select');
  });

  it('ignores non-left pointer drags on blank canvas', () => {
    expect(getCanvasPointerAction({ button: 1 })).toBe('ignore');
    expect(getCanvasPointerAction({ button: 2 })).toBe('ignore');
  });
});
