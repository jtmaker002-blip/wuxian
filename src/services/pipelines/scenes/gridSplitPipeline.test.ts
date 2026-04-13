import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCENES } from '../../../types/scene';
import { gridSplitPipeline } from './gridSplitPipeline';

type CanvasOperation = { name: string; args: unknown[] };

type MockCanvasContext = CanvasRenderingContext2D & {
  operations: CanvasOperation[];
};

type MockCanvasElement = HTMLCanvasElement & {
  context: MockCanvasContext;
};

let imageSize = { width: 101, height: 81 };
let createdCanvases: MockCanvasElement[] = [];

function setupCanvasImageMocks() {
  createdCanvases = [];
  const documentStub = {
    createElement: vi.fn((tagName: string) => {
      if (tagName !== 'canvas') {
        return {};
      }

      const context: Partial<MockCanvasContext> = {
        operations: [],
        drawImage: vi.fn((...args: unknown[]) => {
          context.operations?.push({ name: 'drawImage', args });
        }),
      };

      const canvas = {
        width: 0,
        height: 0,
        context,
        getContext: vi.fn(() => context),
        toDataURL: vi.fn(() => `data:image/png;mock,${canvas.width}x${canvas.height}`),
      } as unknown as MockCanvasElement;

      createdCanvases.push(canvas);
      return canvas;
    }),
  };
  vi.stubGlobal('document', documentStub);

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

  vi.stubGlobal('Image', MockImage);
}

describe('gridSplitPipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    imageSize = { width: 101, height: 81 };
    setupCanvasImageMocks();
  });

  it('cuts a custom grid into real tiles and preserves crop metadata without dropping remainder pixels', async () => {
    const result = await gridSplitPipeline.runLocal?.({
      nodeId: 'grid-node',
      projectId: 'project-1',
      scene: SCENES.GRID_SPLIT,
      params: {
        imageUrl: 'mock://image',
        mode: 'custom',
        rows: 2,
        cols: 2,
      },
    });

    expect(result?.outputs.imageList).toHaveLength(4);
    expect(result?.outputs.imageList?.[0]).toMatchObject({
      index: 0,
      row: 0,
      col: 0,
      imageUrl: 'data:image/png;mock,50x40',
      url: 'data:image/png;mock,50x40',
      crop: { x: 0, y: 0, width: 50, height: 40 },
      sourceImageUrl: 'mock://image',
      width: 50,
      height: 40,
    });
    expect(result?.outputs.imageList?.[3]).toMatchObject({
      index: 3,
      row: 1,
      col: 1,
      imageUrl: 'data:image/png;mock,51x41',
      url: 'data:image/png;mock,51x41',
      crop: { x: 50, y: 40, width: 51, height: 41 },
      width: 51,
      height: 41,
    });
    expect(result?.outputs.structuredData?.split).toEqual({
      rows: 2,
      cols: 2,
      total: 4,
      sourceWidth: 101,
      sourceHeight: 81,
    });
    expect(createdCanvases).toHaveLength(4);
  });

  it('maps preset 16 grid to 4 x 4', async () => {
    const result = await gridSplitPipeline.runLocal?.({
      nodeId: 'grid-node',
      projectId: 'project-1',
      scene: SCENES.GRID_SPLIT,
      params: {
        imageUrl: 'mock://image',
        mode: 'preset',
        gridType: 16,
      },
    });

    expect(result?.outputs.imageList).toHaveLength(16);
    expect(result?.outputs.structuredData?.split).toMatchObject({
      rows: 4,
      cols: 4,
      total: 16,
    });
  });
});
