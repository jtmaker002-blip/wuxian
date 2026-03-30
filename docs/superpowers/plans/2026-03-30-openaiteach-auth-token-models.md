# OpenAiTeach 登录 + Token + 模型集成 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 TwitCanva 中接入 openaiteach.com 账号登录、Token 管理和 59 个帧境模型，替换原有 ApiSettingsModal。

**架构：** 新增 `src/features/` 存放 auth/settings 模块，`src/shared/` 存放公共 API 工具和类型。App.tsx 加登录守卫，主画布齿轮按钮打开新三 Tab SettingsModal；模型启用/禁用通过现有 `useApiSettings` 的 `twitcanva_api_settings` 存储与 `twitcanva_api_settings_changed` 事件同步，无需新增存储 key。

**技术栈：** React 19、Vite 6、TypeScript、Zustand（新增直接依赖）、Tailwind CSS（CDN）、fetch API（credentials: include）

**规格文档：** `docs/superpowers/specs/2026-03-30-openaiteach-auth-token-models-design.md`

> **⚠️ 计划对规格的三处修正（优先以计划为准）：**
> 1. **代理路径**：规格写 `/api` + `/v1`；计划改为 `/oat-api` + `/oat-v1`，避免与现有本地 Express `/api` 路由冲突。
> 2. **模型默认启用**：规格写"默认 `isDefault: false`、用户在 Tab3 勾选"；计划改为"首次默认全部启用"，防止空白首屏，用户可随时取消勾选。
> 3. **模型启用存储 key**：规格写 `twitcanva_enabled_models`；计划复用现有 `twitcanva_api_settings.enabledModelIds`，保持与 `useApiSettings` 一致。

---

## 重要背景：本地后端与 OpenAiTeach 并存

**现状：** 当前 `vite.config.ts` 将 `/api` 代理到 `localhost:3001`（本地 Express 服务，提供聊天、工作流、素材库等）。

**方案：** OpenAiTeach 在开发环境使用 `/oat-api`（→ openaiteach.com/api）和 `/oat-v1`（→ openaiteach.com/v1）两个独立路径前缀，**不影响**现有 `/api → localhost:3001`。

```
开发环境代理：
/oat-api  → https://openaiteach.com/api  (去除 /oat 前缀)
/oat-v1   → https://openaiteach.com/v1   (去除 /oat 前缀)
/api      → http://localhost:3001         (保持不变)
/library  → http://localhost:3001         (保持不变)

生产环境：
env.apiBaseUrl = 'https://openaiteach.com/api'  (直连)
env.aiBaseUrl  = 'https://openaiteach.com/v1'   (直连)
```

---

## 文件结构

### 新建文件
| 文件 | 职责 |
|------|------|
| `src/shared/types/auth.ts` | LoginInput / SessionPayload / CurrentUser 类型 |
| `src/shared/types/token.ts` | ApiTokenRecord 类型 |
| `src/shared/config/env.ts` | apiBaseUrl / aiBaseUrl，dev 用 /oat- 前缀，prod 用绝对域名 |
| `src/shared/api/resolve-absolute-base-url.ts` | 相对路径 → 绝对 URL 工具函数 |
| `src/shared/api/http.ts` | createHttpClient（GET/POST，credentials: include，401 全局事件）|
| `src/features/auth/api/auth-client.ts` | createAuthClient（login 方法）|
| `src/features/auth/store/session-store.ts` | useSessionStore（Zustand + persist）|
| `src/features/auth/pages/LoginPage.tsx` | 全屏登录页，跟随 canvasTheme |
| `src/features/settings/api/token-client.ts` | createTokenClient（listTokens / verifyToken）|
| `src/features/settings/store/token-config-store.ts` | useTokenConfigStore（Zustand + persist）|
| `src/features/settings/pages/SettingsModal.tsx` | 三 Tab 弹窗（账号/Token/模型）|

### 修改文件
| 文件 | 改动 |
|------|------|
| `vite.config.ts` | 加 `/oat-api` 和 `/oat-v1` 代理（保留原 `/api → localhost:3001`）|
| `src/config/modelRegistry.ts` | 替换为帧境 59 个模型，全部无 `isDefault`（默认全启用）|
| `src/hooks/useApiSettings.ts` | `DEFAULT_ENABLED_IDS` 改为全模型；`getProviderConfig` 注入 openaiteach token |
| `src/App.tsx` | 加登录守卫 + 401 全局监听 + 替换 ApiSettingsModal → SettingsModal |

### 删除文件
| 文件 | 原因 |
|------|------|
| `src/components/modals/ApiSettingsModal.tsx` | 被 SettingsModal 完全替代 |

---

## 任务 1：安装依赖 + Vite 代理 + 共享基础设施

**文件：**
- 修改：`vite.config.ts`
- 创建：`src/shared/types/auth.ts`
- 创建：`src/shared/types/token.ts`
- 创建：`src/shared/config/env.ts`
- 创建：`src/shared/api/resolve-absolute-base-url.ts`
- 创建：`src/shared/api/http.ts`

