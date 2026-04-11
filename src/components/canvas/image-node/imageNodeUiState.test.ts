import { describe, expect, it } from 'vitest';

import {
  getLiblibBlankImageNodeState,
  getLiblibImageReferenceState,
} from './imageNodeUiState';

describe('image node UI state', () => {
  it('prefers the uploaded/current image as the Liblib material preview', () => {
    expect(
      getLiblibImageReferenceState({
        connectedImageNodes: [{ id: 'parent-1', url: 'parent.png' }],
        inputUrl: 'uploaded.png',
        resultUrl: 'result.png',
      })
    ).toEqual({
      count: 1,
      hasReference: true,
      previewUrl: 'uploaded.png',
    });
  });

  it('falls back to connected image nodes when the current image has no direct URL', () => {
    expect(
      getLiblibImageReferenceState({
        connectedImageNodes: [
          { id: 'parent-1', url: 'parent.png' },
          { id: 'parent-2', url: 'second.png' },
        ],
      })
    ).toEqual({
      count: 2,
      hasReference: true,
      previewUrl: 'parent.png',
    });
  });

  it('marks selected blank hosted image nodes as Liblib upload surfaces', () => {
    expect(
      getLiblibBlankImageNodeState({
        selected: true,
        isImageType: true,
        isLocalModel: false,
        hasUploadHandler: true,
      })
    ).toEqual({
      headline: null,
      showMutedIcon: true,
      showSelectedBlankFrame: true,
      showSelectedUploadCta: true,
    });
  });
});
