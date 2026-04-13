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
      await new Promise((resolve) => setTimeout(resolve, 2900));

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

      await new Promise((resolve) => setTimeout(resolve, 1350));
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
      await new Promise((resolve) => setTimeout(resolve, 2900));

      const statusResponse = await fetch(`${serverHandle.baseUrl}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [created.taskId] }),
      });
      const status = await statusResponse.json();

      expect(status.tasks[0].status).toBe('succeeded');
      expect(status.tasks[0].result.structuredData.realProviderRequested).toBe(true);
      expect(status.tasks[0].result.structuredData.providerFallback).toContain('OPENAI_API_KEY');
      expect(status.tasks[0].result.imageList[0].url).toMatch(/^data:image\/svg\+xml;base64,/);
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
});
