import type { Project } from '../../types/project';

export type TemplateSummary = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  nodeCount: number;
};

type TemplateListResponse = {
  success: boolean;
  templates: TemplateSummary[];
};

type TemplateResponse = {
  success: boolean;
  template: TemplateSummary;
};

type TemplateProjectResponse = {
  success: boolean;
  project: Project;
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

export async function listTemplates(): Promise<TemplateSummary[]> {
  const response = await requestJson<TemplateListResponse>('/api/templates');
  return response.templates;
}

export async function publishProjectTemplate(projectId: string, name?: string): Promise<TemplateSummary> {
  const response = await requestJson<TemplateResponse>('/api/templates', {
    method: 'POST',
    body: JSON.stringify({ projectId, name }),
  });
  return response.template;
}

export async function createProjectFromTemplate(templateId: string, name?: string): Promise<Project> {
  const response = await requestJson<TemplateProjectResponse>(`/api/templates/${templateId}/create-project`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return response.project;
}
