# Node Type Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为普通生成节点增加一个类型下拉框，让同一个节点可以在文字、图片、视频三种类型之间切换，并正确迁移节点数据。

**Architecture:** 新增一个前端节点类型注册表，统一管理三种可切换节点的默认值和迁移规则。节点 UI 在 `CanvasNode.tsx` 渲染下拉框，切换逻辑集中放进 `useNodeManagement.ts`，`NodeContent.tsx` 和现有控制区继续根据 `data.type` 自然重渲。

**Tech Stack:** React 19、TypeScript、现有画布节点系统、现有模型注册表

---

## 文件结构

### 新建文件

- `src/config/nodeTypeRegistry.ts`
  - 维护可切换节点类型的显示名、默认模型、默认参数、清理规则

### 修改文件

- `src/types.ts`
  - 明确普通可切换节点的类型范围
  - 如有需要，补充辅助类型
- `src/hooks/useNodeManagement.ts`
  - 新增节点类型切换方法
  - 统一处理节点数据迁移和清理
- `src/components/canvas/CanvasNode.tsx`
  - 在普通节点标题区域增加类型下拉框
  - 将切换动作传给 `useNodeManagement`
- `src/components/canvas/NodeContent.tsx`
  - 如有必要，修正切换到文字节点后的默认展示状态
- `src/App.tsx`
  - 如果当前节点更新入口是从这里传入，需要把新切换方法一路透传

### 测试文件

- 新建：`src/config/nodeTypeRegistry.test.ts`
- 新建：`src/hooks/useNodeManagement.node-type-switch.test.ts`

---

### Task 1: 定义可切换节点类型注册表

**Files:**
- Create: `src/config/nodeTypeRegistry.ts`
- Test: `src/config/nodeTypeRegistry.test.ts`

- [ ] **Step 1: 写失败测试，验证注册表只开放三种可切换类型**

```ts
import { describe, expect, it } from 'vitest';
import { SWITCHABLE_NODE_TYPES, getDefaultNodeTypeConfig } from './nodeTypeRegistry';
import { NodeType } from '../types';

describe('nodeTypeRegistry', () => {
  it('only exposes text image and video as switchable types', () => {
    expect(SWITCHABLE_NODE_TYPES).toEqual([
      NodeType.TEXT,
      NodeType.IMAGE,
      NodeType.VIDEO,
    ]);
  });

  it('returns default config for image nodes', () => {
    const config = getDefaultNodeTypeConfig(NodeType.IMAGE);
    expect(config.type).toBe(NodeType.IMAGE);
    expect(config.aspectRatio).toBe('Auto');
    expect(config.resolution).toBe('Auto');
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npx vitest run src/config/nodeTypeRegistry.test.ts`  
Expected: FAIL，因为文件和导出还不存在。

- [ ] **Step 3: 写最小实现**

```ts
import { NodeType, NodeStatus, type NodeData } from '../types';

export type SwitchableNodeType = NodeType.TEXT | NodeType.IMAGE | NodeType.VIDEO;

export type NodeTypeConfig = Pick<
  NodeData,
  'type' | 'model' | 'aspectRatio' | 'resolution'
> & {
  textMode?: 'menu' | 'editing';
  videoMode?: 'standard' | 'frame-to-frame' | 'motion-control';
};

export const SWITCHABLE_NODE_TYPES: SwitchableNodeType[] = [
  NodeType.TEXT,
  NodeType.IMAGE,
  NodeType.VIDEO,
];

const DEFAULTS: Record<SwitchableNodeType, NodeTypeConfig> = {
  [NodeType.TEXT]: {
    type: NodeType.TEXT,
    model: 'gpt-4o',
    aspectRatio: 'Auto',
    resolution: 'Auto',
    textMode: 'editing',
  },
  [NodeType.IMAGE]: {
    type: NodeType.IMAGE,
    model: 'Nano Banana 1',
    aspectRatio: 'Auto',
    resolution: 'Auto',
  },
  [NodeType.VIDEO]: {
    type: NodeType.VIDEO,
    model: 'kling-v2-1',
    aspectRatio: '16:9',
    resolution: 'Auto',
    videoMode: 'standard',
  },
};

export function getDefaultNodeTypeConfig(type: SwitchableNodeType): NodeTypeConfig {
  return DEFAULTS[type];
}

export function isSwitchableNodeType(type: NodeType): type is SwitchableNodeType {
  return SWITCHABLE_NODE_TYPES.includes(type as SwitchableNodeType);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/config/nodeTypeRegistry.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/nodeTypeRegistry.ts src/config/nodeTypeRegistry.test.ts
git commit -m "feat: add switchable node type registry"
```

---

