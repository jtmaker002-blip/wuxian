import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notifyOpenAiTeachProviderConfigChanged,
  readStoredOpenAiTeachProviderConfig,
  subscribeOpenAiTeachProviderConfig,
} from './openaiteach-config';

describe('readStoredOpenAiTeachProviderConfig', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalAddEventListener = globalThis.addEventListener;
  const originalRemoveEventListener = globalThis.removeEventListener;
  const originalDispatchEvent = globalThis.dispatchEvent;
  const listeners = new Map<string, Set<(event?: Event) => void>>();

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
      },
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: (type: string, callback: (event?: Event) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(callback);
      },
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      value: (type: string, callback: (event?: Event) => void) => {
        listeners.get(type)?.delete(callback);
      },
    });
    Object.defineProperty(globalThis, 'dispatchEvent', {
      configurable: true,
      value: (event: Event) => {
        listeners.get(event.type)?.forEach((callback) => callback(event));
        return true;
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: originalAddEventListener,
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      value: originalRemoveEventListener,
    });
    Object.defineProperty(globalThis, 'dispatchEvent', {
      configurable: true,
      value: originalDispatchEvent,
    });
    listeners.clear();
  });

  it('returns empty config when no token is stored', () => {
    expect(readStoredOpenAiTeachProviderConfig()).toEqual({});
  });

  it('returns provider token config when a selected token value exists', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => JSON.stringify({
          state: {
            selectedTokenValue: 'sk-bound-token',
          },
        })),
      },
    });

    expect(readStoredOpenAiTeachProviderConfig()).toEqual({
      providerApiKey: 'sk-bound-token',
      providerBaseUrl: 'https://openaiteach.com/v1',
    });
  });

  it('notifies same-window subscribers when token config changes', () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeOpenAiTeachProviderConfig(onStoreChange);

    notifyOpenAiTeachProviderConfigChanged();

    expect(onStoreChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
