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
