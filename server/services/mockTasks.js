const tasks = new Map();
const MAX_CHILD_CONCURRENCY = 4;

function makeTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function buildMockResult(request) {
  const scene = request?.params?.scene || 'mock_scene';
  const count =
    scene === 'coherent_storyboard_25' ? 25 :
    scene === 'plot_deduction_four_grid' ? 4 :
    scene === 'character_three_view_generate' ? 3 :
    scene === 'multi_view_nine_grid' ? 9 :
    1;

  return {
    textList: [`${scene} mock task completed`],
    imageList: Array.from({ length: count }).map((_, index) => ({
      url: makeMockImageDataUrl(`${scene} · Result ${index + 1}`, scene === 'coherent_storyboard_25' ? '#7c3aed' : '#2563eb', index + 1),
      width: 960,
      height: 540,
      label: `Result ${index + 1}`,
      status: 'succeeded',
    })),
    structuredData: {
      scene,
      requestId: request?.requestId,
      storyboard: count > 1
        ? Array.from({ length: count }).map((_, index) => ({
          shotNumber: index + 1,
          plotDescription: `${scene} shot ${index + 1}`,
          emotion: index % 2 === 0 ? 'calm' : 'tense',
          sceneTags: 'cinematic, coherent',
          lightingAndAtmosphere: 'film lighting',
          imageGenerationPrompt: `Generate ${scene} shot ${index + 1}`,
        }))
        : undefined,
    },
  };
}

function buildChildTasks(parentTaskId, request, count, now) {
  if (count <= 1) return [];
  return Array.from({ length: count }).map((_, index) => {
    const wave = Math.floor(index / MAX_CHILD_CONCURRENCY);
    const childStart = now + wave * 550;
    return {
      taskId: `${parentTaskId}_child_${index + 1}`,
      requestId: `${request?.requestId || parentTaskId}_child_${index + 1}`,
      index,
      status: 'pending',
      progressPercent: 0,
      createdAt: childStart,
      completionAt: childStart + 1100 + (index % MAX_CHILD_CONCURRENCY) * 150,
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
      result: progress >= 100
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

export function createTask(request) {
  const taskId = makeTaskId();
  const now = Date.now();
  const output = buildMockResult(request);
  const childTasks = buildChildTasks(taskId, request, output.imageList?.length || 0, now);
  const task = {
    taskId,
    requestId: request?.requestId || taskId,
    request,
    createdAt: now,
    completionAt: now + 2000,
    status: 'pending',
    progressPercent: 0,
    result: null,
    errorMessage: null,
    output,
    childTasks,
    maxConcurrency: childTasks.length > 0 ? MAX_CHILD_CONCURRENCY : undefined,
  };
  tasks.set(taskId, task);
  return task;
}

export function getTasks(taskIds) {
  const now = Date.now();
  return taskIds.flatMap((taskId) => {
    const task = tasks.get(taskId);
    if (!task) return [];
    if (task.status === 'cancelled' || task.status === 'failed') return [task];

    task.childTasks = updateChildTasks(task, now);
    if (task.childTasks.length > 0) {
      const childProgressTotal = task.childTasks.reduce((sum, child) => sum + child.progressPercent, 0);
      const progress = Math.round(childProgressTotal / task.childTasks.length);
      const allComplete = task.childTasks.every((child) => child.status === 'succeeded');
      task.progressPercent = progress;
      task.status = allComplete ? 'succeeded' : progress < 8 ? 'pending' : 'running';
      task.result = allComplete ? task.output : null;
    } else {
      const progress = Math.min(100, Math.round(((now - task.createdAt) / (task.completionAt - task.createdAt)) * 100));
      task.progressPercent = progress;
      task.status = progress >= 100 ? 'succeeded' : progress < 8 ? 'pending' : 'running';
      task.result = task.status === 'succeeded' ? task.output : null;
    }
    tasks.set(taskId, task);
    return [task];
  });
}

export function cancelTask(taskId) {
  const task = tasks.get(taskId);
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
