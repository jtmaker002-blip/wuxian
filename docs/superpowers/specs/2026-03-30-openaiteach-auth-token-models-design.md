# OpenAiTeach 登录 + Token + 模型集成设计

**日期：** 2026-03-30  
**项目：** TwitCanva-Video-Workflow  
**状态：** 已批准，待实现

---

## 1. 背景与目标

TwitCanva 目前的模型列表硬编码在 `src/config/modelRegistry.ts`，每个服务商需要用户单独配置 API Key。

本设计将接入 openaiteach.com 平台，实现：
- 用户用 openaiteach.com 账号登录 TwitCanva
- 登录后从账号拉取 API Token
- 用帧境（framerealm-canvas）的模型名字表替换硬编码列表
- 所有 AI 请求统一走 openaiteach.com，无需单独配置各服务商 Key

---

## 2. 整体架构

```
用户打开 TwitCanva
       ↓
[读 localStorage 检查 session]
  ↓ 无效               ↓ 有效
登录页              主画布（正常使用）
  ↓ 登录成功
主画布
  ↓ 点设置图标（齿轮）
新设置弹窗（三 Tab）
  Tab1: 账号  Tab2: Token  Tab3: 模型
       ↓
  模型勾选后 → 节点下拉框动态更新
```

### 新增文件

| 文件 | 作用 |
|------|------|
| `src/features/auth/pages/LoginPage.tsx` | 登录页（TwitCanva 深色风格）|
| `src/features/auth/store/session-store.ts` | Zustand session 状态（持久化）|
| `src/features/auth/api/auth-client.ts` | 登录 API 调用 |
| `src/features/settings/pages/SettingsModal.tsx` | 新三 Tab 设置弹窗 |
| `src/features/settings/api/token-client.ts` | Token 列表 API |
| `src/features/settings/store/token-config-store.ts` | Token 选择状态（持久化）|
| `src/shared/api/http.ts` | 带 `credentials: include` 的 fetch 工具 |
| `src/shared/api/resolve-absolute-base-url.ts` | 相对路径转绝对 URL |
| `src/shared/config/env.ts` | dev `/api` / prod `https://openaiteach.com/api` |
| `src/shared/types/auth.ts` | LoginInput / SessionPayload / CurrentUser 类型 |
| `src/shared/types/token.ts` | ApiTokenRecord 类型 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `vite.config.ts` | 加 `/api` 代理 → `https://openaiteach.com` |
| `src/App.tsx` | 加登录守卫 + 替换 ApiSettingsModal → SettingsModal |
| `src/config/modelRegistry.ts` | 替换为帧境 59 个模型名字表 |
| `src/hooks/useApiSettings.ts` | 读取 session + token，供节点使用 |

---

## 3. 登录页设计

**文件：** `src/features/auth/pages/LoginPage.tsx`

**样式：** 跟随 `canvasTheme`（深色 `#050505` / 浅色 `#f5f5f5`），主色 `#6366f1`（紫色），与 TwitCanva 完全一致。页面右上角有深/浅模式切换按钮，主题偏好存 localStorage。

**界面：**
```
全屏背景
  🎬 TwitCanva
  使用 OpenAiTeach 账号登录

  [账号 / 邮箱输入框]
  [密码输入框（可显示/隐藏）]
  [登录按钮]

  登录即表示同意使用条款
  遇到问题？前往 openaiteach.com
```

**状态：**
- 登录中 → 按钮禁用 + 显示"登录中..."
- 失败 → 红色错误提示（如"账号或密码错误"）
- 成功 → 写入 session store → 跳转主画布（不刷新）

**API：**
```
POST /api/user/login?turnstile=
Body: { username, password, captcha_token: "" }
Headers: credentials: "include"（Cookie 会话）
```

---

## 4. 三 Tab 设置弹窗

**文件：** `src/features/settings/pages/SettingsModal.tsx`  
**替换：** 删除 `src/components/modals/ApiSettingsModal.tsx`，App.tsx 改引 SettingsModal

