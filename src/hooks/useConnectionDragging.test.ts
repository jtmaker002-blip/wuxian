import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeStatus, NodeType, type NodeData, type Viewport } from '../types';

function createReactHookMock() {
  const stateSlots: unknown[] = [];
  const refSlots: Array<{ current: unknown }> = [];
  let stateCursor = 0;
  let refCursor = 0;

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

  const useRef = <T,>(initialValue: T) => {
    const slot = refCursor++;
    if (!(slot in refSlots)) {
      refSlots[slot] = { current: initialValue };
    }
    return refSlots[slot] as { current: T };
  };

  const useCallback = <T extends (...args: any[]) => any>(callback: T) => callback;

  const reactModule = {
    __esModule: true,
    default: { useState, useRef, useCallback },
    useState,
    useRef,
    useCallback,
  };

  return {
    reactModule,
    render<T>(factory: () => T) {
      stateCursor = 0;
      refCursor = 0;
      return factory();
    },
  };
}

function createPointerEvent(overrides: Partial<React.PointerEvent> = {}) {
  return {
    clientX: 0,
    clientY: 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as React.PointerEvent;
}

function createImageNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'image-1',
    type: NodeType.IMAGE,
    x: 100,
    y: 120,
    prompt: '让画面动起来',
    status: NodeStatus.SUCCESS,
    model: 'image-model',
    imageModel: 'image-model',
    aspectRatio: '9:16',
    resolution: 'Auto',
    resultUrl: 'https://example.com/source.png',
    parentIds: [],
    ...overrides,
  };
}

function createVideoNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'video-1',
    type: NodeType.VIDEO,
    x: 500,
    y: 120,
    prompt: '',
    status: NodeStatus.IDLE,
    model: 'video-model',
    videoModel: 'video-model',
    videoMode: 'standard',
    aspectRatio: '16:9',
    resolution: 'Auto',
    parentIds: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('react');
  vi.restoreAllMocks();
});

