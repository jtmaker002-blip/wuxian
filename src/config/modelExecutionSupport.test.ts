import { describe, expect, it } from 'vitest';
import {
  getImageExecutionSupport,
  getVideoExecutionSupport,
  getVideoExecutionSupportForContext,
  getVoiceExecutionSupport,
} from './modelExecutionSupport';

describe('model execution support', () => {
  it('marks hosted image models as token-backed', () => {
    expect(getImageExecutionSupport('gemini-3-pro-image-preview')).toMatchObject({
      mode: 'hosted-token',
    });
    expect(getImageExecutionSupport('midjourney-v6')).toMatchObject({
      mode: 'hosted-token',
    });
  });

  it('marks standard hosted-enabled video chains as token-backed', () => {
    expect(getVideoExecutionSupport('kling-v2-6')).toMatchObject({
      mode: 'hosted-token',
    });
    expect(getVideoExecutionSupport('minimax-hailuo')).toMatchObject({
      mode: 'hosted-token',
    });
    expect(getVideoExecutionSupport('jimeng-4.5')).toMatchObject({
      mode: 'hosted-token',
    });
  });

  it('marks current voice routes as unimplemented', () => {
    expect(getVoiceExecutionSupport('qwen3-tts-flash')).toMatchObject({
      mode: 'unimplemented',
    });
  });

  it('keeps advanced video modes local-key only when no hosted token is bound', () => {
    expect(getVideoExecutionSupportForContext('kling-v2-6', { videoMode: 'frame-to-frame' })).toMatchObject({
      mode: 'local-key',
    });
    expect(getVideoExecutionSupportForContext('veo3.1', { videoMode: 'frame-to-frame' })).toMatchObject({
      mode: 'local-key',
    });
    expect(getVideoExecutionSupportForContext('kling-v3', { videoMode: 'motion-control' })).toMatchObject({
      mode: 'local-key',
    });
    expect(getVideoExecutionSupportForContext('minimax-hailuo', {
      videoMode: 'standard',
      usesReferenceImages: true,
    })).toMatchObject({
      mode: 'local-key',
    });
  });

  it('treats advanced video modes as hosted-token fallback when a hosted token is already bound', () => {
    expect(getVideoExecutionSupportForContext('kling-v2-6', {
      videoMode: 'frame-to-frame',
      hasHostedToken: true,
    })).toMatchObject({
      mode: 'hosted-token',
    });
    expect(getVideoExecutionSupportForContext('kling-v3', {
      videoMode: 'motion-control',
      hasHostedToken: true,
    })).toMatchObject({
      mode: 'hosted-token',
    });
    expect(getVideoExecutionSupportForContext('minimax-hailuo', {
      videoMode: 'standard',
      usesReferenceImages: true,
      hasHostedToken: true,
    })).toMatchObject({
      mode: 'hosted-token',
    });
  });

  it('keeps standard video mode token-backed when no advanced inputs are active', () => {
    expect(getVideoExecutionSupportForContext('kling-v2-6', {
      videoMode: 'standard',
      usesReferenceImages: false,
    })).toMatchObject({
      mode: 'hosted-token',
    });
    expect(getVideoExecutionSupportForContext('veo3.1', {
      videoMode: 'standard',
      usesReferenceImages: false,
    })).toMatchObject({
      mode: 'hosted-token',
    });
    expect(getVideoExecutionSupportForContext('jimeng-4.5', {
      videoMode: 'standard',
      usesReferenceImages: false,
    })).toMatchObject({
      mode: 'hosted-token',
    });
  });
});
