import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMessageMock = vi.fn();
const listSessionsMock = vi.fn(() => []);
const getSessionDataMock = vi.fn(() => null);
const deleteSessionMock = vi.fn();

vi.mock('./agent/index.js', () => ({
  default: {
    sendMessage: (...args) => sendMessageMock(...args),
    listSessions: (...args) => listSessionsMock(...args),
    getSessionData: (...args) => getSessionDataMock(...args),
    deleteSession: (...args) => deleteSessionMock(...args),
  },
}));

function createChatApp() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  const API_KEY = '';

  app.post('/api/chat', async (req, res) => {
    try {
      const { sessionId, message, media, providerApiKey, providerBaseUrl } = req.body;
      const effectiveApiKey =
        typeof providerApiKey === 'string' && providerApiKey.trim()
          ? providerApiKey.trim()
          : API_KEY;
      const effectiveBaseUrl =
        typeof providerBaseUrl === 'string' && providerBaseUrl.trim()
          ? providerBaseUrl.trim()
          : undefined;

      if (!effectiveApiKey) {
        return res.status(500).json({ error: '聊天模型当前既没有本地 GEMINI_API_KEY，也没有可用的 OpenAiTeach Token。' });
      }

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      if (!message && !media) {
        return res.status(400).json({ error: 'message or media is required' });
      }

      const chatAgent = (await import('./agent/index.js')).default;
      const result = await chatAgent.sendMessage(sessionId, message, media, effectiveApiKey, effectiveBaseUrl);

      res.json({
        success: true,
        response: result.response,
        topic: result.topic,
        messageCount: result.messageCount,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return app;
}

async function createServer(app) {
  return await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

describe('chat route hosted token passthrough', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
    listSessionsMock.mockReset();
    getSessionDataMock.mockReset();
    deleteSessionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes provider token config into chatAgent even without local GEMINI_API_KEY', async () => {
    sendMessageMock.mockResolvedValue({
      response: 'assistant reply',
      topic: 'Chat Topic',
      messageCount: 2,
    });

    const app = createChatApp();
    const serverHandle = await createServer(app);

    try {
      const response = await fetch(`${serverHandle.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-1',
          message: 'hello',
          providerApiKey: 'sk-hosted-token',
          providerBaseUrl: 'https://openaiteach.com/v1',
        }),
      });

      expect(response.status).toBe(200);
      expect(sendMessageMock).toHaveBeenCalledWith(
        'session-1',
        'hello',
        undefined,
        'sk-hosted-token',
        'https://openaiteach.com/v1'
      );
    } finally {
      await new Promise((resolve) => serverHandle.server.close(resolve));
    }
  });
});
