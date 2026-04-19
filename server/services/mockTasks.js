import { generateOpenAIImage, generateOpenAIText } from './openai.js';
import { generateGeminiImage } from './gemini.js';
import { generateOpenAiTeachGeminiImage } from './openaiteachGeminiImage.js';
import { buildSceneImagePrompts, buildStoryboardPlannerPrompt } from './scenePromptTemplates.js';
import { detectImageExtensionFromBuffer, resolveImageToBase64, saveBufferToFile } from '../utils/imageHelpers.js';
import { resolveRuntimePaths } from '../runtime-paths.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const tasks = new Map();
const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_CHILD_CONCURRENCY = 4;
const NANO_BANANA_PRO_MODEL = 'gemini-3-pro-image-preview';
const MULTI_VIEW_CAMERA_LABELS = [
  'LS',
  'MLS',
  'MS',
  'MCU',
  'CU',
  'ECU',
  'High-Angle',
  'Low-Angle',
  'OTS',
];
const DEFAULT_TIMING = {
  childWaveMs: 1800,
  childDurationMs: 1100,
  childStaggerMs: 120,
  singleTaskMs: 2000,
};

function getTiming(runtime = {}) {
  return {
    childWaveMs: Number(runtime.TASK_CHILD_WAVE_MS || process.env.TWITCANVA_TASK_CHILD_WAVE_MS) || DEFAULT_TIMING.childWaveMs,
    childDurationMs: Number(runtime.TASK_CHILD_DURATION_MS || process.env.TWITCANVA_TASK_CHILD_DURATION_MS) || DEFAULT_TIMING.childDurationMs,
    childStaggerMs: Number(runtime.TASK_CHILD_STAGGER_MS || process.env.TWITCANVA_TASK_CHILD_STAGGER_MS) || DEFAULT_TIMING.childStaggerMs,
    singleTaskMs: Number(runtime.TASK_SINGLE_MS || process.env.TWITCANVA_TASK_SINGLE_MS) || DEFAULT_TIMING.singleTaskMs,
  };
}

function makeTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isSafeTaskId(taskId) {
  return typeof taskId === 'string' && /^[A-Za-z0-9_-]+$/.test(taskId);
}

function getTasksDir(runtime = {}) {
  const dir = runtime.TASKS_DIR;
  if (!dir) return null;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function taskFilePath(taskId, runtime = {}) {
  if (!isSafeTaskId(taskId)) return null;
  const dir = getTasksDir(runtime);
  if (!dir) return null;
  return path.join(dir, `${taskId}.json`);
}

function persistTask(task, runtime = {}) {
  const filePath = taskFilePath(task.taskId, runtime);
  if (!filePath) return;
  fs.writeFileSync(filePath, JSON.stringify(redactTaskForStorage(task), null, 2));
}

function loadTask(taskId, runtime = {}) {
  const existing = tasks.get(taskId);
  if (existing) return existing;
  const filePath = taskFilePath(taskId, runtime);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const task = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  tasks.set(taskId, task);
  return task;
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/apiKey|providerApiKey|token|secret|authorization/i.test(key)) {
      return [key, '[REDACTED]'];
    }
    return [key, redactSecrets(entry)];
  }));
}

function redactTaskForStorage(task) {
  return redactSecrets(task);
}

function normalizeHostedToken(raw) {
  const value = String(raw || '').trim().replace(/^Bearer\s+/i, '');
  if (!value || value.includes('*')) return '';
  return value.startsWith('sk-') ? value : `sk-${value}`;
}

function findTokenItems(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload;
  for (const key of ['items', 'list', 'records', 'rows', 'tokens', 'keys', 'data']) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = findTokenItems(value);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

async function resolveOpenAiTeachProxyToken(runtime = {}) {
  const sessionFile = runtime.OAT_PROXY_SESSION_FILE || resolveRuntimePaths({ serverDir: SERVER_DIR }).proxySessionStoreFile;
  if (!sessionFile || !fs.existsSync(sessionFile)) return '';

  let sessions;
  try {
    sessions = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  } catch {
    return '';
  }
  if (!Array.isArray(sessions) || sessions.length === 0) return '';

  const latest = sessions
    .filter((session) => session?.sid && session?.cookie)
    .sort((a, b) => Number(b.at || 0) - Number(a.at || 0))[0];
  if (!latest) return '';

  const upstream = await fetch('https://openaiteach.com/api/token/?p=0&size=100', {
    method: 'GET',
    headers: {
      Cookie: latest.cookie,
      'User-Agent': 'TwitCanva-OpenAiTeach-Proxy/1.0',
      ...(latest.userId ? { 'New-Api-User': latest.userId } : latest.username ? { 'New-Api-User': latest.username } : {}),
    },
  });
  if (!upstream.ok) return '';
  const payload = await upstream.json().catch(() => null);
  const items = findTokenItems(payload);
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const token = normalizeHostedToken(item.key || item.token || item.value || item.api_key || item.apiKey || item.sk);
    if (token) return token;
  }
  return '';
}

