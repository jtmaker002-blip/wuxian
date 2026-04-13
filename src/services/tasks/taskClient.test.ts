import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateTaskCost, cancelTask, cancelTasks, createTask, pollTasks } from './taskClient';
import { SCENES } from '../../types/scene';

const originalFetch = global.fetch;

function mockFetch(json: unknown, ok = true) {
  global.fetch = vi.fn(async () => new Response(JSON.stringify(json), {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;
}

const request = {
  params: { scene: SCENES.PLOT_DEDUCTION_FOUR_GRID },
  metadata: { node_id: 'node-1', project_id: 'project-1' },
  provider: 'mock',
  model: 'mock-model',
  taskType: 'image' as const,
  requestId: 'request-1',
};

describe('taskClient', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('creates a task through the unified task endpoint', async () => {
    mockFetch({ success: true, taskId: 'task-1' });

    await expect(createTask(request)).resolves.toEqual({ success: true, taskId: 'task-1' });
    expect(global.fetch).toHaveBeenCalledWith('/api/tasks/create', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(request),
    }));
  });

  it('polls tasks in a single batch request', async () => {
    mockFetch({
      success: true,
      tasks: [
        {
          taskId: 'task-1',
          requestId: 'request-1',
          status: 'running',
          progressPercent: 50,
          maxConcurrency: 4,
          childTasks: [
            { taskId: 'task-1-child-1', index: 0, status: 'running', progressPercent: 50 },
          ],
        },
        { taskId: 'task-2', requestId: 'request-2', status: 'succeeded', progressPercent: 100 },
      ],
    });

    const tasks = await pollTasks(['task-1', 'task-2']);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].maxConcurrency).toBe(4);
    expect(tasks[0].childTasks?.[0].taskId).toBe('task-1-child-1');
    expect(global.fetch).toHaveBeenCalledWith('/api/tasks/status', expect.objectContaining({
      body: JSON.stringify({ taskIds: ['task-1', 'task-2'] }),
    }));
  });

  it('returns an empty array for an empty task status response', async () => {
    mockFetch({ success: true, tasks: [] });

    await expect(pollTasks(['missing-task'])).resolves.toEqual([]);
  });

  it('throws the backend error message for failed task requests', async () => {
    mockFetch({ error: 'task backend exploded' }, false);

    await expect(createTask(request)).rejects.toThrow('task backend exploded');
  });

  it('supports cancel, batch cancel, and cost estimation', async () => {
    mockFetch({ success: true, cancelledTaskIds: ['task-1'], estimatedCost: 64, unit: 'energy' });

    await expect(cancelTask('task-1')).resolves.toBe(true);
    await expect(cancelTasks(['task-1'])).resolves.toEqual(['task-1']);
    await expect(calculateTaskCost(request)).resolves.toMatchObject({ estimatedCost: 64, unit: 'energy' });
  });
});