- [ ] **步骤 1：安装 zustand**

```bash
npm install zustand
```

- [ ] **步骤 2：修改 vite.config.ts（保留 /api → localhost，新增 /oat-api + /oat-v1）**

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      proxy: {
        '/oat-api': {
          target: 'https://openaiteach.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/oat-api/, '/api'),
        },
        '/oat-v1': {
          target: 'https://openaiteach.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/oat-v1/, '/v1'),
        },
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/library': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
```

- [ ] **步骤 3：创建 src/shared/types/auth.ts**

```typescript
export type LoginInput = {
  account: string;
  password: string;
};

export type SessionPayload = {
  ok: boolean;
  /** 前端标识占位符 "cookie-session:{userId}"，真实 session 由 HttpOnly Cookie 维护 */
  sessionToken: string;
  userId?: string;
  username?: string;
};
```

- [ ] **步骤 4：创建 src/shared/types/token.ts**

```typescript
export type ApiTokenRecord = {
  id: string;
  name: string;
  /** 完整 sk-xxx 值 */
  value: string;
};
```

- [ ] **步骤 5：创建 src/shared/config/env.ts**

```typescript
const REMOTE_API = 'https://openaiteach.com/api';
const REMOTE_V1  = 'https://openaiteach.com/v1';
const isDev = import.meta.env?.DEV ?? false;

export const env = {
  /** 登录、Token 管理等后台 API */
  apiBaseUrl: isDev ? '/oat-api' : REMOTE_API,
  /** AI 推理接口 */
  aiBaseUrl: isDev ? '/oat-v1' : REMOTE_V1,
};
```

- [ ] **步骤 6：创建 src/shared/api/resolve-absolute-base-url.ts**

```typescript
/**
 * 将 /oat-api 等相对 base 转为绝对 URL，避免 new URL(path, relative) 抛错。
 */
export function resolveAbsoluteBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const origin =
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
      ? window.location.origin
      : 'https://openaiteach.com';
  const p = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${origin}${p}`;
}
```

- [ ] **步骤 7：创建 src/shared/api/http.ts（含 401 全局事件）**

```typescript
import { resolveAbsoluteBaseUrl } from './resolve-absolute-base-url';

export const OPENAITEACH_401_EVENT = 'openaiteach_401';

export type HttpClientConfig = {
  baseUrl: string;
};

export function createHttpClient(config: HttpClientConfig) {
  const base = resolveAbsoluteBaseUrl(config.baseUrl);

  function dispatch401() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(OPENAITEACH_401_EVENT));
    }
  }

  return {
    async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
      const res = await fetch(new URL(path, base), {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (res.status === 401) { dispatch401(); throw new Error('HTTP 401 Unauthorized'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    },

    async post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
      const res = await fetch(new URL(path, base), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (res.status === 401) { dispatch401(); throw new Error('HTTP 401 Unauthorized'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    },
  };
}
```

- [ ] **步骤 8：验证构建**

```bash
npm run build
```

预期：无 TypeScript 错误，构建成功。

- [ ] **步骤 9：Commit**

```bash
git add package.json package-lock.json vite.config.ts src/shared/
git commit -m "feat: add zustand, shared types/env/http-client and oat proxy for openaiteach"
```

---

## 任务 2：Auth 客户端 + Session Store

**文件：**
- 创建：`src/features/auth/api/auth-client.ts`
- 创建：`src/features/auth/store/session-store.ts`

- [ ] **步骤 1：创建 src/features/auth/api/auth-client.ts**

```typescript
import { createHttpClient } from '../../../shared/api/http';
import { env } from '../../../shared/config/env';
import type { LoginInput, SessionPayload } from '../../../shared/types/auth';

export function createAuthClient(options: { baseUrl?: string } = {}) {
  const http = createHttpClient({ baseUrl: options.baseUrl ?? env.apiBaseUrl });

  return {
    async login(input: LoginInput): Promise<SessionPayload> {
      if (!input.account.trim() || !input.password.trim()) {
        throw new Error('账号和密码不能为空');
      }

      const response = await http.post<{
        success: boolean;
        message?: string;
        data?: Record<string, unknown>;
      }>('user/login?turnstile=', {
        username: input.account,
        password: input.password,
        captcha_token: '',
      });

      if (!response.success) {
        throw new Error(response.message ?? '登录失败，请检查账号密码');
      }

      const data = (response.data ?? {}) as Record<string, unknown>;
      const userId = readString(data, ['id', 'user_id', 'userId', 'uid']);
      const username = readString(data, ['username', 'email', 'name']);

      return {
        ok: true,
        sessionToken: `cookie-session:${userId ?? 'anon'}`,
        userId,
        username,
      };
    },
  };
}

function readString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}
```

- [ ] **步骤 2：创建 src/features/auth/store/session-store.ts**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionPayload } from '../../../shared/types/auth';

