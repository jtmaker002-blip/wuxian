import { NodeStatus, NodeType, type NodeData } from '../types';

export const CANVAS_NODE_WIDTH = 350;
export const CANVAS_NODE_EMPTY_SIZE = 350;
export const CANVAS_NODE_GAP = 100;
export const CANVAS_NODE_MAX_SIZE = 1050;
export const CANVAS_VIDEO_NODE_WIDTH = 1050;

export type CanvasNodeDimensions = {
  width: number;
  height: number;
};

export function parseNodeAspectRatio(value: string | undefined): number | undefined {
  if (!value || value === 'Auto') return undefined;
  const separator = value.includes('/') ? '/' : ':';
  const [rawWidth, rawHeight] = value.split(separator).map(Number);
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawWidth <= 0 || rawHeight <= 0) {
    return undefined;
  }
  return rawWidth / rawHeight;
}

export function computeNodeDimensionsFromRatio(
  ratio: number | undefined,
  options: {
    baseSize?: number;
    maxSize?: number;
  } = {}
): CanvasNodeDimensions {
  const baseSize = options.baseSize ?? CANVAS_NODE_EMPTY_SIZE;
  const maxSize = options.maxSize ?? CANVAS_NODE_MAX_SIZE;

  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return { width: baseSize, height: baseSize };
  }

  if (ratio >= 1) {
    return {
      width: Math.min(Math.round(baseSize * ratio), maxSize),
      height: baseSize,
    };
  }

  return {
    width: baseSize,
    height: Math.min(Math.round(baseSize / ratio), maxSize),
  };
}

export function computeNodeDimensionsFromNatural(width: number, height: number): CanvasNodeDimensions {
  return computeNodeDimensionsFromRatio(width / height);
}

export function getCanvasNodeDimensions(node: Pick<NodeData,
  'type' | 'status' | 'resultUrl' | 'resultAspectRatio' | 'aspectRatio' | 'parentIds'
>, parentNode?: Pick<NodeData, 'status' | 'resultUrl' | 'resultAspectRatio'>): CanvasNodeDimensions {
  if (node.type === NodeType.VIDEO) {
    return computeNodeDimensionsFromRatio(
      parseNodeAspectRatio(node.resultAspectRatio) ?? parseNodeAspectRatio(node.aspectRatio) ?? 16 / 9,
      {
        baseSize: Math.round(CANVAS_VIDEO_NODE_WIDTH / (16 / 9)),
        maxSize: CANVAS_VIDEO_NODE_WIDTH,
      }
    );
  }

  if (node.type === NodeType.IMAGE_EDITOR || node.type === NodeType.VIDEO_EDITOR) {
    const parentRatio = parentNode?.status === NodeStatus.SUCCESS && parentNode.resultUrl
      ? parseNodeAspectRatio(parentNode.resultAspectRatio)
      : undefined;
    return computeNodeDimensionsFromRatio(parentRatio);
  }

  if (node.status === NodeStatus.SUCCESS && node.resultUrl) {
    return computeNodeDimensionsFromRatio(
      parseNodeAspectRatio(node.resultAspectRatio) ?? parseNodeAspectRatio(node.aspectRatio)
    );
  }

  return computeNodeDimensionsFromRatio(undefined);
}

export function getCanvasNodeAspectRatioStyle(node: Pick<NodeData,
  'type' | 'status' | 'resultUrl' | 'resultAspectRatio' | 'aspectRatio'
>) {
  const dimensions = getCanvasNodeDimensions(node);
  return { aspectRatio: `${dimensions.width}/${dimensions.height}` };
}
