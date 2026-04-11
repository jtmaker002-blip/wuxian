import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateOpenAITextMock = vi.fn();

vi.mock('../services/openai.js', () => ({
  generateOpenAIText: (...args) => generateOpenAITextMock(...args),
}));

describe('chatAgent hosted text routing', () => {
  beforeEach(() => {
    vi.resetModules();
    generateOpenAITextMock.mockReset();
  });

  it('uses hosted token text generation when providerBaseUrl is supplied', async () => {
    generateOpenAITextMock
      .mockResolvedValueOnce('assistant reply')
      .mockResolvedValueOnce('Chat Topic');

    const chatAgent = await import('./index.js');

    const result = await chatAgent.sendMessage(
      'session-1',
      'hello',
      undefined,
      'sk-hosted-token',
      'https://openaiteach.com/v1'
    );

    expect(result.response).toBe('assistant reply');
    expect(result.topic).toBe('Chat Topic');
    expect(generateOpenAITextMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        apiKey: 'sk-hosted-token',
        baseUrl: 'https://openaiteach.com/v1',
        model: 'gpt-4o-mini',
      })
    );
  });
});
