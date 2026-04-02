# Video And Voice Capabilities Design

**Goal**

为当前项目引入一套可维护的“模型能力配置”机制，优先覆盖视频与语音两类模型。前端节点不再把秒数、分辨率、参考图、首尾帧、多图、运动参考等能力写死在组件里，而是统一从能力配置读取；同时预留从 `openaiteach.com` 后台拉取最新能力配置并覆盖本地默认配置的能力，确保后续模型功能更新时不需要到处改前端代码。

**Critical Constraint**

当前代码里存在“UI registry id”和“后端 generation 路由 id”不完全一致的问题，例如部分视频模型在 [registryModelBridge.ts](E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryModelBridge.ts) 中仍会收敛到同一个 server id。新的能力层不能忽略这个现实，否则“同一个能力表同时服务 UI 和 generation”会变成假命题。

**Scope**

- 先只覆盖 `video` 与 `voice` 两类模型
- 提供一份本地静态能力表，作为默认保底配置
- 设计一份远程配置结构，允许后台返回更细的能力定义覆盖本地
- 统一视频节点参数联动规则：
  - 秒数
  - 比例
  - 分辨率
  - 文生视频 / 图生视频
  - 多图参考
  - 首尾帧
  - 全图参考
  - 运动参考
  - 是否支持原生音频
- 统一语音节点能力规则，为后续语音节点接入做准备
- 明确前端如何读取能力表，后端 generation 如何根据能力表做参数约束

**Non-Goals**

- 这一轮不实现后台管理界面
- 这一轮不实现图片与文本模型的能力配置远程化
- 这一轮不直接重构所有 generation provider 的内部实现，只先建立统一能力层与使用规则
- 这一轮不讨论自动创建默认 token

**Current Problems**

目前视频模型能力散落在多个位置：

- [registryCanvasModels.ts](E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryCanvasModels.ts) 里有较粗粒度的 `durations / resolutions / aspectRatios / supportsImageToVideo / supportsMultiImage`
- [NodeControls.tsx](E:\自己的无限画布\TwitCanva-Video-Workflow\src\components\canvas\NodeControls.tsx) 里又有大量 UI 侧写死判断
- [useGeneration.ts](E:\自己的无限画布\TwitCanva-Video-Workflow\src\hooks\useGeneration.ts) 里还存在 provider 特化逻辑
- [generation.js](E:\自己的无限画布\TwitCanva-Video-Workflow\server\routes\generation.js) 再次按 provider 分流

结果是：

- 前端很容易显示出后端其实不支持的参数
- 新模型上线或老模型增加功能时，需要同时改多个文件
- 用户很难知道某个模型到底支持什么模式

**Design**

## 1. 新增统一能力配置层

新增一个专门的能力配置模块，例如：

- `src/config/modelCapabilities.ts`

该模块分两部分：

- `videoCapabilities`
- `voiceCapabilities`

每条视频模型配置至少定义这些字段：

- `id`
- `category`
- `serverModelId` 或等价的 generation target（供后端映射使用）
- `modes`

其中 `modes` 不再是扁平布尔表，而是按运行模式拆分。视频第一版至少拆成：

- `standard`
- `frameToFrame`
- `motionControl`

每个 mode 再定义：

- `enabled`
- `supportsTextToVideo`
- `supportsImageToVideo`
- `supportsMultiImage`
- `supportsStartEndFrames`
- `supportsFullReference`
- `supportsMotionReference`
- `supportsAudio`
- `durations`
- `aspectRatios`
- `resolutions`
- `defaultDuration`
- `defaultAspectRatio`
- `defaultResolution`

每条语音模型配置至少定义：

- `id`
- `category`
- `supportsTextToSpeech`
- `supportsVoiceClone`
- `supportsVoiceDesign`
- `supportsSpeedControl`
- `supportsEmotionControl`
- `defaultVoice`
- `serverModelId`

目标是把“模型支持什么”从 UI 组件和 generation 逻辑里抽离出来，变成一处集中维护的事实源；同时明确 registry id 与实际 generation target 之间的桥接关系。

## 1.1 Registry ID 与 Server ID 的统一策略

这一轮不再允许“能力表按 registry id 写，但 generation 继续无脑塌缩成 `veo-3.1` 或其他公共 id”。

设计要求：

- 能力表以 registry id 为主键
- 每个能力项显式记录 `serverModelId`
- generation 请求映射必须从能力表读取 `serverModelId`
- 不能继续在别处隐藏式收敛模型 id

这意味着后续 [registryModelBridge.ts](E:\自己的无限画布\TwitCanva-Video-Workflow\src\config\registryModelBridge.ts) 要么被简化成“仅做 legacy id 规范化”，要么把 server target 的来源迁移到能力层，避免双重事实源。

## 2. 本地保底 + 远程覆盖

能力配置采用双层来源：

### 本地保底配置

项目内置一份静态能力表。即使后台接口失败、离线或还没接通，前端节点仍然可以正常工作。这是运行时保底，不依赖网络。

### 远程配置覆盖

后续由 `openaiteach.com` 提供一个能力配置接口，前端启动或登录后拉取一次。