type SessionState = {
  session: SessionPayload | null;
  setSession: (session: SessionPayload | null) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
    }),
    { name: 'openaiteach-session' }
  )
);
```

- [ ] **步骤 3：验证构建**

```bash
npm run build
```

- [ ] **步骤 4：Commit**

```bash
git add src/features/auth/api/ src/features/auth/store/
git commit -m "feat: add auth client and session store"
```

---

## 任务 3：登录页

**文件：**
- 创建：`src/features/auth/pages/LoginPage.tsx`

- [ ] **步骤 1：创建 LoginPage.tsx（使用具名 FormEvent 导入，无 React.FormEvent）**

```tsx
import { useState, type FormEvent } from 'react';
import { createAuthClient } from '../api/auth-client';
import { useSessionStore } from '../store/session-store';

type LoginPageProps = {
  canvasTheme: 'dark' | 'light';
  onToggleTheme: () => void;
};

const authClient = createAuthClient();

export function LoginPage({ canvasTheme, onToggleTheme }: LoginPageProps) {
  const setSession = useSessionStore((s) => s.setSession);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = canvasTheme === 'dark';
  const bg = isDark ? 'bg-[#050505]' : 'bg-neutral-50';
  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const inputBg = isDark
    ? 'bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500'
    : 'bg-neutral-100 border-neutral-300 text-neutral-900 placeholder-neutral-400';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await authClient.login({ account, password });
      setSession(session);
      // session store 已更新，React 自动重渲，App 读到 session.ok=true 进入主画布
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`${bg} w-screen h-screen flex items-center justify-center relative transition-colors duration-300`}
    >
      {/* 主题切换 */}
      <button
        type="button"
        onClick={onToggleTheme}
        className={`absolute top-4 right-4 p-2 rounded-full ${
          isDark
            ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'
        } transition-colors`}
        title="切换主题"
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <div className={`${cardBg} border rounded-2xl p-8 w-full max-w-sm shadow-2xl`}>
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🎬</div>
          <h1 className={`text-xl font-bold ${textPrimary}`}>TwitCanva</h1>
          <p className={`text-sm mt-1 ${textSecondary}`}>使用 OpenAiTeach 账号登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
              账号 / 邮箱
            </label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="your@email.com"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${inputBg}`}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className={`block text-xs font-medium ${textSecondary} mb-1`}>密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${inputBg}`}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${textSecondary}`}
              >
                {showPassword ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className={`mt-4 text-center text-xs ${textSecondary}`}>
          <p>
            遇到问题？前往
            <a
              href="https://openaiteach.com"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline ml-1"
            >
              openaiteach.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：验证构建**

```bash
npm run build
```

- [ ] **步骤 3：Commit**

```bash
git add src/features/auth/pages/LoginPage.tsx
git commit -m "feat: add LoginPage with dark/light theme support"
```

---

## 任务 4：Token 客户端 + Store

**文件：**
- 创建：`src/features/settings/api/token-client.ts`
- 创建：`src/features/settings/store/token-config-store.ts`

- [ ] **步骤 1：创建 src/features/settings/api/token-client.ts（用 createHttpClient，确保 401 全局事件一致）**

```typescript
import { createHttpClient } from '../../../shared/api/http';
import { env } from '../../../shared/config/env';
import type { ApiTokenRecord } from '../../../shared/types/token';

type FetchSession = {
  userId?: string;
  /** "cookie-session:xxx" 时用 Cookie；sk-xxx 时作为 Bearer Token */
  systemToken: string;
};

function buildAuthHeaders(session: FetchSession): Record<string, string> {
  const headers: Record<string, string> = {};
  const isBearer =
    session.systemToken &&
    !session.systemToken.startsWith('cookie-session:') &&
    session.systemToken.trim() !== '';
  if (isBearer) {
    const raw = session.systemToken.trim();
    headers['Authorization'] = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
  }
  return headers;
}

export function createTokenClient(options: { baseUrl?: string } = {}) {
  // 使用 createHttpClient：自动 credentials:include，且 401 会触发 OPENAITEACH_401_EVENT
  const http = createHttpClient({ baseUrl: options.baseUrl ?? env.apiBaseUrl });

  return {
    async listTokens(session: FetchSession): Promise<ApiTokenRecord[]> {
      const payload = await http.get<unknown>(
        'token/?p=0&size=20',
        buildAuthHeaders(session)
      );
      return parseTokenItems(payload);
    },

    async verifyToken(session: FetchSession): Promise<boolean> {
      await http.get<unknown>('user/self', buildAuthHeaders(session));
      return true;
    },
  };
}

