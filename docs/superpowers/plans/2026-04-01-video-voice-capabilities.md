# Video And Voice Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first, remotely-overridable capability system for video and voice models, then wire video node parameter UI and generation validation to that capability source of truth.

**Architecture:** Introduce a dedicated capability layer keyed by registry model id, with explicit `serverModelId`, per-mode video capability objects, schema validation, and deep merge semantics. Video nodes and generation requests will consume sanitized capability-derived state instead of scattered hardcoded checks. Voice support starts as schema + loading support only, without full runtime node execution yet.

**Tech Stack:** Vite, React, TypeScript, Zustand, Express, Vitest

---

### File Map

**Create**
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\modelCapabilities.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\modelCapabilities.test.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\services\remoteCapabilitiesService.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\services\remoteCapabilitiesService.test.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\utils\videoCapabilityState.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\utils\videoCapabilityState.test.ts`

**Modify**
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryCanvasModels.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryModelBridge.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\components\canvas\NodeControls.tsx`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\hooks\useGeneration.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\types.ts`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\src\App.tsx`
- `E:\自己的无限画布\TwitCanva-Video-Workflow\server\routes\generation.js`

**Optional later**
- `E:\自己的无限画布\TwitCanva-Video-Workflow\server\routes\openaiteach-proxy.js` (only if a capability relay endpoint becomes necessary in dev)

---

### Task 1: Add local capability schema and defaults

**Files:**
- Create: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\modelCapabilities.ts`
- Test: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\modelCapabilities.test.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- known video model returns capability by registry id
- known voice model returns capability by registry id
- every video capability has `serverModelId`
- every video capability mode has valid defaults contained in its option arrays
- fallback model references only known models

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/modelCapabilities.test.ts`

Expected: FAIL because file/functions do not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement:
- exported video capability map
- exported voice capability map
- helper getters like `getVideoCapability(id)` and `getVoiceCapability(id)`
- local defaults for currently supported project models only

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/modelCapabilities.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/modelCapabilities.ts src/config/modelCapabilities.test.ts
git commit -m "feat: add local video and voice capability registry"
```

### Task 2: Implement remote override schema and deep-merge rules

**Files:**
- Create: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\services\remoteCapabilitiesService.ts`
- Test: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\services\remoteCapabilitiesService.test.ts`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\modelCapabilities.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- partial remote `modes.standard` field overrides only the targeted field
- invalid remote defaults are rejected
- unknown remote model ids are ignored
- invalid empty option arrays are ignored
- valid remote override preserves local required fields

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/remoteCapabilitiesService.test.ts`

Expected: FAIL because merge/validation utilities do not exist yet

- [ ] **Step 3: Write minimal implementation**

Implement:
- schema guard functions
- `mergeCapabilities(local, remote)`
- model-level merge
- mode-level deep merge
- validation errors reported via return structure or console warnings

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/remoteCapabilitiesService.test.ts src/config/modelCapabilities.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/remoteCapabilitiesService.ts src/services/remoteCapabilitiesService.test.ts src/config/modelCapabilities.ts
git commit -m "feat: add remote capability override validation"
```

### Task 3: Unify registry model ids with generation target ids

**Files:**
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryModelBridge.ts`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryCanvasModels.ts`
- Test: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\modelCapabilities.test.ts`

- [ ] **Step 1: Write/extend failing tests**

Cover:
- capability lookup by registry id returns explicit `serverModelId`
- `mapRegistryVideoIdToServerVideoId()` uses capability config instead of hardcoded provider collapse
- legacy id normalization still works

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/modelCapabilities.test.ts`

Expected: FAIL on old hardcoded mapping assumptions

- [ ] **Step 3: Write minimal implementation**

Refactor:
- keep legacy id canonicalization in `registryModelBridge.ts`
- move server target resolution to capability data
- stop hardcoding broad collapse where capability data already has exact server target

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/modelCapabilities.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/registryModelBridge.ts src/config/registryCanvasModels.ts src/config/modelCapabilities.ts src/config/modelCapabilities.test.ts
git commit -m "refactor: source video server ids from capability registry"
```

### Task 4: Add video capability-driven state sanitization helpers

**Files:**
- Create: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\utils\videoCapabilityState.ts`
- Test: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\utils\videoCapabilityState.test.ts`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\types.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- switching model keeps existing values if still allowed
- invalid duration falls back to mode default
- invalid resolution falls back to mode default
- invalid aspect ratio falls back to mode default
- switching to unsupported mode falls back to first enabled mode
- downlevel model strips forbidden fields (`frameInputs`, `motionReferenceUrl`, `generateAudio`)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/videoCapabilityState.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Add helpers:
- `getEnabledVideoModes(capability)`
- `sanitizeVideoNodeState(node, capability)`
- `coerceVideoMode(node, capability)`

