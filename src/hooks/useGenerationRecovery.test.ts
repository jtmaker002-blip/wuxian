import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { recoverGenerationStatusForNode } from './useGenerationRecovery';
import { NodeStatus, NodeType, type NodeData } from '../types';

function createLoadingVideoNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'video-node',
    type: NodeType.VIDEO,
    x: 0,
    y: 0,
    prompt: '恢复测试',
    status: NodeStatus.LOADING,
    model: 'veo3.1',
    videoModel: 'veo3.1',
    aspectRatio: '16:9',
    resolution: '720p',
    generationStartTime: Date.now(),
    ...overrides,
  };
}

describe('recoverGenerationStatusForNode', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it('视频恢复成功时会带回请求模型、实际执行、执行档位和执行通道', async () => {
    const updateNode = vi.fn();
    const node = createLoadingVideoNode({
      generationStartTime: new Date('2026-04-03T10:00:00.000Z').getTime(),
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        type: 'video',
        resultUrl: '/library/videos/video.mp4',
        createdAt: '2026-04-03T10:01:00.000Z',
        requestedModel: 'minimax-hailuo',
        executedModel: 'S2V-01',
        executedMode: 'S2V',
        executionProvider: 'hailuo',
      }),
    })) as unknown as typeof fetch;
    const extractLastFrameMock = vi.fn(async () => 'data:image/png;base64,last-frame');

    await recoverGenerationStatusForNode({
      nodeId: 'video-node',
      getNodes: () => [node],
      updateNode,
      fetchImpl: fetchMock,
      extractLastFrame: extractLastFrameMock,
    });

    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.SUCCESS,
        requestedVideoModel: 'minimax-hailuo',
        executedVideoModel: 'S2V-01',
        executedVideoMode: 'S2V',
        executionProvider: 'hailuo',
        lastFrame: 'data:image/png;base64,last-frame',
      })
    );
  });

  it('如果提取最后一帧期间用户又重新发起生成，旧恢复结果不会覆盖新一轮', async () => {
    const updateNode = vi.fn();
    const staleNode = createLoadingVideoNode({
      generationStartTime: new Date('2026-04-03T10:00:00.000Z').getTime(),
    });
    const freshNode = createLoadingVideoNode({
      generationStartTime: new Date('2026-04-03T10:05:00.000Z').getTime(),
    });

    let currentNodes: NodeData[] = [staleNode];

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        type: 'video',
        resultUrl: '/library/videos/stale.mp4',
        createdAt: '2026-04-03T10:01:00.000Z',
        requestedModel: 'kling-v2-6',
        executedModel: 'fal-ai/kling-video/v2.6/pro/text-to-video',
        executedMode: 'pro',
        executionProvider: 'fal',
      }),
    })) as unknown as typeof fetch;

    const extractLastFrameMock = vi.fn(async () => {
      currentNodes = [freshNode];
      return 'data:image/png;base64,stale-frame';
    });

    await recoverGenerationStatusForNode({
      nodeId: 'video-node',
      getNodes: () => currentNodes,
      updateNode,
      fetchImpl: fetchMock,
      extractLastFrame: extractLastFrameMock,
    });

    expect(extractLastFrameMock).toHaveBeenCalled();
    expect(updateNode).not.toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.SUCCESS,
        resultUrl: expect.stringContaining('/library/videos/stale.mp4'),
      })
    );
  });
});
