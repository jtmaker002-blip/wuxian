import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyLightingEffect,
  cutoutImageBySelection,
  expandImageCanvas,
  getCropBox,
  getGridCropBoxes,
  splitImageIntoGrid,
  parseGridSize,
  upscaleImage2x,
} from './imageNodeActions';

type CanvasOperation =
  | { name: string; args: unknown[] }
  | { name: 'set'; prop: string; value: unknown };

type MockCanvasContext = CanvasRenderingContext2D & {
  operations: CanvasOperation[];
};

type MockCanvasElement = HTMLCanvasElement & {
  context: MockCanvasContext;
};

let imageSize = { width: 320, height: 180 };
let createdCanvases: MockCanvasElement[] = [];

function createMockContext(): MockCanvasContext {
  const operations: CanvasOperation[] = [];
  const context: Partial<MockCanvasContext> = {
    operations,
    drawImage: vi.fn((...args: unknown[]) => operations.push({ name: 'drawImage', args })),
    fillRect: vi.fn((...args: unknown[]) => operations.push({ name: 'fillRect', args })),
    clearRect: vi.fn((...args: unknown[]) => operations.push({ name: 'clearRect', args })),
    save: vi.fn((...args: unknown[]) => operations.push({ name: 'save', args })),
    restore: vi.fn((...args: unknown[]) => operations.push({ name: 'restore', args })),
    beginPath: vi.fn((...args: unknown[]) => operations.push({ name: 'beginPath', args })),
    rect: vi.fn((...args: unknown[]) => operations.push({ name: 'rect', args })),
    clip: vi.fn((...args: unknown[]) => operations.push({ name: 'clip', args })),
    strokeRect: vi.fn((...args: unknown[]) => operations.push({ name: 'strokeRect', args })),
    translate: vi.fn((...args: unknown[]) => operations.push({ name: 'translate', args })),
    transform: vi.fn((...args: unknown[]) => operations.push({ name: 'transform', args })),
    setTransform: vi.fn((...args: unknown[]) => operations.push({ name: 'setTransform', args })),
    createLinearGradient: vi.fn((...args: unknown[]) => {
      operations.push({ name: 'createLinearGradient', args });
      return {
        addColorStop: vi.fn((...stopArgs: unknown[]) => operations.push({ name: 'linearColorStop', args: stopArgs })),
      } as unknown as CanvasGradient;
    }),
    createRadialGradient: vi.fn((...args: unknown[]) => {
      operations.push({ name: 'createRadialGradient', args });
      return {
        addColorStop: vi.fn((...stopArgs: unknown[]) => operations.push({ name: 'radialColorStop', args: stopArgs })),
      } as unknown as CanvasGradient;
    }),
  };

  for (const prop of [
    'fillStyle',
    'strokeStyle',
    'lineWidth',
    'filter',
    'globalAlpha',
    'globalCompositeOperation',
    'imageSmoothingEnabled',
    'imageSmoothingQuality',
  ]) {
    let value: unknown;
    Object.defineProperty(context, prop, {
      get: () => value,
      set: (nextValue) => {
        value = nextValue;
        operations.push({ name: 'set', prop, value: nextValue });
      },
    });
  }

  return context as MockCanvasContext;
}

function createMockCanvas(): MockCanvasElement {
  const context = createMockContext();
  const canvas = {
    width: 0,
    height: 0,
    context,
    getContext: vi.fn((type: string) => (type === '2d' ? context : null)),
    toDataURL: vi.fn(() => `data:image/png;mock,${canvas.width}x${canvas.height}`),
  } as unknown as MockCanvasElement;
  return canvas;
}

