/**
 * 将 /oat-api 等相对 base 转为绝对 URL，避免 new URL(path, relative) 抛错。
 */
export function resolveAbsoluteBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const origin =
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
      ? window.location.origin
      : 'https://openaiteach.com';
  const p = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${origin}${p}`;
}
