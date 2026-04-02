# 节点类型下拉切换设计

**日期：** 2026-03-31  
**项目：** TwitCanva-Video-Workflow  
**状态：** 已确认，待实现

---

## 1. 目标

在画布里的每个节点上增加一个“节点类型下拉框”，允许用户把**同一个节点**在以下三种类型之间切换：

- 文字
- 图片
- 视频

本次只做前端固定三项，不做后台控制开放项。后续如果要扩展语音或更多节点类型，再在这个结构上增加即可。

---

## 2. 用户体验

### 2.1 节点上的交互

- 每个普通生成节点显示一个类型下拉框
- 下拉框展示当前节点类型
- 用户点击后可切换到其他类型
- 切换后仍然是**原来的节点**，不会新建节点，不会改变节点位置和连接关系

### 2.2 切换时的数据保留规则

切换节点类型时：

- **保留通用内容**
  - `prompt`
  - `title`
  - `x / y`
  - `parentIds`
  - `groupId`
- **清理不兼容内容**
  - 旧类型专属参数
  - 旧生成结果
  - 旧错误状态
- **补上新类型默认值**
  - 默认模型
  - 默认比例
  - 默认分辨率
  - 默认模式字段

### 2.3 用户可感知效果

例如：

- 图片节点切成文字节点
  - prompt 还在
  - 图片结果消失
  - 比例、分辨率等图片参数清理或重置
  - 节点内容区切换为文字节点样式

- 文字节点切成视频节点
  - prompt 还在
  - 文本菜单态切换为视频节点默认状态
  - 补上默认视频模型和视频专属参数

---

## 3. 范围

### 本次包含

- 普通节点增加类型下拉框
- 支持 `Text / Image / Video` 三种切换
- 切换时节点数据迁移
- 切换后节点内容区与控制区同步变化
- 模型不兼容时自动回退到该类型默认模型

### 本次不包含

- 后台控制“开放哪些节点类型”
- 语音节点切换
- 特殊节点类型切换：
  - `IMAGE_EDITOR`
  - `VIDEO_EDITOR`
  - `STORYBOARD`
  - `CAMERA_ANGLE`
  - `LOCAL_IMAGE_MODEL`
  - `LOCAL_VIDEO_MODEL`

这些特殊节点先保持不可切换。

---

## 4. 架构设计

### 4.1 节点类型注册表

新增一个前端本地注册表，统一描述可切换节点类型：

- 类型 id
- 显示名称
- 默认模型
- 默认比例
- 默认分辨率
- 切换时需要保留的通用字段
- 切换时需要清理的专属字段

这样本次先写死三种类型，后面再加语音时不需要重做整套逻辑。

### 4.2 节点切换入口

下拉框放在节点 UI 内部，推荐放在节点标题附近，由 `CanvasNode.tsx` 渲染。

切换动作通过统一方法完成，例如：

```ts
switchNodeType(nodeId, nextType)
```

这个方法由 `useNodeManagement.ts` 提供，负责：

1. 找到当前节点
2. 根据注册表生成新类型默认值
3. 迁移通用字段
4. 清理旧结果和旧专属字段
5. 更新节点状态

### 4.3 节点显示层同步

`NodeContent.tsx` 继续根据 `data.type` 决定显示：

- 文字节点内容
- 图片节点内容
- 视频节点内容

切换类型后不需要额外分支，只要 `NodeData.type` 被更新，现有内容区域自然重新渲染。

---

## 5. 数据规则

### 5.1 通用字段

下列字段视为通用字段，切换类型时尽量保留：

- `id`
- `title`
- `x`
- `y`
- `prompt`
- `parentIds`
- `groupId`
- `isPromptExpanded`

### 5.2 必须清理的字段

切换类型时必须清掉这些会造成旧状态污染的字段：

- `resultUrl`
- `lastFrame`
- `errorMessage`
- `generationStartTime`
- `resultAspectRatio`
- `inputUrl`

以及旧类型的专属参数，例如：

- 从图片切走时：
  - `imageModel`
  - `angleMode`
  - `angleSettings`
  - `klingReferenceMode`
  - `klingFaceIntensity`
  - `klingSubjectIntensity`
  - `detectedFaces`
  - `faceDetectionStatus`

- 从视频切走时：
  - `videoMode`
  - `frameInputs`
  - `videoModel`
  - `videoDuration`
  - `generateAudio`

- 从文字切走时：
  - `textMode`
  - `linkedVideoNodeId`

### 5.3 默认值

建议默认值如下：

- Text
  - `type: NodeType.TEXT`
  - `textMode: 'editing'`
  - `model: <默认文字模型>`

- Image
  - `type: NodeType.IMAGE`
  - `model: <默认图片模型>`
  - `aspectRatio: 'Auto'`
  - `resolution: 'Auto'`

- Video
  - `type: NodeType.VIDEO`
  - `model: <默认视频模型>`
  - `aspectRatio: '16:9'`
  - `resolution: 'Auto'`
  - `videoMode: 'standard'`

---

## 6. 风险与处理

### 风险 1：旧结果残留

如果不清理旧结果，节点可能出现：

- 文字节点还显示图片结果
- 视频节点沿用旧图片比例

**处理：** 切换类型时统一清空 `resultUrl` 和相关结果字段。

### 风险 2：模型不匹配

比如当前节点是图片模型，但切成了文字节点。

**处理：** 切换后如果当前模型不属于新类型，自动替换为该类型默认模型。

### 风险 3：特殊节点误切换

图片编辑器、分镜节点、相机角度节点等不适合纳入这次统一切换。

**处理：** 本次只对普通 `Text / Image / Video` 生成节点开放下拉切换；特殊节点不显示该下拉框。

---

## 7. 验收标准

- 普通节点上出现类型下拉框
- 下拉项包含：文字、图片、视频
- 切换后仍是同一个节点，不新建节点
- 切换后保留 prompt
- 切换后旧结果被清空
- 切换后节点 UI 正确切到对应类型
- 切换后模型与参数符合新类型默认值
- 特殊节点不显示此下拉框

