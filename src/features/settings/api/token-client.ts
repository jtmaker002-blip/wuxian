import { createHttpClient } from '../../../shared/api/http';
import { env } from '../../../shared/config/env';
import type { ApiTokenRecord } from '../../../shared/types/token';

type FetchSession = {
  userId?: string;
  oatProxySid?: string;
  /** cookie-session / Bearer / oat-proxy 占位 */
  systemToken: string;
};

const TOKEN_ID_KEYS = ['id', 'token_id', 'key_id', 'uuid'] as const;
const TOKEN_NAME_KEYS = [
  'name',
  'title',
  'label',
  'remark',
  'token_name',
  'key_name',
  'display_name',
  'description',
  'memo',
  'comment',
] as const;
const TOKEN_VALUE_KEYS = [
  'key',
  'token',
  'value',
  'api_key',
  'apiKey',
  'secret',
  'sk',
  'raw_key',
  'token_value',
] as const;

function readFirstString(row: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

export function normalizeTokenValue(raw: unknown): string {
  const value = String(raw ?? '').trim().replace(/^Bearer\s+/i, '');
  if (!value) return '';
  return value.startsWith('sk-') ? value : `sk-${value}`;
}

function isUsableTokenValue(raw: unknown): boolean {
  const value = String(raw ?? '').trim();
  return Boolean(value) && !value.includes('*');
}

function maskTokenForLabel(value: string): string {
  if (!value) return '';
  if (value.length <= 14) return value;
  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}

function looksLikeMeaningfulName(name: string): boolean {
  return Boolean(name);
}

function buildAuthHeaders(session: FetchSession): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = session.systemToken?.trim() ?? '';
  if (!raw || raw.startsWith('cookie-session:') || raw.startsWith('oat-proxy:')) {
    return headers;
  }
  const token = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : raw;
  headers['Authorization'] = `Bearer ${normalizeTokenValue(token)}`;
  return headers;
}

function assertPayloadOk(payload: unknown): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  const top = payload as Record<string, unknown>;

  if (top['success'] === false) {
    throw new Error(String(top['message'] ?? top['msg'] ?? '拉取令牌列表失败'));
  }

  const code = top['code'];
  if (code === 401 || code === '401' || code === 403 || code === '403') {
    throw new Error(String(top['message'] ?? top['msg'] ?? '登录已失效，请退出后重新登录再刷新'));
  }
  if (typeof code === 'number' && code !== 0 && code !== 200) {
    throw new Error(String(top['message'] ?? top['msg'] ?? `接口错误 (${code})`));
  }
}

function pickArrayFromObject(obj: Record<string, unknown>): unknown[] | null {
  for (const key of ['items', 'list', 'records', 'rows', 'tokens', 'keys', 'content', 'data']) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

function looksLikeTokenRow(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return [...TOKEN_ID_KEYS, ...TOKEN_NAME_KEYS, ...TOKEN_VALUE_KEYS].some((k) => row[k] != null);
}

function findTokenRowsDeep(payload: unknown, depth = 0): unknown[] | null {
  if (depth > 6 || payload == null) return null;

  if (Array.isArray(payload)) {
    if (payload.some(looksLikeTokenRow)) return payload;
    for (const item of payload) {
      const nested = findTokenRowsDeep(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  if (typeof payload !== 'object') return null;

  const obj = payload as Record<string, unknown>;
  if (looksLikeTokenRow(obj)) {
    return [obj];
  }
  const direct = pickArrayFromObject(obj);
  if (direct) {
    return direct.some(looksLikeTokenRow) ? direct : findTokenRowsDeep(direct, depth + 1);
  }

  for (const value of Object.values(obj)) {
    const nested = findTokenRowsDeep(value, depth + 1);
    if (nested) return nested;
  }

  return null;
}

export function parseTokenItems(payload: unknown): ApiTokenRecord[] {
  assertPayloadOk(payload);

  if (Array.isArray(payload)) {
    return normalizeTokenRows(payload);
  }

  if (!payload || typeof payload !== 'object') return [];

  const rows = findTokenRowsDeep(payload);
  if (!rows) return [];

  return normalizeTokenRows(rows);
}

function normalizeTokenRows(items: unknown[]): ApiTokenRecord[] {
  return items
    .map((item, idx) => {
      if (!item || typeof item !== 'object') {
        return { id: `row-${idx}`, name: `Token ${idx + 1}`, value: '' };
      }
      const r = item as Record<string, unknown>;
      const id = readFirstString(r, TOKEN_ID_KEYS) || `row-${idx}`;
      const rawValue = readFirstString(r, TOKEN_VALUE_KEYS);
      const value = isUsableTokenValue(rawValue) ? normalizeTokenValue(rawValue) : '';
      const rawName = readFirstString(r, TOKEN_NAME_KEYS);
      const name = looksLikeMeaningfulName(rawName)
        ? rawName
        : rawValue
          ? maskTokenForLabel(normalizeTokenValue(rawValue))
          : `Token ${idx + 1}`;
      return { id, name, value, isUsable: Boolean(value) };
    })
    .filter((t) => t.name.length > 0 || t.value.length > 0);
}

export function createTokenClient(options: { baseUrl?: string } = {}) {
  const http = createHttpClient({ baseUrl: options.baseUrl ?? env.apiBaseUrl });

  return {
    async listTokens(session: FetchSession): Promise<ApiTokenRecord[]> {
      if (session.oatProxySid) {
        const r = await fetch(
          `/api/openaiteach/tokens?sid=${encodeURIComponent(session.oatProxySid)}&p=0&size=100`
        );
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            String((payload as Record<string, unknown>)['message'] ?? `HTTP ${r.status}`)
          );
        }
        return parseTokenItems(payload);
      }

      const headers = buildAuthHeaders(session);
      const candidates = [
        'token/?p=0&size=100',
        'token?p=0&size=100',
        'user/token/?p=0&size=100',
      ];

      let last404: Error | null = null;
      for (const path of candidates) {
        try {
          const payload = await http.get<unknown>(path, headers, { suppressGlobal401: true });
          return parseTokenItems(payload);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          if (err.message.includes('404')) {
            last404 = err;
            continue;
          }
          throw err;
        }
      }
      throw last404 ?? new Error('未找到令牌列表接口');
    },

    async verifyToken(session: FetchSession): Promise<boolean> {
      const headers = buildAuthHeaders(session);
      if (!headers['Authorization']) {
        throw new Error('请先选择或输入有效的 sk- Token');
      }

      const response = await fetch(`${env.aiBaseUrl}/models`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        throw new Error('Token 无效或已失效（HTTP 401）');
      }
      if (response.status === 403) {
        throw new Error('Token 无权限访问模型列表（HTTP 403）');
      }
      if (!response.ok) {
        throw new Error(`连接测试失败（HTTP ${response.status}）`);
      }

      return true;
    },
  };
}
