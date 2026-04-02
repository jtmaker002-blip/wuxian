export type ApiTokenRecord = {
  id: string;
  name: string;
  /** 完整 sk-xxx 值 */
  value: string;
  /** 是否拿到了可直接测试/保存的完整 token，而不是后台掩码 */
  isUsable: boolean;
};
