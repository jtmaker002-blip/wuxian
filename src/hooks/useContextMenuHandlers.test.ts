import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeStatus, NodeType, type ContextMenuState, type NodeData, type Viewport } from '../types';

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

describe('useContextMenuHandlers', () => {
  it('opens the image connector menu at the drop point with image source typing', async () => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const { useContextMenuHandlers } = await import('./useContextMenuHandlers');
    const setContextMenu = vi.fn();
    const imageNode: NodeData = {
      id: 'image-1',
      type: NodeType.IMAGE,
      x: 40,
      y: 60,
      prompt: '引用这张图继续生成',
      status: NodeStatus.SUCCESS,
      model: 'image-model',
      imageModel: 'image-model',
      aspectRatio: '3:4',
      resolution: 'Auto',
      parentIds: [],
      resultUrl: 'https://example.com/source.png',
    };
    const viewport: Viewport = { x: 100, y: 50, zoom: 2 };
    const contextMenu: ContextMenuState = {
      isOpen: false,
      x: 0,
      y: 0,
      type: 'global',
    };

    const hook = reactMock.render(() =>
      useContextMenuHandlers({
        nodes: [imageNode],
        viewport,
        contextMenu,
        setContextMenu,
        handleOpenCreateAsset: vi.fn(),
        handleSelectTypeFromMenu: vi.fn(),
      })
    );

    hook.handleAddNext(imageNode.id, 'right', { x: 520, y: 340 });

    expect(setContextMenu).toHaveBeenCalledWith({
      isOpen: true,
      x: 520,
      y: 340,
      type: 'node-connector',
      sourceNodeId: imageNode.id,
      connectorSide: 'right',
      sourceNodeType: NodeType.IMAGE,
      dropCanvasPosition: {
        x: 210,
        y: 145,
      },
    });
  });

  it('treats generated scene image nodes as image sources for the connector menu', async () => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const { useContextMenuHandlers } = await import('./useContextMenuHandlers');
    const setContextMenu = vi.fn();
    const sceneImageNode: NodeData = {
      id: 'scene-image-1',
      type: NodeType.STORYBOARD,
      x: 40,
      y: 60,
      prompt: '引用这个生成结果继续创作',
      status: NodeStatus.SUCCESS,
      model: 'mock-scene-pipeline',
      aspectRatio: '16:9',
      resolution: 'Auto',
      resultUrl: 'https://example.com/generated-scene.png',
      parentIds: [],
      scene: 'character_three_view_generate',
    };
    const viewport: Viewport = { x: 100, y: 50, zoom: 2 };
    const contextMenu: ContextMenuState = {
      isOpen: false,
      x: 0,
      y: 0,
      type: 'global',
    };

    const hook = reactMock.render(() =>
      useContextMenuHandlers({
        nodes: [sceneImageNode],
        viewport,
        contextMenu,
        setContextMenu,
        handleOpenCreateAsset: vi.fn(),
        handleSelectTypeFromMenu: vi.fn(),
      })
    );

    hook.handleAddNext(sceneImageNode.id, 'right', { x: 520, y: 340 });

    expect(setContextMenu).toHaveBeenCalledWith(expect.objectContaining({
      type: 'node-connector',
      sourceNodeId: sceneImageNode.id,
      sourceNodeType: NodeType.IMAGE,
    }));
  });
});
