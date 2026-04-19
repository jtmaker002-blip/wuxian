import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';
import { getRecoverableSceneTasks, getRestorableSceneTasks, isRealSceneExecutionParams } from './useSceneTaskRunner';

function createNode(overrides: Partial<NodeData>): NodeData {
  return {
    id: 'scene-node',
    type: NodeType.STORYBOARD,
    x: 0,
    y: 0,
    prompt: '恢复中的故事',
    status: NodeStatus.LOADING,
    model: 'mock-scene-pipeline',
    aspectRatio: '16:9',
    resolution: 'Auto',
    ...overrides,
  };
}

describe('useSceneTaskRunner helpers', () => {
  it('collects restorable loading scene tasks from node taskInfo', () => {
    const tasks = getRestorableSceneTasks([
      createNode({
        scene: 'plot_deduction_four_grid',
        params: {
          storyText: '恢复项目里的故事',
          ratio: '9:16',
        },
        taskInfo: {
          taskId: 'task-restore',
          loading: true,
          status: 'running',
          progressPercent: 42,
        },
      }),
    ]);

    expect(tasks).toEqual([
      expect.objectContaining({
        nodeId: 'scene-node',
        scene: 'plot_deduction_four_grid',
        taskId: 'task-restore',
        remote: true,
        params: expect.objectContaining({
          storyText: '恢复项目里的故事',
          ratio: '9:16',
          prompt: '恢复中的故事',
        }),
      }),
    ]);
  });

  it('restores local mock scene tasks as local so polling/cancel stays on the mock runner', () => {
    const tasks = getRestorableSceneTasks([
      createNode({
        scene: 'plot_deduction_four_grid',
        taskInfo: {
          taskId: 'local_restore',
          loading: true,
          status: 'running',
          progressPercent: 42,
        },
      }),
    ]);

    expect(tasks[0]).toMatchObject({
      taskId: 'local_restore',
      remote: false,
    });
  });

  it('does not resume completed scene tasks or non-scene loading nodes', () => {
    const tasks = getRestorableSceneTasks([
      createNode({
        scene: 'plot_deduction_four_grid',
        taskInfo: {
          taskId: 'task-done',
          loading: false,
          status: 'succeeded',
          progressPercent: 100,
        },
      }),
      createNode({
        type: NodeType.IMAGE,
        scene: undefined,
        taskInfo: {
          taskId: 'task-image',
          loading: true,
          status: 'running',
          progressPercent: 50,
        },
      }),
    ]);

    expect(tasks).toEqual([]);
  });

  it('collects failed scene tasks without outputs for recovery polling', () => {
    const tasks = getRecoverableSceneTasks([
      createNode({
        scene: 'character_three_view_generate',
        status: NodeStatus.ERROR,
        taskInfo: {
          taskId: 'task-recover',
          loading: false,
          status: 'failed',
          progressPercent: 100,
          failedReason: '任务执行中断，结果未写入，请重试。',
        },
      }),
    ]);

    expect(tasks).toEqual([
      expect.objectContaining({
        nodeId: 'scene-node',
        taskId: 'task-recover',
        scene: 'character_three_view_generate',
      }),
    ]);
  });

  it('marks only explicit real scene params as remote-only execution', () => {
    expect(isRealSceneExecutionParams({ executionMode: 'real' })).toBe(true);
    expect(isRealSceneExecutionParams({ providerMode: 'real' })).toBe(true);
    expect(isRealSceneExecutionParams({ executionMode: 'mock', providerMode: 'mock' })).toBe(false);
    expect(isRealSceneExecutionParams({})).toBe(false);
  });
});
