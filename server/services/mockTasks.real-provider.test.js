import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateOpenAiTeachGeminiImage = vi.fn();
const mockGenerateGeminiImage = vi.fn();
const mockGenerateOpenAIImage = vi.fn();

vi.mock('./openaiteachGeminiImage.js', () => ({
  generateOpenAiTeachGeminiImage: mockGenerateOpenAiTeachGeminiImage,
}));

vi.mock('./gemini.js', () => ({
  generateGeminiImage: mockGenerateGeminiImage,
}));

vi.mock('./openai.js', () => ({
  generateOpenAIText: vi.fn(async () => ''),
  generateOpenAIImage: mockGenerateOpenAIImage,
}));

describe('mockTasks real provider routing', () => {
  let rootDir;
  let tasksDir;
  let imagesDir;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});
