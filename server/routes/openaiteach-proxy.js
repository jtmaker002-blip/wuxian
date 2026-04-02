/**
 * OpenAiTeach 会话代理：在服务端持有上游 Set-Cookie，解决本地开发时浏览器存不住 / 带不上 Cookie 导致无法拉 Token 列表的问题。
 * 前端登录改为 POST /api/openaiteach/login，刷新令牌改为 GET /api/openaiteach/tokens?sid=...
 *
 * 注意：sid 会同步写入磁盘，Node 重启后会自动恢复；若会话超过 TTL 或会话文件损坏，则会要求重新登录。
 */

import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePaths } from '../runtime-paths.js';

const router = express.Router();

const OAT_API = 'https://openaiteach.com/api';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { proxySessionStoreFile: SESSION_STORE_FILE } = resolveRuntimePaths({
  serverDir: path.join(__dirname, '..'),
});

/** @type {Map<string, { cookie: string, at: number, userId?: string, username?: string }>} */
const sessions = new Map();

const TTL_MS = 8 * 24 * 60 * 60 * 1000; // 8 天（仅内存；重启即清空）

export function getProxySessionRecord(sid) {
  prune();
  if (!sid) return null;
  return sessions.get(String(sid).trim()) ?? null;
}

function ensureSessionStoreDir() {
  fs.mkdirSync(path.dirname(SESSION_STORE_FILE), { recursive: true });
}

function persistSessionsToDisk() {
  try {
    ensureSessionStoreDir();
    const tmpFile = `${SESSION_STORE_FILE}.tmp`;
    const payload = JSON.stringify(
      Array.from(sessions.entries()).map(([sid, record]) => ({
        sid,
        ...record,
      })),
      null,
      2
    );
    fs.writeFileSync(tmpFile, payload, 'utf8');
    fs.renameSync(tmpFile, SESSION_STORE_FILE);
  } catch (error) {
    console.warn('[openaiteach-proxy] persist sessions failed:', error?.message || error);
  }
}

function hydrateSessionsFromDisk() {
  try {
    if (!fs.existsSync(SESSION_STORE_FILE)) return;
    const text = fs.readFileSync(SESSION_STORE_FILE, 'utf8');
    if (!text.trim()) return;
    const raw = JSON.parse(text);
    if (!Array.isArray(raw)) return;

    const now = Date.now();
    sessions.clear();
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const sid = String(item.sid || '').trim();
      const cookie = typeof item.cookie === 'string' ? item.cookie.trim() : '';
      const at = Number(item.at || 0);
      if (!sid || !cookie || !Number.isFinite(at)) continue;
      if (now - at > TTL_MS) continue;
      sessions.set(sid, {
        cookie,
        at,
        userId: typeof item.userId === 'string' ? item.userId : undefined,
        username: typeof item.username === 'string' ? item.username : undefined,
      });
    }
  } catch (error) {
    console.warn('[openaiteach-proxy] hydrate sessions failed:', error?.message || error);
  }
}

function prune() {
  const now = Date.now();
  let changed = false;
  for (const [k, v] of sessions) {
    if (now - v.at > TTL_MS) {
      sessions.delete(k);
      changed = true;
    }
  }
  if (changed) persistSessionsToDisk();
}

hydrateSessionsFromDisk();

/**
 * undici / Node fetch 的 Set-Cookie 数组 → 请求头 Cookie: a=b; c=d
 */
function setCookieHeadersToCookieHeader(setCookieList) {
  if (!setCookieList || !setCookieList.length) return '';
  return setCookieList
    .map((line) => String(line).split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function collectSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const list = headers.getSetCookie();
    if (list && list.length) return list;
  }
  const single = headers.get('set-cookie');
  if (!single) return [];
  return Array.isArray(single) ? single : [single];
}

function readStringDeep(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  for (const nest of ['user', 'data', 'info', 'result']) {
    if (obj[nest] && typeof obj[nest] === 'object') {
      const inner = readStringDeep(obj[nest], keys);
      if (inner) return inner;
    }
  }
  return undefined;
}

