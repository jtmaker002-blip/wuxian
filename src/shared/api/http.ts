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
