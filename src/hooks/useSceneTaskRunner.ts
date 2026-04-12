import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { NodeData, NodeStatus } from '../types';
import type { SceneId } from '../types/scene';
import { getSceneDefinition } from '../services/scenes/registry';
import { getScenePipeline } from '../services/pipelines/registry';
import { createMockTask, getMockTaskStatus } from '../services/mock/tasks';
import { createTask as createRemoteTask, pollTasks } from '../services/tasks/taskClient';

type UseSceneTaskRunnerOptions = {
  nodes: NodeData[];
  projectId: string;
  setNodes: Dispatch<SetStateAction<NodeData[]>>;
};

type ActiveSceneTask = {
  nodeId: string;
  scene: SceneId;
  taskId: string;
  params: Record<string, any>;
  remote: boolean;
};

export function useSceneTaskRunner({ nodes, projectId, setNodes }: UseSceneTaskRunnerOptions) {
  const pollingRef = useRef<number | undefined>(undefined);
  const activeTasksRef = useRef<Record<string, ActiveSceneTask>>({});

  const patchNode = useCallback((nodeId: string, updates: Partial<NodeData>) => {
    setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, ...updates } : node)));
  }, [setNodes]);

  const ensureBatchPoller = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = window.setInterval(async () => {
      const activeTasks = Object.values(activeTasksRef.current);
      if (activeTasks.length === 0) {
        if (pollingRef.current) window.clearInterval(pollingRef.current);
        pollingRef.current = undefined;
        return;
      }

      const remoteTasks = activeTasks.filter((task) => task.remote);
      const localTasks = activeTasks.filter((task) => !task.remote);
      const snapshots = [
        ...(remoteTasks.length > 0 ? await pollTasks(remoteTasks.map((task) => task.taskId)).catch(() => []) : []),
        ...(localTasks.length > 0 ? await getMockTaskStatus(localTasks.map((task) => task.taskId)) : []),
      ];

      for (const task of snapshots) {
        const active = activeTasks.find((candidate) => candidate.taskId === task.taskId);
        if (!active) continue;
        const pipeline = getScenePipeline(active.scene);
        if (!pipeline) continue;

        if (task.status === 'succeeded' && task.result) {
          delete activeTasksRef.current[active.nodeId];
          const handled = await pipeline.handleResult(
            {
              nodeId: active.nodeId,
              projectId,
              scene: active.scene,
              params: active.params,
            },
            task.result
          );
          patchNode(active.nodeId, {
            status: NodeStatus.SUCCESS,
            outputs: handled.outputs,
            structuredData: handled.structuredData,
            resultUrl: handled.outputs.imageList?.[0]?.url,
            taskInfo: {
              taskId: task.taskId,
              loading: false,
              status: 'succeeded',
              progressPercent: 100,
            },
          });
          continue;
        }

        if (task.status === 'failed' || task.status === 'cancelled') {
          delete activeTasksRef.current[active.nodeId];
          patchNode(active.nodeId, {
            status: NodeStatus.ERROR,
            taskInfo: {
              taskId: task.taskId,
              loading: false,
              status: task.status,
              failedReason: task.errorMessage || '任务失败',
              progressPercent: task.progressPercent,
            },
            errorMessage: task.errorMessage || '任务失败',
          });
          continue;
        }

          patchNode(active.nodeId, {
            status: NodeStatus.LOADING,
            taskInfo: {
              taskId: task.taskId,
              loading: true,
              status: task.status,
              progressPercent: task.progressPercent,
              ...(task.childTasks ? { childTasks: task.childTasks } : {}),
            },
          });
      }
    }, 450);
  }, [patchNode, projectId]);

  const runSceneNode = useCallback(async (nodeId: string) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node?.scene) return false;

    const scene = node.scene as SceneId;
    const definition = getSceneDefinition(scene);
    const pipeline = getScenePipeline(scene);
    if (!definition || !pipeline) {
      patchNode(nodeId, {
        status: NodeStatus.ERROR,
        taskInfo: {
          status: 'failed',
          loading: false,
          failedReason: '当前 scene 未注册 pipeline。',
          progressPercent: 0,
        },
      });
      return true;
    }

    const params = {
      ...definition.defaultParams,
      ...(node.params || {}),
      prompt: node.prompt || node.params?.prompt || definition.defaultParams.prompt,
    };

    try {
      await pipeline.validate(params);
      const requestOrRequests = await pipeline.buildRequest({
        nodeId,
        projectId,
        scene,
        params,
      });
      const primaryRequest = Array.isArray(requestOrRequests) ? requestOrRequests[0] : requestOrRequests;
      let taskId: string;
      let remote = true;
      try {
        const created = await createRemoteTask(primaryRequest);
        taskId = created.taskId;
      } catch {
        const created = await createMockTask(primaryRequest);
        taskId = created.taskId;
        remote = false;
      }

      patchNode(nodeId, {
        status: NodeStatus.LOADING,
        taskInfo: {
          taskId,
          loading: true,
          status: 'pending',
          progressPercent: 0,
        },
        errorMessage: undefined,
      });

      activeTasksRef.current[nodeId] = {
        nodeId,
        scene,
        taskId,
        params,
        remote,
      };
      ensureBatchPoller();

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'scene pipeline failed';
      patchNode(nodeId, {
        status: NodeStatus.ERROR,
        taskInfo: {
          loading: false,
          status: 'failed',
          failedReason: message,
          progressPercent: 0,
        },
        errorMessage: message,
      });
      return true;
    }
  }, [ensureBatchPoller, nodes, patchNode, projectId]);

  return { runSceneNode };
}