function parseTokenItems(payload: unknown): ApiTokenRecord[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const top = payload as Record<string, unknown>;
  const data = top['data'];
  const items =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)['items']
      : Array.isArray(data)
      ? data
      : [];
  if (!Array.isArray(items)) return [];
  return items.map((item: Record<string, unknown>) => ({
    id: String(item['id'] ?? item['key'] ?? ''),
    name: String(item['name'] ?? `Token ${item['id'] ?? ''}`),
    value: String(item['key'] ?? item['token'] ?? item['value'] ?? ''),
  }));
}
```

- [ ] **步骤 2：创建 src/features/settings/store/token-config-store.ts**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiTokenRecord } from '../../../shared/types/token';

type TokenConfigState = {
  availableTokens: ApiTokenRecord[];
  selectedTokenId: string;
  selectedTokenValue: string;
  draftTokenValue: string;
  setAvailableTokens: (tokens: ApiTokenRecord[]) => void;
  setSelectedTokenId: (id: string) => void;
  setDraftTokenValue: (value: string) => void;
  saveSelectedToken: () => void;
  saveManualToken: () => void;
  reset: () => void;
};

const initial = {
  availableTokens: [] as ApiTokenRecord[],
  selectedTokenId: '',
  selectedTokenValue: '',
  draftTokenValue: '',
};

export const useTokenConfigStore = create<TokenConfigState>()(
  persist(
    (set, get) => ({
      ...initial,
      setAvailableTokens: (tokens) => {
        const { selectedTokenId, draftTokenValue, selectedTokenValue } = get();
        const matched = tokens.find((t) => t.id === selectedTokenId);
        set({
          availableTokens: tokens,
          draftTokenValue: matched?.value ?? draftTokenValue,
          selectedTokenValue: matched?.value ?? selectedTokenValue,
        });
      },
      setSelectedTokenId: (id) => {
        const matched = get().availableTokens.find((t) => t.id === id);
        set({ selectedTokenId: id, draftTokenValue: matched?.value ?? '' });
      },
      setDraftTokenValue: (value) => set({ draftTokenValue: value }),
      saveSelectedToken: () => {
        const { availableTokens, selectedTokenId, draftTokenValue, selectedTokenValue } = get();
        const matched = availableTokens.find((t) => t.id === selectedTokenId);
        set({
          draftTokenValue: matched?.value ?? draftTokenValue,
          selectedTokenValue: matched?.value ?? selectedTokenValue,
        });
      },
      saveManualToken: () => {
        const raw = get().draftTokenValue.trim();
        // 去除重复前缀后保存完整 sk-xxx
        const value = raw.startsWith('sk-') ? raw : raw ? `sk-${raw}` : '';
        set({ selectedTokenId: '', selectedTokenValue: value });
      },
      reset: () => set(initial),
    }),
    { name: 'openaiteach-token-config' }
  )
);
```

- [ ] **步骤 3：验证构建**

```bash
npm run build
```

- [ ] **步骤 4：Commit**

```bash
git add src/features/settings/api/ src/features/settings/store/
git commit -m "feat: add token client (Bearer header) and token config store"
```

---

## 任务 5：模型注册表替换

**文件：**
- 修改：`src/config/modelRegistry.ts`
- 修改：`src/hooks/useApiSettings.ts`

**注意：** 所有 59 个模型**不设 `isDefault`**（或全不加此字段），`useApiSettings` 的默认启用改为全模型，确保首次打开不会因无默认模型而空白。

- [ ] **步骤 1：读取 src/config/modelRegistry.ts 确认类型定义结构**

执行：
```bash
type src\config\modelRegistry.ts
```

确认 `ModelCategory`、`ModelEntry` 等类型定义的字段。

- [ ] **步骤 2：保留类型定义，完全替换 MODEL_PROVIDERS 和 MODEL_REGISTRY**

在 `modelRegistry.ts` 中，保持文件顶部的 `type`/`interface` 定义不变，将 `MODEL_PROVIDERS` 和 `MODEL_REGISTRY` 替换为以下内容：

