# Liblib 图片节点 1:1 复刻计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将当前画布中的“图片节点”复刻为接近 Liblib Canvas 的单节点交互，包括空白态、上传后态、图生图内容区、顶部图片工具系统、上传素材后的交互、与视频节点的连接体验，以及在无限画布中的拉线丝滑度。

**架构：** 不新增独立图片主流程弹窗。图片节点统一收敛到“节点内完成上传、素材预览、提示词编辑、模型/比例/清晰度/生成、图片增强工具”的单面板交互。连接系统继续沿用现有 `parentIds` 数据结构，但补“磁吸连接点 + 落点菜单 + 图片到视频专属路径”。

**技术栈：** React、TypeScript、现有 `CanvasNode / NodeContent / NodeControls` 架构、自定义 hooks、Vitest、LSP diagnostics。

---

## 现状审计

### 已确认的 Liblib 图片节点特征

基于当前登录页面快照与用户补充截图，Liblib 图片节点至少包含：

#### 1. 空白态图片节点
- 节点本体中央是占位区域
- 左右连接点常驻在节点边缘
- 选中后节点下方出现一体化暗色输入面板

#### 2. 选中后的下方输入面板
- 顶部工具位：
  - `风格`
  - `标记`
  - `聚焦`
- 已上传素材缩略图，显示数量角标
- 中部大输入区
  - placeholder：`描述你想要生成的画面内容，按/呼出指令，@引用素材`
- 底部参数区
  - 模型
  - 比例
  - 清晰度
  - 摄像机控制
  - 数量
  - 生成按钮

#### 3. 已上传图片后的顶部悬浮工具条
- `多角度`
- `打光`
- `九宫格`
- `高清`
- `宫格切分`
- 右侧图像工具/下载/展开按钮

#### 4. 节点贴附式子功能面板
- `多角度编辑器`
  - 预设视角 tab
  - 自定义模式
  - 球面预览区
  - 水平环绕
  - 垂直俯仰
  - 景别缩放
  - 提示词开关
  - 重置参数
- `打光效果`
  - 全局
  - 智能模式
  - 亮度
  - 颜色
  - 主光源方向
  - 轮廓光
- `高清`
  - `高清 / 扩图 / 重绘 / 擦除 / 抠图 / 裁剪`
- `九宫格`
  - 作为预设生成/切分/衍生入口
- `聚焦`
  - 进入全屏遮罩态
  - 在图片上框选局部区域
  - 底部内容区出现“请在图片上框选聚焦区域”

#### 5. 上传后的交互
- 上传并不会把用户带去额外 modal
- 上传的图片会成为当前节点里的素材/参考
- 图生图主路径始终停留在当前节点

#### 6. 连接体验
- 从图片节点拉线到其他节点时，目标连接点强磁吸
- 拉到空白处时，就地创建/选择目标节点
- 图片到视频节点的衔接是主路径，而不是旁路工具

### 当前项目图片节点现状

- 图片节点已经有结果态、上传态、底部 `NodeControls`
- 上传图片和视频已支持原地更新节点，不再强制走 editor modal
- 连接拖拽已开始支持磁吸与落点菜单
- 当前缺口：
  - 图片节点仍是通用 `NodeControls` 风格，不是图片专属单面板
  - `风格 / 标记 / 聚焦` 只是静态入口位，没有真实上下文行为
  - 还没有 `多角度 / 打光 / 九宫格 / 高清 / 宫格切分` 这组图片专属顶部工具系统
  - 上传素材缩略图只是占位，还不是引用系统
  - 没有全屏局部框选类交互（聚焦模式）
  - 没有节点贴附式子面板（多角度编辑器 / 打光效果）
  - 图片节点与视频节点的连接没有做专属 affordance
  - 空白态、上传后态、选中态的视觉层级还不够像 Liblib

## 文件结构

### 主要修改文件

- 修改：`src/components/canvas/CanvasNode.tsx`
  - 控制图片节点上方工具条、选中态和节点外壳视觉
- 修改：`src/components/canvas/NodeContent.tsx`
  - 控制图片节点空白态、上传入口、素材预览、结果态显示
- 修改：`src/components/canvas/NodeControls.tsx`
  - 重构图片节点底部面板为 Liblib 风格的一体化输入区