### Task 2: 在节点管理里实现类型切换与数据迁移

**Files:**
- Modify: `src/hooks/useNodeManagement.ts`
- Test: `src/hooks/useNodeManagement.node-type-switch.test.ts`

- [ ] **Step 1: 写失败测试，验证切换时保留 prompt、清掉旧结果**

```ts
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNodeManagement } from './useNodeManagement';
import { NodeStatus, NodeType } from '../types';

describe('useNodeManagement node type switch', () => {
  it('keeps prompt but clears image-specific result when switching image to text', () => {
    const { result } = renderHook(() => useNodeManagement());

    act(() => {
      result.current.setNodes([
        {
          id: 'n1',
          type: NodeType.IMAGE,
          x: 0,
          y: 0,
          prompt: 'hello world',
          status: NodeStatus.SUCCESS,
          resultUrl: 'https://example.com/a.png',
          model: 'Nano Banana 1',
          aspectRatio: '1:1',
          resolution: '2K',
          parentIds: [],
        },
      ]);
    });

    act(() => {
      result.current.switchNodeType('n1', NodeType.TEXT);
    });

    const node = result.current.nodes[0];
    expect(node.type).toBe(NodeType.TEXT);
    expect(node.prompt).toBe('hello world');
    expect(node.resultUrl).toBeUndefined();
    expect(node.status).toBe(NodeStatus.IDLE);
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npx vitest run src/hooks/useNodeManagement.node-type-switch.test.ts`  
Expected: FAIL，因为 `switchNodeType` 还不存在。

- [ ] **Step 3: 在 useNodeManagement.ts 中新增最小切换方法**

实现目标：
- 只允许切换 `Text / Image / Video`
- 保留：
  - `prompt`
  - `title`
  - `x / y`
  - `parentIds`
  - `groupId`
- 清理：
  - `resultUrl`
  - `lastFrame`
  - `errorMessage`
  - `generationStartTime`
  - `resultAspectRatio`
  - `inputUrl`
  - 旧类型专属字段
- 自动设置：
  - `status: NodeStatus.IDLE`
  - 新类型默认模型和参数

示意代码：

```ts
const switchNodeType = (id: string, nextType: NodeType.TEXT | NodeType.IMAGE | NodeType.VIDEO) => {
  setNodes((prev) =>
    prev.map((node) => {
      if (node.id !== id) return node;
      if (!isSwitchableNodeType(node.type) || !isSwitchableNodeType(nextType)) return node;
      if (node.type === nextType) return node;

      const defaults = getDefaultNodeTypeConfig(nextType);

      return {
        ...node,
        ...defaults,
        status: NodeStatus.IDLE,
        resultUrl: undefined,
        lastFrame: undefined,
        errorMessage: undefined,
        generationStartTime: undefined,
        resultAspectRatio: undefined,
        inputUrl: undefined,
        imageModel: nextType === NodeType.IMAGE ? defaults.model : undefined,
        videoModel: nextType === NodeType.VIDEO ? defaults.model : undefined,
        textMode: nextType === NodeType.TEXT ? defaults.textMode : undefined,
        videoMode: nextType === NodeType.VIDEO ? defaults.videoMode : undefined,
        linkedVideoNodeId: undefined,
        frameInputs: undefined,
        videoDuration: undefined,
        generateAudio: undefined,
        angleMode: undefined,
        angleSettings: undefined,
        klingReferenceMode: undefined,
        klingFaceIntensity: undefined,
        klingSubjectIntensity: undefined,
        detectedFaces: undefined,
        faceDetectionStatus: undefined,
      };
    })
  );
};
```

- [ ] **Step 4: 暴露 switchNodeType 到 hook 返回值**

```ts
return {
  nodes,
  setNodes,
  selectedNodeIds,
  setSelectedNodeIds,
  addNode,
  updateNode,
  switchNodeType,
  deleteNode,
  deleteNodes,
  clearSelection,
  handleSelectTypeFromMenu,
};
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/hooks/useNodeManagement.node-type-switch.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNodeManagement.ts src/hooks/useNodeManagement.node-type-switch.test.ts
git commit -m "feat: add node type switching with data migration"
```

---

### Task 3: 在节点 UI 上渲染类型下拉框

**Files:**
- Modify: `src/components/canvas/CanvasNode.tsx`

- [ ] **Step 1: 在 CanvasNodeProps 里加切换回调**

```ts
onSwitchType?: (id: string, nextType: NodeType.TEXT | NodeType.IMAGE | NodeType.VIDEO) => void;
```

- [ ] **Step 2: 只对普通可切换节点显示下拉框**

在标题区域附近增加：

