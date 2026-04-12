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

Run the full scoped verification lane with:

```bash
npm run verify:liblib-image-node:full
```

The smoke covers:

- creating a blank image node
- uploading `public/workflow-sample-1.png`
- selected image node bottom panel and material count
- focus overlay selection and persisted focus state
- dragging an image connector to blank canvas and seeing `图生视频 / 主路径`
- selecting `图生视频` from the blank-drop menu and seeing a created image-to-video node
- dragging an uploaded image node into an existing video node and seeing image-to-video state
- selecting `标记 -> 保留区域`, deleting the annotation, and selecting `标记 -> 忽略区域`
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

## Implemented Scope

- Image node blank, uploaded, selected, focus, mark, top-toolbar, and bottom-panel states.
- Image tool real effects for `高清`, `扩图`, `重绘`, `擦除`, `抠图`, `裁剪`, `九宫格`, `宫格切分`, `打光`, and local `多角度` fallback.
- Image annotations for reference/note/preserve/ignore regions, including delete controls and generation metadata.
- Image connector blank-drop primary `图生视频` menu.
- Direct image-to-video connection state with stale video result cleanup.
- Image-to-video video controls with first-frame material state and `生成视频` action.

## Remaining External Dependency

The only remaining 1:1 limitation is access to an authenticated Liblib Canvas session for pixel-perfect comparison. If authenticated screenshots or recordings are available, compare them against `.omx/logs/liblib-image-node-smoke/manifest.json` artifacts and adjust visual spacing/motion accordingly.
