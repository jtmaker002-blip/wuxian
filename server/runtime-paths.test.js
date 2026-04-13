import path from 'path';
import { describe, expect, test } from 'vitest';

import {
  resolveRuntimePaths,
  resolveServerPort,
} from './runtime-paths.js';

describe('resolveServerPort', () => {
  test('prefers explicit environment port values', () => {
    expect(resolveServerPort({ PORT: '4123' })).toBe(4123);
    expect(resolveServerPort({ TWITCANVA_SERVER_PORT: '5123' })).toBe(5123);
  });

  test('falls back to 3001 when environment values are invalid', () => {
    expect(resolveServerPort({ PORT: 'abc' })).toBe(3001);
    expect(resolveServerPort({ PORT: '-1' })).toBe(3001);
  });
});

describe('resolveRuntimePaths', () => {
  test('uses bundled app.asar dist for packaged renderer assets', () => {
    const resourcesPath = path.join('C:', 'Users', 'tester', 'AppData', 'Local', 'Programs', 'TwitCanva', 'resources');
    const serverDir = path.join(resourcesPath, 'app.asar.unpacked', 'server');
    const existsSet = new Set([
      path.join(resourcesPath, 'app.asar', 'dist'),
      path.join(resourcesPath, 'app.asar', 'dist', 'workflows'),
    ]);

    const paths = resolveRuntimePaths({
      serverDir,
      resourcesPath,
      exists: (candidate) => existsSet.has(candidate),
    });

    expect(paths.rendererDistDir).toBe(path.join(resourcesPath, 'app.asar', 'dist'));
    expect(paths.publicWorkflowsDir).toBe(path.join(resourcesPath, 'app.asar', 'dist', 'workflows'));
    expect(paths.libraryDir).toBe(path.join(resourcesPath, 'app.asar.unpacked', 'library'));
    expect(paths.tasksDir).toBe(path.join(resourcesPath, 'app.asar.unpacked', 'library', 'tasks'));
    expect(paths.runtimeDir).toBe(path.join(resourcesPath, 'app.asar.unpacked', 'library', '.runtime'));
    expect(paths.proxySessionStoreFile).toBe(path.join(resourcesPath, 'app.asar.unpacked', 'library', '.runtime', 'openaiteach-proxy-sessions.json'));
  });

  test('can infer bundled app.asar paths from an unpacked server path alone', () => {
    const resourcesPath = path.join('C:', 'Users', 'tester', 'AppData', 'Local', 'Programs', 'TwitCanva', 'resources');
    const serverDir = path.join(resourcesPath, 'app.asar.unpacked', 'server');
    const existsSet = new Set([
      path.join(resourcesPath, 'app.asar', 'dist'),
      path.join(resourcesPath, 'app.asar', 'dist', 'workflows'),
    ]);

    const paths = resolveRuntimePaths({
      serverDir,
      resourcesPath: undefined,
      exists: (candidate) => existsSet.has(candidate),
    });

    expect(paths.rendererDistDir).toBe(path.join(resourcesPath, 'app.asar', 'dist'));
    expect(paths.publicWorkflowsDir).toBe(path.join(resourcesPath, 'app.asar', 'dist', 'workflows'));
    expect(paths.proxySessionStoreFile).toBe(path.join(resourcesPath, 'app.asar.unpacked', 'library', '.runtime', 'openaiteach-proxy-sessions.json'));
  });

  test('uses repo-local paths during development', () => {
    const repoRoot = path.join('E:', 'repo', 'TwitCanva-Video-Workflow');
    const serverDir = path.join(repoRoot, 'server');
    const existsSet = new Set([
      path.join(repoRoot, 'dist'),
      path.join(repoRoot, 'public', 'workflows'),
    ]);

    const paths = resolveRuntimePaths({
      serverDir,
      exists: (candidate) => existsSet.has(candidate),
    });

    expect(paths.rendererDistDir).toBe(path.join(repoRoot, 'dist'));
    expect(paths.publicWorkflowsDir).toBe(path.join(repoRoot, 'public', 'workflows'));
    expect(paths.libraryDir).toBe(path.join(repoRoot, 'library'));
    expect(paths.tasksDir).toBe(path.join(repoRoot, 'library', 'tasks'));
    expect(paths.proxySessionStoreFile).toBe(path.join(repoRoot, 'library', '.runtime', 'openaiteach-proxy-sessions.json'));
  });

  test('prefers explicit TWITCANVA_LIBRARY_DIR when provided by desktop runtime', () => {
    const repoRoot = path.join('E:', 'repo', 'TwitCanva-Video-Workflow');
    const serverDir = path.join(repoRoot, 'server');
    const userDataLibrary = path.join('C:', 'Users', 'tester', 'AppData', 'Roaming', 'TwitCanva', 'library');

    const paths = resolveRuntimePaths({
      serverDir,
      env: { TWITCANVA_LIBRARY_DIR: userDataLibrary },
      exists: () => false,
    });

    expect(paths.libraryDir).toBe(userDataLibrary);
    expect(paths.tasksDir).toBe(path.join(userDataLibrary, 'tasks'));
    expect(paths.imagesDir).toBe(path.join(userDataLibrary, 'images'));
    expect(paths.videosDir).toBe(path.join(userDataLibrary, 'videos'));
    expect(paths.proxySessionStoreFile).toBe(path.join(userDataLibrary, '.runtime', 'openaiteach-proxy-sessions.json'));
  });
});
