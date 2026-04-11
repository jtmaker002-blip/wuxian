import { describe, expect, it } from 'vitest';
import { normalizeTokenValue, parseTokenItems } from './token-client';

describe('normalizeTokenValue', () => {
  it('adds sk prefix when upstream omits it', () => {
    expect(normalizeTokenValue('abc123')).toBe('sk-abc123');
  });

  it('keeps an existing sk prefix intact', () => {
    expect(normalizeTokenValue('sk-abc123')).toBe('sk-abc123');
  });

  it('strips bearer prefix before normalizing', () => {
    expect(normalizeTokenValue('Bearer abc123')).toBe('sk-abc123');
  });
});

describe('parseTokenItems', () => {
  it('finds token rows even when an array is wrapped inside nested objects', () => {
    const tokens = parseTokenItems({
      success: true,
      data: {
        items: [
          {
            record: {
              token_id: 12,
              token_name: '默认令牌',
              secret: 'abc123456789',
            },
          },
        ],
      },
    });

    expect(tokens).toEqual([
      {
        id: '12',
        name: '默认令牌',
        value: 'sk-abc123456789',
        isUsable: true,
      },
    ]);
  });

  it('keeps the upstream token name when it is numeric but the token is directly usable', () => {
    const tokens = parseTokenItems([
      {
        id: 54656546,
        name: '54656546',
        secret: 'abc1234567890xyz',
      },
    ]);

    expect(tokens[0]).toEqual({
      id: '54656546',
      name: '54656546',
      value: 'sk-abc1234567890xyz',
      isUsable: true,
    });
  });

  it('keeps the upstream numeric name when the upstream only returns an unusable masked token', () => {
    const tokens = parseTokenItems([
      {
        id: 'masked-1',
        name: '1',
        secret: 'aUnd******tiWU',
      },
    ]);

    expect(tokens[0]).toEqual({
      id: 'masked-1',
      name: '1',
      value: '',
      isUsable: false,
    });
  });
});
