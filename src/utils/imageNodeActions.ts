import type { FocusSelection, ImageLightingSettings } from '../types';

export function getCropBox(
  naturalWidth: number,
  naturalHeight: number,
  selection: FocusSelection
) {
  const x = Math.max(0, Math.min(naturalWidth - 1, Math.round(selection.x * naturalWidth)));
  const y = Math.max(0, Math.min(naturalHeight - 1, Math.round(selection.y * naturalHeight)));
  const width = Math.max(1, Math.min(naturalWidth - x, Math.round(selection.width * naturalWidth)));
  const height = Math.max(1, Math.min(naturalHeight - y, Math.round(selection.height * naturalHeight)));

  return { x, y, width, height };
}

export async function cropImageBySelection(imageUrl: string, selection: FocusSelection): Promise<{
  dataUrl: string;
  resultAspectRatio: string;
}> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for crop'));
    img.src = imageUrl;
  });

  const crop = getCropBox(image.naturalWidth, image.naturalHeight, selection);
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available');
  }

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return {
    dataUrl: canvas.toDataURL('image/png'),
    resultAspectRatio: `${crop.width}/${crop.height}`,
  };
}

export function parseGridSize(label: string): { rows: number; cols: number } | null {
  const match = label.match(/(\d+)x(\d+)/i);
  if (!match) return null;

  return {
    rows: Number(match[2]),
    cols: Number(match[1]),
  };
}

export function getGridCropBoxes(naturalWidth: number, naturalHeight: number, rows: number, cols: number) {
  const tileWidth = Math.floor(naturalWidth / cols);
  const tileHeight = Math.floor(naturalHeight / rows);

  return Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = col * tileWidth;
    const y = row * tileHeight;
    const width = col === cols - 1 ? naturalWidth - x : tileWidth;
    const height = row === rows - 1 ? naturalHeight - y : tileHeight;

    return { x, y, width, height, row, col };
  });
}

async function loadImage(imageUrl: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

function exportCanvas(canvas: HTMLCanvasElement) {
  return {
    dataUrl: canvas.toDataURL('image/png'),
    resultAspectRatio: `${canvas.width}/${canvas.height}`,
  };
}

export async function upscaleImage2x(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth * 2;
  canvas.height = image.naturalHeight * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return exportCanvas(canvas);
}

export async function expandImageCanvas(imageUrl: string, paddingRatio = 0.18) {
  const image = await loadImage(imageUrl);
  const padX = Math.round(image.naturalWidth * paddingRatio);
  const padY = Math.round(image.naturalHeight * paddingRatio);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth + padX * 2;
  canvas.height = image.naturalHeight + padY * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');

  context.fillStyle = '#111111';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, padX, padY);
  return exportCanvas(canvas);
}

export async function eraseImageSelection(imageUrl: string, selection: FocusSelection) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');

  context.drawImage(image, 0, 0);
  const box = getCropBox(image.naturalWidth, image.naturalHeight, selection);
  context.clearRect(box.x, box.y, box.width, box.height);
  return exportCanvas(canvas);
}

export async function repaintImageSelection(imageUrl: string, selection: FocusSelection) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');

  context.drawImage(image, 0, 0);
  const box = getCropBox(image.naturalWidth, image.naturalHeight, selection);
  context.save();
  context.beginPath();
  context.rect(box.x, box.y, box.width, box.height);
  context.clip();
  context.filter = 'blur(8px) saturate(1.2) contrast(1.08)';
  context.drawImage(image, 0, 0);
  context.filter = 'none';
  context.globalAlpha = 0.14;
  context.fillStyle = '#ffffff';
  context.fillRect(box.x, box.y, box.width, box.height);
  context.restore();
  return exportCanvas(canvas);
}