- 修改：`src/hooks/useConnectionDragging.ts`
  - 提升拉线磁吸、连接目标命中和落点菜单逻辑
- 修改：`src/hooks/useContextMenuHandlers.ts`
  - 支持连接落点即地打开节点创建菜单
- 修改：`src/hooks/useImageNodeHandlers.ts`
  - 统一图片节点“图生图 / 图生视频”分支入口逻辑
- 修改：`src/hooks/useAssetHandlers.ts`
  - 上传资产后自动选中、保持节点内工作流
- 修改：`src/hooks/useImageEditor.ts`
  - 只保留上传/尺寸识别作为底层能力，不再承担图片主交互职责
- 修改：`src/App.tsx`
  - 串起图片节点行为、连接菜单位置、上传后的选中与焦点

### 可能新增文件

- 创建：`src/components/canvas/image-node/ImageNodePromptPanel.tsx`
  - 图片节点专属 prompt panel
- 创建：`src/components/canvas/image-node/ImageNodeTopToolbar.tsx`
  - 图片节点顶部工具条
- 创建：`src/components/canvas/image-node/ImageNodePopoverPanel.tsx`
  - 顶部工具的统一子面板容器
- 创建：`src/components/canvas/image-node/FocusSelectionOverlay.tsx`
  - 聚焦模式的全屏框选层
- 创建：`src/components/canvas/image-node/MultiAnglePanel.tsx`
  - 多角度编辑器
- 创建：`src/components/canvas/image-node/LightingPanel.tsx`
  - 打光效果面板

### 主要测试文件

- 修改/新增：`src/components/canvas/NodeControls.test.tsx`
- 修改/新增：`src/components/canvas/NodeContent.test.tsx`
- 修改：`src/hooks/useConnectionDragging.test.ts`
- 修改：`src/hooks/useImageNodeHandlers.test.ts`

## 实施任务

### 任务 1：固化参考行为清单

**文件：**
- 修改：`docs/superpowers/plans/2026-04-08-liblib-image-node-parity.md`

- [ ] **步骤 1：把图片节点参考行为拆成状态表**
  - 空白未上传
  - 空白已选中
  - 已上传已选中
  - 已有图片并进入图生图输入态
  - 已有图片并打开顶部工具条
  - 进入 `聚焦 / 多角度 / 打光` 子功能态

- [ ] **步骤 2：列出每个状态的可见元素**
  - 上方按钮
  - 节点本体
  - 下方输入区
  - 参数区
  - 连线交互
  - 子面板/全屏态

- [ ] **步骤 3：标出当前实现缺口**
  - 已有
  - 部分已有但样式不对
  - 完全缺失

### 任务 2：重构图片节点视觉壳层

**文件：**
- 修改：`src/components/canvas/CanvasNode.tsx`
- 测试：`src/components/canvas/NodeContent.test.tsx`

- [ ] **步骤 1：把图片节点选中态的顶部工具条固定显示**
- [ ] **步骤 2：让图片节点标题/上传按钮/节点本体的层级更接近 Liblib**
- [ ] **步骤 3：验证图片节点在 light/dark 主题下不炸布局**

### 任务 3：把图片节点底部控制区改成专属单面板

**文件：**
- 修改：`src/components/canvas/NodeControls.tsx`
- 可能创建：`src/components/canvas/image-node/ImageNodePromptPanel.tsx`
- 测试：`src/components/canvas/NodeControls.test.tsx`

- [ ] **步骤 1：抽离图片节点专属面板布局**
- [ ] **步骤 2：实现顶部工具位（风格 / 标记 / 聚焦 / 素材缩略图）**
- [ ] **步骤 3：实现中部大输入区**
- [ ] **步骤 4：实现底部参数区**
- [ ] **步骤 5：避免图片主流程回流到 modal**

### 任务 4：实现图片节点顶部工具系统

**文件：**
- 修改：`src/components/canvas/CanvasNode.tsx`
- 修改：`src/components/canvas/NodeContent.tsx`
- 可能创建：`src/components/canvas/image-node/ImageNodeTopToolbar.tsx`
- 可能创建：`src/components/canvas/image-node/ImageNodePopoverPanel.tsx`

