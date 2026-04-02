import { resolveAbsoluteBaseUrl } from './resolve-absolute-base-url';

export const OPENAITEACH_401_EVENT = 'openaiteach_401';

export type HttpClientConfig = {
  baseUrl: string;
};

export type HttpGetOptions = {
  /** 为 true 时不派发全局登出（例如 token 列表接口 Cookie 未带上时不应踢出登录页） */
  suppressGlobal401?: boolean;
};

export function createHttpClient(config: HttpClientConfig) {
  const base = resolveAbsoluteBaseUrl(config.baseUrl);

  function dispatch401() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(OPENAITEACH_401_EVENT));
    }
  }

  return {
    async get<T>(
      path: string,
      headers?: Record<string, string>,
      options?: HttpGetOptions
    ): Promise<T> {
      const res = await fetch(new URL(path, base), {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (res.status === 401) {
        if (!options?.suppressGlobal401) dispatch401();
        throw new Error('HTTP 401 Unauthorized');
      }
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
      if (res.status === 401) {
        dispatch401();
        throw new Error('HTTP 401 Unauthorized');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    },
  };
}
