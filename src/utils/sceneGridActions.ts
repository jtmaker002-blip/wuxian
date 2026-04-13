import { getDefaultModelForNodeType } from '../config/nodeTypeRegistry';
import { NodeStatus, NodeType, type NodeData } from '../types';

export type SceneGridImage = {
  url: string;
  label?: string;
};

export function createSceneGridImageNode({
  id,
  sourceNode,
  image,
}: {
  id: string;
  sourceNode: NodeData;
  image: SceneGridImage;
}): NodeData {
  const label = image.label || '宫格单格';
  return {
    id,
    type: NodeType.IMAGE,
    x: sourceNode.x + 460,
    y: sourceNode.y,
    prompt: image.label || '来自宫格单格的图片素材',
    status: NodeStatus.SUCCESS,
    resultUrl: image.url,
    model: getDefaultModelForNodeType(NodeType.IMAGE),
    imageModel: getDefaultModelForNodeType(NodeType.IMAGE),
    aspectRatio: '16:9',
    resolution: '1K',
    title: label,
    parentIds: [sourceNode.id],
  };
}

export function createSceneGridUpscaleNode({
  id,
  sourceNode,
  image,
}: {
  id: string;
  sourceNode: NodeData;
  image: SceneGridImage;
}): NodeData {
  const label = image.label || '单格';
  return {
    id,
    type: NodeType.IMAGE,
    x: sourceNode.x + 460,
    y: sourceNode.y + 260,
    prompt: `高清放大 · ${label}`,
    status: NodeStatus.IDLE,
    model: 'mock-scene-pipeline',
    imageModel: 'gpt-image-1.5',
    aspectRatio: '16:9',
    resolution: '2x',
    title: `高清 · ${label}`,
    name: `高清 · ${label}`,
    scene: 'upscale',
    params: {
      imageUrl: image.url,
      targetResolution: '2x',
      detailMode: 'cinematic',
    },
    parentIds: [sourceNode.id],
    isPromptExpanded: true,
  };
}
