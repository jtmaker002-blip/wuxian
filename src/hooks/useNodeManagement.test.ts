import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveStandaloneNodeCanvasPosition } from './useNodeManagement';
import { NodeStatus, NodeType, type ContextMenuState, type NodeData, type Viewport } from '../types';

function createReactHookMock() {
  const stateSlots: unknown[] = [];
  let stateCursor = 0;

  const useState = <T,>(initialState: T | (() => T)) => {
    const slot = stateCursor++;
    if (!(slot in stateSlots)) {
      stateSlots[slot] =
        typeof initialState === 'function'
          ? (initialState as () => T)()
          : initialState;
    }

    const setState = (value: T | ((prev: T) => T)) => {
      const previousValue = stateSlots[slot] as T;
      stateSlots[slot] =
        typeof value === 'function'
          ? (value as (prev: T) => T)(previousValue)
          : value;
    };

    return [stateSlots[slot] as T, setState] as const;
  };

  return {
    reactModule: {
      __esModule: true,
      default: { useState },
      useState,
    },
    render<T>(factory: () => T) {
      stateCursor = 0;
      return factory();
    },
  };
}

function createImageNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'image-1',
    type: NodeType.IMAGE,
    x: 40,
    y: 60,
    prompt: '引用这张图做成视频',
    status: NodeStatus.SUCCESS,
    model: 'image-model',
    imageModel: 'image-model',
    aspectRatio: '3:4',
    resolution: 'Auto',
    resultUrl: 'https://example.com/source.png',
    parentIds: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('react');
  vi.restoreAllMocks();
});

describe('resolveStandaloneNodeCanvasPosition', () => {
  it('clamps toolbar-origin nodes into the visible viewport area', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };

    expect(resolveStandaloneNodeCanvasPosition(62, 24, viewport)).toEqual({
      canvasX: 132,
      canvasY: 72,
    });
  });

  it('preserves natural placement when the trigger point is already safely inside the viewport', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };

    expect(resolveStandaloneNodeCanvasPosition(640, 420, viewport)).toEqual({
      canvasX: 470,
      canvasY: 320,
    });
  });

  it('respects viewport translation and zoom while keeping nodes visible', () => {
    const viewport = { x: -180, y: -40, zoom: 2 };

    expect(resolveStandaloneNodeCanvasPosition(80, 60, viewport)).toEqual({
      canvasX: 156,
      canvasY: 56,
    });
  });
});

describe('useNodeManagement connector menu creation', () => {
  it('creates image-to-video state when choosing Video from an image blank connector menu', async () => {
    vi.resetModules();
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const nextNodeId = '22222222-2222-4222-8222-222222222222';
    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(nextNodeId);
    const { useNodeManagement } = await import('./useNodeManagement');
    const sourceNode = createImageNode();
    const viewport: Viewport = { x: 100, y: 50, zoom: 2 };
    const contextMenu: ContextMenuState = {
      isOpen: true,
      x: 520,
      y: 340,
      type: 'node-connector',
      sourceNodeId: sourceNode.id,
      connectorSide: 'right',
      sourceNodeType: NodeType.IMAGE,
      dropCanvasPosition: {
        x: 210,
        y: 145,
      },
    };

    let hook = reactMock.render(() => useNodeManagement());
    hook.setNodes([sourceNode]);
    hook = reactMock.render(() => useNodeManagement());

    const onCloseMenu = vi.fn();
    hook.handleSelectTypeFromMenu(NodeType.VIDEO, contextMenu, viewport, onCloseMenu);

    hook = reactMock.render(() => useNodeManagement());
    const createdNode = hook.nodes.find((node) => node.id === nextNodeId);

    expect(createdNode).toMatchObject({
      id: nextNodeId,
      type: NodeType.VIDEO,
      x: 234,
      y: 36.71875,
      prompt: sourceNode.prompt,
      status: NodeStatus.IDLE,
      videoMode: 'standard',
      aspectRatio: sourceNode.aspectRatio,
      inputUrl: sourceNode.resultUrl,
      parentIds: [sourceNode.id],
      isPromptExpanded: true,
    });
    expect(hook.selectedNodeIds).toEqual([nextNodeId]);
    expect(onCloseMenu).toHaveBeenCalledOnce();
    expect(randomUuidSpy).toHaveBeenCalledOnce();
  });
});
