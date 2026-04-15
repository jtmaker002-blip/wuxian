# Current Status

## Completed Pages / Surfaces

- Main canvas app in `src/App.tsx`.
- Workflow/project panel now uses `/api/projects` first and keeps `/api/workflows` as compatibility fallback.
- New project persistence API via `/api/projects`.
- New template API via `/api/templates`.
- Template library tab in the workflow panel can publish the current project and create project copies.
- Unified task API via `/api/tasks/*`.

## Completed Node Types

- Existing core nodes: text, image, video, audio, image editor, video editor, storyboard manager, local image/video model.
- New scene/tool nodes reuse existing `NodeData` with `scene`, `params`, `outputs`, `structuredData`, and `taskInfo`.

## Completed Task Interfaces

- `POST /api/tasks/create`
- `POST /api/tasks/status`
- `POST /api/tasks/cancel`
- `POST /api/tasks/cancel-batch`
- `POST /api/tasks/calculate-cost`
- `POST /api/tasks/retry`

## Completed Scene / Pipeline Registry

- `multi_view_nine_grid`
- `plot_deduction_four_grid`
- `coherent_storyboard_25`
- `cinematic_light_correction`
- `character_three_view_generate`
- `frame_deduction_plus_3s`
- `frame_deduction_minus_5s`
- `upscale`
- Server prompt templates now encode the guide-document behavior for the seven Slash workflows instead of using generic `scene result` prompts.
- `character_three_view_generate` returns one front/side/back production sheet and sends one real-provider Nano Banana request with the reference image attached.

## Completed Grid Item Operations

- Single-cell retry.
- Single-cell retry goes through `/api/tasks/retry` before falling back locally.
- Single-cell download.
- Send cell to a new image node.
- Send cell to a new upscale scene node and auto-run the upscale pipeline.

## Key Remaining Production Risks

- External real provider execution requires configured provider keys; without keys the system intentionally falls back to mock and shows a warning.
- Task storage is JSON-file backed, not Redis/BullMQ/PostgreSQL.
- Real relighting/upscale third-party provider adapters are not configured; local canvas implementations are used when an input image exists.
