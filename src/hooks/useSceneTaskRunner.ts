import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { NodeData, NodeStatus } from '../types';
import type { SceneId } from '../types/scene';
import { getSceneDefinition } from '../services/scenes/registry';
import { getScenePipeline } from '../services/pipelines/registry';
import { cancelMockTask, createMockTask, getMockTaskStatus } from '../services/mock/tasks';
import { cancelTasks, createTask as createRemoteTask, pollTasks } from '../services/tasks/taskClient';
import { useStoredOpenAiTeachProviderConfig } from '../shared/provider/openaiteach-config';

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

export function buildSceneTaskParams(node: NodeData): Record<string, any> | undefined {
  if (!node.scene) return undefined;
  const definition = getSceneDefinition(node.scene);
  if (!definition) return undefined;
  return {
    ...definition.defaultParams,
    ...(node.params || {}),
    prompt: node.prompt || node.params?.prompt || definition.defaultParams.prompt,
  };
}

export function isRealSceneExecutionParams(params: Record<string, any>): boolean {
  return params.executionMode === 'real' || params.providerMode === 'real';
}

export function getRestorableSceneTasks(nodes: NodeData[]): ActiveSceneTask[] {
  return nodes.flatMap((node) => {
    if (!node.scene || !node.taskInfo?.taskId || !node.taskInfo.loading) return [];
    if (node.taskInfo.status !== 'pending' && node.taskInfo.status !== 'running') return [];
    const params = buildSceneTaskParams(node);
    if (!params) return [];
    return [{
      nodeId: node.id,
      scene: node.scene as SceneId,
      taskId: node.taskInfo.taskId,
      params,
      remote: !node.taskInfo.taskId.startsWith('local_'),
    }];
  });
}

export function getRecoverableSceneTasks(nodes: NodeData[]): ActiveSceneTask[] {
  return nodes.flatMap((node) => {
    if (!node.scene || !node.taskInfo?.taskId) return [];
    if (node.taskInfo.loading) return [];
    if (node.taskInfo.status !== 'failed') return [];
    if (node.outputs?.imageList?.length) return [];
    const params = buildSceneTaskParams(node);
    if (!params) return [];
    return [{
      nodeId: node.id,
      scene: node.scene as SceneId,
      taskId: node.taskInfo.taskId,
      params,
      remote: (node.taskInfo as any).remote !== false && !node.taskInfo.taskId.startsWith('local_'),
    }];
  });
}

export function useSceneTaskRunner({ nodes, projectId, setNodes }: UseSceneTaskRunnerOptions) {
  const providerConfig = useStoredOpenAiTeachProviderConfig();
  const pollingRef = useRef<number | undefined>(undefined);
  const activeTasksRef = useRef<Record<string, ActiveSceneTask>>({});
  const reconciledTaskIdsRef = useRef<Record<string, true>>({});

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
              ...(task.maxConcurrency ? { maxConcurrency: task.maxConcurrency } : {}),
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

    const baseParams = buildSceneTaskParams(node)!;
    const params = isRealSceneExecutionParams(baseParams)
      ? {
        ...baseParams,
        providerApiKey: baseParams.providerApiKey || providerConfig.providerApiKey,
        providerBaseUrl: baseParams.providerBaseUrl || providerConfig.providerBaseUrl,
      }
      : baseParams;

    try {
      await pipeline.validate(params);

      const localResult = await pipeline.runLocal?.({
        nodeId,
        projectId,
        scene,
        params,
      });
      if (localResult) {
        const taskId = `local_${scene}_${Date.now()}`;
      patchNode(nodeId, {
        status: NodeStatus.SUCCESS,
          resultUrl: localResult.outputs.imageList?.[0]?.url,
          outputs: localResult.outputs,
          structuredData: localResult.structuredData,
          taskInfo: {
            taskId,
            loading: false,
            status: 'succeeded',
            progressPercent: 100,
          },
        });
        return true;
      }

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
      } catch (error) {
        if (isRealSceneExecutionParams(params)) {
          throw error;
        }
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
            ...(remote ? {} : { remote: false }),
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
  }, [ensureBatchPoller, nodes, patchNode, projectId, providerConfig.providerApiKey, providerConfig.providerBaseUrl]);

  const cancelSceneTasks = useCallback(async (nodeIds: string[]) => {
    const targets = nodeIds.flatMap((nodeId) => {
      const active = activeTasksRef.current[nodeId];
      if (active) return [active];

      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node?.scene || !node.taskInfo?.taskId || !node.taskInfo.loading) return [];
      return [{
        nodeId,
        scene: node.scene as SceneId,
        taskId: node.taskInfo.taskId,
        params: buildSceneTaskParams(node) || {},
        remote: (node.taskInfo as any).remote !== false && !node.taskInfo.taskId.startsWith('local_'),
      }];
    });
    if (targets.length === 0) return false;

    const remoteTaskIds = targets.filter((task) => task.remote).map((task) => task.taskId);
    const localTaskIds = targets.filter((task) => !task.remote).map((task) => task.taskId);

    if (remoteTaskIds.length > 0) {
      await cancelTasks(remoteTaskIds).catch(() => []);
    }
    await Promise.all(localTaskIds.map((taskId) => cancelMockTask(taskId)));

    for (const target of targets) {
      delete activeTasksRef.current[target.nodeId];
      patchNode(target.nodeId, {
        status: NodeStatus.ERROR,
        taskInfo: {
          taskId: target.taskId,
          loading: false,
          status: 'cancelled',
          failedReason: '任务已取消',
          progressPercent: 0,
          ...(target.remote ? {} : { remote: false }),
        },
        errorMessage: '任务已取消',
      });
    }

    return true;
  }, [nodes, patchNode]);

  useEffect(() => {
    const restorableTasks = getRestorableSceneTasks(nodes);
    let addedTask = false;
    for (const task of restorableTasks) {
      if (activeTasksRef.current[task.nodeId]) continue;
      activeTasksRef.current[task.nodeId] = task;
      addedTask = true;
    }
    if (addedTask) {
      ensureBatchPoller();
    }
  }, [ensureBatchPoller, nodes]);

  useEffect(() => {
    const recoverableTasks = getRecoverableSceneTasks(nodes);
    let addedTask = false;
    for (const task of recoverableTasks) {
      if (activeTasksRef.current[task.nodeId]) continue;
      if (reconciledTaskIdsRef.current[task.taskId]) continue;
      activeTasksRef.current[task.nodeId] = task;
      reconciledTaskIdsRef.current[task.taskId] = true;
      addedTask = true;
    }
    if (addedTask) {
      ensureBatchPoller();
    }
  }, [ensureBatchPoller, nodes]);

  return { runSceneNode, cancelSceneTasks };
}
