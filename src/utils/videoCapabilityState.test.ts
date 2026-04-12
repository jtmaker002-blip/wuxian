import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';
import { LOCAL_VIDEO_CAPABILITIES } from '../config/modelCapabilities';
import {
  canQuickAddStandardVideoImage,
  getVideoNodeStateMismatches,
  resolveStandardVideoCapabilityState,
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

  it('reuses the existing frameInputs reference when the sanitized start/end bindings are unchanged', () => {
    const frameInputs = [
      { nodeId: 'image-b', order: 'start' as const },
      { nodeId: 'image-a', order: 'end' as const },
    ];
    const node = createVideoNode({
      videoModel: 'kling-v3',
      videoMode: 'frame-to-frame',
      parentIds: ['image-a', 'image-b'],
      frameInputs,
    });
    const next = sanitizeVideoNodeState(node, LOCAL_VIDEO_CAPABILITIES['kling-v3']);

    expect(next.frameInputs).toBe(frameInputs);
  });

  it('标准模式单图同时支持图生和全图参考时，会优先保留普通图生视频主路径', () => {
    const state = resolveStandardVideoInputState(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'], {
      sources: [{ type: 'image', url: 'image-a' }],
    });

    expect(state.inputMode).toBe('image-to-video');
    expect(state.supportsCurrentInputMode).toBe(true);
    expect(state.supportsReferenceImages).toBe(true);
    expect(state.usesReferenceImages).toBe(false);
    expect(state.hasUnsupportedMultipleImageInputs).toBe(false);
  });

  it('标准模式多图但服务端参考图链没接通时，会明确标记为不支持', () => {
    const state = resolveStandardVideoInputState(LOCAL_VIDEO_CAPABILITIES['grok-video-3'], {
      sources: [
        { type: 'image', url: 'image-a' },
        { type: 'image', url: 'image-b' },
      ],
    });

    expect(state.inputMode).toBe('image-to-video');
    expect(state.supportsReferenceImages).toBe(false);
    expect(state.supportsCurrentInputMode).toBe(false);
    expect(state.usesReferenceImages).toBe(false);
    expect(state.hasUnsupportedMultipleImageInputs).toBe(true);
  });

  it('标准模式执行状态会统一给出 referenceImageUrls，避免 UI 和生成链重复拼装', () => {
    const state = resolveStandardVideoExecutionState(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'], {
      sources: [
        { nodeId: 'image-a', type: 'image', url: 'image-a' },
        { nodeId: 'image-b', type: 'image', url: undefined },
        { nodeId: 'image-c', type: 'image', url: 'image-b', previewUrl: 'preview-b' },
      ],
    });

    expect(state.supportsCurrentInputMode).toBe(true);
    expect(state.usesReferenceImages).toBe(true);
    expect(state.referenceImageUrls).toEqual(['image-a', 'image-b']);
    expect(state.referenceImageSources).toEqual([
      { nodeId: 'image-a', type: 'image', url: 'image-a', previewUrl: 'image-a' },
      { nodeId: 'image-c', type: 'image', url: 'image-b', previewUrl: 'preview-b' },
    ]);
  });

  it('标准模式单个可执行输入会统一给出 primaryInputUrl，避免生成链自己挑首图', () => {
    const state = resolveStandardVideoExecutionState(LOCAL_VIDEO_CAPABILITIES['veo3.1'], {
      sources: [
        { nodeId: 'video-a', type: 'video', url: 'last-frame-a', previewUrl: 'video-preview-a' },
      ],
    });

    expect(state.inputMode).toBe('image-to-video');
    expect(state.usesReferenceImages).toBe(false);
    expect(state.primaryInputUrl).toBe('last-frame-a');
    expect(state.primaryInputSource).toEqual({
      nodeId: 'video-a',
      type: 'video',
      url: 'last-frame-a',
      previewUrl: 'video-preview-a',
    });
    expect(state.referenceImageUrls).toBeUndefined();
  });

  it('标准模式统一能力状态会给出多图未接通的阻断原因', () => {
    const state = resolveStandardVideoCapabilityState(LOCAL_VIDEO_CAPABILITIES['kling-v2-6'], {
      sources: [
        { type: 'image', url: 'image-a' },
        { type: 'image', url: 'image-b' },
      ],
    });

    expect(state.isBlocked).toBe(true);
    expect(state.blockedReason).toBe('当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。');
  });

  it('标准模式统一能力状态会给出输入模式未接通的阻断原因', () => {
    const state = resolveStandardVideoCapabilityState(LOCAL_VIDEO_CAPABILITIES['wan2.6-i2v'], {
      sources: [],
    });

    expect(state.isBlocked).toBe(true);
    expect(state.blockedReason).toBe('当前视频模型尚未接通当前标准输入模式，请切换模型或调整输入后再试。');
  });

  it('标准模式支持参考图时，接入第一张图后仍允许继续追加图片入口', () => {
    const standardState = resolveStandardVideoCapabilityState(LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'], {
      sources: [{ type: 'image', url: 'image-a' }],
    });

    expect(canQuickAddStandardVideoImage(
      LOCAL_VIDEO_CAPABILITIES['minimax-hailuo'],
      standardState,
      1
    )).toBe(true);
  });

  it('Veo 标准模式支持全图参考时，接入首张图后仍允许继续追加参考图入口', () => {
    const standardState = resolveStandardVideoCapabilityState(LOCAL_VIDEO_CAPABILITIES['veo3.1'], {
      sources: [{ type: 'image', url: 'image-a' }],
    });

    expect(canQuickAddStandardVideoImage(
      LOCAL_VIDEO_CAPABILITIES['veo3.1'],
      standardState,
      1
    )).toBe(true);
  });
});
