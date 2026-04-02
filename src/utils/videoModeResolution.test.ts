import { describe, expect, it } from 'vitest';
import { NodeType } from '../types';
import { LOCAL_VIDEO_CAPABILITIES } from '../config/modelCapabilities';
import { getVideoModeAvailabilityState, getVideoModePrerequisiteState, resolveEffectiveVideoMode } from './videoModeResolution';

describe('resolveEffectiveVideoMode', () => {
  it('keeps explicit motion-control mode when prerequisites are ready', () => {
    expect(
      resolveEffectiveVideoMode(
        { type: NodeType.VIDEO, videoMode: 'motion-control', frameInputs: [], parentIds: [] },
        [{ type: NodeType.IMAGE }, { type: NodeType.VIDEO }]
      )
    ).toBe('motion-control');
  });

  it('keeps explicit frame-to-frame mode even when prerequisites are missing', () => {
    expect(
      resolveEffectiveVideoMode(
        { type: NodeType.VIDEO, videoMode: 'frame-to-frame', frameInputs: [], parentIds: ['a'] },
        [{ type: NodeType.IMAGE }]
      )
    ).toBe('frame-to-frame');
  });

  it('keeps frame-to-frame when there are two image inputs', () => {
    expect(
      resolveEffectiveVideoMode(
        { type: NodeType.VIDEO, videoMode: 'frame-to-frame', frameInputs: [{ nodeId: 'a', order: 'start' }, { nodeId: 'b', order: 'end' }], parentIds: ['a', 'b'] },
        [{ type: NodeType.IMAGE }, { type: NodeType.IMAGE }]
      )
    ).toBe('frame-to-frame');
  });

  it('keeps standard mode when there is only a video parent and motion-control was not explicitly chosen', () => {
    expect(
      resolveEffectiveVideoMode(
        { type: NodeType.VIDEO, videoMode: 'standard', frameInputs: [], parentIds: ['video-parent'] },
        [{ type: NodeType.VIDEO }]
      )
    ).toBe('standard');
  });

  it('keeps explicit motion-control mode even when prerequisites are missing', () => {
    expect(
      resolveEffectiveVideoMode(
        { type: NodeType.VIDEO, videoMode: 'motion-control', frameInputs: [], parentIds: ['only-video'] },
        [{ type: NodeType.VIDEO }]
      )
    ).toBe('motion-control');
  });

  it('keeps unsupported selected modes visible so the UI can warn instead of silently downgrading', () => {
    expect(
      getVideoModeAvailabilityState(
        { type: NodeType.VIDEO, videoMode: 'motion-control' },
        LOCAL_VIDEO_CAPABILITIES['kling-v3']
      )
    ).toMatchObject({
      selectedMode: 'motion-control',
      capabilityMode: 'motionControl',
      selectedModeEnabled: false,
    });
  });
});

describe('getVideoModePrerequisiteState', () => {
  it('marks frame-to-frame as unavailable until two image inputs are ready', () => {
    expect(
      getVideoModePrerequisiteState(
        { type: NodeType.VIDEO, videoMode: 'frame-to-frame', frameInputs: [], parentIds: ['a'] },
        [{ type: NodeType.IMAGE }]
      )
    ).toMatchObject({
      selectedMode: 'frame-to-frame',
      imageCount: 1,
      videoCount: 0,
      canUseFrameToFrame: false,
      canUseMotionControl: false,
      missingFrameToFrame: true,
      missingMotionReferenceVideo: true,
      missingMotionReferenceImage: false,
      missingMotionControl: true,
    });
  });

  it('requires both a video reference and an image reference for motion-control', () => {
    expect(
      getVideoModePrerequisiteState(
        { type: NodeType.VIDEO, videoMode: 'motion-control', frameInputs: [], parentIds: ['image-only'] },
        [{ type: NodeType.IMAGE }]
      )
    ).toMatchObject({
      selectedMode: 'motion-control',
      imageCount: 1,
      videoCount: 0,
      canUseFrameToFrame: false,
      canUseMotionControl: false,
      missingFrameToFrame: true,
      missingMotionReferenceVideo: true,
      missingMotionReferenceImage: false,
      missingMotionControl: true,
    });
  });

  it('treats motion-control as ready only when both references exist', () => {
    expect(
      getVideoModePrerequisiteState(
        { type: NodeType.VIDEO, videoMode: 'motion-control', frameInputs: [], parentIds: ['image', 'video'] },
        [{ type: NodeType.IMAGE }, { type: NodeType.VIDEO }]
      )
    ).toMatchObject({
      selectedMode: 'motion-control',
      imageCount: 1,
      videoCount: 1,
      canUseMotionControl: true,
      missingMotionReferenceVideo: false,
      missingMotionReferenceImage: false,
      missingMotionControl: false,
    });
  });
});
