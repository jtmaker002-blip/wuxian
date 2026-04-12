# Liblib Image Node Parity

This document tracks the scoped Liblib Canvas parity lane for:

- image node blank, selected, uploaded, and tool states
- image node to video node main path

Do not use this checklist to expand into unrelated site-wide UI or old OpenAiTeach token work.

## Verified Main Path

Run the focused browser smoke while `npm run dev` is serving `http://127.0.0.1:5173`:

```bash
npm run verify:liblib-image-node
```

The smoke covers:

- creating a blank image node
- uploading `public/workflow-sample-1.png`
- selected image node bottom panel and material count
- focus overlay selection and persisted focus state
- dragging an image connector to blank canvas and seeing `图生视频 / 主路径`
- dragging an uploaded image node into an existing video node and seeing image-to-video state
- triggering a nine-grid action

## Focused Automated Tests

```bash
npm test -- \
  src/components/canvas/image-node/imageNodeUiState.test.ts \
  src/utils/imageNodeActions.test.ts \
  src/components/canvas/image-node/FocusSelectionOverlay.test.ts \
  src/hooks/useConnectionDragging.test.ts \
  src/hooks/useContextMenuHandlers.test.ts \
  src/hooks/useImageNodeHandlers.test.ts \
  src/hooks/useNodeManagement.test.ts \
  src/hooks/useGeneration.test.ts \
  server/routes/generation-image.test.js
```

## Current Notes

- Full `npm test` still has unrelated macOS failures in server Windows-path/OpenAiTeach fixture tests.
- `.omx/**` and `.omc/**` are excluded from Vitest discovery so team worktrees do not pollute root test runs.
- Real Liblib Canvas pages require login/membership access; unauthenticated screenshots may show marketing/member modals instead of the canvas.