Also update `NodeData.videoMode` comments to reflect explicit runtime mode, not inferred mode.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/videoCapabilityState.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/videoCapabilityState.ts src/utils/videoCapabilityState.test.ts src/types.ts
git commit -m "feat: add video capability state sanitization helpers"
```

### Task 5: Wire NodeControls video UI to capability matrix

**Files:**
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\components\canvas\NodeControls.tsx`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryCanvasModels.ts`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\App.tsx` (only if capability data must be loaded at app level)

- [ ] **Step 1: Identify the current hardcoded video UI branches**

Read and note:
- hardcoded duration arrays
- hardcoded aspect ratio arrays
- hardcoded resolution arrays
- auto-open advanced logic
- provider-specific toggles

- [ ] **Step 2: Replace hardcoded option sources with capability-derived options**

Use capability helpers so current model + current mode drive:
- available durations
- available aspect ratios
- available resolutions
- whether advanced mode choices appear
- whether audio toggle appears

- [ ] **Step 3: Enforce explicit mode selection**

Make sure `videoMode` is explicit on nodes:
- `standard`
- `frame-to-frame`
- `motion-control`

No new generation path may infer mode only from parent count.

- [ ] **Step 4: Sanitize node values on model change**

When user changes model:
- retain legal values
- fallback invalid values to defaults
- strip unsupported fields

- [ ] **Step 5: Run targeted verification**

Run:
- `npm run test`
- `npm run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/NodeControls.tsx src/config/registryCanvasModels.ts src/utils/videoCapabilityState.ts src/types.ts
git commit -m "feat: drive video node controls from capability matrix"
```

### Task 6: Enforce capability contracts in generation request building

**Files:**
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\hooks\useGeneration.ts`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryModelBridge.ts`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\utils\videoCapabilityState.ts`

- [ ] **Step 1: Write/extend failing tests where possible**

If no direct hook tests exist, add small utility-level tests around payload shaping.

Cover:
- `standard` forbids `frameInputs` and `motionReferenceUrl`
- `frameToFrame` requires start/end inputs
- `motionControl` requires motion reference and forbids frame inputs
- unsupported audio flag gets dropped

- [ ] **Step 2: Run test to verify it fails**

Run: targeted vitest command for new utility tests

- [ ] **Step 3: Update generation assembly**

Before request dispatch:
- read capability by current video model
- sanitize state
- build payload only with legal fields for current mode
- use capability-backed `serverModelId`

- [ ] **Step 4: Run verification**

Run:
- `npm run test`
- `npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGeneration.ts src/config/registryModelBridge.ts src/utils/videoCapabilityState.ts
git commit -m "feat: validate video generation params from capability matrix"
```

### Task 7: Add runtime loading of remote capabilities

**Files:**
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\App.tsx`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\services\remoteCapabilitiesService.ts`
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\modelCapabilities.ts`

- [ ] **Step 1: Define runtime loading behavior**

Implement:
- load local defaults immediately
- attempt remote fetch after app init or login
- on success merge and publish runtime capability set
- on failure log warning and retain local defaults

- [ ] **Step 2: Revalidate existing nodes after remote load**

When capabilities change:
- sanitize existing video nodes
- if values changed, update node state
- optionally expose one-time notification marker for UI later

- [ ] **Step 3: Verify**

Run:
- `npm run test`
- `npm run build`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/services/remoteCapabilitiesService.ts src/config/modelCapabilities.ts src/utils/videoCapabilityState.ts
git commit -m "feat: load remote video and voice capabilities with fallback"
```

### Task 8: Add minimal backend guardrails for generation route

**Files:**
- Modify: `E:\自己的无限画布\TwitCanva-Video-Workflow\server\routes\generation.js`

- [ ] **Step 1: Add request validation comments or utility use points**

Document and, where safe, enforce:
- standard mode field contract
- frameToFrame field contract
- motionControl field contract

- [ ] **Step 2: Apply minimal defensive checks**

Do not rewrite the entire route. Only:
- reject impossible combinations
- log clear errors for unsupported combinations
- keep existing provider handlers intact

- [ ] **Step 3: Verify**

Run:
- `npm run build`
- smoke the app in dev if necessary

- [ ] **Step 4: Commit**

```bash
git add server/routes/generation.js
git commit -m "chore: add generation route guardrails for video capability modes"
```

### Task 9: Final verification and handoff

**Files:**
- Review all modified files above

- [ ] **Step 1: Run full verification**

Run:
- `npm run test`
- `npm run build`

- [ ] **Step 2: Manual smoke checklist**

Verify in the app:
- switching video models changes visible options
- unsupported options disappear
- invalid saved values reset cleanly
- remote capability fetch failure does not break local defaults
- token/settings flow still works

- [ ] **Step 3: Prepare review summary**

Include:
- exact changed files
- exact user-visible behavior changes
- any deferred work (voice runtime node support, backend admin UI)

