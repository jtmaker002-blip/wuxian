import { DEFAULT_REGISTRY_IMAGE_ID, DEFAULT_REGISTRY_VIDEO_ID } from './registryModelBridge';
import { NodeType } from '../types';

export type SwitchableNodeType = NodeType.TEXT | NodeType.IMAGE | NodeType.VIDEO;

export const SWITCHABLE_NODE_TYPE_OPTIONS: Array<{ type: SwitchableNodeType; label: string }> = [
  { type: NodeType.TEXT, label: '文字' },
  { type: NodeType.IMAGE, label: '图片' },
  { type: NodeType.VIDEO, label: '视频' },
];

export function getNodeTypeOptionLabels() {
  return SWITCHABLE_NODE_TYPE_OPTIONS;
}

export function isSwitchableNodeType(type: NodeType): type is SwitchableNodeType {
  return SWITCHABLE_NODE_TYPE_OPTIONS.some((option) => option.type === type);
}

export function getDefaultModelForNodeType(type: SwitchableNodeType): string {
  switch (type) {
    case NodeType.TEXT:
      return 'gpt-4o';
    case NodeType.IMAGE:
      return DEFAULT_REGISTRY_IMAGE_ID;
    case NodeType.VIDEO:
      return DEFAULT_REGISTRY_VIDEO_ID;
  }
}
