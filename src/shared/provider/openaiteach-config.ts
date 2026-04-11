import { useSyncExternalStore } from 'react';

export type StoredOpenAiTeachTokenState = {
  state?: {
    selectedTokenValue?: string;
  };
};

export type OpenAiTeachProviderConfig = {
  providerApiKey?: string;
  providerBaseUrl?: string;
};

const OPENAITEACH_TOKEN_STORAGE_KEY = 'openaiteach-token-config';
const OPENAITEACH_PROVIDER_CONFIG_EVENT = 'openaiteach-provider-config-change';
const EMPTY_PROVIDER_CONFIG: OpenAiTeachProviderConfig = {};
let cachedProviderToken = '';
let cachedProviderConfig: OpenAiTeachProviderConfig = EMPTY_PROVIDER_CONFIG;

function getBrowserLikeTarget() {
  if (typeof globalThis === 'undefined') return null;
  const candidate = globalThis;
  if (
    typeof candidate.addEventListener === 'function' &&
    typeof candidate.removeEventListener === 'function'
  ) {
    return candidate;
  }
  return null;
}

function getStorage() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.localStorage ?? null;
}

export function readStoredOpenAiTeachProviderConfig(): OpenAiTeachProviderConfig {
  const storage = getStorage();
  if (!storage) {
    return EMPTY_PROVIDER_CONFIG;
  }

  try {
    const raw = storage.getItem(OPENAITEACH_TOKEN_STORAGE_KEY);
    if (!raw) {
      cachedProviderToken = '';
      cachedProviderConfig = EMPTY_PROVIDER_CONFIG;
      return cachedProviderConfig;
    }
    const parsed = JSON.parse(raw) as StoredOpenAiTeachTokenState;
    const token = parsed?.state?.selectedTokenValue?.trim();
    if (!token) {
      cachedProviderToken = '';
      cachedProviderConfig = EMPTY_PROVIDER_CONFIG;
      return cachedProviderConfig;
    }

    if (token === cachedProviderToken) {
      return cachedProviderConfig;
    }

    cachedProviderToken = token;
    cachedProviderConfig = {
      providerApiKey: token,
      providerBaseUrl: 'https://openaiteach.com/v1',
    };

    return cachedProviderConfig;
  } catch {
    cachedProviderToken = '';
    cachedProviderConfig = EMPTY_PROVIDER_CONFIG;
    return cachedProviderConfig;
  }
}

export function notifyOpenAiTeachProviderConfigChanged() {
  const target = getBrowserLikeTarget();
  if (!target || typeof target.dispatchEvent !== 'function') return;
  target.dispatchEvent(new Event(OPENAITEACH_PROVIDER_CONFIG_EVENT));
}

export function subscribeOpenAiTeachProviderConfig(onStoreChange: () => void) {
  const target = getBrowserLikeTarget();
  if (!target) {
    return () => {};
  }

  const handleChange = () => onStoreChange();
  target.addEventListener('storage', handleChange);
  target.addEventListener(OPENAITEACH_PROVIDER_CONFIG_EVENT, handleChange);

  return () => {
    target.removeEventListener('storage', handleChange);
    target.removeEventListener(OPENAITEACH_PROVIDER_CONFIG_EVENT, handleChange);
  };
}

export function useStoredOpenAiTeachProviderConfig() {
  return useSyncExternalStore(
    subscribeOpenAiTeachProviderConfig,
    readStoredOpenAiTeachProviderConfig,
    () => EMPTY_PROVIDER_CONFIG
  );
}
