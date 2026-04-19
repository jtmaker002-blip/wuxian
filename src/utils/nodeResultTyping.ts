import { NodeType, type NodeData } from '../types';

export function nodeEmitsImageResult(node: Pick<NodeData, 'type' | 'resultUrl'> | undefined) {
  if (!node?.resultUrl) return false;
  return (
    node.type !== NodeType.VIDEO &&
    node.type !== NodeType.LOCAL_VIDEO_MODEL &&
    node.type !== NodeType.AUDIO &&
    node.type !== NodeType.TEXT
  );
}