```typescript
export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'openaiteach',
    name: 'OpenAiTeach',
    apiKeyLabel: 'API Token',
    apiKeyPlaceholder: 'sk-...',
    apiKeyLink: 'https://openaiteach.com/console/token',
    baseUrlDefault: 'https://openaiteach.com/v1',
  },
];

export const MODEL_REGISTRY: ModelEntry[] = [
  // ── LLM ────────────────────────────────────────────────────────────────
  { id: 'claude-opus-4-6',                   name: 'Claude Opus 4.6',               category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'claude-opus-4-6-thinking',           name: 'Claude Opus 4.6 Thinking',      category: 'llm',   region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'claude-opus-4-5-20251101',           name: 'Claude Opus 4.5',               category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'claude-opus-4-5-20251101-thinking',  name: 'Claude Opus 4.5 Thinking',      category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3.1-pro-preview',             name: 'Gemini 3.1 Pro Preview',        category: 'llm',   region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gemini-3-pro-preview',               name: 'Gemini 3 Pro Preview',          category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3-pro-preview-thinking',      name: 'Gemini 3 Pro Preview Thinking', category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3-flash-preview',             name: 'Gemini 3 Flash Preview',        category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3.1-flash-lite-preview',      name: 'Gemini 3.1 Flash Lite',         category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-5.4',                            name: 'GPT 5.4',                       category: 'llm',   region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gpt-5.2',                            name: 'GPT 5.2',                       category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-5.2-chat',                       name: 'GPT 5.2 Chat',                  category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-4o',                             name: 'GPT-4o',                        category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-4o-mini',                        name: 'GPT-4o Mini',                   category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'deepseek-v3.2',                      name: 'DeepSeek V3.2',                 category: 'llm',   region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'deepseek-v3.2-thinking',             name: 'DeepSeek V3.2 Thinking',        category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seed-1-8-251228',             name: '豆包 Seed 1.8',                 category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seed-1-8-251228-thinking',    name: '豆包 Seed 1.8 Thinking',        category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'kimi-k2.5',                          name: 'Kimi K2.5',                     category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'glm-4.7',                            name: 'GLM 4.7',                       category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'grok-4.2',                           name: 'Grok 4.2',                      category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'mimo-v2-flash',                      name: 'MiMo V2 Flash',                 category: 'llm',   region: 'global', providerId: 'openaiteach' },
  // ── Image ───────────────────────────────────────────────────────────────
  { id: 'gemini-2.5-flash-image-preview',     name: 'Nano Banana 1',                 category: 'image', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gemini-3.1-flash-image-preview',     name: 'Nano Banana 2',                 category: 'image', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gemini-3-pro-image-preview',         name: 'Nano Banana Pro',               category: 'image', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gpt-image-1.5-all',                  name: 'GPT Image 1.5',                 category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-4.2-image',                     name: 'Grok 4.2 Image',                category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-4.1-image',                     name: 'Grok 4.1 Image',                category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-4-image',                       name: 'Grok 4 Image',                  category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-3-image',                       name: 'Grok 3 Image',                  category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'midjourney-v6',                      name: 'Midjourney',                    category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'midjourney-v6-raw',                  name: 'Midjourney V6.1 (Raw)',          category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'midjourney-niji-v6',                 name: 'Niji Journey',                  category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'doubao-seedream-5-0-260128',         name: 'Doubao Seedream 5.0',           category: 'image', region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'doubao-seedream-4-5-251128',         name: 'Doubao Seedream 4.5',           category: 'image', region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seedream-4-0-250828',         name: 'Doubao Seedream 4.0',           category: 'image', region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seedream-3-0-t2i-250415',     name: 'Doubao Seedream 3.0',           category: 'image', region: 'china',  providerId: 'openaiteach' },
  { id: 'qwen-image-edit-2509',               name: 'Qwen Image Edit',               category: 'image', region: 'china',  providerId: 'openaiteach' },
  // ── Video ───────────────────────────────────────────────────────────────
  { id: 'sora-2',                             name: 'Sora 2',                        category: 'video', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'veo3.1-pro',                         name: 'Veo 3.1 Pro',                   category: 'video', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'veo3.1',                             name: 'Veo 3.1',                       category: 'video', region: 'global', providerId: 'openaiteach' },
  { id: 'veo3.1-fast-components',             name: 'Veo 3.1 Fast',                  category: 'video', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-video-3',                       name: 'Grok Video 3',                  category: 'video', region: 'global', providerId: 'openaiteach' },
  { id: 'kling-v3',                           name: 'Kling V3',                      category: 'video', region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'kling-v2-6',                         name: 'Kling V2.6',                    category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'kling-v2-5-turbo',                   name: 'Kling V2.5 Turbo',              category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'minimax-hailuo',                     name: 'MiniMax Hailuo',                category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'wan2.6-i2v',                         name: 'Wan 2.6 I2V',                   category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'wan2.6-i2v-flash',                   name: 'Wan 2.6 I2V Flash',             category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'wan2.5-i2v-preview',                 name: 'Wan 2.5 I2V Preview',           category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-seedance-2',                  name: 'Seedance 2.0',                  category: 'video', region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'jimeng-4.5',                         name: '即梦 4.5',                      category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-4.1',                         name: '即梦 4.1',                      category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-4.0',                         name: '即梦 4.0',                      category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-video-3-fast',                name: '即梦视频 3.0 Fast',             category: 'video', region: 'china',  providerId: 'openaiteach' },
  // ── Voice ───────────────────────────────────────────────────────────────
  { id: 'cosyvoice-v3-flash',                 name: 'CosyVoice V3 Flash',            category: 'voice', region: 'china',  providerId: 'openaiteach' },
  { id: 'cosyvoice-v3-plus',                  name: 'CosyVoice V3 Plus',             category: 'voice', region: 'china',  providerId: 'openaiteach' },
  { id: 'qwen3-tts-flash',                    name: 'Qwen TTS Flash',                category: 'voice', region: 'china',  providerId: 'openaiteach' },
  { id: 'qwen-voice-design',                  name: 'Qwen Voice Design',             category: 'voice', region: 'china',  providerId: 'openaiteach' },
];
```

- [ ] **步骤 3：修改 src/hooks/useApiSettings.ts（两处）**

**改动 A**：将第 38 行（DEFAULT_ENABLED_IDS）改为全模型默认启用：

旧：
```typescript
const DEFAULT_ENABLED_IDS = MODEL_REGISTRY.filter(m => m.isDefault).map(m => m.id);
```

