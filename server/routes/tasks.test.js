import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import tasksRouter from './tasks.js';

let rootDir;
let tasksDir;

async function createServer() {
  const app = express();
  app.use(express.json());
  app.locals.TASKS_DIR = tasksDir;
  app.locals.TASK_CHILD_WAVE_MS = 80;
  app.locals.TASK_CHILD_DURATION_MS = 45;
  app.locals.TASK_CHILD_STAGGER_MS = 5;
  app.locals.TASK_SINGLE_MS = 80;
  app.use('/api/tasks', tasksRouter);
  return await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

describe('tasks routes', () => {
  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-routes-'));
    tasksDir = path.join(rootDir, 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates, polls, estimates, and cancels mock tasks', async () => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { scene: 'plot_deduction_four_grid' },
          metadata: { node_id: 'node-1', project_id: 'project-1' },
          provider: 'mock',
          model: 'mock-model',
          taskType: 'image',
          requestId: 'request-1',
        }),
      });
      const created = await createResponse.json();
      expect(created.success).toBe(true);
      expect(created.taskId).toMatch(/^task_/);
      expect(fs.existsSync(path.join(tasksDir, `${created.taskId}.json`))).toBe(true);

      const costResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/calculate-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { scene: 'plot_deduction_four_grid' } }),
      });
      expect(await costResponse.json()).toMatchObject({
        success: true,
        estimatedCost: 64,
        unit: 'energy',
      });

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [created.taskId] }),
      });
      const status = await statusResponse.json();
      expect(status.success).toBe(true);
      expect(status.tasks[0]).toEqual(
        expect.objectContaining({
          taskId: created.taskId,
          requestId: 'request-1',
        })
      );
      expect(status.tasks[0].childTasks).toHaveLength(4);
      expect(status.tasks[0].maxConcurrency).toBe(4);
      expect(status.tasks[0].childTasks.slice(0, 4).every((task) => task.status === 'pending' || task.status === 'running' || task.status === 'succeeded')).toBe(true);

      const cancelResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: created.taskId }),
      });
      expect(await cancelResponse.json()).toEqual({ success: true });
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('redacts provider credentials from persisted task snapshots', async () => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            scene: 'plot_deduction_four_grid',
            executionMode: 'real',
            providerApiKey: 'sk-super-secret',
            providerBaseUrl: 'https://example.test/v1',
          },
          metadata: { node_id: 'node-secret', project_id: 'project-1' },
          provider: 'openai',
          model: 'gpt-image-1.5',
          taskType: 'image',
          requestId: 'request-secret',
        }),
      });
      const created = await createResponse.json();
      const raw = fs.readFileSync(path.join(tasksDir, `${created.taskId}.json`), 'utf8');

      expect(raw).not.toContain('sk-super-secret');
      expect(JSON.parse(raw).request.params.providerApiKey).toBe('[REDACTED]');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('returns renderable data URLs for completed mock image results', async () => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { scene: 'plot_deduction_four_grid' },
          metadata: { node_id: 'node-1', project_id: 'project-1' },
          provider: 'mock',
          model: 'mock-model',
          taskType: 'image',
          requestId: 'request-4',
        }),
      });
      const created = await createResponse.json();
      await new Promise((resolve) => setTimeout(resolve, 180));

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [created.taskId] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0].status).toBe('succeeded');
      expect(status.tasks[0].childTasks).toHaveLength(4);
      expect(status.tasks[0].result.imageList).toHaveLength(4);
      expect(status.tasks[0].result.imageList[0].url).toMatch(/^data:image\/svg\+xml;base64,/);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('restores persisted task snapshots from disk after memory-only route recreation', async () => {
    const serverHandle = await createServer();

    try {
      const persistedTask = {
        taskId: 'task_persisted',
        requestId: 'request-persisted',
        status: 'succeeded',
        progressPercent: 100,
        result: {
          imageList: [{ url: 'data:image/svg+xml;base64,PHN2Zy8+', label: 'Persisted' }],
          structuredData: { scene: 'plot_deduction_four_grid' },
        },
        output: {
          imageList: [{ url: 'data:image/svg+xml;base64,PHN2Zy8+', label: 'Persisted' }],
          structuredData: { scene: 'plot_deduction_four_grid' },
        },
        childTasks: [],
        errorMessage: null,
      };
      fs.writeFileSync(path.join(tasksDir, 'task_persisted.json'), JSON.stringify(persistedTask, null, 2));

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: ['task_persisted'] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0]).toMatchObject({
        taskId: 'task_persisted',
        status: 'succeeded',
        progressPercent: 100,
      });
      expect(status.tasks[0].result.imageList[0].label).toBe('Persisted');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('marks orphaned completed snapshots without output as failed instead of success-without-result', async () => {
    const serverHandle = await createServer();

    try {
      fs.writeFileSync(path.join(tasksDir, 'task_orphan.json'), JSON.stringify({
        taskId: 'task_orphan',
        requestId: 'request-orphan',
        status: 'succeeded',
        progressPercent: 100,
        result: null,
        output: null,
        childTasks: [],
        errorMessage: null,
      }, null, 2));

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: ['task_orphan'] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0]).toMatchObject({
        taskId: 'task_orphan',
        status: 'failed',
        errorMessage: '任务快照缺少结果，请重新运行该节点。',
      });
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('exposes 25 storyboard child task queue without blocking all cells on one request', async () => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { scene: 'coherent_storyboard_25' },
          metadata: { node_id: 'node-25', project_id: 'project-1' },
          provider: 'mock',
          model: 'mock-model',
          taskType: 'image',
          requestId: 'request-25',
        }),
      });
      const created = await createResponse.json();

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [created.taskId] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0].childTasks).toHaveLength(25);
      expect(status.tasks[0].maxConcurrency).toBe(4);
      expect(status.tasks[0].childTasks.filter((task) => task.status === 'running').length).toBeLessThanOrEqual(4);

      await new Promise((resolve) => setTimeout(resolve, 70));
      const secondStatusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [created.taskId] }),
      });
      const secondStatus = await secondStatusResponse.json();
      expect(secondStatus.tasks[0].childTasks.filter((task) => task.status === 'running').length).toBeLessThanOrEqual(4);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('records provider fallback when real execution is requested without keys', async () => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            scene: 'plot_deduction_four_grid',
            executionMode: 'real',
            storyText: '真实服务优先但没有 key',
          },
          metadata: { node_id: 'node-real', project_id: 'project-1' },
          provider: 'mock',
          model: 'mock-model',
          taskType: 'image',
          requestId: 'request-real',
        }),
      });
      const created = await createResponse.json();
      await new Promise((resolve) => setTimeout(resolve, 180));

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [created.taskId] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0].status).toBe('succeeded');
      expect(status.tasks[0].result.structuredData.realProviderRequested).toBe(true);
      expect(status.tasks[0].result.structuredData.imageModel).toBeUndefined();
      expect(status.tasks[0].result.structuredData.providerFallback).toContain('OPENAI_API_KEY');
      expect(status.tasks[0].result.imageList[0].url).toMatch(/^data:image\/svg\+xml;base64,/);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('persists Nano Banana Pro model selection without provider secrets for real tasks', async () => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            scene: 'plot_deduction_four_grid',
            executionMode: 'real',
            providerApiKey: 'sk-hosted-token',
            storyText: 'Nano Banana Pro 默认模型测试',
          },
          metadata: { node_id: 'node-nano', project_id: 'project-1' },
          provider: 'openai',
          model: 'gemini-3-pro-image-preview',
          taskType: 'image',
          requestId: 'request-nano',
        }),
      });
      const created = await createResponse.json();
      const raw = fs.readFileSync(path.join(tasksDir, `${created.taskId}.json`), 'utf8');
      expect(raw).toContain('gemini-3-pro-image-preview');
      expect(raw).not.toContain('sk-hosted-token');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('keeps image input references available for real Nano Banana scene tasks while redacting secrets', async () => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            scene: 'frame_deduction_plus_3s',
            executionMode: 'real',
            imageModel: 'gemini-3-pro-image-preview',
            providerApiKey: 'sk-hosted-token',
            imageUrl: 'data:image/png;base64,input-frame',
            referenceImages: ['data:image/png;base64,reference-a'],
          },
          metadata: { node_id: 'node-image-input', project_id: 'project-1' },
          provider: 'openai',
          model: 'gemini-3-pro-image-preview',
          taskType: 'image',
          requestId: 'request-image-input',
        }),
      });
      const created = await createResponse.json();
      const raw = fs.readFileSync(path.join(tasksDir, `${created.taskId}.json`), 'utf8');
      const persisted = JSON.parse(raw);

      expect(raw).not.toContain('sk-hosted-token');
      expect(persisted.request.params.imageUrl).toBe('data:image/png;base64,input-frame');
      expect(persisted.request.params.referenceImages).toEqual(['data:image/png;base64,reference-a']);
      expect(persisted.request.params.imageModel).toBe('gemini-3-pro-image-preview');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('creates retry tasks through the async retry endpoint', async () => {
    const serverHandle = await createServer();

    try {
      const retryResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: {
            params: { scene: 'plot_deduction_four_grid' },
            metadata: { node_id: 'node-retry', project_id: 'project-1' },
            provider: 'mock',
            model: 'mock-model',
            taskType: 'image',
            requestId: 'request-retry',
          },
        }),
      });
      const retried = await retryResponse.json();

      expect(retried.success).toBe(true);
      expect(retried.taskId).toMatch(/^task_/);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('retries a single grid item as a one-result task', async () => {
    const serverHandle = await createServer();

    try {
      const retryResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: {
            params: { scene: 'coherent_storyboard_25', gridItemIndex: 7 },
            metadata: { node_id: 'node-retry-cell', project_id: 'project-1' },
            provider: 'mock',
            model: 'mock-model',
            taskType: 'image',
            requestId: 'request-retry-cell',
          },
        }),
      });
      const retried = await retryResponse.json();
      await new Promise((resolve) => setTimeout(resolve, 180));

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [retried.taskId] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0].status).toBe('succeeded');
      expect(status.tasks[0].result.imageList).toHaveLength(1);
      expect(status.tasks[0].result.imageList[0].label).toBe('Result 8');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it.each([
    ['multi_view_nine_grid', 9, 'multiView'],
    ['plot_deduction_four_grid', 4, 'storyboard'],
    ['coherent_storyboard_25', 25, 'characterBible'],
    ['cinematic_light_correction', 1, 'lightingRequest'],
    ['character_three_view_generate', 1, 'characterProfile'],
    ['frame_deduction_plus_3s', 1, 'frameDeduction'],
    ['frame_deduction_minus_5s', 1, 'frameDeduction'],
    ['upscale', 1, 'upscale'],
  ])('returns structured output contract for %s', async (scene, expectedCount, expectedStructuredKey) => {
    const serverHandle = await createServer();

    try {
      const createResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { scene, storyText: '结构化契约测试' },
          metadata: { node_id: `node-${scene}`, project_id: 'project-1' },
          provider: 'mock',
          model: 'mock-model',
          taskType: 'image',
          requestId: `request-${scene}`,
        }),
      });
      const created = await createResponse.json();
      const waitMs = expectedCount > 9 ? 620 : 260;
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [created.taskId] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0].status).toBe('succeeded');
      expect(status.tasks[0].result.imageList).toHaveLength(expectedCount);
      expect(status.tasks[0].result.structuredData[expectedStructuredKey]).toBeTruthy();
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
