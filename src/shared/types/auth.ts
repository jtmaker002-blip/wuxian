export type LoginInput = {
  account: string;
  password: string;
};

export type SessionPayload = {
  ok: boolean;
  /** 前端标识占位符 "cookie-session:{userId}"，真实 session 由 HttpOnly Cookie 维护 */
  sessionToken: string;
  userId?: string;
  username?: string;
};