规则：

- 先加载本地配置
- 如果远程配置拉取成功，用远程配置覆盖本地同 id 的模型能力
- 如果远程配置拉取失败，继续使用本地配置，不影响功能
- 未出现在远程配置里的模型，继续沿用本地定义

这样以后模型能力更新时，你只需要改后台配置，前端会自动同步；但一旦远程接口异常，应用也不会崩。

## 2.1 远程配置的强校验

远程覆盖不能直接“来什么就吃什么”，必须先过 schema 校验。否则一个错误 payload 就会把整套联动搞坏。

前端接收远程配置时必须验证：

- model id 必须是已知 id，未知 id 直接忽略并记日志
- `serverModelId` 不能为空
- `durations / aspectRatios / resolutions` 不能为空数组
- `defaultDuration` 必须存在于 `durations`
- `defaultAspectRatio` 必须存在于 `aspectRatios`
- `defaultResolution` 必须存在于 `resolutions`
- 如果 `supportsStartEndFrames = true`，则必须同时允许 image input
- 如果 `supportsMotionReference = true`，则该 mode 必须开启
- 若字段缺失，只允许按“部分覆盖”回落到本地默认值，不能把本地必需字段清空

只有验证通过的远程片段才允许合并进运行时能力表。

## 2.2 `modes` 的合并契约

`modes` 必须做“逐 mode、逐字段”的深合并，不能把一个 mode 整体替换掉。

规则明确如下：

- 顶层按模型 id 合并
- 进入模型后，`modes.standard / modes.frameToFrame / modes.motionControl` 分别独立处理
- 如果远程只提供 `modes.standard.durations`，则只覆盖 `standard.durations`
- `standard` 下未提供的字段继续沿用本地 `standard`
- 远程 payload 不允许通过“传一个空对象”把整个 `standard` 清空
- 如果某个 mode 在本地存在、远程缺失，则保留本地整个 mode
- 如果远程新增一个本地不存在的 mode，只有在 schema 校验完整通过时才允许接收

也就是说，合并粒度必须是：

`model -> mode -> field`

而不是：

`model -> modes.standard whole object replace`

## 3. 视频节点参数联动

视频节点的所有参数 UI 都应从视频能力表读取，而不是继续在组件里分散写死。联动要按 mode 生效，而不是只按模型生效。

联动规则：

- 切换模型后，只显示该模型支持的参数
- 切换 mode 后，再按当前 mode 的能力过滤参数
- 不支持的参数直接隐藏，不做“显示但不可用”的假按钮
- 秒数下拉来自当前 mode 的 `durations`
- 比例下拉来自当前 mode 的 `aspectRatios`
- 分辨率下拉来自当前 mode 的 `resolutions`
- 若当前 mode 不支持首尾帧，则不显示 frame-to-frame 相关输入
- 若当前 mode 不支持多图参考，则只允许单图输入
- 若当前 mode 不支持 motion reference，则不显示 motion-control 模式
- 若当前 mode 支持原生音频，则显示音频开关；否则隐藏

目标是让用户一换模型，节点上的参数菜单自动收缩到“这个模型真实支持的能力”。

## 3.1 UI 到 generation 的明确契约

视频 generation 不允许再只靠“前端大概过滤一下”这种模糊行为。三种 mode 的字段契约要固定下来：

### `standard`

- 必需：
  - `videoModel`
  - `videoDuration`
  - `aspectRatio`
  - `resolution`
- 可选：
  - `prompt`
  - 单张输入图（当 `supportsImageToVideo = true`）
- 禁止：
  - `frameInputs`
  - `motionReferenceUrl`

### `frameToFrame`

- 必需：
  - `videoModel`
  - `videoDuration`
  - `aspectRatio`
  - `resolution`
  - `frameInputs`
- 其中：
  - 若模型支持首尾帧，则 `frameInputs` 必须恰好包含 `start` 和 `end`
  - 若模型只支持单图参考而不支持 start/end，则不能进入该 mode
- 禁止：
  - `motionReferenceUrl`

### `motionControl`

- 必需：
  - `videoModel`
  - `videoDuration`
  - `aspectRatio`
  - `resolution`
  - 主参考图（或主图像输入）
  - `motionReferenceUrl`
- 禁止：
  - `frameInputs`

### mode 的来源

- mode 在前端必须是显式状态，不允许仅靠 `parentIds` 数量隐式推断
- 旧节点兼容期可做一次“从历史数据推断初始 mode”，但一旦进入运行时状态，必须转成显式 `videoMode`

这样前端显示、节点状态、generation 请求三者才能一致。

## 4. 前端默认值与回退策略

每个模型 / mode 都要有自己的默认参数：

- 默认秒数
- 默认比例
- 默认分辨率

当用户切换模型或 mode 时：

- 如果当前值仍然被新模型支持，则保留
- 如果当前值不被支持，则回退到新模型默认值

示例：

- 从支持 `8s` 的模型切到只支持 `5s/10s` 的模型
- 当前节点的 `8s` 自动回退成该模型默认值，比如 `5s`