```tsx
{isSwitchableNodeType(data.type) && onSwitchType && (
  <select
    value={data.type}
    onChange={(e) => onSwitchType(data.id, e.target.value as NodeType.TEXT | NodeType.IMAGE | NodeType.VIDEO)}
    onClick={(e) => e.stopPropagation()}
    onPointerDown={(e) => e.stopPropagation()}
    className="absolute top-2 left-3 px-2 py-1 text-xs rounded-md bg-neutral-900/90 border border-neutral-700 text-white"
  >
    <option value={NodeType.TEXT}>文字</option>
    <option value={NodeType.IMAGE}>图片</option>
    <option value={NodeType.VIDEO}>视频</option>
  </select>
)}
```

- [ ] **Step 3: 调整标题位置，避免和下拉框撞车**

把现有标题和新下拉框错开，优先保证：
- 标题还能编辑
- 下拉不会遮挡图片/视频工具条

- [ ] **Step 4: 确保特殊节点不显示**

`IMAGE_EDITOR`、`VIDEO_EDITOR`、`STORYBOARD`、`CAMERA_ANGLE`、本地模型节点都不要渲染该下拉框。

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/CanvasNode.tsx
git commit -m "feat: add node type dropdown to switchable nodes"
```

---

### Task 4: 把切换能力从 App 透传到节点

**Files:**
- Modify: `src/App.tsx`
- Modify: 其他实际渲染 `CanvasNode` 的位置文件，如果不是 `App.tsx`，以真实调用点为准

- [ ] **Step 1: 找到 CanvasNode 的调用点**

Run: `rg -n "<CanvasNode|CanvasNode\\(" src -S`

Expected: 找到渲染每个节点的地方。

- [ ] **Step 2: 从 useNodeManagement 解构 switchNodeType**

示意：

```ts
const {
  nodes,
  updateNode,
  switchNodeType,
  ...
} = useNodeManagement();
```

- [ ] **Step 3: 给 CanvasNode 传 onSwitchType**

```tsx
<CanvasNode
  ...
  onSwitchType={switchNodeType}
/>
```

- [ ] **Step 4: 运行构建确认类型链路通**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire node type switching through canvas rendering"
```

---

### Task 5: 修正切换后的节点默认显示

**Files:**
- Modify: `src/components/canvas/NodeContent.tsx`

- [ ] **Step 1: 检查文字节点切换后默认进入哪种模式**

目标：从图片/视频切到文字后，不要落在难理解的空菜单态；建议默认 `textMode: 'editing'`，用户直接可以输入。

- [ ] **Step 2: 写最小修正**

如果 `NodeContent` 对 `textMode` 有额外隐式假设，就补一层兜底：

```ts
const effectiveTextMode = data.textMode ?? 'editing';
```

然后文字节点渲染用 `effectiveTextMode`。

- [ ] **Step 3: 检查图片/视频切换后的空态**

确保切换到图片/视频后：
- 不显示旧结果
- 占位态和工具按钮正常

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/NodeContent.tsx
git commit -m "fix: normalize default node content after type switch"
```

---

### Task 6: 全量验证

**Files:**
- Verify: `src/config/nodeTypeRegistry.ts`
- Verify: `src/hooks/useNodeManagement.ts`
- Verify: `src/components/canvas/CanvasNode.tsx`
- Verify: `src/components/canvas/NodeContent.tsx`
- Verify: `src/App.tsx`

- [ ] **Step 1: 跑新增单测**

Run:

```bash
npx vitest run src/config/nodeTypeRegistry.test.ts src/hooks/useNodeManagement.node-type-switch.test.ts
```

Expected: PASS

- [ ] **Step 2: 跑现有相关测试**

如果仓库已有节点相关测试，补跑对应文件；若没有，至少执行：

```bash
npm run build
```

Expected: 构建通过，无 TypeScript 错误。

- [ ] **Step 3: 人工验证**

启动：

```bash
npm run dev
```

手动检查：
- 新建一个图片节点
- 输入 prompt
- 把它切到文字
- prompt 仍保留
- 图片结果消失
- 节点样式切到文字
- 再切到视频
- 节点样式切到视频，占位态正确
- 不会新建额外节点
- 特殊节点没有该下拉框

- [ ] **Step 4: 最终 Commit**

```bash
git add .
git commit -m "feat: add dropdown-based node type switching"
```

---

## 备注

- 这次先不做后台控制开放类型
- 这次先不做语音节点切换
- 未来如果要扩展，只需要：
  1. 在 `nodeTypeRegistry.ts` 里加新类型
  2. 在 `switchNodeType` 里补该类型迁移规则
  3. 在 `NodeContent.tsx` 里补对应渲染
