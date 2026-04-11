import { describe, expect, it } from 'vitest';
import { resolveTokenSelection, useTokenConfigStore } from './token-config-store';
import type { ApiTokenRecord } from '../../../shared/types/token';

const TOKENS: ApiTokenRecord[] = [
  { id: 'token-1', name: '默认令牌', value: 'sk-default-1', isUsable: true },
  { id: 'token-2', name: '备用令牌', value: 'sk-backup-2', isUsable: true },
];

describe('resolveTokenSelection', () => {
  it('keeps selected token by id after refreshing the list', () => {
    const next = resolveTokenSelection(TOKENS, {
      selectedTokenId: 'token-2',
      selectedTokenValue: '',
      draftTokenValue: '',
      tokenValuesById: {},
    });

    expect(next.selectedTokenId).toBe('token-2');
    expect(next.selectedTokenValue).toBe('sk-backup-2');
    expect(next.draftTokenValue).toBe('sk-backup-2');
  });

  it('backfills selectedTokenId from a previously saved token value', () => {
    const next = resolveTokenSelection(TOKENS, {
      selectedTokenId: '',
      selectedTokenValue: 'sk-default-1',
      draftTokenValue: '',
      tokenValuesById: {},
    });

    expect(next.selectedTokenId).toBe('token-1');
    expect(next.selectedTokenValue).toBe('sk-default-1');
    expect(next.draftTokenValue).toBe('sk-default-1');
  });

  it('preserves manual token value when the refreshed list has no match', () => {
    const next = resolveTokenSelection(TOKENS, {
      selectedTokenId: '',
      selectedTokenValue: 'sk-manual-custom',
      draftTokenValue: 'sk-manual-custom',
      tokenValuesById: {},
    });

    expect(next.selectedTokenId).toBe('');
    expect(next.selectedTokenValue).toBe('sk-manual-custom');
    expect(next.draftTokenValue).toBe('sk-manual-custom');
  });

  it('defaults to the first account token when no selection has been saved yet', () => {
    const next = resolveTokenSelection(TOKENS, {
      selectedTokenId: '',
      selectedTokenValue: '',
      draftTokenValue: '',
      tokenValuesById: {},
    });

    expect(next.selectedTokenId).toBe('token-1');
    expect(next.selectedTokenValue).toBe('sk-default-1');
    expect(next.draftTokenValue).toBe('sk-default-1');
  });

  it('does not overwrite the saved value with a masked token row', () => {
    const next = resolveTokenSelection(
      [{ id: 'token-1', name: '默认令牌', value: '', isUsable: false }],
      {
        selectedTokenId: '',
        selectedTokenValue: '',
        draftTokenValue: '',
        tokenValuesById: {},
      }
    );

    expect(next.selectedTokenId).toBe('token-1');
    expect(next.selectedTokenValue).toBe('');
    expect(next.draftTokenValue).toBe('');
  });

  it('keeps a masked account token unusable even when it is already selected', () => {
    const next = resolveTokenSelection(
      [{ id: 'masked-1', name: '掩码令牌', value: '', isUsable: false }],
      {
        selectedTokenId: 'masked-1',
        selectedTokenValue: '',
        draftTokenValue: '',
        tokenValuesById: {},
      }
    );

    expect(next.selectedTokenId).toBe('masked-1');
    expect(next.selectedTokenValue).toBe('');
    expect(next.draftTokenValue).toBe('');
  });

  it('reuses a manually remembered token value for a masked account token after selecting it again', () => {
    const next = resolveTokenSelection(
      [{ id: 'masked-1', name: '1', value: '', isUsable: false }],
      {
        selectedTokenId: 'masked-1',
        selectedTokenValue: '',
        draftTokenValue: '',
        tokenValuesById: { 'masked-1': 'sk-manual-bound-token' },
      }
    );

    expect(next.selectedTokenId).toBe('masked-1');
    expect(next.selectedTokenValue).toBe('sk-manual-bound-token');
    expect(next.draftTokenValue).toBe('sk-manual-bound-token');
  });
});

describe('useTokenConfigStore', () => {
  it('switches the effective selected token when choosing a remembered masked token entry', () => {
    useTokenConfigStore.setState({
      availableTokens: [{ id: 'masked-1', name: '1', value: '', isUsable: false }],
      selectedTokenId: '',
      selectedTokenValue: '',
      draftTokenValue: '',
      tokenValuesById: { 'masked-1': 'sk-manual-bound-token' },
    });

    useTokenConfigStore.getState().setSelectedTokenId('masked-1');

    expect(useTokenConfigStore.getState().selectedTokenId).toBe('masked-1');
    expect(useTokenConfigStore.getState().selectedTokenValue).toBe('sk-manual-bound-token');
    expect(useTokenConfigStore.getState().draftTokenValue).toBe('sk-manual-bound-token');
  });
});
