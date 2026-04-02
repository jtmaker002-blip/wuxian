import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../../auth/store/session-store';
import { useTokenConfigStore } from '../store/token-config-store';
import { createTokenClient } from '../api/token-client';
import { MODEL_REGISTRY, type ModelCategory } from '../../../config/modelRegistry';
import { getRegistryVideoModels } from '../../../config/registryCanvasModels';

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
  const hasAutoRefreshedTokenTab = useRef(false);
  const selectedAccountToken = availableTokens.find((t) => t.id === selectedTokenId);
  const selectedAccountTokenNeedsManualCopy = Boolean(selectedAccountToken) && !selectedAccountToken.isUsable;

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
  const visibleVideoIds = new Set(getRegistryVideoModels().map((model) => model.id));
  const visibleModels = MODEL_REGISTRY.filter((model) => model.category !== 'video' || visibleVideoIds.has(model.id));
  const visibleEnabledCount = visibleModels.filter((model) => isModelEnabled(model.id)).length;

  async function handleRefreshTokens() {
    if (!session) return;
    setIsRefreshing(true);
    setMessage('');
    try {
      const tokens = await tokenClient.listTokens({
        userId: session.userId,
        systemToken: session.sessionToken,
        oatProxySid: session.oatProxySid,
      });
      setAvailableTokens(tokens);
      setMessage(
        tokens.length > 0
          ? `已同步 ${tokens.length} 个令牌`
          : session.oatProxySid
            ? '已请求账号令牌列表，但当前返回 0 个 token。请确认当前登录账号就是你在官网看到令牌的那个账号。'
            : '请先点「退出」再登录一次（登录会经本机后端连接 openaiteach.com，刷新令牌才有效）。'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '刷新失败';
      setMessage(
        msg.includes('401')
          ? '未登录或 Cookie 未带上：请退出后重新登录，再点刷新；仍不行请用手动输入 sk-xxx 保存。'
          : msg
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      hasAutoRefreshedTokenTab.current = false;
      return;
    }

    if (tab !== 'token') {
      hasAutoRefreshedTokenTab.current = false;
      return;
    }

    if (!session || isRefreshing || availableTokens.length > 0 || hasAutoRefreshedTokenTab.current) {
      return;
    }

    hasAutoRefreshedTokenTab.current = true;
    void handleRefreshTokens();
  }, [isOpen, tab, session, isRefreshing, availableTokens.length]);

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
                    {isRefreshing ? '刷新中' : '刷新'}
                  </button>
                  <button
                    onClick={saveSelectedToken}
                    disabled={!selectedAccountToken || selectedAccountTokenNeedsManualCopy}
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
                    {selectedAccountToken?.name ??
                      (selectedTokenValue ? '手动 Token' : '未设置')}
                  </span>
                </div>
                {selectedAccountTokenNeedsManualCopy && (
                  <div className="text-amber-400">
                    当前账号列表只返回了掩码令牌，无法直接测试。请去官网复制完整 <span className={textP}>sk-...</span> 到下方手动输入后保存。
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting || selectedAccountTokenNeedsManualCopy}
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
                <span>已选 {visibleEnabledCount} / 共 {visibleModels.length} 个</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleAllModels(visibleModels.map((m) => m.id), true)}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    全选
                  </button>
                  <span>|</span>
                  <button
                    onClick={() => onToggleAllModels(visibleModels.map((m) => m.id), false)}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    全不选
                  </button>
                </div>
              </div>

              {ALL_CATEGORIES.map((cat) => {
                const models = visibleModels.filter((m) => m.category === cat);
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