这样能避免模型切换后节点处于非法状态。

## 4.1 已存在节点的重校验

除了“用户主动切换模型”之外，还要覆盖“远程能力更新后，旧节点已经保存了不再合法的参数”。

规则：

- 能力配置加载完成后，对现有视频节点做一次轻量 revalidate
- 如果旧节点的秒数/比例/分辨率/mode 已不再被支持：
  - 自动回退到当前模型当前 mode 的默认值
  - 在节点或全局 toast 给出一次提示，说明“模型能力已更新，部分参数已自动调整”
- 如果模型本身被下线：
  - 保留节点内容
  - 标记为“模型已下线”
  - 引导用户切换到推荐回退模型

触发时机建议：

- 应用启动后加载到远程能力配置时
- 登录成功后
- 用户手动刷新模型能力配置后
- 不要求在 token 每次切换时强制刷新能力，但可以提供显式刷新入口

## 5. 与 generation 逻辑的关系

能力表不只服务 UI，也要服务生成请求的最终校验。

请求前需要做两层保护：

1. UI 层不展示不支持的参数
2. 提交前再按能力表校验一次

例如：

- 模型不支持 motion reference，就不能把 motion 相关字段发到后端
- 模型只支持 `5s / 10s`，就不能发 `8s`
- 模型不支持首尾帧，就不能构建 `frameInputs`

这样可以减少 provider 路由收到非法组合参数的概率。

这里的关键不是“把所有 provider 逻辑挪走”，而是：

- provider 逻辑仍可存在于后端
- 但其输入必须先通过统一能力层合法化
- generation 层拿到的是“已符合当前模型能力表”的参数

## 6. 推荐的能力字段设计

视频模型建议统一这些布尔或枚举字段：

- `supportsTextToVideo`
- `supportsImageToVideo`
- `supportsMultiImage`
- `supportsStartEndFrames`
- `supportsFullReference`
- `supportsMotionReference`
- `supportsAudio`

如果后面你还要补更多细节，建议继续加可枚举字段，而不是继续堆 `if/else`：

- `referenceMode: 'none' | 'single-image' | 'multi-image' | 'start-end' | 'motion' | 'mixed'`
- `durationMode: 'fixed' | 'list'`
- `resolutionMode: 'fixed' | 'list'`

但第一版不用上这么重，先用布尔 + 数组选项就够。

## 7. 第一批模型覆盖范围

这一轮只覆盖当前项目里已经存在的模型：

- `sora-2`
- `veo3.1-pro`
- `veo3.1`
- `veo3.1-fast-components`
- `grok-video-3`
- `kling-v3`
- `kling-v2-6`
- `kling-v2-5-turbo`
- `minimax-hailuo`
- `wan2.6-i2v`
- `wan2.6-i2v-flash`
- `wan2.5-i2v-preview`
- `jimeng-seedance-2`
- `jimeng-4.5`
- `jimeng-4.1`
- `jimeng-4.0`
- `jimeng-video-3-fast`

语音模型第一批按 `MODEL_REGISTRY` 里已有项建能力表，但当前阶段只做“schema 与远程覆盖能力”，不要求同步落地完整语音节点运行时联动。

也就是说，语音部分本轮是：

- 有本地能力表结构
- 可接受远程覆盖
- 不强制要求当前代码树里立刻出现完整的 `voiceModel` 运行链

## 8. 错误处理

### 远程配置拉取失败

- 不阻塞应用
- 打印告警日志
- 回退本地能力表

### 远程配置不完整

- 只覆盖远程提供的字段
- 缺失字段沿用本地默认配置

### 模型被后台下线

- 新建节点与模型切换菜单中不再显示
- 旧节点如果已有该模型，允许展示，但提示“模型配置已下线”并给出回退模型

回退模型的来源必须明确，不能靠前端临时猜测。第一版规则：

- 能力表里显式提供 `fallbackModelId`
- 若模型被下线且 `fallbackModelId` 有效，则自动建议该模型
- 若没有 `fallbackModelId`，则前端只提示“模型已下线”，不自动替换
- 不允许前端自己按 provider 名称或数组第一个模型做隐式回退

### 远程配置与本地配置冲突

- 远程字段非法：忽略该字段，保留本地值
- 远程某个模型整体非法：忽略该模型覆盖，保留本地模型定义
- 前端应记录调试日志，方便定位后台配置错误

## 9. 测试策略

### 单测

- 本地能力表的模型查找与默认值回退
- 远程配置覆盖本地配置
- 不完整远程配置不会把本地字段清空
- 参数联动时非法值自动回退

### 组件测试

- 视频节点切换不同模型后，参数区只显示对应能力
- 不支持的控件隐藏
- 旧值不合法时自动切默认值

### 集成验证

- 使用当前 generation 路径，验证提交参数不包含模型不支持的字段

**Recommendation**

先完成这份统一能力层，再做视频节点联动实现。不要直接在 [NodeControls.tsx](E:\自己的无限画布\TwitCanva-Video-Workflow\src\components\canvas\NodeControls.tsx) 里继续加模型特判，否则后续每次模型更新都会反复返工。
