import type { Project } from '../../types/project';

type ProjectResponse = {
  success: boolean;
  project: Project;
};

type ProjectListResponse = {
  success: boolean;
  projects: Array<{
    id: string;
    name: string;
    title: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    nodeCount: number;
  }>;
};

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function saveProject(project: Project): Promise<Project> {
  const response = await requestJson<ProjectResponse>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  });
  return response.project;
}

export async function loadProject(projectId: string): Promise<Project> {
  const response = await requestJson<ProjectResponse>(`/api/projects/${projectId}`);
  return response.project;
}

export async function listProjects(): Promise<ProjectListResponse['projects']> {
  const response = await requestJson<ProjectListResponse>('/api/projects');
  return response.projects;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  await requestJson<{ success: boolean }>(`/api/projects/${projectId}`, {
    method: 'DELETE',
  });
  return true;
}
