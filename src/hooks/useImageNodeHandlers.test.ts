import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';

function createReactHookMock() {
  const useCallback = <T extends (...args: any[]) => any>(callback: T) => callback;

  return {
    reactModule: {
      __esModule: true,
      default: { useCallback },
      useCallback,
    },
    render<T>(factory: () => T) {
      return factory();
    },
  };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('react');
  vi.restoreAllMocks();
});

describe('useImageNodeHandlers', () => {
  it('creates a video node with the expected image-to-video state', async () => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const nextNodeId = '11111111-1111-4111-8111-111111111111';
    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(nextNodeId);
    const { useImageNodeHandlers } = await import('./useImageNodeHandlers');
    const imageNode: NodeData = {
      id: 'image-1',
      type: NodeType.IMAGE,
      x: 120,
      y: 80,
      prompt: '把镜头推进一点',
      status: NodeStatus.SUCCESS,
      model: 'image-model',
      imageModel: 'image-model',
      aspectRatio: '9:16',
      resolution: 'Auto',
      resultUrl: 'https://example.com/image.png',
      parentIds: [],
    };

    let nextNodes = [imageNode];
    const setNodes = vi.fn((updater: NodeData[] | ((prev: NodeData[]) => NodeData[])) => {
      nextNodes =
        typeof updater === 'function'
          ? (updater as (prev: NodeData[]) => NodeData[])(nextNodes)
          : updater;
    });
    const setSelectedNodeIds = vi.fn();

    const hook = reactMock.render(() =>
      useImageNodeHandlers({
        nodes: nextNodes,
        setNodes,
        setSelectedNodeIds,
      })
    );

    hook.handleImageToVideo(imageNode.id);

    const createdNode = nextNodes.find((node) => node.id === nextNodeId);
    expect(createdNode).toMatchObject({
      id: nextNodeId,
      type: NodeType.VIDEO,
      prompt: imageNode.prompt,
      status: NodeStatus.IDLE,
      videoMode: 'standard',
      aspectRatio: imageNode.aspectRatio,
      inputUrl: imageNode.resultUrl,
      parentIds: [imageNode.id],
      isPromptExpanded: true,
    });
    expect(setSelectedNodeIds).toHaveBeenCalledWith([nextNodeId]);
    expect(randomUuidSpy).toHaveBeenCalledOnce();
  });
});
