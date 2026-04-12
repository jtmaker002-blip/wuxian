import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { NodeData, NodeStatus } from '../types';
import type { SceneId } from '../types/scene';
import { getSceneDefinition } from '../services/scenes/registry';
import { getScenePipeline } from '../services/pipelines/registry';
import { createMockTask, getMockTaskStatus } from '../services/mock/tasks';

type UseSceneTaskRunnerOptions = {
  nodes: NodeData[];
  projectId: string;
  setNodes: Dispatch<SetStateAction<NodeData[]>>;
};

export function useSceneTaskRunner({ nodes, projectId, setNodes }: UseSceneTaskRunnerOptions) {
  const pollingRef = useRef<Record<string, number>>({});

  const patchNode = useCallback((nodeId: string, updates: Partial<NodeData>) => {
    setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, ...updates } : node)));
  }, [setNodes]);

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
      const { taskId } = await createMockTask(primaryRequest);

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

      if (pollingRef.current[nodeId]) {
        window.clearInterval(pollingRef.current[nodeId]);
      }

      pollingRef.current[nodeId] = window.setInterval(async () => {
        const [task] = await getMockTaskStatus([taskId]);
        if (!task) return;

        if (task.status === 'succeeded' && task.result) {
          window.clearInterval(pollingRef.current[nodeId]);
          delete pollingRef.current[nodeId];
          const handled = await pipeline.handleResult(
            {
              nodeId,
              projectId,
              scene,
              params,
            },
            task.result
          );
          patchNode(nodeId, {
            status: NodeStatus.SUCCESS,
            outputs: handled.outputs,
            structuredData: handled.structuredData,
            resultUrl: handled.outputs.imageList?.[0]?.url,
            taskInfo: {
              taskId,
              loading: false,
              status: 'succeeded',
              progressPercent: 100,
            },
          });
          return;
        }

        if (task.status === 'failed' || task.status === 'cancelled') {
          window.clearInterval(pollingRef.current[nodeId]);
          delete pollingRef.current[nodeId];
          patchNode(nodeId, {
            status: NodeStatus.ERROR,
            taskInfo: {
              taskId,
              loading: false,
              status: task.status,
              failedReason: task.errorMessage || '任务失败',
              progressPercent: task.progressPercent,
            },
            errorMessage: task.errorMessage || '任务失败',
          });
          return;
        }

        patchNode(nodeId, {
          status: NodeStatus.LOADING,
          taskInfo: {
            taskId,
            loading: true,
            status: task.status,
            progressPercent: task.progressPercent,
          },
        });
      }, 450);

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
  }, [nodes, patchNode, projectId]);

  return { runSceneNode };
}
