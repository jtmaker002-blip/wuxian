/**
 * useApiSettings.ts
 *
 * 管理 API 设置的 hook。
 * 负责：
 *  - 从 localStorage 读取已保存的 API Keys 和已启用的模型
 *  - 保存设置到 localStorage
 *  - 提供判断某模型是否启用的方法
 */

import { useState, useCallback, useEffect } from 'react';
import { MODEL_REGISTRY } from '../config/modelRegistry';
import { getRegistryVideoModels } from '../config/registryCanvasModels';

// 自定义事件名，用于通知其他组件设置已变更
export const API_SETTINGS_CHANGED_EVENT = 'twitcanva_api_settings_changed';

// ============================================================================
// 类型
// ============================================================================

/** 每个服务商的 API 配置 */
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string; // 部分服务商支持自定义中转 URL
}

/** 完整的设置对象，存入 localStorage */
export interface ApiSettings {
  /** key: providerId, value: 配置 */
  providers: Record<string, ProviderConfig>;
  /** 已启用的模型 ID 集合 */
  enabledModelIds: string[];
}

const STORAGE_KEY = 'twitcanva_api_settings';

// 默认启用所有模型，用户可在设置弹窗的"模型"tab 取消勾选
const DEFAULT_ENABLED_IDS = MODEL_REGISTRY
  .filter((m) => m.category !== 'video')
  .map((m) => m.id)
  .concat(getRegistryVideoModels().map((m) => m.id));

const DEFAULT_SETTINGS: ApiSettings = {
  providers: {},
  enabledModelIds: DEFAULT_ENABLED_IDS,
};

/** 保存到 localStorage 并通知其他组件 */
const persistSettings = (settings: ApiSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(API_SETTINGS_CHANGED_EVENT));
  } catch {
    console.error('保存 API 设置失败');
  }
};

// ============================================================================
// Hook
// ============================================================================

export const useApiSettings = () => {
  const [settings, setSettings] = useState<ApiSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ApiSettings;
        // 兼容旧版本：如果没有 enabledModelIds 字段，用默认值
        if (!parsed.enabledModelIds) {
          parsed.enabledModelIds = DEFAULT_ENABLED_IDS;
        } else {
          const executableVideoIds = new Set(getRegistryVideoModels().map((m) => m.id));
          parsed.enabledModelIds = parsed.enabledModelIds.filter((id) => {
            const entry = MODEL_REGISTRY.find((model) => model.id === id);
            if (!entry) return false;
            if (entry.category !== 'video') return true;
            return executableVideoIds.has(id);
          });
        }
        return parsed;
      }
    } catch {
      // localStorage 读取失败，用默认值
    }
    return DEFAULT_SETTINGS;
  });

  /** 保存全部设置 */
  const saveSettings = useCallback((newSettings: ApiSettings) => {
    setSettings(newSettings);
    persistSettings(newSettings);
  }, []);

  /** 更新某个服务商的 API Key */
  const updateProviderConfig = useCallback((providerId: string, config: ProviderConfig) => {
    setSettings(prev => {
      const next: ApiSettings = {
        ...prev,
        providers: { ...prev.providers, [providerId]: config },
      };
      persistSettings(next);
      return next;
    });
  }, []);

  /** 切换某个模型的启用状态 */
  const toggleModel = useCallback((modelId: string, enabled: boolean) => {
    setSettings(prev => {
      const ids = new Set(prev.enabledModelIds);
      if (enabled) {
        ids.add(modelId);
      } else {
        ids.delete(modelId);
      }
      const next: ApiSettings = { ...prev, enabledModelIds: Array.from(ids) };
      persistSettings(next);
      return next;
    });
  }, []);

  /** 批量设置某个分类下所有模型的启用状态 */
  const toggleAllInCategory = useCallback((modelIds: string[], enabled: boolean) => {
    setSettings(prev => {
      const ids = new Set(prev.enabledModelIds);
      modelIds.forEach(id => {
        if (enabled) ids.add(id);
        else ids.delete(id);
      });
      const next: ApiSettings = { ...prev, enabledModelIds: Array.from(ids) };
      persistSettings(next);
      return next;
    });
  }, []);

  /** 判断某个模型是否启用 */
  const isModelEnabled = useCallback(
    (modelId: string) => settings.enabledModelIds.includes(modelId),
    [settings.enabledModelIds]
  );

  /** 获取某个服务商的 API Key */
  const getProviderConfig = useCallback(
    (providerId: string): ProviderConfig => {
      if (providerId === 'openaiteach') {
        try {
          const raw = localStorage.getItem('openaiteach-token-config');
          if (raw) {
            const store = JSON.parse(raw) as { state?: { selectedTokenValue?: string } };
            const tokenValue = store?.state?.selectedTokenValue;
            if (tokenValue) {
              return { apiKey: tokenValue, baseUrl: 'https://openaiteach.com/v1' };
            }
          }
        } catch { /* ignore */ }
      }
      return settings.providers[providerId] ?? { apiKey: '', baseUrl: '' };
    },
    [settings.providers]
  );

  /** 获取所有已启用的模型（按类别） */
  const getEnabledModels = useCallback(
    (category?: string) =>
      MODEL_REGISTRY.filter(
        m =>
          settings.enabledModelIds.includes(m.id) &&
          (category ? m.category === category : true)
      ),
    [settings.enabledModelIds]
  );

  return {
    settings,
    saveSettings,
    updateProviderConfig,
    toggleModel,
    toggleAllInCategory,
    isModelEnabled,
    getProviderConfig,
    getEnabledModels,
  };
};

/** 与画布下拉一致：null 表示未存过 enabled 列表，视为「全部启用」 */
export function readEnabledModelIdsFromStorage(): Set<string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ApiSettings>;
      if (parsed.enabledModelIds && Array.isArray(parsed.enabledModelIds)) {
        return new Set(parsed.enabledModelIds);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function useEnabledModelIdsFromStorage(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(() => readEnabledModelIdsFromStorage());
  useEffect(() => {
    const handler = () => setIds(readEnabledModelIdsFromStorage());
    window.addEventListener(API_SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(API_SETTINGS_CHANGED_EVENT, handler);
  }, []);
  return ids;
}
