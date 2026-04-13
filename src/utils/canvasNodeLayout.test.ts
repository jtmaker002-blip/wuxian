import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType } from '../types';
import {
  CANVAS_NODE_EMPTY_SIZE,
  computeNodeDimensionsFromNatural,
  computeNodeDimensionsFromRatio,
  getCanvasNodeDimensions,
  parseNodeAspectRatio,
} from './canvasNodeLayout';

describe('canvasNodeLayout', () => {
  it('uses a 350x350 baseline for empty nodes', () => {
    expect(computeNodeDimensionsFromRatio(undefined)).toEqual({
      width: CANVAS_NODE_EMPTY_SIZE,
      height: CANVAS_NODE_EMPTY_SIZE,
    });
  });

  it('keeps landscape nodes at 350 high and grows width by ratio', () => {
    expect(computeNodeDimensionsFromRatio(16 / 9)).toEqual({
      width: 622,
      height: 350,
    });
  });

  it('keeps portrait nodes at 350 wide and grows height by ratio', () => {
    expect(computeNodeDimensionsFromRatio(9 / 16)).toEqual({
      width: 350,
      height: 622,
    });
  });

  it('caps extremely wide or tall media at the max edge', () => {
    expect(computeNodeDimensionsFromRatio(10)).toEqual({ width: 1050, height: 350 });
    expect(computeNodeDimensionsFromRatio(0.1)).toEqual({ width: 350, height: 1050 });
  });

  it('parses ratio strings from both stored forms', () => {
    expect(parseNodeAspectRatio('16:9')).toBeCloseTo(16 / 9);
    expect(parseNodeAspectRatio('1920/1080')).toBeCloseTo(16 / 9);
  });

  it('uses natural media dimensions for generated content', () => {
    expect(computeNodeDimensionsFromNatural(1080, 1920)).toEqual({
      width: 350,
      height: 622,
    });
  });

  it('resolves node dimensions from generated result aspect ratio first', () => {
    expect(
      getCanvasNodeDimensions({
        type: NodeType.IMAGE,
        status: NodeStatus.SUCCESS,
        resultUrl: 'image.png',
        resultAspectRatio: '1920/1080',
        aspectRatio: '1:1',
      })
    ).toEqual({ width: 622, height: 350 });
  });
});
