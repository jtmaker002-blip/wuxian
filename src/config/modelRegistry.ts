/**
 * modelRegistry.ts
 *
 * 2026 年 3 月最新 AI 模型注册表
 * 对齐帧境AI (framerealm-canvas) 模型列表
 * 类别：Video / LLM / Voice / Image
 * 地区：global(国际) / china(国产)
 */

export type ModelCategory = 'video' | 'llm' | 'voice' | 'image';
export type ModelRegion = 'global' | 'china';

export interface ModelProvider {
  id: string;
  name: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  apiKeyLink?: string;
  baseUrlLabel?: string;
  baseUrlDefault?: string;
}

export interface ModelEntry {
  id: string;
  name: string;
  description?: string;
  category: ModelCategory;
  region: ModelRegion;
  providerId: string;
  tags?: string[];
  isDefault?: boolean;
}

// ============================================================================
// 服务商
// ============================================================================

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'openaiteach',
    name: 'OpenAiTeach',
    apiKeyLabel: 'API Token',
    apiKeyPlaceholder: 'sk-...',
    apiKeyLink: 'https://openaiteach.com/console/token',
    baseUrlDefault: 'https://openaiteach.com/v1',
  },
];

// ============================================================================
// 模型列表
// ============================================================================

export const MODEL_REGISTRY: ModelEntry[] = [
  // ── LLM ────────────────────────────────────────────────────────────────
  { id: 'claude-opus-4-6',                   name: 'Claude Opus 4.6',               category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'claude-opus-4-6-thinking',           name: 'Claude Opus 4.6 Thinking',      category: 'llm',   region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'claude-opus-4-5-20251101',           name: 'Claude Opus 4.5',               category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'claude-opus-4-5-20251101-thinking',  name: 'Claude Opus 4.5 Thinking',      category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3.1-pro-preview',             name: 'Gemini 3.1 Pro Preview',        category: 'llm',   region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gemini-3-pro-preview',               name: 'Gemini 3 Pro Preview',          category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3-pro-preview-thinking',      name: 'Gemini 3 Pro Preview Thinking', category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3-flash-preview',             name: 'Gemini 3 Flash Preview',        category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gemini-3.1-flash-lite-preview',      name: 'Gemini 3.1 Flash Lite',         category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-5.4',                            name: 'GPT 5.4',                       category: 'llm',   region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gpt-5.2',                            name: 'GPT 5.2',                       category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-5.2-chat',                       name: 'GPT 5.2 Chat',                  category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-4o',                             name: 'GPT-4o',                        category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'gpt-4o-mini',                        name: 'GPT-4o Mini',                   category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'deepseek-v3.2',                      name: 'DeepSeek V3.2',                 category: 'llm',   region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'deepseek-v3.2-thinking',             name: 'DeepSeek V3.2 Thinking',        category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seed-1-8-251228',             name: '豆包 Seed 1.8',                 category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seed-1-8-251228-thinking',    name: '豆包 Seed 1.8 Thinking',        category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'kimi-k2.5',                          name: 'Kimi K2.5',                     category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'glm-4.7',                            name: 'GLM 4.7',                       category: 'llm',   region: 'china',  providerId: 'openaiteach' },
  { id: 'grok-4.2',                           name: 'Grok 4.2',                      category: 'llm',   region: 'global', providerId: 'openaiteach' },
  { id: 'mimo-v2-flash',                      name: 'MiMo V2 Flash',                 category: 'llm',   region: 'global', providerId: 'openaiteach' },
  // ── Image ───────────────────────────────────────────────────────────────
  { id: 'gemini-2.5-flash-image-preview',     name: 'Nano Banana 1',                 category: 'image', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gemini-3.1-flash-image-preview',     name: 'Nano Banana 2',                 category: 'image', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gemini-3-pro-image-preview',         name: 'Nano Banana Pro',               category: 'image', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'gpt-image-1.5-all',                  name: 'GPT Image 1.5',                 category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-4.2-image',                     name: 'Grok 4.2 Image',                category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-4.1-image',                     name: 'Grok 4.1 Image',                category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-4-image',                       name: 'Grok 4 Image',                  category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-3-image',                       name: 'Grok 3 Image',                  category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'midjourney-v6',                      name: 'Midjourney',                    category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'midjourney-v6-raw',                  name: 'Midjourney V6.1 (Raw)',          category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'midjourney-niji-v6',                 name: 'Niji Journey',                  category: 'image', region: 'global', providerId: 'openaiteach' },
  { id: 'doubao-seedream-5-0-260128',         name: 'Doubao Seedream 5.0',           category: 'image', region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'doubao-seedream-4-5-251128',         name: 'Doubao Seedream 4.5',           category: 'image', region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seedream-4-0-250828',         name: 'Doubao Seedream 4.0',           category: 'image', region: 'china',  providerId: 'openaiteach' },
  { id: 'doubao-seedream-3-0-t2i-250415',     name: 'Doubao Seedream 3.0',           category: 'image', region: 'china',  providerId: 'openaiteach' },
  { id: 'qwen-image-edit-2509',               name: 'Qwen Image Edit',               category: 'image', region: 'china',  providerId: 'openaiteach' },
  // ── Video ───────────────────────────────────────────────────────────────
  { id: 'sora-2',                             name: 'Sora 2',                        category: 'video', region: 'global', providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'veo3.1',                             name: 'Veo 3.1',                       category: 'video', region: 'global', providerId: 'openaiteach' },
  { id: 'grok-video-3',                       name: 'Grok Video 3',                  category: 'video', region: 'global', providerId: 'openaiteach' },
  { id: 'kling-v3',                           name: 'Kling V3',                      category: 'video', region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'kling-v2-6',                         name: 'Kling V2.6',                    category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'kling-v2-5-turbo',                   name: 'Kling V2.5 Turbo',              category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'minimax-hailuo',                     name: 'MiniMax Hailuo',                category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'wan2.6-i2v',                         name: 'Wan 2.6 I2V',                   category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'wan2.6-i2v-flash',                   name: 'Wan 2.6 I2V Flash',             category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-seedance-2',                  name: 'Seedance 2.0',                  category: 'video', region: 'china',  providerId: 'openaiteach', tags: ['HOT'] },
  { id: 'jimeng-4.5',                         name: '即梦 4.5',                      category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-4.1',                         name: '即梦 4.1',                      category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-4.0',                         name: '即梦 4.0',                      category: 'video', region: 'china',  providerId: 'openaiteach' },
  { id: 'jimeng-video-3-fast',                name: '即梦视频 3.0 Fast',             category: 'video', region: 'china',  providerId: 'openaiteach' },
  // ── Voice ───────────────────────────────────────────────────────────────
  { id: 'cosyvoice-v3-flash',                 name: 'CosyVoice V3 Flash',            category: 'voice', region: 'china',  providerId: 'openaiteach' },
  { id: 'cosyvoice-v3-plus',                  name: 'CosyVoice V3 Plus',             category: 'voice', region: 'china',  providerId: 'openaiteach' },
  { id: 'qwen3-tts-flash',                    name: 'Qwen TTS Flash',                category: 'voice', region: 'china',  providerId: 'openaiteach' },
  { id: 'qwen-voice-design',                  name: 'Qwen Voice Design',             category: 'voice', region: 'china',  providerId: 'openaiteach' },
];

// ============================================================================
// 辅助函数
// ============================================================================

export const getModelsByCategory = (category: ModelCategory) =>
  MODEL_REGISTRY.filter(m => m.category === category);

export const getModelsByProvider = (providerId: string) =>
  MODEL_REGISTRY.filter(m => m.providerId === providerId);

export const getProvidersByCategory = (category: ModelCategory) => {
  const ids = new Set(MODEL_REGISTRY.filter(m => m.category === category).map(m => m.providerId));
  return MODEL_PROVIDERS.filter(p => ids.has(p.id));
};

export const getProvider = (providerId: string) =>
  MODEL_PROVIDERS.find(p => p.id === providerId);
