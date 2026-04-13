import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';
import { getRestorableSceneTasks } from './useSceneTaskRunner';

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
});
