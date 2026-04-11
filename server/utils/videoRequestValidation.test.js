import { describe, expect, it } from 'vitest';
import { validateVideoRequest } from './videoRequestValidation.js';

describe('validateVideoRequest', () => {
  it('rejects motion control on non-kling-v2-6 models', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v3',
        imageBase64: 'img',
        motionReferenceUrl: 'motion',
      })
    ).toThrow(/只支持 Kling 2.6/i);
  });

  it('rejects frame-to-frame when end frame exists without start frame', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'veo-3.1',
        lastFrameBase64: 'end-frame',
      })
    ).toThrow(/必须同时提供首帧/i);
  });

  it('rejects unsupported kling durations', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v3',
        imageBase64: 'img',
        duration: 8,
      })
    ).toThrow(/仅支持 5 或 10 秒/i);
  });

  it('rejects unsupported hailuo durations', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'hailuo-2.3',
        imageBase64: 'img',
        duration: 5,
      })
    ).toThrow(/仅支持 6 或 10 秒/i);
  });

  it('rejects unsupported Veo-route durations', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'veo-3.1-fast-generate-preview',
        imageBase64: 'img',
        duration: 10,
      })
    ).toThrow(/仅支持 4、6 或 8 秒/i);
  });

  it('rejects unsupported Veo-route resolutions', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'veo-3.1-fast-generate-preview',
        imageBase64: 'img',
        resolution: '4K',
      })
    ).toThrow(/仅支持 512p、720p 或 1080p/i);
  });

  it('rejects unsupported Kling aspect ratios', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v3',
        imageBase64: 'img',
        aspectRatio: '1:1',
        duration: 5,
      })
    ).toThrow(/仅支持 16:9 或 9:16/i);
  });

  it('allows end-frame mode on kling-v2-6 when both frames are present', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v2-6',
        imageBase64: 'img',
        lastFrameBase64: 'end-frame',
        duration: 5,
        aspectRatio: '16:9',
        resolution: 'Auto',
      })
    ).not.toThrow();
  });

  it('rejects 1:1 end-frame mode on kling-v2-6', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v2-6',
        imageBase64: 'img',
        lastFrameBase64: 'end-frame',
        duration: 5,
        aspectRatio: '1:1',
        resolution: 'Auto',
      })
    ).toThrow(/首尾帧当前仅支持 16:9 或 9:16/i);
  });

  it('allows valid motion control for kling-v2-6', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v2-6',
        imageBase64: 'img',
        motionReferenceUrl: 'motion',
        duration: 5,
      })
    ).not.toThrow();
  });

  it('rejects mixed kling-v2-6 motion control and end frame input', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v2-6',
        imageBase64: 'img',
        lastFrameBase64: 'end-frame',
        motionReferenceUrl: 'motion',
      })
    ).toThrow(/不能与首尾帧模式混用/i);
  });

  it('rejects generateAudio for kling-v2-6 motion control', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v2-6',
        imageBase64: 'img',
        motionReferenceUrl: 'motion',
        generateAudio: true,
      })
    ).toThrow(/运动参考模式当前不支持音频生成/i);
  });

  it('allows valid kling-v2-6 text-to-video request with 1:1 ratio', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v2-6',
        duration: 5,
        aspectRatio: '1:1',
        resolution: 'Auto',
      })
    ).not.toThrow();
  });

  it('rejects unsupported kling-v2-6 explicit resolutions', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v2-6',
        imageBase64: 'img',
        duration: 5,
        resolution: '720p',
      })
    ).toThrow(/仅支持 Auto 分辨率/i);
  });

  it('allows valid standard kling image-to-video request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'kling-v3',
        imageBase64: 'img',
        duration: 5,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).not.toThrow();
  });

  it('allows valid hailuo frame-to-frame request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'hailuo-2.3',
        imageBase64: 'start',
        lastFrameBase64: 'end',
        duration: 6,
        aspectRatio: '9:16',
        resolution: '768p',
      })
    ).not.toThrow();
  });

  it('allows valid hailuo standard reference-images request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'minimax-hailuo',
        referenceImagesBase64: ['ref-a', 'ref-b'],
        duration: 6,
        aspectRatio: '16:9',
        resolution: '768p',
      })
    ).not.toThrow();
  });

  it('rejects mixed hailuo start-frame and reference-images input', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'minimax-hailuo',
        imageBase64: 'start',
        referenceImagesBase64: ['ref-a'],
        duration: 6,
        aspectRatio: '16:9',
        resolution: '768p',
      })
    ).toThrow(/不能同时混用首帧图生和参考图模式/i);
  });

  it('allows valid Veo frame-to-frame request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'veo-3.1-fast-generate-preview',
        imageBase64: 'start',
        lastFrameBase64: 'end',
        duration: 4,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).not.toThrow();
  });

  it('rejects sora-2 frame-to-frame requests instead of silently dropping the tail frame', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'sora-2',
        imageBase64: 'start',
        lastFrameBase64: 'end',
        duration: 4,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).toThrow(/Sora 2 当前不支持首尾帧模式/i);
  });

  it('rejects generateAudio for non-kling-v2-6 models', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'veo-3.1-fast-generate-preview',
        imageBase64: 'img',
        duration: 4,
        generateAudio: true,
      })
    ).toThrow(/暂不支持音频生成/i);
  });

  it('rejects unknown video models instead of silently falling back to Veo', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'totally-unknown-video',
        imageBase64: 'img',
      })
    ).toThrow(/unsupported video model/i);
  });

  it('allows valid wan 2.6 image-to-video request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'wan2.6-i2v',
        imageBase64: 'img',
        duration: 10,
        aspectRatio: 'Auto',
        resolution: '1080p',
      })
    ).not.toThrow();
  });

  it('rejects wan 2.6 image-to-video without image input', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'wan2.6-i2v',
        duration: 10,
        aspectRatio: 'Auto',
        resolution: '1080p',
      })
    ).toThrow(/必须提供首帧图片/i);
  });

  it('rejects wan 2.6 image-to-video unsupported ratio overrides', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'wan2.6-i2v',
        imageBase64: 'img',
        duration: 10,
        aspectRatio: '16:9',
        resolution: '1080p',
      })
    ).toThrow(/原图比例/i);
  });

  it('rejects grok reference-images request because当前后端还没接通这条链', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'grok-video-3',
        referenceImagesBase64: ['img-a', 'img-b'],
        duration: 10,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).toThrow(/不支持多图\/全图参考/i);
  });

  it('allows jimeng-seedance-2 standard text-to-video request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-seedance-2',
        duration: 5,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).not.toThrow();
  });

  it('allows jimeng-seedance-2 standard 10-second portrait request inside the safe boundary', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-seedance-2',
        duration: 10,
        aspectRatio: '9:16',
        resolution: '1080p',
      })
    ).not.toThrow();
  });

  it('allows seedance audio on supported jimeng models', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-4.1',
        duration: 10,
        aspectRatio: '9:16',
        resolution: '720p',
        generateAudio: true,
      })
    ).not.toThrow();
  });

  it('allows jimeng-4.1 standard image-to-video request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-4.1',
        imageBase64: 'start',
        duration: 5,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).not.toThrow();
  });

  it('allows jimeng-seedance-2 frame-to-frame request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-seedance-2',
        imageBase64: 'start',
        lastFrameBase64: 'end',
        duration: 10,
        aspectRatio: '9:16',
        resolution: '1080p',
      })
    ).not.toThrow();
  });

  it('rejects jimeng motion-control requests', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-seedance-2',
        imageBase64: 'start',
        motionReferenceUrl: 'motion',
      })
    ).toThrow(/只支持 kling 2\.6|尚未接通模式|不支持运动参考模式/i);
  });

  it('rejects unsupported jimeng duration outside the narrowed safe boundary', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-4.5',
        duration: 8,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).toThrow(/仅支持 5 或 10 秒/i);
  });

  it('rejects unsupported jimeng aspect ratios outside the narrowed safe boundary', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-4.5',
        duration: 5,
        aspectRatio: '1:1',
        resolution: '720p',
      })
    ).toThrow(/仅支持 16:9 或 9:16/i);
  });

  it('rejects jimeng models without frame-to-frame support when end frame is present', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-4.1',
        imageBase64: 'start',
        lastFrameBase64: 'end',
        duration: 5,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).toThrow(/尚未接通首尾帧模式/i);
  });

  it('rejects jimeng-4.0 frame-to-frame requests', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'jimeng-4.0',
        imageBase64: 'start',
        lastFrameBase64: 'end',
        duration: 5,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).toThrow(/尚未接通首尾帧模式/i);
  });

  it('allows valid grok text-to-video request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'grok-video-3',
        duration: 8,
        aspectRatio: '16:9',
        resolution: '720p',
      })
    ).not.toThrow();
  });

  it('allows valid grok single-image video request', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'grok-video-3',
        imageBase64: 'img',
        duration: 6,
        aspectRatio: '9:16',
        resolution: '480p',
      })
    ).not.toThrow();
  });

  it('rejects grok reference-images mixed with image-to-video', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'grok-video-3',
        imageBase64: 'img',
        referenceImagesBase64: ['img-a', 'img-b'],
      })
    ).toThrow(/不能同时使用首帧图片和多图参考/i);
  });

  it('rejects grok reference-images requests longer than 10 seconds', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'grok-video-3',
        referenceImagesBase64: ['img-a', 'img-b'],
        duration: 12,
      })
    ).toThrow(/不支持多图\/全图参考/i);
  });

  it('rejects grok reference-images requests beyond seven images', () => {
    expect(() =>
      validateVideoRequest({
        videoModel: 'grok-video-3',
        referenceImagesBase64: ['1', '2', '3', '4', '5', '6', '7', '8'],
        duration: 10,
      })
    ).toThrow(/不支持多图\/全图参考/i);
  });
});