/** 健康检查：浏览器可访问 /api/openaiteach/ping 确认本机后端与路由已挂载 */
router.get('/ping', (req, res) => {
  res.json({ ok: true, service: 'openaiteach-proxy' });
});

router.post('/login', async (req, res) => {
  try {
    prune();
    const username = String(req.body?.username ?? req.body?.account ?? '').trim();
    const password = String(req.body?.password ?? '').trim();
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '账号和密码不能为空' });
    }

    const upstream = await fetch(`${OAT_API}/user/login?turnstile=`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        captcha_token: '',
      }),
    });

    const rawCookies = collectSetCookieHeaders(upstream.headers);

    const text = await upstream.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        message: '上游返回非 JSON，请稍后重试',
      });
    }

    if (!body.success) {
      return res.status(401).json({
        success: false,
        message: body.message || '账号或密码错误',
      });
    }

    const cookieHeader = setCookieHeadersToCookieHeader(rawCookies || []);
    if (!cookieHeader) {
      return res.status(502).json({
        success: false,
        message:
          '上游登录成功但未返回 Cookie（本地代理无法维持会话）。请改用官网复制 sk- 手动粘贴，或联系站点是否启用仅 Token 登录。',
      });
    }

    const data = body.data && typeof body.data === 'object' ? body.data : body;
    const userId = readStringDeep(data, ['id', 'user_id', 'userId', 'uid']);
    const uname = readStringDeep(data, ['username', 'email', 'name']);

    const sid = crypto.randomUUID();
    sessions.set(sid, {
      cookie: cookieHeader,
      at: Date.now(),
      userId,
      username: uname,
    });
    persistSessionsToDisk();

    return res.json({
      success: true,
      ok: true,
      oatProxySid: sid,
      userId,
      username: uname,
    });
  } catch (e) {
    console.error('[openaiteach-proxy] login', e);
    return res.status(500).json({
      success: false,
      message: e.message || '登录代理异常',
    });
  }
});

async function forwardWithSession(req, res, pathAndQuery) {
  prune();
  const sid = String(req.query.sid || req.headers['x-oat-proxy-sid'] || '').trim();
  if (!sid) {
    return res.status(400).json({ success: false, message: '缺少 sid，请重新登录' });
  }
  const rec = sessions.get(sid);
  if (!rec) {
    return res.status(401).json({
      success: false,
      message: '会话已失效（可能已重启后端或超过保留时间），请重新登录',
    });
  }
  rec.at = Date.now();
  sessions.set(sid, rec);
  persistSessionsToDisk();

  const url = `${OAT_API}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Cookie: rec.cookie,
        'User-Agent': 'TwitCanva-OpenAiTeach-Proxy/1.0',
        ...(rec.userId ? { 'New-Api-User': rec.userId } : rec.username ? { 'New-Api-User': rec.username } : {}),
      },
    });
    const text = await upstream.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, message: '上游返回非 JSON' });
    }
    res.status(upstream.status).json(body);
  } catch (e) {
    console.error('[openaiteach-proxy] forward', pathAndQuery, e);
    res.status(500).json({ success: false, message: e.message || '转发失败' });
  }
}

router.get('/tokens', (req, res) => {
  const p = req.query.p ?? '0';
  const size = req.query.size ?? '100';
  return forwardWithSession(req, res, `/token/?p=${encodeURIComponent(p)}&size=${encodeURIComponent(size)}`);
});

router.get('/user/self', (req, res) => {
  return forwardWithSession(req, res, '/user/self');
});

router.post('/logout', (req, res) => {
  const sid = String(req.body?.sid || '').trim();
  if (sid) {
    sessions.delete(sid);
    persistSessionsToDisk();
  }
  res.json({ success: true });
});

export function __resetProxySessionsForTests() {
  sessions.clear();
  try {
    if (fs.existsSync(SESSION_STORE_FILE)) {
      fs.unlinkSync(SESSION_STORE_FILE);
    }
  } catch {
    // noop
  }
}

export function __getProxySessionStoreFileForTests() {
  return SESSION_STORE_FILE;
}

export default router;
