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
