import { describe, expect, it } from 'vitest';

import { resolveStandaloneNodeCanvasPosition } from './useNodeManagement';

describe('resolveStandaloneNodeCanvasPosition', () => {
  it('clamps toolbar-origin nodes into the visible viewport area', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };

    expect(resolveStandaloneNodeCanvasPosition(62, 24, viewport)).toEqual({
      canvasX: 132,
      canvasY: 72,
    });
  });

  it('preserves natural placement when the trigger point is already safely inside the viewport', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };

    expect(resolveStandaloneNodeCanvasPosition(640, 420, viewport)).toEqual({
      canvasX: 470,
      canvasY: 320,
    });
  });

  it('respects viewport translation and zoom while keeping nodes visible', () => {
    const viewport = { x: -180, y: -40, zoom: 2 };

    expect(resolveStandaloneNodeCanvasPosition(80, 60, viewport)).toEqual({
      canvasX: 156,
      canvasY: 56,
    });
  });
});
