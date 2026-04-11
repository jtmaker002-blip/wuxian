import {
  LOCAL_VIDEO_CAPABILITIES as BASE_LOCAL_VIDEO_CAPABILITIES,
  LOCAL_VOICE_CAPABILITIES as BASE_LOCAL_VOICE_CAPABILITIES,
} from '../config/modelCapabilities';
import type {
  VideoCapabilitiesMap,
  VideoCapabilityMode,
  VideoModelCapability,
  VideoModeCapability,
  VoiceCapabilitiesMap,
  VoiceModelCapability,
} from '../config/modelCapabilities';

type PartialVideoModeCapability = Partial<VideoModeCapability>;
type PartialVideoModelCapability = {
  serverModelId?: string;
  modes?: Partial<Record<VideoCapabilityMode, PartialVideoModeCapability>>;
};
type PartialVoiceModelCapability = Partial<VoiceModelCapability>;

const KNOWN_VIDEO_IDS = new Set(Object.keys(BASE_LOCAL_VIDEO_CAPABILITIES));
const KNOWN_VOICE_IDS = new Set(Object.keys(BASE_LOCAL_VOICE_CAPABILITIES));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unwrapCapabilityPayload(
  payload: unknown,
  kind: 'video' | 'voice'
): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;

  const direct = payload;
  const fromKind = isRecord(direct[kind]) ? (direct[kind] as Record<string, unknown>) : null;
  const fromCapabilities = isRecord(direct.capabilities)
    ? (isRecord((direct.capabilities as Record<string, unknown>)[kind])
      ? ((direct.capabilities as Record<string, unknown>)[kind] as Record<string, unknown>)
      : (direct.capabilities as Record<string, unknown>))
    : null;
  const fromData = isRecord(direct.data)
    ? unwrapCapabilityPayload(direct.data, kind)
    : null;
  const fromResult = isRecord(direct.result)
    ? unwrapCapabilityPayload(direct.result, kind)
    : null;

  return fromKind ?? fromCapabilities ?? fromData ?? fromResult ?? direct;
}

function isValidMode(mode: VideoModeCapability): boolean {
  return (
    mode.durations.length > 0 &&
    mode.aspectRatios.length > 0 &&
    mode.resolutions.length > 0 &&
    mode.durations.includes(mode.defaultDuration) &&
    mode.aspectRatios.includes(mode.defaultAspectRatio) &&
    mode.resolutions.includes(mode.defaultResolution) &&
    (!mode.supportsStartEndFrames || mode.supportsImageToVideo) &&
    (!mode.supportsMotionReference || mode.enabled)
  );
}

function mergeBoolean(localValue: boolean, remoteValue: unknown): boolean {
  return typeof remoteValue === 'boolean' ? remoteValue : localValue;
}

function mergeMode(
  localMode: VideoModeCapability,
  remoteMode?: PartialVideoModeCapability
): VideoModeCapability {
  if (!remoteMode) return localMode;
  const next = {
    ...localMode,
    ...remoteMode,
  };
  next.enabled = mergeBoolean(localMode.enabled, remoteMode.enabled);
  next.supportsTextToVideo = mergeBoolean(localMode.supportsTextToVideo, remoteMode.supportsTextToVideo);
  next.supportsImageToVideo = mergeBoolean(localMode.supportsImageToVideo, remoteMode.supportsImageToVideo);
  next.supportsMultiImage = mergeBoolean(localMode.supportsMultiImage, remoteMode.supportsMultiImage);
  next.supportsStartEndFrames = mergeBoolean(localMode.supportsStartEndFrames, remoteMode.supportsStartEndFrames);
  next.supportsFullReference = mergeBoolean(localMode.supportsFullReference, remoteMode.supportsFullReference);
  next.supportsMotionReference = mergeBoolean(localMode.supportsMotionReference, remoteMode.supportsMotionReference);
  next.supportsAudio = mergeBoolean(localMode.supportsAudio, remoteMode.supportsAudio);
  return isValidMode(next) ? next : localMode;
}

function mergeModel(
  localModel: VideoModelCapability,
  remoteModel?: PartialVideoModelCapability
): VideoModelCapability {
  if (!remoteModel) return localModel;
  const nextServerModelId =
    remoteModel.serverModelId && remoteModel.serverModelId === localModel.serverModelId
      ? remoteModel.serverModelId
      : localModel.serverModelId;

  const next: VideoModelCapability = {
    ...localModel,
    serverModelId: nextServerModelId,
    modes: {
      standard: mergeMode(localModel.modes.standard, remoteModel.modes?.standard),
      frameToFrame: mergeMode(localModel.modes.frameToFrame, remoteModel.modes?.frameToFrame),
      motionControl: mergeMode(localModel.modes.motionControl, remoteModel.modes?.motionControl),
    },
  };
  return next.serverModelId ? next : localModel;
}

export function mergeVideoCapabilities(
  local: VideoCapabilitiesMap,
  remote: Record<string, unknown>
): VideoCapabilitiesMap {
  const merged: VideoCapabilitiesMap = { ...local };

  for (const [id, rawModel] of Object.entries(remote)) {
    if (!rawModel || typeof rawModel !== 'object' || Array.isArray(rawModel)) continue;
    if (!KNOWN_VIDEO_IDS.has(id)) continue;

    const remoteModel = rawModel as PartialVideoModelCapability;
    const localModel = local[id];

    if (!localModel) continue;
    merged[id] = mergeModel(localModel, remoteModel);
  }

  return merged;
}

export function mergeVoiceCapabilities(
  local: VoiceCapabilitiesMap,
  remote: Record<string, unknown>
): VoiceCapabilitiesMap {
  const merged: VoiceCapabilitiesMap = { ...local };

  for (const [id, rawModel] of Object.entries(remote)) {
    if (!rawModel || typeof rawModel !== 'object' || Array.isArray(rawModel)) continue;
    if (!KNOWN_VOICE_IDS.has(id)) continue;
    const remoteModel = rawModel as PartialVoiceModelCapability;
    const localModel = local[id];
    if (!localModel) continue;
    const next = {
      ...localModel,
      ...remoteModel,
    };
    if (!next.serverModelId || !next.defaultVoice) continue;
    merged[id] = next;
  }

  return merged;
}

export async function fetchRemoteVideoCapabilities(sid?: string): Promise<Record<string, unknown> | null> {
  try {
    const url = sid
      ? `/api/model-capabilities/video?sid=${encodeURIComponent(sid)}`
      : '/api/model-capabilities/video';
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return unwrapCapabilityPayload(payload, 'video');
  } catch {
    return null;
  }
}

export async function fetchRemoteVoiceCapabilities(sid?: string): Promise<Record<string, unknown> | null> {
  try {
    const url = sid
      ? `/api/model-capabilities/voice?sid=${encodeURIComponent(sid)}`
      : '/api/model-capabilities/voice';
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return unwrapCapabilityPayload(payload, 'voice');
  } catch {
    return null;
  }
}
