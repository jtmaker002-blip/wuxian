import type { GenerationRequest, TaskSnapshot } from '../../types/scene';
import { readStoredOpenAiTeachProviderConfig } from '../../shared/provider/openaiteach-config';

type CreateTaskResponse = {
  success: boolean;
  taskId: string;
};

type TaskStatusResponse = {
  success: boolean;
  tasks: TaskSnapshot[];
};

type CancelTaskResponse = {
  success: boolean;
  cancelledTaskIds?: string[];
};

type CostResponse = {
  success: boolean;
  estimatedCost: number;
  unit: string;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function withStoredProviderConfig(request: GenerationRequest): GenerationRequest {
  const providerConfig =
    request.params.providerApiKey || request.params.providerBaseUrl ||
    (request.params.executionMode !== 'real' && request.params.providerMode !== 'real' && request.provider !== 'openai')
      ? {}
      : readStoredOpenAiTeachProviderConfig();
  return {
    ...request,
    params: {
      ...providerConfig,
      ...request.params,
    },
  };
}

export async function createTask(request: GenerationRequest): Promise<CreateTaskResponse> {
  return postJson<CreateTaskResponse>('/api/tasks/create', withStoredProviderConfig(request));
}

export async function retryTask(request: GenerationRequest): Promise<CreateTaskResponse> {
  return postJson<CreateTaskResponse>('/api/tasks/retry', {
    request: withStoredProviderConfig(request),
  });
}

export async function pollTasks(taskIds: string[]): Promise<TaskSnapshot[]> {
  const response = await postJson<TaskStatusResponse>('/api/tasks/status', { taskIds });
  return response.tasks;
}

export async function cancelTask(taskId: string): Promise<boolean> {
  const response = await postJson<CancelTaskResponse>('/api/tasks/cancel', { taskId });
  return response.success;
}

export async function cancelTasks(taskIds: string[]): Promise<string[]> {
  const response = await postJson<CancelTaskResponse>('/api/tasks/cancel-batch', { taskIds });
  return response.cancelledTaskIds || [];
}

export async function calculateTaskCost(request: GenerationRequest): Promise<CostResponse> {
  return postJson<CostResponse>('/api/tasks/calculate-cost', request);
}
