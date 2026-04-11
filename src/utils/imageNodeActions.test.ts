import { describe, expect, it } from 'vitest';

import { getCropBox, getGridCropBoxes, parseGridSize } from './imageNodeActions';

describe('getCropBox', () => {
  it('converts normalized focus selection to natural image pixels', () => {
    expect(
      getCropBox(1000, 500, {
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
      })
    ).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    });
  });

  it('clamps selections to the source image bounds', () => {
    expect(
      getCropBox(1000, 500, {
        x: 0.9,
        y: 0.8,
        width: 0.5,
        height: 0.5,
      })
    ).toEqual({
      x: 900,
      y: 400,
      width: 100,
      height: 100,
    });
  });
});

describe('parseGridSize', () => {
  it('extracts grid dimensions from Liblib-style split labels', () => {
    expect(parseGridSize('2x2 切分')).toEqual({ rows: 2, cols: 2 });
    expect(parseGridSize('3x3 切分')).toEqual({ rows: 3, cols: 3 });
  });

  it('ignores non-grid labels', () => {
    expect(parseGridSize('宫格切分')).toBeNull();
  });
});

describe('getGridCropBoxes', () => {
  it('returns crop boxes covering the whole source image', () => {
    expect(getGridCropBoxes(100, 80, 2, 2)).toEqual([
      { x: 0, y: 0, width: 50, height: 40, row: 0, col: 0 },
      { x: 50, y: 0, width: 50, height: 40, row: 0, col: 1 },
      { x: 0, y: 40, width: 50, height: 40, row: 1, col: 0 },
      { x: 50, y: 40, width: 50, height: 40, row: 1, col: 1 },
    ]);
  });

  it('lets the last row and column absorb remainder pixels', () => {
    expect(getGridCropBoxes(101, 81, 2, 2).at(-1)).toEqual({
      x: 50,
      y: 40,
      width: 51,
      height: 41,
      row: 1,
      col: 1,
    });
  });
});
