import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiTokenRecord } from '../../../shared/types/token';
import { notifyOpenAiTeachProviderConfigChanged } from '../../../shared/provider/openaiteach-config';

type TokenConfigState = {
  availableTokens: ApiTokenRecord[];
  selectedTokenId: string;
  selectedTokenValue: string;
  draftTokenValue: string;
  tokenValuesById: Record<string, string>;
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
  tokenValuesById: {} as Record<string, string>,
};

type TokenSelectionSnapshot = Pick<
  TokenConfigState,
  'selectedTokenId' | 'selectedTokenValue' | 'draftTokenValue' | 'tokenValuesById'
>;

export function resolveTokenSelection(
  tokens: ApiTokenRecord[],
  snapshot: TokenSelectionSnapshot
) {
  const { selectedTokenId, selectedTokenValue, draftTokenValue, tokenValuesById } = snapshot;
  const matchedById = selectedTokenId
    ? tokens.find((t) => t.id === selectedTokenId)
    : undefined;
  const matched = matchedById ??
    (selectedTokenValue ? tokens.find((t) => t.value === selectedTokenValue) : undefined) ??
    (!selectedTokenValue && !draftTokenValue && tokens.length > 0 ? tokens[0] : undefined);
  const rememberedValue = matched?.id ? tokenValuesById[matched.id] ?? '' : '';
  const resolvedValue = matched?.isUsable ? matched.value : (rememberedValue || selectedTokenValue);
  const resolvedDraft = matched?.isUsable ? matched.value : (rememberedValue || draftTokenValue);

  return {
    availableTokens: tokens,
    selectedTokenId: matched?.id ?? '',
    selectedTokenValue: resolvedValue,
    draftTokenValue: resolvedDraft,
    tokenValuesById,
  };
}

export const useTokenConfigStore = create<TokenConfigState>()(
  persist(
    (set, get) => ({
      ...initial,
      setAvailableTokens: (tokens) => {
        const next = resolveTokenSelection(tokens, get());
        set(next);
        notifyOpenAiTeachProviderConfigChanged();
      },
      setSelectedTokenId: (id) => {
        const state = get();
        const matched = state.availableTokens.find((t) => t.id === id);
        const rememberedValue = id ? state.tokenValuesById[id] ?? '' : '';
        const nextValue = matched?.isUsable ? matched.value : rememberedValue;
        set({
          selectedTokenId: id,
          selectedTokenValue: nextValue,
          draftTokenValue: nextValue,
        });
        notifyOpenAiTeachProviderConfigChanged();
      },
      setDraftTokenValue: (value) => set({ draftTokenValue: value }),
      saveSelectedToken: () => {
        const { availableTokens, selectedTokenId, draftTokenValue, selectedTokenValue, tokenValuesById } = get();
        const matched = availableTokens.find((t) => t.id === selectedTokenId);
        const rememberedValue = matched?.id ? tokenValuesById[matched.id] ?? '' : '';
        set({
          selectedTokenId: matched?.id ?? '',
          draftTokenValue: matched?.isUsable ? matched.value : (rememberedValue || draftTokenValue),
          selectedTokenValue: matched?.isUsable ? matched.value : (rememberedValue || selectedTokenValue),
        });
        notifyOpenAiTeachProviderConfigChanged();
      },
      saveManualToken: () => {
        const { draftTokenValue, selectedTokenId, tokenValuesById } = get();
        const raw = draftTokenValue.trim();
        // 去除重复前缀后保存完整 sk-xxx
        const value = raw.startsWith('sk-') ? raw : raw ? `sk-${raw}` : '';
        set({
          selectedTokenId,
          selectedTokenValue: value,
          tokenValuesById: selectedTokenId
            ? { ...tokenValuesById, [selectedTokenId]: value }
            : tokenValuesById,
        });
        notifyOpenAiTeachProviderConfigChanged();
      },
      reset: () => {
        set(initial);
        notifyOpenAiTeachProviderConfigChanged();
      },
    }),
    { name: 'openaiteach-token-config' }
  )
);
