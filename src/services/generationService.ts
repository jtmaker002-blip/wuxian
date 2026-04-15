/**
 * generationService.ts
 * 
 * Frontend service layer for AI content generation.
 * Proxies requests to backend API which handles multiple providers:
 * - Image: Gemini Pro, Kling AI
 * - Video: Veo 3.1, Kling AI
 */

import type {
  CameraPreset,
  FocusSelection,
  ImageAnnotation,
  ImageCameraSettings,
  ImageLightingSettings,
  ImageToolMode,
  VideoCameraControlState,
} from '../types';
import { readStoredOpenAiTeachProviderConfig } from '../shared/provider/openaiteach-config';

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  imageBase64?: string | string[]; // Supports single image or array of images
  imageModel?: string; // Image model version (e.g., 'gemini-pro', 'kling-v2')
  nodeId?: string; // ID of the node initiating generation
  providerApiKey?: string;
  providerBaseUrl?: string;
  // Kling V1.5 reference settings
  klingReferenceMode?: 'subject' | 'face';
  klingFaceIntensity?: number; // 0-100
  klingSubjectIntensity?: number; // 0-100
  focusSelection?: FocusSelection;
  imageAnnotations?: ImageAnnotation[];
  imageToolMode?: Exclude<ImageToolMode, null>;
  imageToolAction?: string;
  imageCameraSettings?: ImageCameraSettings;
  imageLightingSettings?: ImageLightingSettings;
}

export interface GenerateVideoParams {
  prompt: string;
  imageBase64?: string; // For Image-to-Video (start frame)
  referenceImagesBase64?: string[]; // For providers that support multi-image / full reference
  lastFrameBase64?: string; // For frame-to-frame interpolation (end frame)
  aspectRatio?: string;
  resolution?: string; // Add resolution to params
  duration?: number; // Video duration in seconds (e.g., 5, 6, 8, 10)
  videoModel?: string; // Video model version (e.g., 'veo-3.1', 'kling-v2-1')
  motionReferenceUrl?: string; // For Kling 2.6 motion control
  generateAudio?: boolean; // For Kling 2.6 and Veo 3.1 native audio (default: true)
  cameraPresets?: CameraPreset[];
  videoCameraControl?: VideoCameraControlState;
  nodeId?: string; // ID of the node initiating generation
  providerApiKey?: string;
  providerBaseUrl?: string;
}

export interface GenerateVideoResult {
  resultUrl: string;
  requestedModel?: string;
  executedModel?: string;
  executedMode?: string;
  executionProvider?: string;
}

export interface GenerateAudioParams {
  prompt: string;
  audioModel?: string;
  nodeId?: string;
  providerApiKey?: string;
  providerBaseUrl?: string;
}

/**
 * Generates an image by calling the backend API
 */
export const generateImage = async (params: GenerateImageParams): Promise<string> => {
  try {
    const providerConfig =
      params.providerApiKey || params.providerBaseUrl
        ? {}
        : readStoredOpenAiTeachProviderConfig();

    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...providerConfig,
        ...params,
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || response.statusText);
    }

    const data = await response.json();
    if (!data.resultUrl) {
      throw new Error("No image data returned from server");
    }
    return data.resultUrl;

  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};

/**
 * Generates a video by calling the backend API
 */
export const generateVideo = async (params: GenerateVideoParams): Promise<GenerateVideoResult> => {
  try {
    const providerConfig =
      params.providerApiKey || params.providerBaseUrl
        ? {}
        : readStoredOpenAiTeachProviderConfig();

    const response = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...providerConfig,
        ...params,
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || response.statusText);
    }

    const data = await response.json();
    if (!data.resultUrl) {
      throw new Error("No video data returned from server");
    }
    return {
      resultUrl: data.resultUrl,
      requestedModel: data.requestedModel,
      executedModel: data.executedModel,
      executedMode: data.executedMode,
      executionProvider: data.executionProvider,
    };

  } catch (error) {
    console.error("Video Generation Error:", error);
    throw error;
  }
};

export const generateAudio = async (params: GenerateAudioParams): Promise<string> => {
  try {
    const providerConfig =
      params.providerApiKey || params.providerBaseUrl
        ? {}
        : readStoredOpenAiTeachProviderConfig();

    const response = await fetch('/api/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...providerConfig,
        ...params,
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || response.statusText);
    }

    const data = await response.json();
    if (!data.resultUrl) {
      throw new Error('No audio data returned from server');
    }
    return data.resultUrl;
  } catch (error) {
    console.error('Audio Generation Error:', error);
    throw error;
  }
};
