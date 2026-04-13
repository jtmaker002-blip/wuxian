import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

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

function safeJsonPath(baseDir, id) {
  if (!isSafeId(id)) {
    const error = new Error('Invalid project id');
    error.statusCode = 400;
    throw error;
  }
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, `${id}.json`);
  if (!resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
    const error = new Error('Invalid project path');
    error.statusCode = 400;
    throw error;
  }
  return resolvedPath;
}

function projectSummary(project) {
  return {
    id: project.id,
    name: project.name || project.title || 'Untitled Project',
    title: project.title || project.name || 'Untitled Project',
    description: project.description || '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    nodeCount: project.nodes?.length || 0,
    edgeCount: project.edges?.length || 0,
  };
}

router.get('/', (req, res) => {
  try {
    const dir = getProjectDir(req);
    const projects = fs.readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => readJson(path.join(dir, file)))
      .map(projectSummary)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    res.json({ success: true, projects });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const dir = getProjectDir(req);
    const now = new Date().toISOString();
    const project = {
      ...req.body,
      id: isSafeId(req.body?.id) ? req.body.id : crypto.randomUUID(),
      name: req.body?.name || req.body?.title || 'Untitled Project',
      title: req.body?.title || req.body?.name || 'Untitled Project',
      nodes: Array.isArray(req.body?.nodes) ? req.body.nodes : [],
      edges: Array.isArray(req.body?.edges) ? req.body.edges : [],
      groups: Array.isArray(req.body?.groups) ? req.body.groups : [],
      viewport: req.body?.viewport || { x: 0, y: 0, zoom: 1 },
      createdAt: req.body?.createdAt || now,
      updatedAt: now,
    };
    fs.writeFileSync(safeJsonPath(dir, project.id), JSON.stringify(project, null, 2));
    res.json({ success: true, project });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/:projectId', (req, res) => {
  try {
    const filePath = safeJsonPath(getProjectDir(req), req.params.projectId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true, project: readJson(filePath) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
