# GitHub 上传与换电脑继续交接文档

日期：2026-04-20  
项目目录：`/Users/panghudezhongqiansheng/mac`  
当前分支：`codex/liblib-image-node-parity`  
当前远端：`git@github.com:jtmaker002-blip/mac.git`

## 1. 当前状态

这个项目已经是 Git 仓库，并且已经配置了 GitHub remote：

```bash
git remote -v
```

当前应看到：

```text
origin  git@github.com:jtmaker002-blip/mac.git (fetch)
origin  git@github.com:jtmaker002-blip/mac.git (push)
```

当前有大量未提交改动，主要集中在 LibTV 画布节点、图片工具条、scene skill、任务系统、生成任务状态机、IAB 访问、拖拽性能等功能。

## 2. 上传到 GitHub 前先做检查

在项目根目录执行：

```bash
cd /Users/panghudezhongqiansheng/mac
git status --short
npm test
npm run build
git diff --check
```

已经做过的最近验证：

```text
npm test：60 个测试文件通过，487 个测试通过
npm run build：通过
npx tsc --noEmit --pretty false --project tsconfig.json：通过
git diff --check：通过
```

## 3. 上传到 GitHub 的标准步骤

### 3.1 确认不会提交本地隐私文件

这些目录/文件已经在 `.gitignore` 里，不应该上传：

```text
.env
library/
.omx/
.codex/skills/.system/
node_modules/
dist/
models/
venv/
```

注意：

- `library/` 里面有本地生成图片、任务快照、OpenAiTeach 代理会话，不要提交。
- `.env` 里可能有 API Key，不要提交。
- `.omx/` 是本地 agent 运行状态，不要提交。

### 3.2 添加代码改动

```bash
git add \
  scripts/dev-runner.cjs \
  server \
  src \
  docs/github-upload-handoff-2026-04-20.md
```

如果你想直接添加所有未忽略文件，也可以：

```bash
git add -A
```

但执行后一定要检查：

```bash
git status --short
```

确认没有 `.env`、`library/`、`.omx/`、`node_modules/`。

### 3.3 提交

按项目的 Lore Commit Protocol，建议提交信息如下：

```bash
git commit -m "Bring LibTV-style generated image nodes onto the canvas path

This change makes generated image-like nodes behave like first-class image sources:
scene outputs render as compact result nodes, image result nodes expose the same
toolbar, generated scene nodes can be reused as image references, and slow real
tasks no longer get falsely marked failed before output arrives.

Constraint: LibTV internal prompts and backend pipeline are not available, so scene
skills are matched by observed UI behavior and prompt-engineered output contracts.
Constraint: Local secrets, generated assets, and OMX runtime state must stay ignored.
Rejected: Commit local library/ runtime assets | contains generated media and session data
Confidence: medium
Scope-risk: moderate
Directive: Preserve drag smoothness; generated nodes must use lightweight drag rendering.
Tested: npm test; npm run build; npx tsc --noEmit --pretty false --project tsconfig.json; git diff --check
Not-tested: Pixel-perfect parity against authenticated LibTV internal implementation
"
```

### 3.4 推送到 GitHub

当前远端已经是 GitHub，所以执行：

```bash
git push -u origin codex/liblib-image-node-parity
```

如果 GitHub 要权限：

- 用 SSH key：确认 `ssh -T git@github.com`
- 或改成 HTTPS remote：

```bash
git remote set-url origin https://github.com/jtmaker002-blip/mac.git
git push -u origin codex/liblib-image-node-parity
```

## 4. 换一台电脑继续

### 4.1 克隆项目

```bash
git clone git@github.com:jtmaker002-blip/mac.git
cd mac
git checkout codex/liblib-image-node-parity
```

如果用 HTTPS：

```bash
git clone https://github.com/jtmaker002-blip/mac.git
cd mac
git checkout codex/liblib-image-node-parity
```

### 4.2 安装依赖

```bash
npm install
```

### 4.3 启动

```bash
npm run dev
```

现在 `scripts/dev-runner.cjs` 默认让 Vite 监听 IPv6/IPv4 双栈，启动后会显示类似：

```text
Local:   http://localhost:5173/
Network: http://你的局域网IP:5173/
Backend server running on http://localhost:3001
```

如果内置浏览器不能打开 `localhost`，用 `Network` 地址。

### 4.4 新电脑上的配置

GitHub 不会同步这些本地配置：

- OpenAiTeach 登录会话
- API token
- `.env`
- `library/` 生成图片和任务历史
- `.omx/` agent 运行状态

新电脑需要重新：

1. 打开 app 的 API 设置。
2. 登录或手动粘贴 OpenAiTeach `sk-...` token。
3. 确认 `http://localhost:5173/api/openaiteach/ping` 返回 ok。
4. 重新上传/导入需要继续测试的图片素材。

如果必须带走本地生成素材，可以单独压缩 `library/`，不要通过 GitHub：

