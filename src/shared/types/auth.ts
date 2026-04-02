export type LoginInput = {
  account: string;
  password: string;
};

export type SessionPayload = {
  ok: boolean;
  /** 本机后端代理会话 id（有则 Token 列表走 /api/openaiteach/*） */
  oatProxySid?: string;
  /**
   * `oat-proxy:{sid}` 或与 OpenAiTeach 直连相关的占位 / Bearer。
   */
  sessionToken: string;
  userId?: string;
  username?: string;
};
