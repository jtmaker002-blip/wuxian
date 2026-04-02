import type { LoginInput, SessionPayload } from '../../../shared/types/auth';

/**
 * 登录走本机后端 /api/openaiteach/login，由服务端保存上游 Cookie，避免浏览器在 localhost 下带不上会话。
 */
export function createAuthClient() {
  return {
    async login(input: LoginInput): Promise<SessionPayload> {
      if (!input.account.trim() || !input.password.trim()) {
        throw new Error('账号和密码不能为空');
      }

      const response = await fetch('/api/openaiteach/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: input.account.trim(),
          password: input.password.trim(),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (response.status === 404) {
        throw new Error(
          '登录接口 404：本机后端未就绪或未走代理。请先在同一台电脑运行「npm run server」或「npm run dev」（会启动 3001 端口），再刷新页面重试；不要只单独运行 vite 且不启动 server。'
        );
      }

      if (!response.ok) {
        throw new Error(String(body.message ?? `登录失败 (${response.status})`));
      }

      const sid = String(body.oatProxySid ?? '');
      if (!sid) {
        throw new Error('登录响应异常，请确认本机后端已启动（端口 3001）并已更新到最新代码');
      }

      return {
        ok: true,
        sessionToken: `oat-proxy:${sid}`,
        oatProxySid: sid,
        userId: body.userId != null ? String(body.userId) : undefined,
        username: body.username != null ? String(body.username) : undefined,
      };
    },
  };
}