describe('useConnectionDragging', () => {
  it('uses the latest blank-drop screen position when opening the image connector menu', async () => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const { useConnectionDragging } = await import('./useConnectionDragging');
    const nodes = [createImageNode()];
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 };

    let hook = reactMock.render(() => useConnectionDragging());
    hook.handleConnectorPointerDown(createPointerEvent({ clientX: 140, clientY: 210 }), 'image-1', 'right');

    hook = reactMock.render(() => useConnectionDragging());
    hook.updateConnectionDrag(createPointerEvent({ clientX: 480, clientY: 360 }), nodes, viewport);

    hook = reactMock.render(() => useConnectionDragging());
    const onAddNext = vi.fn();
    const onUpdateNodes = vi.fn();

    expect(hook.completeConnectionDrag(onAddNext, onUpdateNodes, nodes)).toBe(true);
    expect(onAddNext).toHaveBeenCalledWith('image-1', 'right', { x: 480, y: 360 });
    expect(onUpdateNodes).not.toHaveBeenCalled();
  });

  it('snaps an image drag to the video input and puts the video node into image-to-video state', async () => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const { useConnectionDragging } = await import('./useConnectionDragging');
    const sourceNode = createImageNode();
    const targetNode = createVideoNode();
    const nodes = [sourceNode, targetNode];
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 };
    const leftConnectorCenterY = targetNode.y + 385 / (16 / 9) / 2;

    let hook = reactMock.render(() => useConnectionDragging());
    hook.handleConnectorPointerDown(
      createPointerEvent({ clientX: sourceNode.x + 365, clientY: sourceNode.y + 120 }),
      sourceNode.id,
      'right'
    );

    hook = reactMock.render(() => useConnectionDragging());
    hook.updateConnectionDrag(
      createPointerEvent({ clientX: targetNode.x + 3, clientY: leftConnectorCenterY }),
      nodes,
      viewport
    );

    hook = reactMock.render(() => useConnectionDragging());
    expect(hook.tempConnectionEnd).toEqual({
      x: targetNode.x,
      y: leftConnectorCenterY,
    });

    let nextNodes = nodes;
    const onUpdateNodes = vi.fn((updater: (prev: NodeData[]) => NodeData[]) => {
      nextNodes = updater(nextNodes);
    });
    const onConnectionMade = vi.fn();

    expect(hook.completeConnectionDrag(vi.fn(), onUpdateNodes, nodes, onConnectionMade)).toBe(true);

    const nextVideoNode = nextNodes.find((node) => node.id === targetNode.id);
    expect(nextVideoNode).toMatchObject({
      id: targetNode.id,
      prompt: sourceNode.prompt,
      inputUrl: sourceNode.resultUrl,
      parentIds: [sourceNode.id],
      videoMode: 'standard',
      aspectRatio: sourceNode.aspectRatio,
      isPromptExpanded: true,
      errorMessage: undefined,
    });
    expect(onConnectionMade).toHaveBeenCalledWith(sourceNode.id, targetNode.id);
  });

  it('magnetically prefers the video input when an image drag lands near the left connector', async () => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const { useConnectionDragging } = await import('./useConnectionDragging');
    const sourceNode = createImageNode();
    const targetNode = createVideoNode();
    const nodes = [sourceNode, targetNode];
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 };
    const leftConnectorCenterY = targetNode.y + 385 / (16 / 9) / 2;

    let hook = reactMock.render(() => useConnectionDragging());
    hook.handleConnectorPointerDown(
      createPointerEvent({ clientX: sourceNode.x + 365, clientY: sourceNode.y + 120 }),
      sourceNode.id,
      'right'
    );

    hook = reactMock.render(() => useConnectionDragging());
    hook.updateConnectionDrag(
      createPointerEvent({ clientX: targetNode.x - 150, clientY: leftConnectorCenterY }),
      nodes,
      viewport
    );

    hook = reactMock.render(() => useConnectionDragging());
    expect(hook.tempConnectionEnd).toEqual({
      x: targetNode.x,
      y: leftConnectorCenterY,
    });
  });

  it.each([NodeStatus.SUCCESS, NodeStatus.ERROR])(
    'clears stale %s video result and execution state when reusing it for image-to-video',
    async (staleStatus) => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const { useConnectionDragging } = await import('./useConnectionDragging');
    const sourceNode = createImageNode({
      id: 'image-source',
      prompt: '主图做成视频',
      aspectRatio: '1:1',
      resultUrl: 'https://example.com/new-source.png',
    });
    const targetNode = createVideoNode({
      id: 'stale-video',
      status: staleStatus,
      prompt: '',
      videoMode: 'frame-to-frame',
      frameInputs: [
        { nodeId: 'old-start', order: 'start' },
        { nodeId: 'old-end', order: 'end' },
      ],
      resultUrl: 'https://example.com/old-video.mp4',
      lastFrame: 'data:image/png;base64,old-frame',
      resultAspectRatio: '16/9',
      requestedVideoModel: 'old-request',
      executedVideoModel: 'old-executed',
      executedVideoMode: 'old-mode',
      executionProvider: 'old-provider',
      generationStartTime: 123,
      errorMessage: 'old failure',
    });
    const nodes = [sourceNode, targetNode];
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 };
    const leftConnectorCenterY = targetNode.y + 385 / (16 / 9) / 2;

    let hook = reactMock.render(() => useConnectionDragging());
    hook.handleConnectorPointerDown(
      createPointerEvent({ clientX: sourceNode.x + 365, clientY: sourceNode.y + 120 }),
      sourceNode.id,
      'right'
    );

    hook = reactMock.render(() => useConnectionDragging());
    hook.updateConnectionDrag(
      createPointerEvent({ clientX: targetNode.x + 3, clientY: leftConnectorCenterY }),
      nodes,
      viewport
    );

    hook = reactMock.render(() => useConnectionDragging());
    let nextNodes = nodes;
    const onUpdateNodes = vi.fn((updater: (prev: NodeData[]) => NodeData[]) => {
      nextNodes = updater(nextNodes);
    });

    expect(hook.completeConnectionDrag(vi.fn(), onUpdateNodes, nodes)).toBe(true);

    const nextVideoNode = nextNodes.find((node) => node.id === targetNode.id);
    expect(nextVideoNode).toMatchObject({
      id: targetNode.id,
      status: NodeStatus.IDLE,
      prompt: sourceNode.prompt,
      inputUrl: sourceNode.resultUrl,
      parentIds: [sourceNode.id],
      videoMode: 'standard',
      aspectRatio: sourceNode.aspectRatio,
      isPromptExpanded: true,
    });
    expect(nextVideoNode?.resultUrl).toBeUndefined();
    expect(nextVideoNode?.lastFrame).toBeUndefined();
    expect(nextVideoNode?.resultAspectRatio).toBeUndefined();
    expect(nextVideoNode?.frameInputs).toBeUndefined();
    expect(nextVideoNode?.requestedVideoModel).toBeUndefined();
    expect(nextVideoNode?.executedVideoModel).toBeUndefined();
    expect(nextVideoNode?.executedVideoMode).toBeUndefined();
    expect(nextVideoNode?.executionProvider).toBeUndefined();
    expect(nextVideoNode?.generationStartTime).toBeUndefined();
    expect(nextVideoNode?.errorMessage).toBeUndefined();
    }
  );

  it('does not reset an already-connected image-to-video node on duplicate drag', async () => {
    const reactMock = createReactHookMock();
    vi.doMock('react', () => reactMock.reactModule);

    const { useConnectionDragging } = await import('./useConnectionDragging');
    const sourceNode = createImageNode();
    const targetNode = createVideoNode({
      parentIds: [sourceNode.id],
      status: NodeStatus.SUCCESS,
      resultUrl: 'https://example.com/existing-video.mp4',
      lastFrame: 'data:image/png;base64,existing-frame',
    });
    const nodes = [sourceNode, targetNode];
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 };
    const leftConnectorCenterY = targetNode.y + 385 / (16 / 9) / 2;

    let hook = reactMock.render(() => useConnectionDragging());
    hook.handleConnectorPointerDown(
      createPointerEvent({ clientX: sourceNode.x + 365, clientY: sourceNode.y + 120 }),
      sourceNode.id,
      'right'
    );

    hook = reactMock.render(() => useConnectionDragging());
    hook.updateConnectionDrag(
      createPointerEvent({ clientX: targetNode.x + 3, clientY: leftConnectorCenterY }),
      nodes,
      viewport
    );

    hook = reactMock.render(() => useConnectionDragging());
    let nextNodes = nodes;
    const onUpdateNodes = vi.fn((updater: (prev: NodeData[]) => NodeData[]) => {
      nextNodes = updater(nextNodes);
    });
    const onConnectionMade = vi.fn();

    expect(hook.completeConnectionDrag(vi.fn(), onUpdateNodes, nodes, onConnectionMade)).toBe(true);
    expect(nextNodes.find((node) => node.id === targetNode.id)).toEqual(targetNode);
    expect(onConnectionMade).not.toHaveBeenCalled();
  });
});