```bash
tar -czf library-backup-$(date +%Y%m%d).tar.gz library
```

到新电脑解压：

```bash
tar -xzf library-backup-YYYYMMDD.tar.gz
```

## 5. 已经完成的主要部分

### 5.1 生成图片节点复用能力

所有生成出来的图片结果节点，都应该像普通图片节点一样：

- 点击后出现图片工具条。
- 支持 `多角度`。
- 支持 `打光`。
- 支持 `九宫格`。
- 支持 `高清`。
- 支持 `宫格切分`。
- 支持标记/预览/下载/展开。
- 可以作为图片源继续引用生成。
- 可以通过右侧 `+` 创建图生视频、图片、文字等后续节点。

关键实现：

- `src/components/canvas/imageToolbarVisibility.ts`
- `src/utils/nodeResultTyping.ts`
- `src/hooks/useContextMenuHandlers.ts`
- `src/hooks/useNodeManagement.ts`
- `src/hooks/useConnectionDragging.ts`

### 5.2 拖拽性能

已做：

- `CanvasNode` 使用 `React.memo` 隔离重渲染。
- 拖动时隐藏重控制面板。
- 正在拖动的节点进入轻量视觉模式。
- 正在拖动的已生成节点只渲染轻量 preview，不走完整 scene/content tree。

后续硬约束：

```text
后面不管什么节点，只要可拖拽，都必须优先保证拖动手感，做到和主体图片主节点一样丝滑。
```

### 5.3 LibTV Skill / scene 工具

已接入：

- `角色三视图生成`
- `剧情推演四宫格`
- `多机位九宫格`
- `25宫格连贯分镜`
- `电影级光影校正`
- `画面推演 - 3秒后`
- `画面推演 - 5秒前`
- `宫格切分`
- `高清放大`

关键实现：

- `server/services/scenePromptTemplates.js`
- `server/services/mockTasks.js`
- `src/services/pipelines/scenes/*`
- `src/components/canvas/SceneResultPanel.tsx`
- `src/components/canvas/scene-node/*`

### 5.4 内置提示词逻辑

已经把四宫格、九宫格、25宫格从“用户 prompt 直接生成”改成“内置 Skill prompt + 用户描述/参考图”：

- 四宫格：起 / 承 / 转 / 合。
- 九宫格：固定九个机位。
- 25宫格：5 幕结构 + 角色圣经 + 世界圣经 + 连贯分镜。
- 三视图：front / side / back 单张成品图。

注意：

```text
这些是根据 LibTV 教程外部行为反推的 prompt 工程，不是 LibTV 内部原始 prompt。
```

### 5.5 真实生成任务状态

已修：

- 真实服务失败不再回退 Mock 假图。
- 慢任务不会被提前判定为 `任务执行中断`。
- 图片已生成但旧状态误判失败时，前端会尝试补查恢复。
- scene 真实任务可自动读取 OpenAiTeach 代理会话 token。

## 6. 还没做 / 继续做的部分

这些不是“漏提交”，而是下一阶段还需要继续打磨的任务：

1. **LibTV 像素级视觉一致性**
   - 现在是接近 LibTV 行为和节点形态。
   - 还不是 LibTV 内部实现的 1:1 复刻。
   - 需要更多真实 LibTV 输入/输出截图逐项校准。

2. **25宫格 / 四宫格 / 九宫格生成质量继续调 prompt**
   - 当前有内置 prompt。
   - 但还需要用真实样例继续比对：
     - 叙事推进
     - 角色一致性
     - 镜头变化
     - 构图密度
     - 是否像教程示例

3. **视频节点能力继续完善**
   - 当前图片节点、图生视频主路径已有大量修复。
   - 但视频高级模式、音频、脚本仍有一些“即将接入”入口。

4. **拖拽性能最后一刀**
   - 当前已经明显降载。
   - 如果还不够，可继续做：
     - 拖动中直接 DOM transform 更新
     - 松手后再写 React state
   - 这会更接近专业画布引擎手感。

5. **真实服务错误分类**
   - 已经不再 Mock 假成功。
   - 后续可把 OpenAiTeach 错误分类成：
     - token 失效
     - 额度不足
     - 模型无渠道
     - 图片输入非法
     - 超时

## 7. 新电脑继续前的验证命令

```bash
npm test
npm run build
npx tsc --noEmit --pretty false --project tsconfig.json
git diff --check
```

启动后验证：

```bash
curl -I http://localhost:5173/
curl http://localhost:5173/api/openaiteach/ping
```

期望：

```text
HTTP/1.1 200 OK
{"ok":true,"service":"openaiteach-proxy"}
```

## 8. 当前关键注意事项

- 不要提交 `library/`。
- 不要提交 `.env`。
- 不要提交 `.omx/`。
- 不要把 OpenAiTeach session/token 放进 GitHub。
- 继续开发时保持“生成图片节点 = 图片源节点”的规则。
- 继续开发时保持“拖动优先丝滑”的规则。