- [ ] **步骤 1：实现图片节点顶部悬浮工具条**
- [ ] **步骤 2：实现子功能面板挂载机制**
- [ ] **步骤 3：先实现只读/假面板再逐个补真实能力**

### 任务 5：实现聚焦模式全屏框选

**文件：**
- 创建：`src/components/canvas/image-node/FocusSelectionOverlay.tsx`
- 修改：`src/App.tsx`
- 修改：`src/components/canvas/CanvasNode.tsx`
- 修改：`src/components/canvas/NodeControls.tsx`

- [ ] **步骤 1：进入聚焦模式时显示全屏遮罩态**
- [ ] **步骤 2：底部内容区出现聚焦提示条**
- [ ] **步骤 3：将框选结果回写到图片节点状态**

### 任务 6：实现多角度编辑器与打光效果面板

**文件：**
- 创建：`src/components/canvas/image-node/MultiAnglePanel.tsx`
- 创建：`src/components/canvas/image-node/LightingPanel.tsx`
- 修改：`src/components/canvas/CanvasNode.tsx`

- [ ] **步骤 1：多角度编辑器面板**
- [ ] **步骤 2：打光效果面板**
- [ ] **步骤 3：参数写回图片节点**

### 任务 7：统一上传后的图片节点交互

**文件：**
- 修改：`src/hooks/useAssetHandlers.ts`
- 修改：`src/hooks/useImageEditor.ts`
- 修改：`src/components/canvas/NodeContent.tsx`
- 测试：`src/hooks/useImageNodeHandlers.test.ts`

- [ ] **步骤 1：统一图片上传后的节点数据形态**
- [ ] **步骤 2：图片上传后默认进入可继续编辑的图生图内容区**
- [ ] **步骤 3：视频节点上传交互不要退化**

### 任务 8：图片到视频的连接体验专项

**文件：**
- 修改：`src/hooks/useConnectionDragging.ts`
- 修改：`src/hooks/useContextMenuHandlers.ts`
- 修改：`src/hooks/useImageNodeHandlers.ts`
- 测试：`src/hooks/useConnectionDragging.test.ts`

- [ ] **步骤 1：磁吸连接点命中优化**
- [ ] **步骤 2：拖到空白处时在落点直接弹出节点创建菜单**
- [ ] **步骤 3：图片节点到视频节点作为一等路径**
- [ ] **步骤 4：验证连接成功后 prompt / parentIds 同步正确**

### 任务 9：清理旧 modal 依赖路径

**文件：**
- 修改：`src/App.tsx`
- 修改：`src/hooks/useImageEditor.ts`
- 可能修改：`src/components/modals/ImageEditorModal.tsx`

- [ ] **步骤 1：确认图片节点主流程不再依赖 ImageEditorModal**
- [ ] **步骤 2：只保留 modal 作为历史兼容/次级工具入口**
- [ ] **步骤 3：避免上传后再次触发 modal**

### 任务 10：验证与收尾

**文件：**
- 修改：相关测试文件

- [ ] **步骤 1：对所有修改文件运行 `lsp_diagnostics`**
- [ ] **步骤 2：运行图片节点与连接相关测试**
- [ ] **步骤 3：运行完整 `npm test`**
- [ ] **步骤 4：运行 `npm run build`**
- [ ] **步骤 5：手动验收**

## 额外约束

- 不要把整个画布系统重写成 Liblib；只聚焦图片节点和它的连接主路径
- 不要破坏现有视频节点、语音节点、Storyboard 节点
- 优先局部重构图片节点组件，而不是把所有节点都改成同一种面板
- 保持差异最小：先复刻结构和交互骨架，再补高级能力

## 当前已知风险

- 当前会话里的浏览器交互能力不稳定，不能完全依赖自动点击逐步对照
- 因此“1:1”应优先落实在结构、布局、交互路径；少数细枝末节需要靠用户后续验收微调

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-04-08-liblib-image-node-parity.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

当前会话已先做了部分基础改动，但如果要严格按计划收口，接下来建议从 **任务 3：图片节点专属单面板** 开始，再依次补顶部工具系统与聚焦/多角度/打光子面板。  
