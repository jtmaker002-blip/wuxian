import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePaths } from '../runtime-paths.js';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const KNOWN_VIDEO_CAPABILITY_IDS = Object.freeze([
  'grok-video-3',
  'sora-2',
  'veo3.1',
  'kling-v3',
  'kling-v2-6',
  'kling-v2-5-turbo',
  'minimax-hailuo',
  'wan2.6-i2v',
  'wan2.6-i2v-flash',
  'wan2.5-i2v-preview',
  'jimeng-seedance-2',
  'jimeng-4.5',
  'jimeng-4.1',
  'jimeng-4.0',
  'jimeng-video-3-fast',
]);

const KNOWN_VOICE_CAPABILITY_IDS = Object.freeze([
  'cosyvoice-v3-flash',
  'cosyvoice-v3-plus',
  'qwen3-tts-flash',
  'qwen-voice-design',
]);

function unwrapCapabilityPayload(payload, kind) {
  if (!isRecord(payload)) return null;

  const direct = payload;
  const fromKind = isRecord(direct[kind]) ? direct[kind] : null;
  const fromCapabilities = isRecord(direct.capabilities)
    ? (isRecord(direct.capabilities[kind]) ? direct.capabilities[kind] : direct.capabilities)
    : null;
  const fromData = isRecord(direct.data) ? unwrapCapabilityPayload(direct.data, kind) : null;
  const fromResult = isRecord(direct.result) ? unwrapCapabilityPayload(direct.result, kind) : null;

  return fromKind ?? fromCapabilities ?? fromData ?? fromResult ?? direct;
}

function deepMergeCapabilityMaps(base, override) {
  if (!isRecord(base) && !isRecord(override)) return {};
  if (!isRecord(base)) return override;
  if (!isRecord(override)) return base;

  const merged = { ...base };

  for (const [id, rawOverride] of Object.entries(override)) {
    if (!isRecord(rawOverride)) {
      merged[id] = rawOverride;
      continue;
    }

    const rawBase = merged[id];
    if (!isRecord(rawBase)) {
      merged[id] = rawOverride;
      continue;
    }

    const next = { ...rawBase, ...rawOverride };
    if (isRecord(rawBase.modes) && isRecord(rawOverride.modes)) {
      next.modes = {
        ...rawBase.modes,
        ...rawOverride.modes,
      };

      for (const modeKey of Object.keys(rawOverride.modes)) {
        if (isRecord(rawBase.modes[modeKey]) && isRecord(rawOverride.modes[modeKey])) {
          next.modes[modeKey] = {
            ...rawBase.modes[modeKey],
            ...rawOverride.modes[modeKey],
          };
        }
      }
    }

    merged[id] = next;
  }

  return merged;
}

export function filterCapabilityPayloadByKnownIds(payload, knownIds) {
  if (!isRecord(payload) || !Array.isArray(knownIds) || knownIds.length === 0) {
    return {};
  }

  const allowSet = new Set(knownIds.map((id) => String(id)));
  return Object.fromEntries(
    Object.entries(payload).filter(([id]) => allowSet.has(String(id)))
  );
}

export function getKnownCapabilityIds(kind) {
  return kind === 'voice' ? [...KNOWN_VOICE_CAPABILITY_IDS] : [...KNOWN_VIDEO_CAPABILITY_IDS];
}

export function sanitizeCapabilityPayload(kind, payload) {
  return filterCapabilityPayloadByKnownIds(payload, getKnownCapabilityIds(kind));
}

export function loadCapabilityOverride(kind, options = {}) {
  const {
    env = process.env,
    exists = fs.existsSync,
    readFile = fs.readFileSync,
  } = options;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const runtimePaths = resolveRuntimePaths({
    serverDir: path.join(__dirname, '..'),
    env,
    exists,
  });

  const filePath =
    kind === 'voice'
      ? runtimePaths.voiceModelCapabilitiesOverrideFile
      : runtimePaths.videoModelCapabilitiesOverrideFile;

  if (!filePath || !exists(filePath)) {
    return null;
  }

  try {
    const text = readFile(filePath, 'utf8');
    if (!String(text || '').trim()) return null;
    const parsed = JSON.parse(text);
    return unwrapCapabilityPayload(parsed, kind);
  } catch (error) {
    console.warn(`[model-capabilities] load ${kind} override failed:`, error?.message || error);
    return null;
  }
}

export function mergeCapabilityPayloads(basePayload, overridePayload) {
  if (!isRecord(basePayload) && !isRecord(overridePayload)) return {};
  if (!isRecord(basePayload)) return overridePayload || {};
  if (!isRecord(overridePayload)) return basePayload;
  return deepMergeCapabilityMaps(basePayload, overridePayload);
}