新：
```typescript
const DEFAULT_ENABLED_IDS = MODEL_REGISTRY.map(m => m.id);
```

**改动 B**：**直接替换** `getProviderConfig` 的 `useCallback` 实现，注入 openaiteach token 逻辑，调用方无需任何修改：

```typescript
// 替换原有 getProviderConfig（约第 131–135 行）
const getProviderConfig = useCallback(
  (providerId: string): ProviderConfig => {
    if (providerId === 'openaiteach') {
      try {
        const raw = localStorage.getItem('openaiteach-token-config');
        if (raw) {
          const store = JSON.parse(raw) as { state?: { selectedTokenValue?: string } };
          const tokenValue = store?.state?.selectedTokenValue;
          if (tokenValue) {
            return { apiKey: tokenValue, baseUrl: 'https://openaiteach.com/v1' };
          }
        }
      } catch { /* ignore */ }
    }
    return settings.providers[providerId] ?? { apiKey: '', baseUrl: '' };
  },
  [settings.providers]
);
```

不需要新增 `getProviderConfigWithToken`，不需要改 return 对象，调用方零改动。

- [ ] **步骤 4：验证构建**

```bash
npm run build
```

预期：无错误，59 个模型全部编译进去。

- [ ] **步骤 5：Commit**

```bash
git add src/config/modelRegistry.ts src/hooks/useApiSettings.ts
git commit -m "feat: replace model registry with 59 framerealm models, default all enabled"
```

---

## 任务 6：三 Tab 设置弹窗

**文件：**
- 创建：`src/features/settings/pages/SettingsModal.tsx`

**关键设计：** 模型启用/禁用直接通过 `props.toggleModel` / `props.toggleAllInCategory` / `props.isModelEnabled` 操作，这些由 App.tsx 从 `useApiSettings()` 传入，共享同一 `twitcanva_api_settings` 存储，无需单独存储 key。

- [ ] **步骤 1：创建 SettingsModal.tsx**

