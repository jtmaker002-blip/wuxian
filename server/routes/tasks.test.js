import express from 'express';
import { describe, expect, it } from 'vitest';
import tasksRouter from './tasks.js';

async function createServer() {
  const app = express();
  app.use(express.json());
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
      expect(status.tasks[0].childTasks.filter((task) => task.status === 'running').length).toBeLessThanOrEqual(4);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
