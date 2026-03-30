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
