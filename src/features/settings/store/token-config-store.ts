import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiTokenRecord } from '../../../shared/types/token';

type TokenConfigState = {
  availableTokens: ApiTokenRecord[];
  selectedTokenId: string;
  selectedTokenValue: string;
  draftTokenValue: string;
  setAvailableTokens: (tokens: ApiTokenRecord[]) => void;
  setSelectedTokenId: (id: string) => void;
  setDraftTokenValue: (value: string) => void;
  saveSelectedToken: () => void;
  saveManualToken: () => void;
  reset: () => void;
};

const initial = {
  availableTokens: [] as ApiTokenRecord[],
  selectedTokenId: '',
  selectedTokenValue: '',
  draftTokenValue: '',
};

export const useTokenConfigStore = create<TokenConfigState>()(
  persist(
    (set, get) => ({
      ...initial,
      setAvailableTokens: (tokens) => {
        const { selectedTokenId, draftTokenValue, selectedTokenValue } = get();
        const matched = tokens.find((t) => t.id === selectedTokenId);
        set({
          availableTokens: tokens,
          draftTokenValue: matched?.value ?? draftTokenValue,
          selectedTokenValue: matched?.value ?? selectedTokenValue,
        });
      },
      setSelectedTokenId: (id) => {
        const matched = get().availableTokens.find((t) => t.id === id);
        set({ selectedTokenId: id, draftTokenValue: matched?.value ?? '' });
      },
      setDraftTokenValue: (value) => set({ draftTokenValue: value }),
      saveSelectedToken: () => {
        const { availableTokens, selectedTokenId, draftTokenValue, selectedTokenValue } = get();
        const matched = availableTokens.find((t) => t.id === selectedTokenId);
        set({
          draftTokenValue: matched?.value ?? draftTokenValue,
          selectedTokenValue: matched?.value ?? selectedTokenValue,
        });
      },
      saveManualToken: () => {
        const raw = get().draftTokenValue.trim();
        // 去除重复前缀后保存完整 sk-xxx
        const value = raw.startsWith('sk-') ? raw : raw ? `sk-${raw}` : '';
        set({ selectedTokenId: '', selectedTokenValue: value });
      },
      reset: () => set(initial),
    }),
    { name: 'openaiteach-token-config' }
  )
);