接收 props：`canvasTheme: 'dark' | 'light'`，所有颜色跟随主题。

### Tab 1 — 账号

- 显示头像（首字母）、用户名、邮箱
- 账户余额（刷新按钮）
- API 地址：`https://openaiteach.com`
- 退出登录按钮（清空 session + 跳回登录页）

### Tab 2 — Token

- 下拉选择账号下的 Token（调 `/api/token/?p=0&size=20`）
- [刷新列表] 按钮
- 分隔线 + 手动输入 `sk-xxx` 框 + [保存] 按钮
- 底部显示当前使用的 Token 名字
- [测试连接] 按钮（调 `/api/user/self`）

**Token 响应解析：**
```json
{ "data": { "items": [{ "id", "name", "key", ... }] }, "success", "message" }
```
显示 `token.name`，保存 `token.key`（前端展示时加 `sk-` 前缀）。

### Tab 3 — 模型

- 顶部：已选数量 / 总数量 + [全选] / [全不选]
- 按类别分组（LLM / 图像 / 视频 / 语音），每组可展开/折叠
- 每个模型一行：勾选框 + 显示名字
- 勾选状态存 `localStorage`（key: `twitcanva_enabled_models`）
- 勾选的模型自动出现在节点下拉框

---

## 5. 模型注册表（帧境名字表，共 59 个）

替换 `src/config/modelRegistry.ts` 的 `MODEL_REGISTRY` 和 `MODEL_PROVIDERS`。

### LLM（22个）

| id | 显示名字 | 分类 |
|----|---------|------|
| claude-opus-4-6 | Claude Opus 4.6 | llm |
| claude-opus-4-6-thinking | Claude Opus 4.6 Thinking | llm |
| claude-opus-4-5-20251101 | Claude Opus 4.5 | llm |
| claude-opus-4-5-20251101-thinking | Claude Opus 4.5 Thinking | llm |
| gemini-3.1-pro-preview | Gemini 3.1 Pro Preview | llm |
| gemini-3-pro-preview | Gemini 3 Pro Preview | llm |
| gemini-3-pro-preview-thinking | Gemini 3 Pro Preview Thinking | llm |
| gemini-3-flash-preview | Gemini 3 Flash Preview | llm |
| gemini-3.1-flash-lite-preview | Gemini 3.1 Flash Lite | llm |
| gpt-5.4 | GPT 5.4 | llm |
| gpt-5.2 | GPT 5.2 | llm |
| gpt-5.2-chat | GPT 5.2 Chat | llm |
| gpt-4o | GPT-4o | llm |
| gpt-4o-mini | GPT-4o Mini | llm |
| deepseek-v3.2 | DeepSeek V3.2 | llm |
| deepseek-v3.2-thinking | DeepSeek V3.2 Thinking | llm |
| doubao-seed-1-8-251228 | 豆包 Seed 1.8 | llm |
| doubao-seed-1-8-251228-thinking | 豆包 Seed 1.8 Thinking | llm |
| kimi-k2.5 | Kimi K2.5 | llm |
| glm-4.7 | GLM 4.7 | llm |
| grok-4.2 | Grok 4.2 | llm |
| mimo-v2-flash | MiMo V2 Flash | llm |

### 图像（16个）

| id | 显示名字 | 分类 |
|----|---------|------|
| gemini-2.5-flash-image-preview | Nano Banana 1 | image |
| gemini-3.1-flash-image-preview | Nano Banana 2 | image |
| gemini-3-pro-image-preview | Nano Banana Pro | image |
| gpt-image-1.5-all | GPT Image 1.5 | image |
| grok-4.2-image | Grok 4.2 Image | image |
| grok-4.1-image | Grok 4.1 Image | image |
| grok-4-image | Grok 4 Image | image |
| grok-3-image | Grok 3 Image | image |
| midjourney-v6 | Midjourney | image |
| midjourney-v6-raw | Midjourney V6.1 (Raw) | image |
| midjourney-niji-v6 | Niji Journey | image |
| doubao-seedream-5-0-260128 | Doubao Seedream 5.0 | image |
| doubao-seedream-4-5-251128 | Doubao Seedream 4.5 | image |
| doubao-seedream-4-0-250828 | Doubao Seedream 4.0 | image |
| doubao-seedream-3-0-t2i-250415 | Doubao Seedream 3.0 | image |
| qwen-image-edit-2509 | Qwen Image Edit | image |

