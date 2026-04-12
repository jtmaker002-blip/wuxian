import type { GenerationRequest, PipelineOutput, SceneId, TaskSnapshot } from '../../types/scene';
import { SCENES } from '../../types/scene';
import { makeFrameDeduction, makeMockImageDataUrl, makeStoryboardShots } from './sceneAssets';

type StoredTask = TaskSnapshot & {
  createdAt: number;
  completionAt: number;
  output: PipelineOutput;
};

const tasks = new Map<string, StoredTask>();

function buildOutput(scene: SceneId, params: Record<string, any>): PipelineOutput {
  const storyText = params.storyText || params.prompt || '电影级画布创作';

  if (scene === SCENES.PLOT_DEDUCTION_FOUR_GRID) {
    const storyboard = makeStoryboardShots(4, storyText);
    return {
      imageList: storyboard.map((shot) => ({
        url: makeMockImageDataUrl(`四宫格 · ${shot.plotDescription}`, '#2563eb', shot.shotNumber),
        label: `镜头 ${shot.shotNumber}`,
        status: 'succeeded',
      })),
      structuredData: { storyboard },
    };
  }

  if (scene === SCENES.COHERENT_STORYBOARD_25) {
    const storyboard = makeStoryboardShots(25, storyText);
    return {
      imageList: storyboard.map((shot) => ({
        url: makeMockImageDataUrl(`25宫格 · ${shot.plotDescription}`, '#7c3aed', shot.shotNumber),
        label: `Shot ${shot.shotNumber}`,
        status: 'succeeded',
      })),
      structuredData: {
        storyboard,
        characterBible: {
          mainCharacters: [
            {
              id: 'hero',
              name: '主角',
              appearance: '清晰轮廓、稳定服装与发型',
              outfit: '深色电影感外套',
              temperament: '克制、坚定',
              referenceImages: params.referenceImages || [],
            },
          ],
        },
        worldBible: {
          worldName: '连贯分镜世界',
          environmentStyle: params.visualStyle || 'cinematic realistic',
          colorPalette: ['deep blue', 'warm amber', 'soft gray'],
          recurringLocations: ['主场景', '转场空间', '结尾场景'],
        },
      },
    };
  }

  if (scene === SCENES.CHARACTER_THREE_VIEW_GENERATE) {
    const views = ['front', 'side', 'back'];
    return {
      imageList: views.map((view, index) => ({
        url: makeMockImageDataUrl(`角色三视图 · ${view}`, '#16a34a', index + 1),
        label: view,
        status: 'succeeded',
      })),
      structuredData: {
        characterProfile: {
          style: params.style || 'realistic',
          background: params.background || 'plain',
          keepCostumeConsistency: params.keepCostumeConsistency !== false,
        },
        views,
      },
    };
  }

  if (scene === SCENES.FRAME_DEDUCTION_PLUS_3S || scene === SCENES.FRAME_DEDUCTION_MINUS_5S) {
    const direction = scene === SCENES.FRAME_DEDUCTION_PLUS_3S ? 'plus' : 'minus';
    const deduction = makeFrameDeduction(direction);
    return {
      imageList: [
        {
          url: makeMockImageDataUrl(direction === 'plus' ? '3秒后画面推演' : '5秒前画面推演', '#ea580c', 1),
          label: direction === 'plus' ? '+3s' : '-5s',
          status: 'succeeded',
        },
      ],
      structuredData: { frameDeduction: deduction },
    };
  }

  if (scene === SCENES.CINEMATIC_LIGHT_CORRECTION) {
    return {
      imageList: [
        {
          url: makeMockImageDataUrl(`电影级打光 · ${params.lightColor || 'neutral'}`, '#f59e0b', 1),
          label: 'Relit',
          status: 'succeeded',
        },
      ],
      structuredData: {
        lightingRequest: {
          originImage: params.originImage,
          UI_KeyLight: params.keyLight || 'front',
          UI_RimLight: params.rimLightEnabled ?? true,
          UI_LightColor: params.lightColor || 'neutral',
          UI_LightBrightness: params.brightness ?? 55,
          prompt: params.prompt || '',
          Reference_Image_Intent: params.referenceImage || '',
        },
      },
    };
  }

  if (scene === SCENES.UPSCALE) {
    return {
      imageList: [
        {
          url: makeMockImageDataUrl(`高清放大 · ${params.targetResolution || '2x'}`, '#0891b2', 1),
          label: params.targetResolution || '2x',
          status: 'succeeded',
        },
      ],
      structuredData: {
        upscale: {
          targetResolution: params.targetResolution || '2x',
          detailMode: params.detailMode || 'cinematic',
        },
      },
    };
  }

  return {
    imageList: Array.from({ length: 9 }).map((_, index) => ({
      url: makeMockImageDataUrl(`多机位九宫格 · 角度 ${index + 1}`, '#db2777', index + 1),
      label: `Angle ${index + 1}`,
      status: 'succeeded',
    })),
    structuredData: {
      multiView: {
        cameraAngles: ['wide', 'medium', 'close', 'low', 'high', 'over-shoulder', 'macro', 'dutch', 'hero'],
      },
    },
  };
}

export async function createMockTask(request: GenerationRequest): Promise<{ taskId: string }> {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const scene = request.params.scene as SceneId;
  const output = buildOutput(scene, request.params);
  const now = Date.now();
  tasks.set(taskId, {
    taskId,
    requestId: request.requestId,
    status: 'pending',
    progressPercent: 0,
    result: null,
    errorMessage: null,
    createdAt: now,
    completionAt: now + 1800 + Math.floor(Math.random() * 1200),
    output,
  });
  return { taskId };
}

export async function getMockTaskStatus(taskIds: string[]): Promise<TaskSnapshot[]> {
  const now = Date.now();
  return taskIds.flatMap((taskId) => {
    const task = tasks.get(taskId);
    if (!task) return [];
    if (task.status === 'cancelled') return [task];
    const progress = Math.min(100, Math.round(((now - task.createdAt) / (task.completionAt - task.createdAt)) * 100));
    if (progress >= 100) {
      task.status = 'succeeded';
      task.progressPercent = 100;
      task.result = task.output;
    } else {
      task.status = progress < 8 ? 'pending' : 'running';
      task.progressPercent = Math.max(4, progress);
      task.result = null;
    }
    tasks.set(taskId, task);
    return [task];
  });
}

export async function cancelMockTask(taskId: string) {
  const task = tasks.get(taskId);
  if (task) {
    tasks.set(taskId, {
      ...task,
      status: 'cancelled',
      progressPercent: task.progressPercent,
      errorMessage: '任务已取消',
    });
  }
}

export function estimateMockTaskCost(scene: SceneId) {
  if (scene === SCENES.COHERENT_STORYBOARD_25) return 350;
  if (scene === SCENES.PLOT_DEDUCTION_FOUR_GRID) return 64;
  if (scene === SCENES.MULTI_VIEW_NINE_GRID) return 126;
  if (scene === SCENES.CHARACTER_THREE_VIEW_GENERATE) return 42;
  return 14;
}
