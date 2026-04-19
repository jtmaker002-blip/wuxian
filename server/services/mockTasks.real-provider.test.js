import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateOpenAiTeachGeminiImage = vi.fn();
const mockGenerateGeminiImage = vi.fn();
const mockGenerateOpenAIImage = vi.fn();
const mockGenerateOpenAIText = vi.fn(async () => '');

vi.mock('./openaiteachGeminiImage.js', () => ({
  generateOpenAiTeachGeminiImage: mockGenerateOpenAiTeachGeminiImage,
}));

vi.mock('./gemini.js', () => ({
  generateGeminiImage: mockGenerateGeminiImage,
}));

vi.mock('./openai.js', () => ({
  generateOpenAIText: mockGenerateOpenAIText,
  generateOpenAIImage: mockGenerateOpenAIImage,
}));

describe('mockTasks real provider routing', () => {
  let rootDir;
  let tasksDir;
  let imagesDir;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGenerateOpenAIText.mockReset();
    mockGenerateOpenAIText.mockResolvedValue('');
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-tasks-real-provider-'));
    tasksDir = path.join(rootDir, 'tasks');
    imagesDir = path.join(rootDir, 'images');
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('uses OpenAiTeach Gemini image route for Nano Banana Pro scene tasks', async () => {
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(Buffer.from('fake-png'));
    const { createTask, getTasks } = await import('./mockTasks.js');

    const task = createTask({
      params: {
        scene: 'frame_deduction_plus_3s',
        executionMode: 'real',
        imageModel: 'gemini-3-pro-image-preview',
        providerApiKey: 'sk-hosted-token',
        imageUrl: 'data:image/png;base64,input-frame',
      },
      metadata: { node_id: 'node-1', project_id: 'project-1' },
      provider: 'openai',
      model: 'gemini-3-pro-image-preview',
      taskType: 'image',
      requestId: 'request-1',
    }, {
      TASK_SINGLE_MS: 20,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const [snapshot] = getTasks([task.taskId], {
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(expect.objectContaining({
      imageModel: 'gemini-3-pro-image-preview',
      apiKey: 'sk-hosted-token',
      imageBase64Array: ['data:image/png;base64,input-frame'],
    }));
    expect(mockGenerateGeminiImage).not.toHaveBeenCalled();
    expect(mockGenerateOpenAIImage).not.toHaveBeenCalled();
    expect(snapshot.status).toBe('succeeded');
    expect(snapshot.result.imageList[0].url).toMatch(/^\/library\/images\/scene_img_/);

    const persisted = fs.readFileSync(path.join(tasksDir, `${task.taskId}.json`), 'utf8');
    expect(persisted).toContain('gemini-3-pro-image-preview');
    expect(persisted).not.toContain('sk-hosted-token');
  });

  it('falls back to the persisted OpenAiTeach proxy session token for real scene tasks', async () => {
    const sessionFile = path.join(rootDir, 'runtime', 'openaiteach-proxy-sessions.json');
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify([
      {
        sid: 'sid-1',
        cookie: 'session=abc',
        at: Date.now(),
        userId: '362620',
        username: 'openaiteach',
      },
    ]));
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url, options) => {
      expect(String(url)).toContain('/api/token/');
      expect(options.headers.Cookie).toBe('session=abc');
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [{ id: 1, key: 'hosted-real-token', status: 1 }],
          },
        }),
      };
    });
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(Buffer.from('fake-png'));
    const { createTask, getTasks } = await import('./mockTasks.js');

    try {
      const task = createTask({
        params: {
          scene: 'character_three_view_generate',
          executionMode: 'real',
          imageModel: 'gemini-3-pro-image-preview',
          characterImageUrl: 'data:image/png;base64,character-ref',
        },
        metadata: { node_id: 'node-session-token', project_id: 'project-1' },
        provider: 'openai',
        model: 'gemini-3-pro-image-preview',
        taskType: 'image',
        requestId: 'request-session-token',
      }, {
        TASK_SINGLE_MS: 20,
        TASKS_DIR: tasksDir,
        IMAGES_DIR: imagesDir,
        OAT_PROXY_SESSION_FILE: sessionFile,
      });

      await new Promise((resolve) => setTimeout(resolve, 30));
      getTasks([task.taskId], {
        TASKS_DIR: tasksDir,
        IMAGES_DIR: imagesDir,
        OAT_PROXY_SESSION_FILE: sessionFile,
      });

      expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: 'sk-hosted-real-token',
      }));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('does not mark a slow real scene task as failed before output arrives', async () => {
    mockGenerateOpenAiTeachGeminiImage.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(Buffer.from('fake-png')), 60))
    );
    const { createTask, getTasks } = await import('./mockTasks.js');

    const task = createTask({
      params: {
        scene: 'character_three_view_generate',
        executionMode: 'real',
        imageModel: 'gemini-3-pro-image-preview',
        providerApiKey: 'sk-hosted-token',
        characterImageUrl: 'data:image/png;base64,character-ref',
      },
      metadata: { node_id: 'node-slow-real', project_id: 'project-1' },
      provider: 'openai',
      model: 'gemini-3-pro-image-preview',
      taskType: 'image',
      requestId: 'request-slow-real',
    }, {
      TASK_SINGLE_MS: 20,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const [before] = getTasks([task.taskId], {
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });
    expect(before.status).toBe('running');
    expect(before.errorMessage).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 60));
    const [after] = getTasks([task.taskId], {
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });
    expect(after.status).toBe('succeeded');
    expect(after.result?.imageList).toHaveLength(1);
  });

  it('sends the three-view reference prompt as one finished contact-sheet request', async () => {
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(Buffer.from('fake-png'));
    const { createTask, getTasks } = await import('./mockTasks.js');

    const task = createTask({
      params: {
        scene: 'character_three_view_generate',
        executionMode: 'real',
        imageModel: 'gemini-3-pro-image-preview',
        providerApiKey: 'sk-hosted-token',
        characterImageUrl: 'data:image/png;base64,character-ref',
        prompt: '古风女性角色',
      },
      metadata: { node_id: 'node-three-view', project_id: 'project-1' },
      provider: 'openai',
      model: 'gemini-3-pro-image-preview',
      taskType: 'image',
      requestId: 'request-three-view',
    }, {
      TASK_SINGLE_MS: 20,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const [snapshot] = getTasks([task.taskId], {
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledWith(expect.objectContaining({
      imageBase64Array: ['data:image/png;base64,character-ref'],
      prompt: expect.stringContaining('front view'),
    }));
    const call = mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0];
    expect(call.prompt).toContain('side profile view');
    expect(call.prompt).toContain('back view');
    expect(call.prompt).toContain('full-body');
    expect(call.prompt).toContain('same character');
    expect(snapshot.status).toBe('succeeded');
    expect(snapshot.result.imageList).toHaveLength(1);
  });

  it('executes storyboard planning before prompt building and image generation for four-grid real mode', async () => {
    mockGenerateOpenAIText.mockResolvedValue(JSON.stringify({
      styleAnchor: 'cinematic realistic',
      characterBible: { mainCharacters: [{ id: 'hero', name: '主角', appearance: 'green robe', outfit: 'green robe', temperament: 'calm' }] },
      worldBible: { worldName: 'test world', environmentStyle: 'realistic' },
      storyboard: [1, 2, 3, 4].map((shotNumber) => ({
        shotNumber,
        plotDescription: `planned beat ${shotNumber}`,
        imageGenerationPrompt: `planned image prompt ${shotNumber}`,
        characterAction: `planned action ${shotNumber}`,
        lightingAndAtmosphere: `planned lighting ${shotNumber}`,
      })),
    }));
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(Buffer.from('fake-png'));
    const { createTask, getTasks } = await import('./mockTasks.js');

    const task = createTask({
      params: {
        scene: 'plot_deduction_four_grid',
        executionMode: 'real',
        imageModel: 'gemini-3-pro-image-preview',
        providerApiKey: 'sk-hosted-token',
        storyText: '角色发现线索',
        referenceImages: ['data:image/png;base64,ref-a'],
      },
      metadata: { node_id: 'node-four-grid', project_id: 'project-1' },
      provider: 'mock',
      model: 'mock-scene-pipeline',
      taskType: 'image',
      requestId: 'request-four-grid',
    }, {
      TASK_CHILD_WAVE_MS: 1,
      TASK_CHILD_DURATION_MS: 1,
      TASK_CHILD_STAGGER_MS: 1,
      TASK_SINGLE_MS: 20,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const [snapshot] = getTasks([task.taskId], {
      TASK_CHILD_WAVE_MS: 1,
      TASK_CHILD_DURATION_MS: 1,
      TASK_CHILD_STAGGER_MS: 1,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    expect(mockGenerateOpenAIText).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpenAIText.mock.calls[0][0].messages[1].content).toContain('Plan four panels');
    expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0]).toMatchObject({
      imageModel: 'gemini-3-pro-image-preview',
      apiKey: 'sk-hosted-token',
      imageBase64Array: ['data:image/png;base64,ref-a'],
    });
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('Create one single 2x2 cinematic storyboard sheet');
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('planned beat 1');
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('planned beat 4');
    expect(snapshot.status).toBe('succeeded');
    expect(snapshot.result.imageList).toHaveLength(1);
    expect(snapshot.result.structuredData.executionMode).toBe('real');
    expect(snapshot.result.structuredData.storyboard[0].imageGenerationPrompt).toBe('planned image prompt 1');
  });

  it('plans nine-grid real mode but generates one built-in camera-grid sheet prompt', async () => {
    mockGenerateOpenAIText.mockResolvedValue(JSON.stringify({
      styleAnchor: 'same moment',
      storyboard: Array.from({ length: 9 }).map((_, index) => ({
        shotNumber: index + 1,
        plotDescription: `shared continuity beat ${index + 1}`,
        lightingAndAtmosphere: 'same neon street light',
        imageGenerationPrompt: `planner prompt ${index + 1}`,
      })),
    }));
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(Buffer.from('fake-png'));
    const { createTask, getTasks } = await import('./mockTasks.js');

    const task = createTask({
      params: {
        scene: 'multi_view_nine_grid',
        executionMode: 'real',
        imageModel: 'gemini-3-pro-image-preview',
        providerApiKey: 'sk-hosted-token',
        imageUrl: 'data:image/png;base64,source',
        prompt: '同一人物站在香港街头',
      },
      metadata: { node_id: 'node-nine-grid', project_id: 'project-1' },
      provider: 'mock',
      model: 'mock-scene-pipeline',
      taskType: 'image',
      requestId: 'request-nine-grid',
    }, {
      TASK_CHILD_WAVE_MS: 1,
      TASK_CHILD_DURATION_MS: 1,
      TASK_CHILD_STAGGER_MS: 1,
      TASK_SINGLE_MS: 20,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const [snapshot] = getTasks([task.taskId], {
      TASK_CHILD_WAVE_MS: 1,
      TASK_CHILD_DURATION_MS: 1,
      TASK_CHILD_STAGGER_MS: 1,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    expect(mockGenerateOpenAIText).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpenAIText.mock.calls[0][0].messages[1].content).toContain('multi-camera');
    expect(mockGenerateOpenAiTeachGeminiImage).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('front establishing wide');
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('rear camera angle');
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('macro/detail insert');
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('shared continuity beat 1');
    expect(mockGenerateOpenAiTeachGeminiImage.mock.calls[0][0].prompt).toContain('ONE finished image only');
    expect(snapshot.status).toBe('succeeded');
    expect(snapshot.result.imageList).toHaveLength(1);
  });

  it('fails real storyboard tasks instead of returning mock images when planning fails', async () => {
    mockGenerateOpenAIText.mockResolvedValue('');
    mockGenerateOpenAiTeachGeminiImage.mockResolvedValue(Buffer.from('fake-png'));
    const { createTask, getTasks } = await import('./mockTasks.js');

    const task = createTask({
      params: {
        scene: 'coherent_storyboard_25',
        executionMode: 'real',
        imageModel: 'gemini-3-pro-image-preview',
        providerApiKey: 'sk-hosted-token',
        storyText: '规划失败场景',
      },
      metadata: { node_id: 'node-25-grid', project_id: 'project-1' },
      provider: 'mock',
      model: 'mock-scene-pipeline',
      taskType: 'image',
      requestId: 'request-25-grid',
    }, {
      TASK_CHILD_WAVE_MS: 1,
      TASK_CHILD_DURATION_MS: 1,
      TASK_CHILD_STAGGER_MS: 1,
      TASK_SINGLE_MS: 20,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const [snapshot] = getTasks([task.taskId], {
      TASK_CHILD_WAVE_MS: 1,
      TASK_CHILD_DURATION_MS: 1,
      TASK_CHILD_STAGGER_MS: 1,
      TASKS_DIR: tasksDir,
      IMAGES_DIR: imagesDir,
    });

    expect(mockGenerateOpenAIText).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpenAiTeachGeminiImage).not.toHaveBeenCalled();
    expect(snapshot.status).toBe('failed');
    expect(snapshot.result).toBeNull();
    expect(snapshot.errorMessage).toContain('storyboard');
  });
});
