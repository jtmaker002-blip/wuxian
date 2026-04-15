import type { GenerationRequest, PipelineOutput, SceneId, TaskSnapshot } from '../../types/scene';
import { SCENES } from '../../types/scene';
import { makeFrameDeduction, makeMockImageDataUrl, makeStoryboardShots } from './sceneAssets';

type StoredTask = TaskSnapshot & {
  createdAt: number;
  completionAt: number;
  output: PipelineOutput;
};

const tasks = new Map<string, StoredTask>();

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
        const x = 210 + index * 390;
        const bodyWidth = index === 1 ? 74 : 118;
        const headRx = index === 1 ? 34 : 42;
        return `
          <g transform="translate(${x},176)">
            <ellipse cx="0" cy="468" rx="112" ry="16" fill="#111" opacity="0.08"/>
            <ellipse cx="0" cy="72" rx="${headRx}" ry="48" fill="#ead8c5" stroke="#d7b99d" stroke-width="3"/>
            <path d="M-${headRx + 12} 66 C-${headRx + 8} 24 -24 12 0 18 C34 20 ${headRx + 16} 42 ${headRx + 9} 92 C28 80 -20 82 -${headRx + 12} 66Z" fill="#242424"/>
            <path d="M-${bodyWidth / 2} 142 C-${bodyWidth / 2 + 12} 248 -${bodyWidth / 2 + 22} 338 -${bodyWidth / 2 - 8} 448 L${bodyWidth / 2 + 8} 448 C${bodyWidth / 2 + 22} 338 ${bodyWidth / 2 - 12} 248 ${bodyWidth / 2} 142Z" fill="#7c9b80" stroke="#55745c" stroke-width="4"/>
            <path d="M-${bodyWidth / 2} 160 L-${bodyWidth / 2 + 56} 362" stroke="#9ab79d" stroke-width="28" stroke-linecap="round" opacity="0.72"/>
            <path d="M${bodyWidth / 2} 160 L${bodyWidth / 2 + 56} 362" stroke="#9ab79d" stroke-width="28" stroke-linecap="round" opacity="0.72"/>
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
      imageList: [
        {
          url: makeThreeViewContactSheetDataUrl(params),
          label: 'Front / Side / Back',
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
