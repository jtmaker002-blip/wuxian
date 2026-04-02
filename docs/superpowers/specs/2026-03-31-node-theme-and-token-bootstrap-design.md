# Node Theme And Token Bootstrap Design

**Goal**

让画布里的节点与节点控制面板跟随系统深浅色切换，同时让设置页的 Token 下拉在打开时自动拉取并回填初始令牌，避免用户每次都看到空下拉。

**Scope**

- 统一修正普通节点在浅色主题下仍使用深色硬编码样式的问题
- 保持特殊节点和现有生成逻辑不变
- 设置页打开 `Token` 标签时自动刷新令牌列表
- 如果账号有令牌且当前没有已保存选择，则自动选中第一条令牌
- 如果本地已保存过 `selectedTokenValue`，刷新后继续优先回填对应令牌

**Non-Goals**

- 不实现“注册后自动发默认 token”，这是网站后端功能，当前仓库不做
- 不改打包流程，只保证当前改动不会阻碍后续打包成安装包
- 不新增语音节点

**Design**

## 1. 节点主题统一

现有节点外层虽然部分跟随了 `canvasTheme`，但节点内容区和底部控制条仍有大量硬编码深色样式，导致浅色主题下节点仍是黑底。修复方式：

- `CanvasNode.tsx` 保持作为主题入口，继续向下传 `canvasTheme`
- `NodeContent.tsx` 新增 `canvasTheme` 入参，统一处理：
  - 文本节点编辑区背景
  - 空态占位区背景
  - 文本颜色、占位符颜色
  - 菜单项 hover 颜色
- `NodeControls.tsx` 保留现有 `canvasTheme` 入参，但把底部控制条、下拉菜单、输入框、分隔线、按钮、面板等硬编码深色类改成按 `isDark` 条件渲染

目标不是做一套新设计，而是保证“系统切浅色时节点整体也浅色，切深色时恢复深色”。

## 2. Token 初始令牌加载

当前问题不是 select 组件本身，而是：

- 打开设置页不会自动刷新 token 列表
- 即使列表刷回来，若本地没有 `selectedTokenId`，只保存了 token 值，也可能不自动显示
- 对于从未保存过 token 但账号已有 token 的用户，下拉仍停留在空状态

修复策略：

- 在 `SettingsModal.tsx` 中，当弹窗打开且当前 tab 为 `token` 时，自动触发一次 `handleRefreshTokens()`
- 在 `token-config-store.ts` 中增强回填规则：
  - 优先按 `selectedTokenId` 匹配
  - 其次按 `selectedTokenValue` 匹配
  - 如果两者都没有，但列表非空且没有手动 token，则默认选中第一条 token
- 保存账号 token 时同步持久化 `selectedTokenId + selectedTokenValue + draftTokenValue`

这样能覆盖三类场景：

- 老用户：已有保存值，自动回填原来的 token
- 新用户但账号已有 token：自动选中第一条
- 手动 token 用户：保留手动 token，不被账号列表覆盖

## 3. 验证

- 为 token 回填补单测，覆盖：
  - 按 id 回填
  - 按 value 回填
  - 列表非空默认选中第一条
  - 手动 token 不被覆盖
- 运行 `npm run test`
- 运行 `npm run build`
- 启动 `npm run dev` 并验证：
  - 设置页打开 `Token` 标签会自动拉取
  - 节点在深浅色切换时同步变色
