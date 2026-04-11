import path from 'path';
import type { IncomingMessage } from 'http';
import type { Server } from 'http-proxy';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 开发代理：把上游 openaiteach.com 的 Set-Cookie 改成浏览器在 http://localhost:5173 能存、且会随 /oat-api/* 请求带上。
 * 仅 cookieDomainRewrite 往往不够：Path=/api 与真实路径 /oat-api/... 不一致；Secure + SameSite=None 在 http 下常被丢弃。
 */
function rewriteOpenaiteachSetCookieHeaders(proxyRes: IncomingMessage, devPrefix: '/oat-api' | '/oat-v1') {
  const raw = proxyRes.headers['set-cookie'];
  if (!raw) return;
  const list = Array.isArray(raw) ? raw : [raw];
  proxyRes.headers['set-cookie'] = list.map((cookie) => {
    let c = cookie;
    c = c.replace(/;\s*Domain=[^;]*/gi, '');
    c = c.replace(/;\s*Secure/gi, '');
    c = c.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
    c = c.replace(/;\s*SameSite=Strict/gi, '; SameSite=Lax');
    c = c.replace(/;\s*Path=\/api\/?/gi, `; Path=${devPrefix}`);
    if (!/;\s*Path=/i.test(c)) {
      c = `${c}; Path=${devPrefix}`;
    }
    return c.replace(/;;+/g, ';').replace(/^;\s*/, '').trim();
  });
}

function attachOatCookieRewrite(proxy: Server, devPrefix: '/oat-api' | '/oat-v1') {
  proxy.on('proxyRes', (proxyRes) => {
    rewriteOpenaiteachSetCookieHeaders(proxyRes, devPrefix);
  });
}

const LOCAL_BACKEND = 'http://localhost:3001';

/** dev 与 vite preview 共用，否则 preview 下 /api 会 404 */
const sharedProxy = {
  '/oat-api': {
    target: 'https://openaiteach.com',
    changeOrigin: true,
    secure: true,
    rewrite: (p: string) => p.replace(/^\/oat-api/, '/api'),
    cookieDomainRewrite: 'localhost',
    configure(proxy: Server) {
      attachOatCookieRewrite(proxy, '/oat-api');
    },
  },
  '/oat-v1': {
    target: 'https://openaiteach.com',
    changeOrigin: true,
    secure: true,
    rewrite: (p: string) => p.replace(/^\/oat-v1/, '/v1'),
    cookieDomainRewrite: 'localhost',
    configure(proxy: Server) {
      attachOatCookieRewrite(proxy, '/oat-v1');
    },
  },
  '/api': {
    target: LOCAL_BACKEND,
    changeOrigin: true,
  },
  '/library': {
    target: LOCAL_BACKEND,
    changeOrigin: true,
  },
};

export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: sharedProxy,
  },
  preview: {
    host: '0.0.0.0',
    proxy: sharedProxy,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
    ],
  },
});
