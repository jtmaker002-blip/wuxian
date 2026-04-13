import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

function getTemplateDir(req) {
  const dir = req.app.locals.TEMPLATES_DIR;
  if (!dir) throw new Error('TEMPLATES_DIR not configured');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getProjectDir(req) {
  const dir = req.app.locals.WORKFLOWS_DIR;
  if (!dir) throw new Error('WORKFLOWS_DIR not configured');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isSafeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id);
}

function safeJsonPath(baseDir, id, label = 'id') {
  if (!isSafeId(id)) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, `${id}.json`);
  if (!resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
    const error = new Error(`Invalid ${label} path`);
    error.statusCode = 400;
    throw error;
  }
  return resolvedPath;
}

function stripRuntimeState(node) {
  return {
    ...node,
    status: node.status === 'loading' ? 'idle' : node.status,
    taskInfo: node.taskInfo
      ? {
        ...node.taskInfo,
        loading: false,
        status: node.taskInfo.status === 'running' || node.taskInfo.status === 'pending'
          ? 'cancelled'
          : node.taskInfo.status,
      }
      : node.taskInfo,
  };
}

router.get('/', (req, res) => {
  try {
    const templates = fs.readdirSync(getTemplateDir(req))
      .filter((file) => file.endsWith('.json'))
      .map((file) => readJson(path.join(getTemplateDir(req), file)))
      .map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        createdAt: template.createdAt,
        nodeCount: template.nodes?.length || 0,
      }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({ success: true, templates });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const projectId = req.body?.projectId;
    const sourceProject = projectId
      ? readJson(safeJsonPath(getProjectDir(req), projectId, 'project id'))
      : req.body?.project;

    if (!sourceProject) {
      return res.status(400).json({ error: 'projectId or project payload is required' });
    }

    const now = new Date().toISOString();
    const template = {
      ...sourceProject,
      id: crypto.randomUUID(),
      sourceProjectId: sourceProject.id,
      name: req.body?.name || sourceProject.name || sourceProject.title || 'Untitled Template',
      description: req.body?.description || sourceProject.description || '',
      nodes: (sourceProject.nodes || []).map(stripRuntimeState),
      createdAt: now,
      updatedAt: now,
    };

    fs.writeFileSync(safeJsonPath(getTemplateDir(req), template.id, 'template id'), JSON.stringify(template, null, 2));
    res.json({ success: true, template });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/:templateId/create-project', (req, res) => {
  try {
    const templatePath = safeJsonPath(getTemplateDir(req), req.params.templateId, 'template id');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = readJson(templatePath);
    const now = new Date().toISOString();
    const nodeIdMap = new Map((template.nodes || []).map((node) => [node.id, crypto.randomUUID()]));
    const remapNodeId = (id) => nodeIdMap.get(id) || id;
    const project = {
      ...template,
      id: crypto.randomUUID(),
      templateId: template.id,
      name: req.body?.name || `${template.name} Copy`,
      title: req.body?.title || req.body?.name || `${template.name} Copy`,
      nodes: (template.nodes || []).map((node) => ({
        ...node,
        id: remapNodeId(node.id),
        parentIds: Array.isArray(node.parentIds) ? node.parentIds.map(remapNodeId) : node.parentIds,
      })),
      edges: (template.edges || []).map((edge) => ({
        ...edge,
        id: crypto.randomUUID(),
        source_node_id: edge.source_node_id ? remapNodeId(edge.source_node_id) : edge.source_node_id,
        target_node_id: edge.target_node_id ? remapNodeId(edge.target_node_id) : edge.target_node_id,
        source: edge.source ? remapNodeId(edge.source) : edge.source,
        target: edge.target ? remapNodeId(edge.target) : edge.target,
      })),
      groups: (template.groups || []).map((group) => ({
        ...group,
        id: crypto.randomUUID(),
        nodeIds: Array.isArray(group.nodeIds) ? group.nodeIds.map(remapNodeId) : group.nodeIds,
      })),
      createdAt: now,
      updatedAt: now,
    };

    fs.writeFileSync(safeJsonPath(getProjectDir(req), project.id, 'project id'), JSON.stringify(project, null, 2));
    res.json({ success: true, project });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
