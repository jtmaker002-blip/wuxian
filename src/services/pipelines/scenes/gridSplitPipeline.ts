import type { GridSplitParams, GridTile, ScenePipeline } from '../../../types/scene';
import { getGridCropBoxes } from '../../../utils/imageNodeActions';

const PRESET_SIZE_BY_GRID_TYPE: Record<4 | 9 | 16 | 25, number> = {
  4: 2,
  9: 3,
  16: 4,
  25: 5,
};

function resolveGridSize(params: Partial<GridSplitParams>) {
  if (params.mode === 'preset') {
    const gridType = params.gridType || 4;
    const size = PRESET_SIZE_BY_GRID_TYPE[gridType];
    if (!size) throw new Error('不支持的宫格预设。');
    return { rows: size, cols: size };
  }

  const rows = Number(params.rows);
  const cols = Number(params.cols);
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    throw new Error('自定义宫格需要 rows / cols。');
  }
  if (rows < 1 || rows > 5 || cols < 1 || cols > 5) {
    throw new Error('自定义宫格范围必须是 1 到 5。');
  }
  return { rows, cols };
}

async function loadImage(imageUrl: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，无法切分。'));
    image.src = imageUrl;
  });
}

function cropTile(image: HTMLImageElement, box: ReturnType<typeof getGridCropBoxes>[number]) {
  const canvas = document.createElement('canvas');
  canvas.width = box.width;
  canvas.height = box.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');

  context.drawImage(
    image,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    box.width,
    box.height
  );

  return canvas.toDataURL('image/png');
}

export const gridSplitPipeline: ScenePipeline = {
  validate(input) {
    if (!input?.imageUrl) throw new Error('宫格切分需要输入图片 URL。');
    resolveGridSize(input as Partial<GridSplitParams>);
  },

  async runLocal(ctx) {
    const params = ctx.params as GridSplitParams;
    const { rows, cols } = resolveGridSize(params);
    const image = await loadImage(params.imageUrl);
    const boxes = getGridCropBoxes(image.naturalWidth, image.naturalHeight, rows, cols);
    const tiles: GridTile[] = boxes.map((box, index) => {
      const imageUrl = cropTile(image, box);
      return {
        id: `${ctx.nodeId}-tile-${index}`,
        index,
        row: box.row,
        col: box.col,
        imageUrl,
        url: imageUrl,
        label: `切片 ${box.row + 1}-${box.col + 1}`,
        status: 'succeeded',
        crop: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
        sourceImageUrl: params.imageUrl,
        width: box.width,
        height: box.height,
      };
    });

    const structuredData = {
      split: {
        rows,
        cols,
        total: tiles.length,
        sourceWidth: image.naturalWidth,
        sourceHeight: image.naturalHeight,
      },
    };

    return {
      outputs: {
        imageList: tiles,
        structuredData,
      },
      structuredData,
    };
  },

  buildRequest() {
    throw new Error('宫格切分是本地 canvas 切图，不创建远程任务。');
  },

  handleResult(_ctx, result) {
    return {
      outputs: result,
      structuredData: result.structuredData,
    };
  },
};
