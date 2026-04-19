import type { GenerationRequest, PipelineOutput, SceneId, TaskSnapshot } from '../../types/scene';
import { SCENES } from '../../types/scene';
import { makeFrameDeduction, makeMockImageDataUrl, makeMultiViewShots, makeStoryboardShots, MULTI_VIEW_CAMERA_LABELS } from './sceneAssets';

type StoredChildTask = NonNullable<TaskSnapshot['childTasks']>[number] & {
  result?: PipelineOutput | null;
  errorMessage?: string | null;
  createdAt: number;
  completionAt: number;
};

type StoredTask = Omit<TaskSnapshot, 'childTasks'> & {
  createdAt: number;
  completionAt: number;
  output: PipelineOutput;
  childTasks?: StoredChildTask[];
  maxConcurrency?: number;
};

const tasks = new Map<string, StoredTask>();
const MAX_CHILD_CONCURRENCY = 4;

function makeThreeViewContactSheetDataUrl(params: Record<string, any>) {
  const style = String(params.style || 'realistic').replace(/[<>&]/g, '');
  const background = String(params.background || 'plain white').replace(/[<>&]/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <rect width="1200" height="720" fill="#f8f7f3"/>
      <rect x="58" y="54" width="1084" height="612" rx="28" fill="#ffffff" stroke="#e7e5df" stroke-width="2"/>
      <text x="92" y="110" fill="#222" font-size="28" font-family="Arial, sans-serif" font-weight="700">角色三视图</text>
      <text x="92" y="146" fill="#777" font-size="17" font-family="Arial, sans-serif">${style} · ${background} · front / side / back</text>
      ${['Front', 'Side', 'Back'].map((view, index) => {
        const x = 280 + index * 320;
        const bodyWidth = index === 1 ? 72 : 116;
        const headRx = index === 1 ? 32 : 42;
        const armOffset = index === 1 ? 34 : 72;
        const bodyColor = index === 2 ? '#6f8f72' : '#7c9b80';
        return `
          <g transform="translate(${x},176)">
            <ellipse cx="0" cy="468" rx="112" ry="16" fill="#111" opacity="0.08"/>
            <ellipse cx="0" cy="72" rx="${headRx}" ry="48" fill="#ead8c5" stroke="#d7b99d" stroke-width="3"/>
            <path d="M-${headRx + 12} 66 C-${headRx + 8} 24 -24 12 0 18 C34 20 ${headRx + 16} 42 ${headRx + 9} 92 C28 80 -20 82 -${headRx + 12} 66Z" fill="${index === 2 ? '#1f1f1f' : '#242424'}"/>
            <path d="M-${bodyWidth / 2} 142 C-${bodyWidth / 2 + 12} 248 -${bodyWidth / 2 + 22} 338 -${bodyWidth / 2 - 8} 448 L${bodyWidth / 2 + 8} 448 C${bodyWidth / 2 + 22} 338 ${bodyWidth / 2 - 12} 248 ${bodyWidth / 2} 142Z" fill="${bodyColor}" stroke="#55745c" stroke-width="4"/>
            <path d="M-${bodyWidth / 2} 160 L-${armOffset} 362" stroke="#9ab79d" stroke-width="28" stroke-linecap="round" opacity="0.72"/>
            <path d="M${bodyWidth / 2} 160 L${armOffset} 362" stroke="#9ab79d" stroke-width="28" stroke-linecap="round" opacity="0.72"/>
            ${index === 2 ? '<path d="M-42 148 C-18 168 18 168 42 148" stroke="#49664f" stroke-width="7" fill="none"/>' : ''}
            <path d="M-34 448 L-48 552" stroke="#4f604f" stroke-width="28" stroke-linecap="round"/>
            <path d="M34 448 L48 552" stroke="#4f604f" stroke-width="28" stroke-linecap="round"/>
            <text x="0" y="606" fill="#555" font-size="22" font-family="Arial, sans-serif" text-anchor="middle">${view}</text>
          </g>
        `;
      }).join('')}
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function buildOutput(scene: SceneId, params: Record<string, any>): PipelineOutput {
  const storyText = params.storyText || params.prompt || '电影级画布创作';

  if (scene === SCENES.PLOT_DEDUCTION_FOUR_GRID) {
    const storyboard = makeStoryboardShots(4, storyText);
    return {
      imageList: [
        {
          url: makeMockImageDataUrl(`剧情推演四宫格 · ${storyText}`, '#2563eb', 1),
          label: '剧情推演四宫格',
          status: 'succeeded',
        },
      ],
      structuredData: { storyboard },
    };
  }

  if (scene === SCENES.COHERENT_STORYBOARD_25) {
    const storyboard = makeStoryboardShots(25, storyText);
    return {
      imageList: [
        {
          url: makeMockImageDataUrl(`25宫格连贯分镜 · ${storyText}`, '#7c3aed', 1),
          label: '25宫格连贯分镜',
          status: 'succeeded',
        },
      ],
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
      imageList: [
        {
          url: makeThreeViewContactSheetDataUrl(params),
          label: '正 / 侧 / 背',
          status: 'succeeded',
        },
      ],
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
    imageList: [
      {
        url: makeMockImageDataUrl(`多机位九宫格 · ${storyText}`, '#db2777', 1),
        label: '多机位九宫格',
        status: 'succeeded',
      },
    ],
    structuredData: {
      multiView: {
        cameraAngles: [...MULTI_VIEW_CAMERA_LABELS],
      },
      storyboard: makeMultiViewShots(storyText),
    },
  };
}

function getSceneResultCount(scene: SceneId, output: PipelineOutput) {
  if (Array.isArray(output.imageList) && output.imageList.length > 0) return output.imageList.length;
  if (scene === SCENES.CHARACTER_THREE_VIEW_GENERATE) return 1;
  if (scene === SCENES.CINEMATIC_LIGHT_CORRECTION) return 1;
  if (scene === SCENES.FRAME_DEDUCTION_PLUS_3S || scene === SCENES.FRAME_DEDUCTION_MINUS_5S) return 1;
  if (scene === SCENES.UPSCALE) return 1;
  return 1;
}

function buildChildTasks(taskId: string, scene: SceneId, output: PipelineOutput, now: number) {
  const count = getSceneResultCount(scene, output);
  if (count <= 1) return undefined;

  return Array.from({ length: count }).map((_, index) => {
    const wave = Math.floor(index / MAX_CHILD_CONCURRENCY);
    const childStart = now + wave * 900;
    return {
      taskId: `${taskId}_child_${index + 1}`,
      index,
      status: 'pending' as const,
      progressPercent: 0,
      result: null,
      errorMessage: null,
      createdAt: childStart,
      completionAt: childStart + 1200 + (index % MAX_CHILD_CONCURRENCY) * 120,
    };
  });
}

function toPublicTaskSnapshot(task: StoredTask): TaskSnapshot {
  return {
    ...task,
    childTasks: task.childTasks?.map(({ createdAt: _createdAt, completionAt: _completionAt, ...child }) => child),
  };
}

export async function createMockTask(request: GenerationRequest): Promise<{ taskId: string }> {
  const taskId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const scene = request.params.scene as SceneId;
  const output = buildOutput(scene, request.params);
  const now = Date.now();
  const childTasks = buildChildTasks(taskId, scene, output, now);
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
    childTasks,
    maxConcurrency: childTasks ? MAX_CHILD_CONCURRENCY : undefined,
  });
  return { taskId };
}

export async function getMockTaskStatus(taskIds: string[]): Promise<TaskSnapshot[]> {
  const now = Date.now();
  return taskIds.flatMap((taskId) => {
    const task = tasks.get(taskId);
    if (!task) return [];
    if (task.status === 'cancelled') return [toPublicTaskSnapshot(task)];
    if (Array.isArray(task.childTasks) && task.childTasks.length > 0) {
      task.childTasks = task.childTasks.map((child) => {
        if (child.status === 'cancelled' || child.status === 'failed') return child;
        if (now < child.createdAt) {
          return {
            ...child,
            status: 'pending',
            progressPercent: 0,
            result: null,
          };
        }
        const progress = Math.min(100, Math.round(((now - child.createdAt) / (child.completionAt - child.createdAt)) * 100));
        return {
          ...child,
          status: progress >= 100 ? 'succeeded' : 'running',
          progressPercent: progress,
          result: progress >= 100 && task.output.imageList?.[child.index]
            ? {
              imageList: [task.output.imageList[child.index]],
              structuredData: {
                storyboard: task.output.structuredData?.storyboard?.[child.index],
              },
            }
            : null,
        };
      });
      const totalProgress = task.childTasks.reduce((sum, child) => sum + child.progressPercent, 0);
      const progress = Math.round(totalProgress / task.childTasks.length);
      const allComplete = task.childTasks.every((child) => child.status === 'succeeded');
      task.progressPercent = progress;
      task.status = allComplete ? 'succeeded' : progress < 8 ? 'pending' : 'running';
      task.result = allComplete ? task.output : null;
    } else {
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
    }
    tasks.set(taskId, task);
    return [toPublicTaskSnapshot(task)];
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
      childTasks: task.childTasks?.map((child) => (
        child.status === 'succeeded'
          ? child
          : { ...child, status: 'cancelled', errorMessage: '任务已取消' }
      )),
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
