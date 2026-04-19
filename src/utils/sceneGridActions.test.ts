import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';
import { createSceneGridImageNode, createSceneGridUpscaleNode } from './sceneGridActions';

const sourceNode: NodeData = {
  id: 'scene-node',
  type: NodeType.STORYBOARD,
  x: 100,
  y: 200,
  prompt: 'story',
  status: NodeStatus.SUCCESS,
  model: 'mock-scene-pipeline',
  aspectRatio: '16:9',
  resolution: 'Auto',
  scene: 'plot_deduction_four_grid',
};

describe('sceneGridActions', () => {
  it('creates a success image node from a single grid item', () => {
    const node = createSceneGridImageNode({
      id: 'image-node',
      sourceNode,
      image: {
        url: 'data:image/png;base64,item',
        label: 'Shot 1',
      },
    });

    expect(node).toMatchObject({
      id: 'image-node',
      type: NodeType.IMAGE,
      status: NodeStatus.SUCCESS,
      resultUrl: 'data:image/png;base64,item',
      title: 'Shot 1',
      parentIds: ['scene-node'],
      x: 570,
      y: 200,
    });
  });

  it('creates an upscale scene node from a single grid item', () => {
    const node = createSceneGridUpscaleNode({
      id: 'upscale-node',
      sourceNode,
      image: {
        url: 'data:image/png;base64,item',
        label: 'Shot 1',
      },
    });

    expect(node).toMatchObject({
      id: 'upscale-node',
      type: NodeType.IMAGE,
      status: NodeStatus.IDLE,
      scene: 'upscale',
      title: '高清 · Shot 1',
      parentIds: ['scene-node'],
      x: 570,
      y: 460,
      params: {
        imageUrl: 'data:image/png;base64,item',
        targetResolution: '2x',
        detailMode: 'cinematic',
      },
    });
  });

  it('places nodes to the right of wide scene results instead of using a fixed offset', () => {
    const wideSource = {
      ...sourceNode,
      resultUrl: 'data:image/png;base64,wide',
      resultAspectRatio: '21/9',
    };

    const node = createSceneGridImageNode({
      id: 'wide-child',
      sourceNode: wideSource,
      image: { url: 'data:image/png;base64,item', label: 'Wide child' },
    });

    expect(node.x).toBe(100 + 817 + 120);
  });
});
