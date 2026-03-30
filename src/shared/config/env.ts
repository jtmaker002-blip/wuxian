const REMOTE_API = 'https://openaiteach.com/api';
const REMOTE_V1  = 'https://openaiteach.com/v1';
const isDev = import.meta.env?.DEV ?? false;

export const env = {
  /** 登录、Token 管理等后台 API */
  apiBaseUrl: isDev ? '/oat-api' : REMOTE_API,
  /** AI 推理接口 */
  aiBaseUrl: isDev ? '/oat-v1' : REMOTE_V1,
};
