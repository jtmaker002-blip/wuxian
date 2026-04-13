import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE_IMAGE_MODEL, FALLBACK_SCENE_IMAGE_MODEL, SCENE_DEFINITIONS, getSceneDefinition } from './registry';
import { getScenePipeline, pipelineRegistry } from '../pipelines/registry';
import { createMockTask, getMockTaskStatus } from '../mock/tasks';
import { SCENES } from '../../types/scene';

describe('scene registry and mock task pipelines', () => {
  it('registers every Liblib scene with a pipeline', () => {
    const sceneIds = SCENE_DEFINITIONS.map((definition) => definition.scene);

    expect(sceneIds).toEqual([
      SCENES.MULTI_VIEW_NINE_GRID,
      SCENES.PLOT_DEDUCTION_FOUR_GRID,
      SCENES.COHERENT_STORYBOARD_25,
      SCENES.CINEMATIC_LIGHT_CORRECTION,
      SCENES.CHARACTER_THREE_VIEW_GENERATE,
      SCENES.FRAME_DEDUCTION_PLUS_3S,
      SCENES.FRAME_DEDUCTION_MINUS_5S,
      SCENES.UPSCALE,
    ]);

    for (const scene of sceneIds) {
      expect(getSceneDefinition(scene)).toBeTruthy();
      expect(getScenePipeline(scene)).toBe(pipelineRegistry[scene]);
    }
  });

  it('defaults every image scene to Nano Banana Pro with Nano Banana 2 as fallback', () => {
    for (const definition of SCENE_DEFINITIONS) {
      expect(definition.defaultParams.imageModel).toBe(DEFAULT_SCENE_IMAGE_MODEL);
      expect(definition.defaultParams.fallbackImageModel).toBe(FALLBACK_SCENE_IMAGE_MODEL);
    }
  });

  it('builds a traceable task envelope for the four-grid storyboard scene', async () => {
    const pipeline = getScenePipeline(SCENES.PLOT_DEDUCTION_FOUR_GRID);
    const request = await pipeline?.buildRequest({
      nodeId: 'node-1',
      projectId: 'project-1',
      scene: SCENES.PLOT_DEDUCTION_FOUR_GRID,
      params: {
        storyText: '角色发现线索',
      },
    });

    expect(request).toEqual(
      expect.objectContaining({
        provider: 'mock',
        model: 'mock-scene-pipeline',
        taskType: 'image',
        metadata: {
          node_id: 'node-1',
          project_id: 'project-1',
        },
      })
    );
  });

  it('mock task status eventually returns storyboard outputs and structured data', async () => {
    const pipeline = getScenePipeline(SCENES.PLOT_DEDUCTION_FOUR_GRID);
    const request = await pipeline!.buildRequest({
      nodeId: 'node-1',
      projectId: 'project-1',
      scene: SCENES.PLOT_DEDUCTION_FOUR_GRID,
      params: {
        storyText: '角色发现线索',
      },
    });
    const { taskId } = await createMockTask(Array.isArray(request) ? request[0] : request);

    await new Promise((resolve) => setTimeout(resolve, 3100));
    const [task] = await getMockTaskStatus([taskId]);

    expect(task.status).toBe('succeeded');
    expect(task.result?.imageList).toHaveLength(4);
    expect(task.result?.structuredData?.storyboard).toHaveLength(4);
  });
});
