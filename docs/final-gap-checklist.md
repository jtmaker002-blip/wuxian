# Final Gap Checklist

## Completed

- Unified scene registry and pipeline registry.
- Unified task envelope and task client.
- Task create/status/cancel/batch-cancel/cost/retry API.
- Task snapshots persisted to disk under the runtime task directory.
- Four-grid and 25-grid structured storyboard outputs.
- Character bible and world bible output for 25-grid storyboard.
- Character three-view structured profile and view list.
- Frame deduction structured `motionDelta`, `cameraDelta`, `environmentDelta`, and `targetFramePrompt`.
- Cinematic lighting request mapping with `UI_KeyLight`, `UI_RimLight`, `UI_LightColor`, and `UI_LightBrightness`.
- Upscale structured output and local real canvas upscale path.
- Grid item retry, upscale, download, and send-to-node operations.
- Project save/load API and template publish/create-copy API.
- Template graph remapping for nodes, parentIds, edges, and groups.
- Liblib image-node smoke verification remains green.

## Not Fully Production-External

- Real provider calls require `OPENAI_API_KEY` or hosted provider credentials.
- Redis/BullMQ/PostgreSQL queue is not installed; file-backed task storage is the current durable implementation.
- Dedicated third-party relighting/upscale providers are not configured; local canvas tools are used as real offline actions.

## Risk Items

- Full `npm test` still includes known out-of-scope legacy OpenAiTeach/Windows-path failures on this branch.
- Scene result UI is implemented directly in React without a full component interaction test suite.
- Large Vite bundle warning remains.

## Next Suggested Step

- Configure a real provider key and run one `executionMode=real` scene task end-to-end, then add a provider-success integration test using a mocked OpenAI client.