function setupCanvasImageMocks() {
  createdCanvases = [];

  vi.stubGlobal('document', {
    createElement: vi.fn((tagName: string) => {
      if (tagName !== 'canvas') {
        throw new Error(`Unexpected element: ${tagName}`);
      }
      const canvas = createMockCanvas();
      createdCanvases.push(canvas);
      return canvas;
    }),
  });

  vi.stubGlobal(
    'Image',
    class MockImage {
      crossOrigin = '';
      naturalWidth = imageSize.width;
      naturalHeight = imageSize.height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
  );
}

function operationsNamed(context: MockCanvasContext, name: string) {
  return context.operations.filter((operation) => operation.name === name);
}

beforeEach(() => {
  imageSize = { width: 320, height: 180 };
  setupCanvasImageMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('local image effects', () => {
  it('upscales the source image with high-quality smoothing metadata', async () => {
    const result = await upscaleImage2x('mock://image');
    const canvas = createdCanvases[0];

    expect(result).toEqual({
      dataUrl: 'data:image/png;mock,640x360',
      resultAspectRatio: '640/360',
    });
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(canvas.context.operations).toContainEqual({ name: 'set', prop: 'imageSmoothingEnabled', value: true });
    expect(canvas.context.operations).toContainEqual({ name: 'set', prop: 'imageSmoothingQuality', value: 'high' });
    expect(operationsNamed(canvas.context, 'drawImage')[0]).toMatchObject({
      args: [expect.any(Object), 0, 0, 640, 360],
    });
  });

  it('expands the image canvas with real padding around the source', async () => {
    const result = await expandImageCanvas('mock://image', 0.1);
    const canvas = createdCanvases[0];

    expect(result.resultAspectRatio).toBe('384/216');
    expect(canvas.context.operations).toContainEqual({ name: 'set', prop: 'fillStyle', value: '#111111' });
    expect(operationsNamed(canvas.context, 'fillRect')[0]).toEqual({ name: 'fillRect', args: [0, 0, 384, 216] });
    expect(operationsNamed(canvas.context, 'drawImage')[0]).toMatchObject({
      args: [expect.any(Object), 32, 18],
    });
  });

  it('cuts out a focus selection by clearing pixels outside the selected region', async () => {
    const result = await cutoutImageBySelection('mock://image', {
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.5,
    });
    const canvas = createdCanvases[0];

    expect(result).toEqual({
      dataUrl: 'data:image/png;mock,320x180',
      resultAspectRatio: '320/180',
    });
    expect(operationsNamed(canvas.context, 'drawImage')[0]).toMatchObject({
      args: [expect.any(Object), 0, 0],
    });
    expect(operationsNamed(canvas.context, 'clearRect')).toEqual([
      { name: 'clearRect', args: [0, 0, 320, 45] },
      { name: 'clearRect', args: [0, 45, 80, 90] },
      { name: 'clearRect', args: [240, 45, 80, 90] },
      { name: 'clearRect', args: [0, 135, 320, 45] },
    ]);
  });

  it('preserves split tile row and column metadata with per-tile exports', async () => {
    imageSize = { width: 101, height: 81 };
    setupCanvasImageMocks();

    const tiles = await splitImageIntoGrid('mock://image', 2, 2);

    expect(tiles).toEqual([
      { dataUrl: 'data:image/png;mock,50x40', resultAspectRatio: '50/40', row: 0, col: 0 },
      { dataUrl: 'data:image/png;mock,51x40', resultAspectRatio: '51/40', row: 0, col: 1 },
      { dataUrl: 'data:image/png;mock,50x41', resultAspectRatio: '50/41', row: 1, col: 0 },
      { dataUrl: 'data:image/png;mock,51x41', resultAspectRatio: '51/41', row: 1, col: 1 },
    ]);
    expect(operationsNamed(createdCanvases[3].context, 'drawImage')[0]).toMatchObject({
      args: [expect.any(Object), 50, 40, 51, 41, 0, 0, 51, 41],
    });
  });

  it('applies lighting settings as visible canvas compositing metadata', async () => {
    const result = await applyLightingEffect('mock://image', {
      mode: 'global',
      smartMode: true,
      brightness: 50,
      color: '#ffcc88',
      keyLight: 'left',
      rimLight: true,
    });
    const canvas = createdCanvases[0];

    expect(result.resultAspectRatio).toBe('320/180');
    expect(canvas.context.operations).toContainEqual({ name: 'set', prop: 'filter', value: 'brightness(1.15)' });
    expect(canvas.context.operations).toContainEqual({ name: 'set', prop: 'globalCompositeOperation', value: 'soft-light' });
    expect(canvas.context.operations).toContainEqual({ name: 'set', prop: 'fillStyle', value: '#ffcc88' });
    expect(operationsNamed(canvas.context, 'createLinearGradient')[0]).toEqual({
      name: 'createLinearGradient',
      args: [0, 90, 320, 90],
    });
    expect(operationsNamed(canvas.context, 'strokeRect')[0]).toEqual({
      name: 'strokeRect',
      args: [4, 4, 312, 172],
    });
  });
});
