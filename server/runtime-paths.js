import fs from 'fs';
import path from 'path';

function resolveExistingPath(candidates, exists = fs.existsSync) {
    const filtered = candidates.filter(Boolean);
    const found = filtered.find((candidate) => exists(candidate));
    return found || filtered[0] || null;
}

export function resolveServerPort(env = process.env) {
    const candidates = [env.PORT, env.TWITCANVA_SERVER_PORT];

    for (const candidate of candidates) {
        const parsed = Number(candidate);
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return 3001;
}

export function resolveRuntimePaths({
    serverDir,
    resourcesPath = process.resourcesPath,
    env = process.env,
    exists = fs.existsSync,
} = {}) {
    const unpackedRoot = path.resolve(serverDir, '..');
    const bundledRoot = resourcesPath
        ? path.join(resourcesPath, 'app.asar')
        : unpackedRoot.includes('app.asar.unpacked')
            ? unpackedRoot.replace('app.asar.unpacked', 'app.asar')
            : unpackedRoot;

    const rendererDistDir = resolveExistingPath([
        env.TWITCANVA_RENDERER_DIST,
        path.join(bundledRoot, 'dist'),
        path.join(unpackedRoot, 'dist'),
    ], exists);

    const publicWorkflowsDir = resolveExistingPath([
        env.TWITCANVA_PUBLIC_WORKFLOWS_DIR,
        path.join(bundledRoot, 'dist', 'workflows'),
        path.join(bundledRoot, 'public', 'workflows'),
        path.join(unpackedRoot, 'public', 'workflows'),
        path.join(unpackedRoot, 'dist', 'workflows'),
    ], exists);

    const libraryDir = env.LIBRARY_DIR || env.TWITCANVA_LIBRARY_DIR || path.join(unpackedRoot, 'library');
    const runtimeDir = env.TWITCANVA_RUNTIME_DIR || path.join(libraryDir, '.runtime');

    return {
        unpackedRoot,
        bundledRoot,
        rendererDistDir,
        publicWorkflowsDir,
        libraryDir,
        runtimeDir,
        workflowsDir: path.join(libraryDir, 'workflows'),
        imagesDir: path.join(libraryDir, 'images'),
        videosDir: path.join(libraryDir, 'videos'),
        chatsDir: path.join(libraryDir, 'chats'),
        libraryAssetsDir: path.join(libraryDir, 'assets'),
        proxySessionStoreFile: env.OAT_PROXY_SESSION_FILE || path.join(runtimeDir, 'openaiteach-proxy-sessions.json'),
        videoModelCapabilitiesOverrideFile:
            env.TWITCANVA_VIDEO_CAPABILITIES_FILE || path.join(runtimeDir, 'video-capabilities.override.json'),
        voiceModelCapabilitiesOverrideFile:
            env.TWITCANVA_VOICE_CAPABILITIES_FILE || path.join(runtimeDir, 'voice-capabilities.override.json'),
    };
}