```tsx
import { useState } from 'react';
import { useSessionStore } from '../../auth/store/session-store';
import { useTokenConfigStore } from '../store/token-config-store';
import { createTokenClient } from '../api/token-client';
import { MODEL_REGISTRY, type ModelCategory } from '../../../config/modelRegistry';

type Tab = 'account' | 'token' | 'models';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  canvasTheme: 'dark' | 'light';
  onLogout: () => void;
  isModelEnabled: (id: string) => boolean;
  onToggleModel: (id: string, enabled: boolean) => void;
  onToggleAllModels: (ids: string[], enabled: boolean) => void;
};

const tokenClient = createTokenClient();

const CATEGORY_LABELS: Record<ModelCategory, string> = {
  llm:   '💬 LLM 语言模型',
  image: '🖼️ 图像模型',
  video: '🎬 视频模型',
  voice: '🔊 语音模型',
};

const ALL_CATEGORIES: ModelCategory[] = ['llm', 'image', 'video', 'voice'];

export function SettingsModal({
  isOpen,
  onClose,
  canvasTheme,
  onLogout,
  isModelEnabled,
  onToggleModel,
  onToggleAllModels,
}: SettingsModalProps) {
  const session = useSessionStore((s) => s.session);
  const {
    availableTokens,
    selectedTokenId,
    selectedTokenValue,
    draftTokenValue,
    setAvailableTokens,
    setSelectedTokenId,
    setDraftTokenValue,
    saveSelectedToken,
    saveManualToken,
  } = useTokenConfigStore();

  const [tab, setTab] = useState<Tab>('account');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState('');

  const isDark = canvasTheme === 'dark';
  const overlay  = isDark ? 'bg-black/70' : 'bg-black/40';
  const cardBg   = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200';
  const divider  = isDark ? 'border-neutral-800' : 'border-neutral-200';
  const textP    = isDark ? 'text-white' : 'text-neutral-900';
  const textS    = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const inputBg  = isDark
    ? 'bg-neutral-800 border-neutral-700 text-white'
    : 'bg-neutral-100 border-neutral-300 text-neutral-900';
  const rowBg    = isDark ? 'bg-neutral-800' : 'bg-neutral-50';
  const tabA     = 'text-indigo-400 border-b-2 border-indigo-400';
  const tabI     = isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-700';

  const enabledCount = MODEL_REGISTRY.filter((m) => isModelEnabled(m.id)).length;

  async function handleRefreshTokens() {
    if (!session) return;
    setIsRefreshing(true);
    setMessage('');
    try {
      const tokens = await tokenClient.listTokens({
        userId: session.userId,
        systemToken: session.sessionToken,
      });
      setAvailableTokens(tokens);
      setMessage(
        tokens.length > 0 ? `已同步 ${tokens.length} 个令牌` : '暂无令牌，请在网站创建 Token'
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleTestConnection() {
    const token = draftTokenValue.trim() || selectedTokenValue;
    if (!token) { setMessage('请先选择或输入 Token'); return; }
    setIsTesting(true);
    setMessage('');
    try {
      await tokenClient.verifyToken({
        userId: session?.userId,
        systemToken: token,
      });
      setMessage('✅ 连接测试通过');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '连接测试失败');
    } finally {
      setIsTesting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${overlay} flex items-center justify-center z-50`}
      onClick={onClose}
    >
      <div
        className={`${cardBg} border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${divider}`}>
          <h2 className={`font-semibold text-sm ${textP}`}>⚙️ 设置</h2>
          <button onClick={onClose} className={`${textS} hover:text-white text-lg leading-none`}>✕</button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${divider} px-5`}>
          {(['account', 'token', 'models'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(''); }}
              className={`py-3 mr-6 text-xs font-medium transition-colors ${tab === t ? tabA : tabI}`}
            >
              {t === 'account' ? '账号' : t === 'token' ? 'Token' : '模型'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── 账号 Tab ── */}
          {tab === 'account' && (
            <div className="space-y-4">
              <div className={`${rowBg} rounded-xl p-4 flex items-center gap-3`}>
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {session?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${textP} truncate`}>
                    {session?.username ?? '未知用户'}
                  </div>
                  <div className={`text-xs ${textS}`}>ID: {session?.userId ?? '-'}</div>
                </div>
                <button
                  onClick={onLogout}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-3 py-1 rounded-lg transition-colors"
                >
                  退出
                </button>
              </div>
              <div className={`text-xs ${textS} space-y-1`}>
                <div>API 地址：<span className={textP}>https://openaiteach.com</span></div>
                <div>AI 推理：<span className={textP}>https://openaiteach.com/v1</span></div>
              </div>
            </div>
          )}

          {/* ── Token Tab ── */}
          {tab === 'token' && (
            <div className="space-y-4">
              <div>
                <div className={`text-xs font-medium ${textS} mb-2`}>从账号获取</div>
                <div className="flex gap-2">
                  <select
                    value={selectedTokenId}
                    onChange={(e) => setSelectedTokenId(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs ${inputBg} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  >
                    <option value="">-- 选择 Token --</option>
                    {availableTokens.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleRefreshTokens}
                    disabled={isRefreshing}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-xs transition-colors"
                  >
                    {isRefreshing ? '...' : '刷新'}
                  </button>
                  <button
                    onClick={saveSelectedToken}
                    className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-xs transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div className={`border-t ${divider} pt-4`}>
                <div className={`text-xs font-medium ${textS} mb-2`}>手动输入 sk-xxx</div>
                <div className="flex gap-2">
                  <input
                    value={draftTokenValue}
                    onChange={(e) => setDraftTokenValue(e.target.value)}
                    placeholder="sk-..."
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs ${inputBg} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                  <button
                    onClick={saveManualToken}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div className={`${rowBg} rounded-xl p-3 text-xs space-y-2`}>
                <div className={textS}>
                  当前令牌：
                  <span className={textP}>
                    {availableTokens.find((t) => t.id === selectedTokenId)?.name ??
                      (selectedTokenValue ? '手动 Token' : '未设置')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-3 py-1 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-xs transition-colors"
                  >
                    {isTesting ? '测试中...' : '测试连接'}
                  </button>
                  <a
                    href="https://openaiteach.com/console/token"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-lg border border-neutral-700 text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
                  >
                    创建令牌
                  </a>
                </div>
              </div>

              {message && <p className="text-xs text-indigo-400">{message}</p>}
            </div>
          )}

          {/* ── 模型 Tab ── */}
          {tab === 'models' && (
            <div className="space-y-4">
              <div className={`flex items-center justify-between text-xs ${textS}`}>
                <span>已选 {enabledCount} / 共 {MODEL_REGISTRY.length} 个</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleAllModels(MODEL_REGISTRY.map((m) => m.id), true)}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    全选
                  </button>
                  <span>|</span>
                  <button
                    onClick={() => onToggleAllModels(MODEL_REGISTRY.map((m) => m.id), false)}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    全不选
                  </button>
                </div>
              </div>

              {ALL_CATEGORIES.map((cat) => {
                const models = MODEL_REGISTRY.filter((m) => m.category === cat);
                return (
                  <div key={cat}>
                    <div className={`text-xs font-semibold ${textS} mb-2`}>
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className="space-y-1">
                      {models.map((m) => (
                        <label
                          key={m.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${rowBg} hover:bg-indigo-600/10 transition-colors`}
                        >
                          <input
                            type="checkbox"
                            checked={isModelEnabled(m.id)}
                            onChange={(e) => onToggleModel(m.id, e.target.checked)}
                            className="accent-indigo-500"
                          />
                          <span className={`text-xs flex-1 ${textP}`}>{m.name}</span>
                          {m.tags?.includes('HOT') && (
                            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded">
                              HOT
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：验证构建**

```bash
npm run build
```

- [ ] **步骤 3：Commit**

```bash
git add src/features/settings/pages/SettingsModal.tsx
git commit -m "feat: add three-tab SettingsModal using shared useApiSettings model state"
```

---

## 任务 7：App.tsx 接入（登录守卫 + 401 监听 + 替换弹窗）

**文件：**
- 修改：`src/App.tsx`
- 删除：`src/components/modals/ApiSettingsModal.tsx`

App.tsx 共 4 处改动，加上新增的 useEffect 401 监听。

- [ ] **步骤 1：替换 import（第 55 行附近）**

将：
```typescript
import { ApiSettingsModal } from './components/modals/ApiSettingsModal';
```
改为：
```typescript
import { LoginPage } from './features/auth/pages/LoginPage';
import { SettingsModal } from './features/settings/pages/SettingsModal';
import { useSessionStore } from './features/auth/store/session-store';
import { useTokenConfigStore } from './features/settings/store/token-config-store';
import { OPENAITEACH_401_EVENT } from './shared/api/http';
```

- [ ] **步骤 2：在 App() 函数顶部加 session/logout/401 逻辑**

在 `const [canvasTheme, setCanvasTheme] = useState` 行下方加：

```typescript
// ── OpenAiTeach session ──────────────────────────────────────────────────
const session = useSessionStore((s) => s.session);
const setSession = useSessionStore((s) => s.setSession);
const resetTokenConfig = useTokenConfigStore((s) => s.reset);

// useCallback 避免 exhaustive-deps 警告，Zustand setter 稳定，deps 为空安全
const handleLogout = useCallback(() => {
  setSession(null);
  resetTokenConfig();
}, [setSession, resetTokenConfig]);

// 任意 API 返回 401 时自动回到登录页
useEffect(() => {
  window.addEventListener(OPENAITEACH_401_EVENT, handleLogout);
  return () => window.removeEventListener(OPENAITEACH_401_EVENT, handleLogout);
}, [handleLogout]);
```

- [ ] **步骤 3：加登录守卫（在主 return 语句之前）**

在 `return (` 之前，加：

```typescript
// 登录守卫：未登录时显示 LoginPage
if (!session?.ok) {
  return (
    <LoginPage
      canvasTheme={canvasTheme}
      onToggleTheme={() =>
        setCanvasTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
      }
    />
  );
}
```

- [ ] **步骤 4：替换 ApiSettingsModal 的 JSX（第 1388 行附近）**

将：
```tsx
<ApiSettingsModal
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  ...任何原有 props
/>
```
改为：
```tsx
<SettingsModal
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  canvasTheme={canvasTheme}
  onLogout={handleLogout}
  isModelEnabled={isModelEnabled}
  onToggleModel={toggleModel}
  onToggleAllModels={toggleAllInCategory}
/>
```

（注意：`isModelEnabled`、`toggleModel`、`toggleAllInCategory` 均来自 `useApiSettings()`，App.tsx 中已在某处调用了该 hook。若尚未解构这三个方法，需从 `useApiSettings()` 返回值中补充解构。）

- [ ] **步骤 5：删除旧文件**

```bash
git rm src/components/modals/ApiSettingsModal.tsx
```

- [ ] **步骤 6：验证构建**

```bash
npm run build
```

预期：无 TypeScript 错误，构建成功。

- [ ] **步骤 7：Commit**

```bash
git add src/App.tsx
git commit -m "feat: add login guard, 401 listener, replace ApiSettingsModal with SettingsModal in App"
```

---

## 任务 8：端对端验证

- [ ] **步骤 1：启动开发服务器**

```bash
npm run dev
```

打开 http://localhost:5173

- [ ] **步骤 2：验证登录页**

- 应显示全屏登录页（深色 TwitCanva 风格）
- 点右上角图标，颜色主题切换正常
- 输入错误账密，显示红色错误提示

- [ ] **步骤 3：验证登录成功**

- 输入正确 openaiteach.com 账密登录
- 应进入主画布
- 刷新页面不需要重新登录（session 持久化）

- [ ] **步骤 4：验证设置弹窗**

- 点顶部齿轮图标，新弹窗出现（三 Tab：账号/Token/模型）
- 账号 Tab：显示用户名、ID，退出按钮正常
- Token Tab → 刷新 → 能看到账号下的 Token
- 模型 Tab → 显示 59 个模型，勾选后节点下拉框同步更新

- [ ] **步骤 5：验证 401 自动退出**

- 打开浏览器开发工具 → Application → Cookies → 删除 openaiteach.com 的 session cookie
- 点刷新令牌按钮 → 应触发 401 → 自动退回登录页

- [ ] **步骤 6：最终构建验证**

```bash
npm run build
```

预期：构建成功，无错误。

- [ ] **步骤 7：最终 Commit**

```bash
git add .
git commit -m "feat: openaiteach auth+token+models integration complete"
```

---

## 依赖说明

- `zustand` — 新增直接依赖，通过 `npm install zustand` 安装（任务 1 步骤 1）
- 不需要安装其他新依赖
- Tailwind CSS 由 CDN 加载，已存在，无需配置
