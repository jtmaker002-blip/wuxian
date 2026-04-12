import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import projectRoutes from './projects.js';
import templateRoutes from './templates.js';

let rootDir;
let workflowsDir;
let templatesDir;

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.locals.WORKFLOWS_DIR = workflowsDir;
  app.locals.TEMPLATES_DIR = templatesDir;
  app.use('/api/projects', projectRoutes);
  app.use('/api/templates', templateRoutes);

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

describe('project and template routes', () => {
  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-template-routes-'));
    workflowsDir = path.join(rootDir, 'workflows');
    templatesDir = path.join(rootDir, 'templates');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.mkdirSync(templatesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('saves a project with structured scene data and reloads it', async () => {
    const serverHandle = await createServer();

    try {
      const saveResponse = await fetch(`${serverHandle.baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Liblib Project',
          nodes: [
            {
              id: 'node-1',
              scene: 'plot_deduction_four_grid',
              outputs: { structuredData: { storyboard: [{ shotNumber: 1 }] } },
              structuredData: { storyboard: [{ shotNumber: 1 }] },
              taskInfo: { taskId: 'task-1', status: 'succeeded' },
            },
          ],
          edges: [{ id: 'edge-1', source_node_id: 'node-1', target_node_id: 'node-2' }],
        }),
      });
      const saved = await saveResponse.json();
      expect(saved.success).toBe(true);

      const loadResponse = await fetch(`${serverHandle.baseUrl}/api/projects/${saved.project.id}`);
      const loaded = await loadResponse.json();
      expect(loaded.project.nodes[0].structuredData.storyboard[0].shotNumber).toBe(1);
      expect(loaded.project.nodes[0].taskInfo.taskId).toBe('task-1');
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });

  it('publishes a project as a template and creates a new project copy', async () => {
    const serverHandle = await createServer();

    try {
      const saveResponse = await fetch(`${serverHandle.baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Storyboard Source',
          nodes: [
            {
              id: 'node-1',
              scene: 'coherent_storyboard_25',
              status: 'loading',
              taskInfo: { taskId: 'task-1', status: 'running', loading: true },
            },
          ],
        }),
      });
      const saved = await saveResponse.json();

      const templateResponse = await fetch(`${serverHandle.baseUrl}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: saved.project.id, name: 'Storyboard Template' }),
      });
      const template = await templateResponse.json();
      expect(template.success).toBe(true);
      expect(template.template.nodes[0].taskInfo.loading).toBe(false);

      const copyResponse = await fetch(`${serverHandle.baseUrl}/api/templates/${template.template.id}/create-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Template Copy' }),
      });
      const copy = await copyResponse.json();
      expect(copy.success).toBe(true);
      expect(copy.project.id).not.toBe(saved.project.id);
      expect(copy.project.nodes[0].id).not.toBe('node-1');
      expect(copy.project.templateId).toBe(template.template.id);
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
