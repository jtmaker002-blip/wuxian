import { getDefaultModelForNodeType, type SwitchableNodeType } from '../config/nodeTypeRegistry';
import { NodeStatus, NodeType, type NodeData } from '../types';

function omitClearedFields(node: NodeData): Partial<NodeData> {
  return {
    ...node,
    resultUrl: undefined,
    lastFrame: undefined,
    errorMessage: undefined,
    generationStartTime: undefined,
    resultAspectRatio: undefined,
    linkedVideoNodeId: undefined,
    frameInputs: undefined,
    videoDuration: undefined,
    generateAudio: undefined,
    angleMode: undefined,
    angleSettings: undefined,
    klingReferenceMode: undefined,
    klingFaceIntensity: undefined,
    klingSubjectIntensity: undefined,
    detectedFaces: undefined,
    faceDetectionStatus: undefined,
    imageModel: undefined,
    videoModel: undefined,
    textMode: undefined,
  };
}

export function switchNodeTypeData(node: NodeData, nextType: SwitchableNodeType): NodeData {
  if (node.type === nextType) return node;

  const base: NodeData = {
    ...(omitClearedFields(node) as NodeData),
    type: nextType,
    status: NodeStatus.IDLE,
    model: getDefaultModelForNodeType(nextType),
    aspectRatio: nextType === NodeType.VIDEO ? '16:9' : 'Auto',
    resolution: 'Auto',
  };

  if (nextType === NodeType.TEXT) {
    return {
      ...base,
      textMode: 'editing',
    };
  }

  if (nextType === NodeType.IMAGE) {
    return {
      ...base,
      imageModel: getDefaultModelForNodeType(NodeType.IMAGE),
    };
  }

  return {
    ...base,
    videoMode: 'standard',
    videoModel: getDefaultModelForNodeType(NodeType.VIDEO),
  };
}
