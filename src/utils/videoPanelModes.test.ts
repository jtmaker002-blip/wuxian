import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';
import {
  getLegacyVideoModeForPanelMode,
  getVideoPanelModeByKey,
  getVideoPanelModeReferencePolicy,
  getVideoPanelModeValidation,
  resolveVideoPanelModeKey,
} from './videoPanelModes';

function createVideoNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'video-node',
    type: NodeType.VIDEO,
    x: 0,
    y: 0,
    prompt: '',
    status: NodeStatus.IDLE,
    model: 'veo3.1',
    videoModel: 'veo3.1',
    videoMode: 'standard',
    aspectRatio: '16:9',
    resolution: '720p',
    parentIds: [],
    ...overrides,
  };
}

describe('videoPanelModes', () => {
  it('exposes Liblib main video tabs with their confirmed keys', () => {
    expect(getVideoPanelModeByKey('text2video')).toMatchObject({
      key: 'text2video',
      label: '文生视频',
      listKey: null,
    });
    expect(getVideoPanelModeByKey('mixed2video')).toMatchObject({
      key: 'mixed2video',
      label: '全能参考',
      listKey: 'mixedList',
    });
    expect(getVideoPanelModeByKey('singleImage2video')).toMatchObject({
      key: 'singleImage2video',
      label: '图生视频',
      listKey: 'imageList',
    });
    expect(getVideoPanelModeByKey('frames2video')).toMatchObject({
      key: 'frames2video',
      label: '首尾帧',
      listKey: 'imageList',
    });
    expect(getVideoPanelModeByKey('image2video')).toMatchObject({
      key: 'image2video',
      label: '图片参考',
      listKey: 'imageList',
    });
  });

  it('maps panel tabs onto existing executable video modes without inventing a parallel pipeline', () => {
    expect(getLegacyVideoModeForPanelMode('text2video')).toBe('standard');
    expect(getLegacyVideoModeForPanelMode('singleImage2video')).toBe('standard');
    expect(getLegacyVideoModeForPanelMode('image2video')).toBe('standard');
    expect(getLegacyVideoModeForPanelMode('mixed2video')).toBe('standard');
    expect(getLegacyVideoModeForPanelMode('frames2video')).toBe('frame-to-frame');
  });

  it('resolves legacy frame-to-frame nodes to the 首尾帧 tab when no panel mode is stored yet', () => {
    expect(resolveVideoPanelModeKey(createVideoNode({ videoMode: 'frame-to-frame' }))).toBe('frames2video');
  });

  it('keeps an explicitly selected 全能参考 mode even if the legacy videoMode is standard', () => {
    expect(resolveVideoPanelModeKey(createVideoNode({ videoPanelMode: 'mixed2video' }))).toBe('mixed2video');
  });

  it('applies input validation rules per tab', () => {
    expect(getVideoPanelModeValidation('text2video', { imageCount: 2, videoCount: 1, audioCount: 0 })).toMatchObject({
      isValid: true,
      acceptsCurrentInputs: false,
    });
    expect(getVideoPanelModeValidation('singleImage2video', { imageCount: 0, videoCount: 1, audioCount: 0 })).toMatchObject({
      isValid: false,
      reason: '图生视频至少需要 1 张图片素材。',
    });
    expect(getVideoPanelModeValidation('frames2video', { imageCount: 1, videoCount: 0, audioCount: 0 })).toMatchObject({
      isValid: false,
      reason: '首尾帧需要连接 2 张图片，分别作为首帧和尾帧。',
    });
    expect(getVideoPanelModeValidation('mixed2video', { imageCount: 1, videoCount: 1, audioCount: 0 })).toMatchObject({
      isValid: true,
      acceptsCurrentInputs: true,
    });
  });

  it('disables preset camera moves for modes that Liblib marks as restricted', () => {
    expect(getVideoPanelModeReferencePolicy('frames2video')).toMatchObject({
      canUsePresetCamera: false,
    });
    expect(getVideoPanelModeReferencePolicy('mixed2video')).toMatchObject({
      canUsePresetCamera: true,
      acceptsVideo: true,
    });
  });
});