### 视频（17个）

| id | 显示名字 | 分类 |
|----|---------|------|
| sora-2 | Sora 2 | video |
| veo3.1-pro | Veo 3.1 Pro | video |
| veo3.1 | Veo 3.1 | video |
| veo3.1-fast-components | Veo 3.1 Fast | video |
| grok-video-3 | Grok Video 3 | video |
| kling-v3 | Kling V3 | video |
| kling-v2-6 | Kling V2.6 | video |
| kling-v2-5-turbo | Kling V2.5 Turbo | video |
| minimax-hailuo | MiniMax Hailuo | video |
| wan2.6-i2v | Wan 2.6 I2V | video |
| wan2.6-i2v-flash | Wan 2.6 I2V Flash | video |
| wan2.5-i2v-preview | Wan 2.5 I2V Preview | video |
| jimeng-seedance-2 | Seedance 2.0 | video |
| jimeng-4.5 | 即梦 4.5 | video |
| jimeng-4.1 | 即梦 4.1 | video |
| jimeng-4.0 | 即梦 4.0 | video |
| jimeng-video-3-fast | 即梦视频 3.0 Fast | video |

### 语音（4个）

| id | 显示名字 | 分类 |
|----|---------|------|
| cosyvoice-v3-flash | CosyVoice V3 Flash | voice |
| cosyvoice-v3-plus | CosyVoice V3 Plus | voice |
| qwen3-tts-flash | Qwen TTS Flash | voice |
| qwen-voice-design | Qwen Voice Design | voice |

所有模型默认 `isDefault: false`，用户在设置 Tab3 自行勾选。

---

## 6. 数据流

### 登录流程
```
LoginPage
  → auth-client.ts: POST /api/user/login?turnstile=  { credentials: include }
  → 服务器写 Cookie
  → 解析响应，提取 userId / username
  → session-store.ts: setSession({ ok, sessionToken, userId, username })
  → App.tsx: session 有效 → 渲染主画布
```

### Token 拉取流程
```
SettingsModal Tab2 [刷新列表]
  → token-client.ts: GET /api/token/?p=0&size=20  { credentials: include }
  → 解析 data.items → ApiTokenRecord[]
  → token-config-store.ts: setAvailableTokens(tokens)
  → 下拉框更新
```

### AI 请求路由
```
节点发起请求
  → useApiSettings: 读取 selectedTokenValue (sk-xxx)
  → 如果有 token: Authorization: Bearer sk-xxx
  → 如果 cookie 会话: 不加 Authorization，依赖 Cookie
  → 请求目标: https://openaiteach.com/v1/...
```

### 开发代理（仅本地）
```
vite.config.ts:
  /api  →  https://openaiteach.com  (changeOrigin: true)
```

---

## 7. 安全约束

- 不在任何日志 / console 中打印真实 token 值
- 不引入任何第三方登录 SDK
- 不修改 openaiteach.com 后端
- Token 明文只存 localStorage（与现有 API Key 存储方式一致）
- 调试用的 `127.0.0.1:7270` ingest 代码迁移时全部删除

---

## 8. 验证标准

- `npm run build` 无 TypeScript 错误
- 登录 openaiteach.com 账号后能进入主画布
- 设置 → Token Tab → 刷新列表 → 能看到"openaiteach的初始令牌"
- 设置 → 模型 Tab → 能看到 59 个模型，勾选后节点下拉框更新
- 深/浅模式切换，登录页和设置弹窗颜色跟随变化
