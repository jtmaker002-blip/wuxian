const tasks = new Map();

function makeTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      url: `mock://${scene}/${index + 1}`,
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

export function createTask(request) {
  const taskId = makeTaskId();
  const now = Date.now();
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
    output: buildMockResult(request),
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

    const progress = Math.min(100, Math.round(((now - task.createdAt) / (task.completionAt - task.createdAt)) * 100));
    task.progressPercent = progress;
    task.status = progress >= 100 ? 'succeeded' : progress < 8 ? 'pending' : 'running';
    task.result = task.status === 'succeeded' ? task.output : null;
    tasks.set(taskId, task);
    return [task];
  });
}

export function cancelTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return false;
  task.status = 'cancelled';
  task.errorMessage = '任务已取消';
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
