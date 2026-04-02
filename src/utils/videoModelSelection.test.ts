import { describe, expect, it } from 'vitest';
import { shouldRepairMissingVideoModel } from './videoModelSelection';

describe('video model selection repair', () => {
  const registryIds = ['veo3.1', 'kling-v2-6', 'minimax-hailuo'];

  it('repairs an empty model id', () => {
    expect(shouldRepairMissingVideoModel(undefined, registryIds)).toBe(true);
  });

  it('does not repair a valid registered model even when it may be temporarily unavailable', () => {
    expect(shouldRepairMissingVideoModel('minimax-hailuo', registryIds)).toBe(false);
  });

  it('does not repair the tiktok import placeholder', () => {
    expect(shouldRepairMissingVideoModel('tiktok-import', registryIds)).toBe(false);
  });

  it('repairs a truly unknown model id', () => {
    expect(shouldRepairMissingVideoModel('veo3.1-pro-ghost', registryIds)).toBe(true);
  });
});
