import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectFromTemplate, listTemplates, publishProjectTemplate } from './templateClient';

const originalFetch = global.fetch;

function mockFetch(json: unknown, ok = true) {
  global.fetch = vi.fn(async () => new Response(JSON.stringify(json), {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  })) as unknown as typeof fetch;
}

describe('templateClient', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lists templates from the template API', async () => {
    mockFetch({ success: true, templates: [{ id: 'tpl-1', name: 'Template', nodeCount: 2 }] });

    await expect(listTemplates()).resolves.toEqual([{ id: 'tpl-1', name: 'Template', nodeCount: 2 }]);
  });

  it('publishes a project as a template', async () => {
    mockFetch({ success: true, template: { id: 'tpl-1', name: 'Template', nodeCount: 2 } });

    await publishProjectTemplate('project-1', 'Template');

    expect(global.fetch).toHaveBeenCalledWith('/api/templates', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ projectId: 'project-1', name: 'Template' }),
    }));
  });

  it('creates a project copy from a template', async () => {
    mockFetch({ success: true, project: { id: 'project-copy', name: 'Copy', title: 'Copy', nodes: [], edges: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } } });

    await expect(createProjectFromTemplate('tpl-1', 'Copy')).resolves.toMatchObject({ id: 'project-copy' });
  });
});