export async function createNineGridVariant(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const tileWidth = image.naturalWidth;
  const tileHeight = image.naturalHeight;
  const gap = Math.max(8, Math.round(Math.min(tileWidth, tileHeight) * 0.025));
  const canvas = document.createElement('canvas');
  canvas.width = tileWidth * 3 + gap * 4;
  canvas.height = tileHeight * 3 + gap * 4;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');

  context.fillStyle = '#111111';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const filters = [
    'brightness(1.05) contrast(1.04)',
    'saturate(1.18)',
    'hue-rotate(-8deg) brightness(1.02)',
    'contrast(1.12)',
    'none',
    'hue-rotate(8deg) saturate(1.1)',
    'brightness(0.92) contrast(1.08)',
    'sepia(0.16) saturate(1.04)',
    'brightness(1.12) saturate(0.92)',
  ];

  filters.forEach((filter, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    context.filter = filter;
    context.drawImage(
      image,
      gap + col * (tileWidth + gap),
      gap + row * (tileHeight + gap),
      tileWidth,
      tileHeight
    );
  });
  context.filter = 'none';

  return exportCanvas(canvas);
}

export async function splitImageIntoGrid(imageUrl: string, rows: number, cols: number): Promise<Array<{
  dataUrl: string;
  resultAspectRatio: string;
  row: number;
  col: number;
}>> {
  const image = await loadImage(imageUrl);
  const boxes = getGridCropBoxes(image.naturalWidth, image.naturalHeight, rows, cols);

  return boxes.map((box) => {
    const canvas = document.createElement('canvas');
    canvas.width = box.width;
    canvas.height = box.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available');
    }

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

    return {
      dataUrl: canvas.toDataURL('image/png'),
      resultAspectRatio: `${box.width}/${box.height}`,
      row: box.row,
      col: box.col,
    };
  });
}

export async function applyLightingEffect(imageUrl: string, settings: ImageLightingSettings) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');

  const brightness = 0.65 + settings.brightness / 100;
  context.filter = `brightness(${brightness})`;
  context.drawImage(image, 0, 0);
  context.filter = 'none';

  context.globalCompositeOperation = 'soft-light';
  context.fillStyle = settings.color;
  context.globalAlpha = settings.smartMode ? 0.18 : 0.12;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const gradientStops: Record<ImageLightingSettings['keyLight'], [number, number, number, number]> = {
    left: [0, canvas.height / 2, canvas.width, canvas.height / 2],
    right: [canvas.width, canvas.height / 2, 0, canvas.height / 2],
    top: [canvas.width / 2, 0, canvas.width / 2, canvas.height],
    bottom: [canvas.width / 2, canvas.height, canvas.width / 2, 0],
    front: [canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height],
    back: [canvas.width / 2, 0, canvas.width / 2, canvas.height],
  };
  const [x0, y0, x1, y1] = gradientStops[settings.keyLight];
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.22)');
  context.globalCompositeOperation = 'overlay';
  context.globalAlpha = 0.55;
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (settings.rimLight) {
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = 0.55;
    context.strokeStyle = settings.color;
    context.lineWidth = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.015));
    context.strokeRect(context.lineWidth, context.lineWidth, canvas.width - context.lineWidth * 2, canvas.height - context.lineWidth * 2);
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  return exportCanvas(canvas);
}

export async function applyCameraAngleFallback(
  imageUrl: string,
  settings: { rotation: number; tilt: number; scale: number; wideAngle: boolean }
) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is not available');

  context.fillStyle = '#050505';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const zoom = 1 + settings.scale / 180;
  const skewX = Math.max(-0.35, Math.min(0.35, settings.rotation / 360));
  const skewY = Math.max(-0.25, Math.min(0.25, settings.tilt / 260));
  const squeezeX = settings.wideAngle ? 0.9 : 1 - Math.min(0.18, Math.abs(settings.rotation) / 720);
  const squeezeY = 1 - Math.min(0.16, Math.abs(settings.tilt) / 520);

  context.translate(canvas.width / 2, canvas.height / 2);
  context.transform(squeezeX * zoom, skewY, skewX, squeezeY * zoom, 0, 0);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  context.setTransform(1, 0, 0, 1, 0, 0);

  if (settings.wideAngle) {
    const vignette = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.2,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.65
    );
    vignette.addColorStop(0, 'rgba(255,255,255,0.08)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  return exportCanvas(canvas);
}
