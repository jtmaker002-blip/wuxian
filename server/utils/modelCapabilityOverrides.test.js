import { describe, expect, it } from 'vitest';
import { LOCAL_VIDEO_CAPABILITIES, LOCAL_VOICE_CAPABILITIES } from '../../src/config/modelCapabilities.ts';
import { filterCapabilityPayloadByKnownIds, getKnownCapabilityIds, mergeCapabilityPayloads, sanitizeCapabilityPayload } from './modelCapabilityOverrides.js';

describe('filterCapabilityPayloadByKnownIds', () => {
  it('只保留白名单里的能力项', () => {
    expect(
      filterCapabilityPayloadByKnownIds(
        {
          'veo3.1': { serverModelId: 'veo-3.1-fast-generate-preview' },
          'unknown-video': { serverModelId: 'unknown-video' },
        },
        ['veo3.1']
      )
    ).toEqual({
      'veo3.1': { serverModelId: 'veo-3.1-fast-generate-preview' },
    });
  });

  it('无效输入时返回空对象', () => {
    expect(filterCapabilityPayloadByKnownIds(null, ['veo3.1'])).toEqual({});
    expect(filterCapabilityPayloadByKnownIds({}, [])).toEqual({});
  });

  it('按 kind 返回内置白名单', () => {
    expect(getKnownCapabilityIds('video')).toContain('veo3.1');
    expect(getKnownCapabilityIds('voice')).toContain('qwen3-tts-flash');
  });

  it('视频白名单与本地视频能力表 keys 保持一致', () => {
    expect(new Set(getKnownCapabilityIds('video'))).toEqual(new Set(Object.keys(LOCAL_VIDEO_CAPABILITIES)));
  });

  it('语音白名单与本地语音能力表 keys 保持一致', () => {
    expect(new Set(getKnownCapabilityIds('voice'))).toEqual(new Set(Object.keys(LOCAL_VOICE_CAPABILITIES)));
  });

  it('sanitizeCapabilityPayload 会丢掉未知能力 id', () => {
    expect(
      sanitizeCapabilityPayload('video', {
        'veo3.1': { serverModelId: 'veo-3.1-fast-generate-preview' },
        'unknown-video': { serverModelId: 'unknown-video' },
      })
    ).toEqual({
      'veo3.1': { serverModelId: 'veo-3.1-fast-generate-preview' },
    });
  });
});

describe('mergeCapabilityPayloads', () => {
  it('深合并 modes 子对象', () => {
    expect(
      mergeCapabilityPayloads(
        {
          'veo3.1': {
            serverModelId: 'veo-3.1-fast-generate-preview',
            modes: {
              standard: { supportsTextToVideo: true, durations: [4, 6, 8] },
            },
          },
        },
        {
          'veo3.1': {
            modes: {
              standard: { supportsTextToVideo: false, defaultDuration: 4 },
            },
          },
        }
      )
    ).toEqual({
      'veo3.1': {
        serverModelId: 'veo-3.1-fast-generate-preview',
        modes: {
          standard: {
            supportsTextToVideo: false,
            durations: [4, 6, 8],
            defaultDuration: 4,
          },
        },
      },
    });
  });
});
