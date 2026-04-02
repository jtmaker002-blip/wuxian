# Node Theme And Token Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有普通节点跟随系统深浅色变化，同时让设置页 Token 下拉在打开时自动加载并显示可用的初始令牌。

**Architecture:** 主题修复集中在 `CanvasNode -> NodeContent -> NodeControls` 这一条 UI 链路，避免散落在业务逻辑里。Token 修复集中在 `SettingsModal` 的自动刷新行为和 `token-config-store` 的回填规则，保持请求层不变。

**Tech Stack:** React 19, Vite 6, TypeScript, Zustand, Vitest, Express proxy

---

### Task 1: 修复 Token 初始回填规则

**Files:**
- Modify: `src/features/settings/store/token-config-store.ts`
- Test: `src/features/settings/store/token-config-store.test.ts`

- [ ] **Step 1: 写失败测试，覆盖“列表非空时默认选中第一条 token”**

在 `token-config-store.test.ts` 新增用例：
- 无 `selectedTokenId`
- 无 `selectedTokenValue`
- 无手动 `draftTokenValue`
- token 列表非空
- 预期自动选中第一条 token

- [ ] **Step 2: 跑测试，确认新用例失败**

Run: `npx vitest run src/features/settings/store/token-config-store.test.ts`

- [ ] **Step 3: 实现最小修复**

在 `resolveTokenSelection()` 中增加兜底：
- 当没有 id/value 命中
- 且 `tokens.length > 0`
- 且不存在手动 token
- 默认使用 `tokens[0]`

- [ ] **Step 4: 跑测试确保通过**

Run: `npx vitest run src/features/settings/store/token-config-store.test.ts`

### Task 2: 设置页打开 Token 标签自动刷新

**Files:**
- Modify: `src/features/settings/pages/SettingsModal.tsx`

- [ ] **Step 1: 在 Token Tab 增加自动刷新 effect**

增加 `useEffect`：
- 当 `isOpen && tab === 'token' && session` 时触发
- 若当前 `availableTokens.length === 0`，调用 `handleRefreshTokens()`
- 避免无限循环

- [ ] **Step 2: 同步消息显示**

如果刷新后为空，继续保留现有提示文案；
如果有 token，则显示同步成功消息并让当前令牌区显示名称。

### Task 3: 普通节点内容区跟随主题

**Files:**
- Modify: `src/components/canvas/CanvasNode.tsx`
- Modify: `src/components/canvas/NodeContent.tsx`

- [ ] **Step 1: 给 NodeContent 透传 canvasTheme**

从 `CanvasNode` 给 `NodeContent` 传入 `canvasTheme`。

- [ ] **Step 2: 在 NodeContent 中按主题切换颜色**

修复这些位置：
- 文本节点编辑容器背景
- 文本颜色/placeholder 颜色
- 空态节点背景
- 文本菜单项 hover 颜色
- 浅色主题下的边框与文字颜色

### Task 4: 底部控制条跟随主题

**Files:**
- Modify: `src/components/canvas/NodeControls.tsx`

- [ ] **Step 1: 统一抽出浅色/深色样式变量**

围绕 `isDark` 提取：
- 控制条卡片背景
- 按钮背景
- 下拉菜单背景
- 边框色
- 文本色

- [ ] **Step 2: 替换当前主要硬编码深色区域**

优先修正用户当前能直接看到的区域：
- 模型选择按钮
- 节点类型下拉
- 分辨率/比例/时长下拉
- 高级设置区域
- 运行按钮周边条

### Task 5: 整体验证

**Files:**
- Verify only

- [ ] **Step 1: 跑测试**

Run: `npm run test`

- [ ] **Step 2: 跑构建**

Run: `npm run build`

- [ ] **Step 3: 启动本地开发环境**

Run: `npm run dev`

- [ ] **Step 4: 手动验证**

检查：
- 打开设置页切到 `Token`，若账号有 token，会自动显示初始选项
- 深浅色切换时，普通节点和控制条一起变色
- 页面能正常打开，后续仍可继续打包安装包
