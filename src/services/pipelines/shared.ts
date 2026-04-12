import type { GenerationRequest, PipelineContext, PipelineOutput, ScenePipeline } from '../../types/scene';

export function createSceneRequest(ctx: PipelineContext, taskType: GenerationRequest['taskType'] = 'image'): GenerationRequest {
  return {
    params: {
      ...ctx.params,
      scene: ctx.scene,
    },
    metadata: {
      node_id: ctx.nodeId,
      project_id: ctx.projectId,
    },
    provider: 'mock',
    model: 'mock-scene-pipeline',
    taskType,
    requestId: crypto.randomUUID(),
  };
}

export function createMockScenePipeline(taskType: GenerationRequest['taskType'] = 'image'): ScenePipeline {
  return {
    validate(input) {
      if (!input) throw new Error('Scene params are required.');
    },
    buildRequest(ctx) {
      return createSceneRequest(ctx, taskType);
    },
    handleResult(_ctx, result: PipelineOutput) {
      return {
        outputs: result,
        structuredData: result.structuredData,
      };
    },
  };
}