function getSceneResultCount(scene, params = {}) {
  if (typeof params.gridItemIndex === 'number') return 1;
  return 1;
}

function getScenePlanningCount(scene) {
  return scene === 'coherent_storyboard_25' ? 25 :
    scene === 'plot_deduction_four_grid' ? 4 :
    scene === 'multi_view_nine_grid' ? 9 :
    1;
}

function makeMockImageDataUrl(label, accent = '#3b82f6', index = 1) {
  const safeLabel = String(label || 'Mock Result').replace(/[<>&]/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#111827"/>
          <stop offset="0.6" stop-color="#1f2937"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="960" height="540" fill="url(#bg)"/>
      <circle cx="720" cy="120" r="180" fill="#ffffff" opacity="0.12"/>
      <text x="54" y="84" fill="#fff" font-size="30" font-family="Arial, sans-serif" font-weight="700">Liblib Task Result</text>
      <text x="54" y="132" fill="#e5e7eb" font-size="22" font-family="Arial, sans-serif">${safeLabel}</text>
      <text x="54" y="488" fill="#fff" font-size="72" font-family="Arial, sans-serif" font-weight="800">${String(index).padStart(2, '0')}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function makeThreeViewMockDataUrl(params = {}) {
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
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function buildStoryboard(count, scene, storyText = '电影级画布创作') {
  return Array.from({ length: count }).map((_, index) => ({
    shotNumber: index + 1,
    durationSeconds: count > 4 ? 4 : 6,
    plotDescription: `${storyText} · ${scene} shot ${index + 1}`,
    shotSize: index % 3 === 0 ? 'wide shot' : index % 3 === 1 ? 'medium shot' : 'close-up',
    characterAction: index % 2 === 0 ? '角色向前推进' : '角色停下观察环境',
    emotion: index % 2 === 0 ? '克制坚定' : '紧张期待',
    sceneTags: index % 2 === 0 ? 'cinematic, exterior, depth' : 'cinematic, interior, low key',
    lightingAndAtmosphere: index % 2 === 0 ? '暖色主光，空气透视' : '冷色边缘光，暗部保留',
    imageGenerationPrompt: `Generate ${scene} shot ${index + 1}: ${storyText}`,
    videoMotionPrompt: `Camera motion for ${scene} shot ${index + 1}`,
  }));
}

function buildMultiViewStoryboard(storyText = '同一场景的多机位变化') {
  return MULTI_VIEW_CAMERA_LABELS.map((label, index) => ({
    shotNumber: index + 1,
    durationSeconds: 4,
    plotDescription: `${storyText} · ${label}`,
    shotSize: label,
    characterAction: '保持主体动作与时间点一致，仅切换镜头语言',
    emotion: '稳定',
    lightingAndAtmosphere: '保持与参考图一致',
    imageGenerationPrompt: `same scene, same subject, ${label} camera framing, cinematic still`,
  }));
}

function buildFrameDeduction(scene) {
  const isFuture = scene === 'frame_deduction_plus_3s';
  return {
    motionDelta: isFuture ? '主体向画面右前方推进约 3 秒' : '主体回到 5 秒前的起始姿态',
    cameraDelta: isFuture ? '镜头轻微推近并降低机位' : '镜头回拉，恢复更宽的环境视野',
    environmentDelta: isFuture ? '背景光源增强，空气尘埃更明显' : '环境动态更安静，运动模糊减少',
    targetFramePrompt: isFuture
      ? 'future keyframe, 3 seconds later, cinematic continuity'
      : 'previous keyframe, 5 seconds earlier, cinematic continuity',
  };
}

function buildStructuredSceneData(scene, request, count) {
  const params = request?.params || {};
  const storyText = params.storyText || params.prompt || '电影级画布创作';
  const base = {
    scene,
    requestId: request?.requestId,
  };

  if (scene === 'plot_deduction_four_grid') {
    return {
      ...base,
      storyboard: buildStoryboard(4, scene, storyText),
    };
  }

  if (scene === 'coherent_storyboard_25') {
    return {
      ...base,
      storyboard: buildStoryboard(25, scene, storyText),
      characterBible: {
        mainCharacters: [
          {
            id: 'hero',
            name: '主角',
            appearance: '清晰轮廓、稳定发型、可跨镜头保持一致',
            outfit: '深色电影感外套',
            temperament: '克制、坚定',
            referenceImages: params.referenceImages || [],
          },
        ],
      },
      worldBible: {
        worldName: '连贯分镜世界',
        era: 'near future',
        environmentStyle: params.visualStyle || 'cinematic realistic',
        colorPalette: ['deep blue', 'warm amber', 'soft gray'],
        recurringLocations: ['主场景', '转场空间', '结尾场景'],
      },
    };
  }

  if (scene === 'character_three_view_generate') {
    return {
      ...base,
      characterProfile: {
        style: params.style || 'realistic',
        background: params.background || 'plain',
        keepCostumeConsistency: params.keepCostumeConsistency !== false,
        sourceImageUrl: params.characterImageUrl || '',
      },
      views: ['front', 'side', 'back'],
    };
  }

  if (scene === 'frame_deduction_plus_3s' || scene === 'frame_deduction_minus_5s') {
    return {
      ...base,
      frameDeduction: buildFrameDeduction(scene),
    };
  }

  if (scene === 'cinematic_light_correction') {
    return {
      ...base,
      lightingRequest: {
        originImage: params.originImage || '',
        width: params.width,
        height: params.height,
        UI_KeyLight: params.keyLight || 'front',
        UI_RimLight: params.rimLightEnabled ?? true,
        UI_LightColor: params.lightColor || 'neutral',
        UI_LightBrightness: params.brightness ?? 55,
        prompt: params.prompt || '',
        Reference_Image_Intent: params.referenceImage || '',
      },
    };
  }

  if (scene === 'upscale') {
    return {
      ...base,
      upscale: {
        imageUrl: params.imageUrl || '',
        targetResolution: params.targetResolution || '2x',
        detailMode: params.detailMode || 'cinematic',
      },
    };
  }

  return {
    ...base,
    multiView: {
      cameraAngles: [...MULTI_VIEW_CAMERA_LABELS],
      ratio: params.ratio || '16:9',
    },
    storyboard: count > 1 ? buildMultiViewStoryboard(storyText) : undefined,
  };
}

function shouldUseRealProvider(request, runtime = {}) {
  void runtime;
  return (
    request?.provider === 'openai' ||
    request?.params?.executionMode === 'real' ||
    request?.params?.providerMode === 'real'
  );
}

function extractJsonObject(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function generateStoryboardPlan({ scene, count, params, runtime }) {
  const proxyToken = params.providerApiKey ? '' : await resolveOpenAiTeachProxyToken(runtime);
  const hostedApiKey = params.providerApiKey || proxyToken;
  const apiKey = hostedApiKey || runtime.OPENAI_API_KEY;
  const baseUrl = params.providerBaseUrl || (hostedApiKey ? 'https://openaiteach.com/v1' : undefined);
  if (!apiKey) return null;

  const prompt = buildStoryboardPlannerPrompt({ scene, count, params });

  const text = await generateOpenAIText({
    apiKey,
    baseUrl,
    model: params.textModel || 'gpt-4o-mini',
    temperature: 0.65,
    maxTokens: count > 10 ? 8192 : 4096,
    messages: [
      { role: 'system', content: 'You are a professional film storyboard planner. Return strict JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  const parsed = extractJsonObject(text);
  if (!parsed) return null;
  const storyboard = Array.isArray(parsed.storyboard) ? parsed.storyboard : Array.isArray(parsed.scenes) ? parsed.scenes : [];
  return {
    ...parsed,
    storyboard: storyboard.slice(0, count).map((shot, index) => ({
      shotNumber: shot.shotNumber || shot.sceneNumber || index + 1,
      durationSeconds: shot.durationSeconds || 4,
      plotDescription: shot.plotDescription || shot.description || `Shot ${index + 1}`,
      shotSize: shot.shotSize || shot.cameraAngle || 'medium shot',
      characterAction: shot.characterAction || '',
      emotion: shot.emotion || shot.mood || '',
      sceneTags: shot.sceneTags || '',
      lightingAndAtmosphere: shot.lightingAndAtmosphere || shot.lighting || '',
      imageGenerationPrompt: shot.imageGenerationPrompt || shot.description || `cinematic shot ${index + 1}`,
      videoMotionPrompt: shot.videoMotionPrompt || shot.cameraMovement || '',
    })),
  };
}

async function generateRealImages({ prompts, params, runtime }) {
  const proxyToken = params.providerApiKey ? '' : await resolveOpenAiTeachProxyToken(runtime);
  const hostedApiKey = params.providerApiKey || proxyToken;
  const apiKey = hostedApiKey || runtime.OPENAI_API_KEY;
  const baseUrl = params.providerBaseUrl || (hostedApiKey ? 'https://openaiteach.com/v1' : undefined);
  const imageModel = params.imageModel || NANO_BANANA_PRO_MODEL;
  const usesGeminiImageModel = String(imageModel).startsWith('gemini-');
  const geminiApiKey = hostedApiKey || runtime.GEMINI_API_KEY;
  if ((!apiKey && !geminiApiKey) || !runtime.IMAGES_DIR) return null;

  const imageInputs = collectSceneImageInputs(params);
  const urls = [];
  for (let index = 0; index < prompts.length; index += 1) {
    const buffer = usesGeminiImageModel && hostedApiKey
      ? await generateOpenAiTeachGeminiImage({
        prompt: prompts[index],
        imageBase64Array: imageInputs,
        imageModel,
        apiKey: hostedApiKey,
        baseUrl,
      })
      : usesGeminiImageModel
        ? await generateGeminiImage({
          prompt: prompts[index],
          imageBase64Array: imageInputs,
          aspectRatio: params.ratio || params.aspectRatio || '16:9',
          resolution: params.resolution || '1K',
          imageModel,
          apiKey: geminiApiKey,
        })
        : await generateOpenAIImage({
          prompt: prompts[index],
          imageBase64Array: imageInputs,
          aspectRatio: params.ratio || params.aspectRatio || '16:9',
          resolution: params.resolution || '1K',
          imageModel,
          apiKey,
          baseUrl,
        });
    const ext = detectImageExtensionFromBuffer(buffer, 'png');
    const saved = saveBufferToFile(buffer, runtime.IMAGES_DIR, 'scene_img', ext);
    urls.push(saved.url);
  }
  return urls;
}

function collectSceneImageInputs(params = {}) {
  const candidates = [
    params.imageUrl,
    params.characterImageUrl,
    params.originImage,
    params.referenceImage,
    ...(Array.isArray(params.referenceImages) ? params.referenceImages : []),
    ...(Array.isArray(params.imageBase64Array) ? params.imageBase64Array : []),
  ].filter(Boolean);

  const seen = new Set();
  return candidates
    .map((candidate) => resolveImageToBase64(candidate))
    .filter(Boolean)
    .filter((dataUrl) => {
      if (seen.has(dataUrl)) return false;
      seen.add(dataUrl);
      return true;
    });
}

function buildMockResult(request, extraStructuredData = {}) {
  const scene = request?.params?.scene || 'mock_scene';
  const count = getSceneResultCount(scene, request?.params || {});
  const startIndex = typeof request?.params?.gridItemIndex === 'number' ? request.params.gridItemIndex : 0;
  const labels =
    scene === 'multi_view_nine_grid'
      ? (typeof request?.params?.gridItemIndex === 'number' ? MULTI_VIEW_CAMERA_LABELS : count === 1 ? ['多机位九宫格'] : MULTI_VIEW_CAMERA_LABELS)
    : scene === 'plot_deduction_four_grid'
      ? (typeof request?.params?.gridItemIndex === 'number' ? [`剧情 ${startIndex + 1}`] : count === 1 ? ['剧情推演四宫格'] : Array.from({ length: count }, (_, index) => `剧情 ${startIndex + index + 1}`))
    : scene === 'coherent_storyboard_25'
        ? (typeof request?.params?.gridItemIndex === 'number' ? [`Shot ${startIndex + 1}`] : count === 1 ? ['25宫格连贯分镜'] : Array.from({ length: count }, (_, index) => `Shot ${startIndex + index + 1}`))
          : [];
  const getLabel = (index) => (
    scene === 'multi_view_nine_grid'
      ? labels[startIndex + index]
      : labels[index]
  );

  return {
    textList: [`${scene} mock task completed`],
    imageList: Array.from({ length: count }).map((_, index) => ({
      url: scene === 'character_three_view_generate'
        ? makeThreeViewMockDataUrl(request?.params || {})
        : makeMockImageDataUrl(
          getLabel(index) ? `${scene} · ${getLabel(index)}` : `${scene} · Result ${startIndex + index + 1}`,
          scene === 'coherent_storyboard_25' ? '#7c3aed' : scene === 'multi_view_nine_grid' ? '#db2777' : '#2563eb',
          startIndex + index + 1
        ),
      width: 960,
      height: 540,
      label: scene === 'character_three_view_generate' ? '正 / 侧 / 背' : getLabel(index) || `Result ${startIndex + index + 1}`,
      status: 'succeeded',
    })),
    structuredData: {
      ...buildStructuredSceneData(scene, request, count),
      ...extraStructuredData,
    },
  };
}

async function buildTaskOutput(request, runtime = {}) {
  const scene = request?.params?.scene || 'mock_scene';
  const params = request?.params || {};
  const count = getSceneResultCount(scene, params);

  if (!shouldUseRealProvider(request, runtime)) {
    return buildMockResult(request);
  }

  try {
    const planningCount = getScenePlanningCount(scene);
    const requiresStoryboardPlan = planningCount > 1;
    const plan = requiresStoryboardPlan
      ? await generateStoryboardPlan({ scene, count: planningCount, params, runtime })
      : null;
    if (requiresStoryboardPlan && !plan) {
      throw new Error('真实 storyboard 规划失败或缺少 OPENAI_API_KEY / 文本模型凭证。');
    }
    const storyboard = plan?.storyboard;
    const prompts = buildSceneImagePrompts({ scene, params, count, storyboard });
    const realImageUrls = await generateRealImages({ prompts, params, runtime });
    if (!realImageUrls) {
      throw new Error('真实图片服务缺少 OPENAI_API_KEY / GEMINI_API_KEY 或 IMAGES_DIR。');
    }

    const structuredBase = buildStructuredSceneData(scene, request, count);
    return {
      textList: [`${scene} real provider task completed`],
      imageList: realImageUrls.map((url, index) => ({
        url,
        width: 960,
        height: 540,
        label: scene === 'character_three_view_generate'
          ? '正 / 侧 / 背'
          : scene === 'multi_view_nine_grid'
            ? MULTI_VIEW_CAMERA_LABELS[index] || `Angle ${index + 1}`
            : scene === 'plot_deduction_four_grid'
              ? `剧情 ${index + 1}`
              : scene === 'coherent_storyboard_25'
                ? `Shot ${index + 1}`
                : `Result ${index + 1}`,
        status: 'succeeded',
      })),
      structuredData: {
        ...structuredBase,
        executionMode: 'real',
        imageModel: params.imageModel || NANO_BANANA_PRO_MODEL,
        styleAnchor: plan?.styleAnchor,
        characterBible: plan?.characterBible || structuredBase.characterBible,
        worldBible: plan?.worldBible || structuredBase.worldBible,
        storyboard: storyboard || structuredBase.storyboard,
      },
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '真实服务执行失败。');
  }
}

function buildChildTasks(parentTaskId, request, count, now, timing = DEFAULT_TIMING) {
  if (count <= 1) return [];
  return Array.from({ length: count }).map((_, index) => {
    const wave = Math.floor(index / MAX_CHILD_CONCURRENCY);
    const childStart = now + wave * timing.childWaveMs;
    return {
      taskId: `${parentTaskId}_child_${index + 1}`,
      requestId: `${request?.requestId || parentTaskId}_child_${index + 1}`,
      index,
      status: 'pending',
      progressPercent: 0,
      createdAt: childStart,
      completionAt: childStart + timing.childDurationMs + (index % MAX_CHILD_CONCURRENCY) * timing.childStaggerMs,
      result: null,
      errorMessage: null,
    };
  });
}

function updateChildTasks(task, now) {
  if (!Array.isArray(task.childTasks) || task.childTasks.length === 0) return [];

  return task.childTasks.map((child) => {
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
      result: progress >= 100 && task.output?.imageList?.[child.index]
        ? {
          imageList: [task.output.imageList[child.index]],
          structuredData: {
            storyboard: task.output.structuredData?.storyboard?.[child.index],
          },
        }
        : null,
    };
  });
}

async function executeTask(taskId, request, runtime) {
  try {
    const output = await buildTaskOutput(request, runtime);
    const task = tasks.get(taskId);
    if (!task || task.status === 'cancelled') return;
    const nextTask = {
      ...task,
      status: Array.isArray(task.childTasks) && task.childTasks.length > 0 ? task.status : 'succeeded',
      progressPercent: Array.isArray(task.childTasks) && task.childTasks.length > 0 ? task.progressPercent : 100,
      result: Array.isArray(task.childTasks) && task.childTasks.length > 0 ? task.result : output,
      errorMessage: null,
      output,
    };
    tasks.set(taskId, nextTask);
    persistTask(nextTask, runtime);
  } catch (error) {
    const task = tasks.get(taskId);
    if (!task || task.status === 'cancelled') return;
    const nextTask = {
      ...task,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : '任务执行失败',
    };
    tasks.set(taskId, nextTask);
    persistTask(nextTask, runtime);
  }
}

export function createTask(request, runtime = {}) {
  const taskId = makeTaskId();
  const now = Date.now();
  const scene = request?.params?.scene || 'mock_scene';
  const timing = getTiming(runtime);
  const childTasks = buildChildTasks(taskId, request, getSceneResultCount(scene, request?.params || {}), now, timing);
  const task = {
    taskId,
    requestId: request?.requestId || taskId,
    request,
    createdAt: now,
    completionAt: now + timing.singleTaskMs,
    status: 'pending',
    progressPercent: 0,
    result: null,
    errorMessage: null,
    output: null,
    childTasks,
    maxConcurrency: childTasks.length > 0 ? MAX_CHILD_CONCURRENCY : undefined,
  };
  tasks.set(taskId, task);
  persistTask(task, runtime);
  void executeTask(taskId, request, runtime);
  return task;
}

export function getTasks(taskIds, runtime = {}) {
  const now = Date.now();
  return taskIds.flatMap((taskId) => {
    const task = loadTask(taskId, runtime);
    if (!task) return [];
    if (task.status === 'succeeded' && !task.result && !task.output) {
      task.status = 'failed';
      task.errorMessage = '任务快照缺少结果，请重新运行该节点。';
      tasks.set(taskId, task);
      persistTask(task, runtime);
      return [task];
    }
    if (task.status === 'cancelled' || task.status === 'failed' || task.status === 'succeeded') return [task];

    task.childTasks = updateChildTasks(task, now);
    if (task.childTasks.length > 0) {
      const childProgressTotal = task.childTasks.reduce((sum, child) => sum + child.progressPercent, 0);
      const progress = Math.round(childProgressTotal / task.childTasks.length);
      const allComplete = task.childTasks.every((child) => child.status === 'succeeded');
      task.progressPercent = progress;
      task.status = allComplete && task.output ? 'succeeded' : progress < 8 ? 'pending' : 'running';
      task.errorMessage = allComplete && task.output ? null : task.errorMessage;
      task.result = allComplete && task.output ? task.output : null;
    } else {
      const progress = Math.min(100, Math.round(((now - task.createdAt) / (task.completionAt - task.createdAt)) * 100));
      task.progressPercent = progress >= 100 && !task.output ? 99 : progress;
      task.status = progress >= 100 && task.output ? 'succeeded' : progress < 8 ? 'pending' : 'running';
      task.errorMessage = progress >= 100 && task.output ? null : task.errorMessage;
      task.result = task.status === 'succeeded' ? task.output : null;
    }
    tasks.set(taskId, task);
    persistTask(task, runtime);
    return [task];
  });
}

export function cancelTask(taskId, runtime = {}) {
  const task = loadTask(taskId, runtime);
  if (!task) return false;
  task.status = 'cancelled';
  task.errorMessage = '任务已取消';
  if (Array.isArray(task.childTasks)) {
    task.childTasks = task.childTasks.map((child) => (
      child.status === 'succeeded'
        ? child
        : { ...child, status: 'cancelled', errorMessage: '任务已取消' }
    ));
  }
  tasks.set(taskId, task);
  persistTask(task, runtime);
  return true;
}

export function estimateCost(request) {
  const scene = request?.params?.scene;
  if (scene === 'coherent_storyboard_25') return 350;
  if (scene === 'multi_view_nine_grid') return 126;
  if (scene === 'plot_deduction_four_grid') return 64;
  if (scene === 'character_three_view_generate') return 42;
  return 14;
}
