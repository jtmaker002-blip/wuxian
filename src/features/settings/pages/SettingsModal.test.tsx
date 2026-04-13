// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';

const { verifyTokenMock, listTokensMock, mockSession } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
  listTokensMock: vi.fn(),
  mockSession: {
    userId: 'user-1',
    username: '测试用户',
    sessionToken: 'cookie-session:test',
    oatProxySid: '',
  },
}));

let mockTokenStoreState: Record<string, unknown>;
let useStateCallIndex = 0;
let mockState = {
  tab: 'token' as 'token' | 'models' | 'account',
  isRefreshing: false,
  isTesting: false,
  message: '',
};
const mockRef = { current: false };

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: ((initial: unknown) => {
      const values = [mockState.tab, mockState.isRefreshing, mockState.isTesting, mockState.message] as const;
      const value = values[useStateCallIndex++] ?? initial;
      return [value, vi.fn()] as [unknown, Dispatch<SetStateAction<unknown>>];
    }) as typeof actual.useState,
    useRef: (() => mockRef) as typeof actual.useRef,
    useEffect: ((effect: () => void) => effect()) as typeof actual.useEffect,
  };
});

vi.mock('../../auth/store/session-store', () => ({
  useSessionStore: (selector?: (state: { session: typeof mockSession }) => unknown) =>
    selector ? selector({ session: mockSession }) : { session: mockSession },
}));

vi.mock('../store/token-config-store', () => ({
  useTokenConfigStore: () => mockTokenStoreState,
}));

vi.mock('../api/token-client', () => ({
  createTokenClient: () => ({
    verifyToken: verifyTokenMock,
    listTokens: listTokensMock,
  }),
}));

import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsModal } from './SettingsModal';

describe('SettingsModal 掩码 token 回归', () => {
  beforeEach(() => {
    verifyTokenMock.mockReset();
    listTokensMock.mockReset();
    useStateCallIndex = 0;
    mockRef.current = false;
    mockTokenStoreState = {
      availableTokens: [
        {
          id: 'masked-1',
          name: '掩码令牌',
          value: '',
          isUsable: false,
        },
      ],
      selectedTokenId: 'masked-1',
      selectedTokenValue: '',
      draftTokenValue: '',
      setAvailableTokens: vi.fn(),
      setSelectedTokenId: vi.fn(),
      setDraftTokenValue: vi.fn(),
      saveSelectedToken: vi.fn(),
      saveManualToken: vi.fn(),
    };
  });

  function renderSettingsModal() {
    useStateCallIndex = 0;
    return renderToStaticMarkup(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        canvasTheme="dark"
        onLogout={vi.fn()}
        isModelEnabled={vi.fn(() => true)}
        onToggleModel={vi.fn()}
        onToggleAllModels={vi.fn()}
      />
    );
  }

  it('会把掩码账号 token 的测试和保存都禁用掉', () => {
    mockState = {
      tab: 'token',
      isRefreshing: false,
      isTesting: false,
      message: '',
    };
    const markup = renderSettingsModal();

    expect(markup).toContain('当前账号列表只返回了掩码令牌，无法直接测试');
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>\s*保存\s*<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>\s*测试连接\s*<\/button>/);
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(listTokensMock).not.toHaveBeenCalled();
  });

  it('切到 Token tab 时只会自动刷新一次，不会重复触发刷新死循环', async () => {
    mockTokenStoreState = {
      availableTokens: [],
      selectedTokenId: '',
      selectedTokenValue: '',
      draftTokenValue: '',
      setAvailableTokens: vi.fn(),
      setSelectedTokenId: vi.fn(),
      setDraftTokenValue: vi.fn(),
      saveSelectedToken: vi.fn(),
      saveManualToken: vi.fn(),
    };
    listTokensMock.mockResolvedValue([]);

    mockState = {
      tab: 'account',
      isRefreshing: false,
      isTesting: false,
      message: '',
    };
    renderSettingsModal();

    mockState = {
      tab: 'token',
      isRefreshing: false,
      isTesting: false,
      message: '',
    };
    renderSettingsModal();

    mockState = {
      tab: 'token',
      isRefreshing: false,
      isTesting: false,
      message: '',
    };
    renderSettingsModal();

    expect(listTokensMock).toHaveBeenCalledTimes(1);
  });
});
