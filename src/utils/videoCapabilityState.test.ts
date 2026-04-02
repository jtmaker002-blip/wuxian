import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';
import { LOCAL_VIDEO_CAPABILITIES } from '../config/modelCapabilities';
import {
  getVideoNodeStateMismatches,
  resolveStandardVideoExecutionState,
  resolveStandardVideoInputState,
  sanitizeVideoNodeState,
} from './videoCapabilityState';

function createVideoNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'node-1',
    type: NodeType.VIDEO,
    x: 0,
    y: 0,
    prompt: 'test',
    status: NodeStatus.IDLE,
    model: 'Banana Pro',
    aspectRatio: '16:9',
    resolution: 'Auto',
    videoModel: 'kling-v2-6',
    videoDuration: 5,
    videoMode: 'standard',
    parentIds: [],
    ...overrides,
  };
}

describe('sanitizeVideoNodeState', () => {
  it('keeps supported values unchanged', () => {
    const node = createVideoNode();
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v2-6']);

    expect(next.videoMode).toBe('standard');
    expect(next.videoDuration).toBe(5);
    expect(next.resolution).toBe('Auto');
    expect(next.aspectRatio).toBe('16:9');
  });

  it('falls back invalid duration to mode default', () => {
    const node = createVideoNode({ videoDuration: 8 });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v2-6']);

    expect(next.videoDuration).toBe(5);
  });

  it('falls back invalid resolution to mode default', () => {
    const node = createVideoNode({ resolution: '4K' });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v2-6']);

    expect(next.resolution).toBe('Auto');
  });

  it('keeps explicitly selected but unsupported modes so the UI can surface a warning', () => {
    const node = createVideoNode({
      videoMode: 'motion-control',
      frameInputs: [
        { nodeId: 'start', order: 'start' },
        { nodeId: 'end', order: 'end' },
      ],
    });
    const next = { ...node, ...sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v3']) };

    expect(next.videoMode).toBe('motion-control');
    expect(next.frameInputs).toEqual([
      { nodeId: 'start', order: 'start' },
      { nodeId: 'end', order: 'end' },
    ]);
  });

  it('keeps frame inputs when the node is not in frame-to-frame mode so they are not lost on mode switches', () => {
    const node = createVideoNode({
      videoMode: 'standard',
      frameInputs: [
        { nodeId: 'start', order: 'start' },
        { nodeId: 'end', order: 'end' },
      ],
    });
    const next = { ...node, ...sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v2-6']) };

    expect(next.frameInputs).toEqual([
      { nodeId: 'start', order: 'start' },
      { nodeId: 'end', order: 'end' },
    ]);
  });

  it('keeps supported modes and normalizes unsupported native audio toggle to false', () => {
    const node = createVideoNode({
      videoMode: 'motion-control',
      generateAudio: true,
    });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v2-6']);

    expect(next.videoMode).toBe('motion-control');
    expect(next.generateAudio).toBe(false);
  });

  it('sets native audio toggle to false by default when the current mode supports audio', () => {
    const node = createVideoNode({
      videoMode: 'standard',
      generateAudio: undefined,
    });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v2-6']);

    expect(next.generateAudio).toBe(false);
  });

  it('reports mismatches when current settings exceed capability limits', () => {
    const node = createVideoNode({
      videoDuration: 9,
      aspectRatio: '1:1',
      resolution: '4K',
      generateAudio: true,
    });

    expect(getVideoNodeStateMismatches(node, LOCAL_VIDEO_CAPABILITIES['veo3.1'])).toEqual([
      '秒数',
      '比例',
      '清晰度',
      '音频',
    ]);
  });

  it('preserves explicit native audio enablement when the current mode supports audio', () => {
    const node = createVideoNode({
      videoMode: 'standard',
      generateAudio: true,
    });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v2-6']);

    expect(next.generateAudio).toBe(true);
  });

  it('removes stale frame inputs that are no longer connected to the current node', () => {
    const node = createVideoNode({
      videoModel: 'kling-v3',
      videoMode: 'frame-to-frame',
      parentIds: ['image-a', 'image-b'],
      frameInputs: [
        { nodeId: 'image-a', order: 'start' },
        { nodeId: 'ghost-image', order: 'end' },
      ],
    });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v3']);

    expect(next.frameInputs).toBeUndefined();
  });

  it('keeps valid start/end bindings when both connected frame inputs are still present', () => {
    const node = createVideoNode({
      videoModel: 'kling-v3',
      videoMode: 'frame-to-frame',
      parentIds: ['image-a', 'image-b'],
      frameInputs: [
        { nodeId: 'image-b', order: 'start' },
        { nodeId: 'image-a', order: 'end' },
      ],
    });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v3']);

    expect(next.frameInputs).toEqual([
      { nodeId: 'image-b', order: 'start' },
      { nodeId: 'image-a', order: 'end' },
    ]);
  });

  it('标准模式单图且能力表开启全图参考时，会优先走 reference images 链', () => {
    const state = resolveStandardVideoInputState(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'], {
      imageInputCount: 1,
      hasInputSource: true,
    });

    expect(state.inputMode).toBe('image-to-video');
    expect(state.supportsCurrentInputMode).toBe(true);
    expect(state.supportsReferenceImages).toBe(true);
    expect(state.usesReferenceImages).toBe(true);
    expect(state.hasUnsupportedMultipleImageInputs).toBe(false);
  });

  it('标准模式多图但服务端参考图链没接通时，会明确标记为不支持', () => {
    const state = resolveStandardVideoInputState(LOCAL_VIDEO_CAPABILITIES['grok-video-3'], {
      imageInputCount: 2,
      hasInputSource: true,
    });

    expect(state.inputMode).toBe('image-to-video');
    expect(state.supportsReferenceImages).toBe(false);
    expect(state.supportsCurrentInputMode).toBe(false);
    expect(state.usesReferenceImages).toBe(false);
    expect(state.hasUnsupportedMultipleImageInputs).toBe(true);
  });

  it('标准模式执行状态会统一给出 referenceImageUrls，避免 UI 和生成链重复拼装', () => {
    const state = resolveStandardVideoExecutionState(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'], {
      imageUrls: ['image-a', undefined, 'image-b'],
      hasInputSource: true,
    });

    expect(state.supportsCurrentInputMode).toBe(true);
    expect(state.usesReferenceImages).toBe(true);
    expect(state.referenceImageUrls).toEqual(['image-a', 'image-b']);
  });
});
