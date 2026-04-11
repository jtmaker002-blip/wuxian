import express from 'express';
import { getProxySessionRecord } from './openaiteach-proxy.js';
import { loadCapabilityOverride, mergeCapabilityPayloads, sanitizeCapabilityPayload } from '../utils/modelCapabilityOverrides.js';

const router = express.Router();
const OAT_API = 'https://openaiteach.com/api';

function buildCapabilityResponse(kind, mergedScoped) {
  return { [kind]: sanitizeCapabilityPayload(kind, mergedScoped) };
}

async function proxyCapabilities(req, res, path) {
  try {
    const kind = path.endsWith('/voice') ? 'voice' : 'video';
    const sid = String(req.query.sid || '').trim();
    const session = getProxySessionRecord(sid);
    const localOverride = sanitizeCapabilityPayload(kind, loadCapabilityOverride(kind) || {});
    const upstream = await fetch(`${OAT_API}${path}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'TwitCanva-Model-Capabilities/1.0',
        ...(session?.cookie ? { Cookie: session.cookie } : {}),
        ...(session?.userId ? { 'New-Api-User': session.userId } : session?.username ? { 'New-Api-User': session.username } : {}),
      },
    });

    if (!upstream.ok) {
      return res.json({ [kind]: localOverride });
    }

    const payload = await upstream.json().catch(() => ({}));
    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
    const upstreamScoped = sanitizeCapabilityPayload(
      kind,
      kind === 'video' ? normalizedPayload?.video || normalizedPayload : normalizedPayload?.voice || normalizedPayload
    );

    const mergedScoped = mergeCapabilityPayloads(upstreamScoped, localOverride);
    return res.json(buildCapabilityResponse(kind, mergedScoped));
  } catch (error) {
    console.warn('[model-capabilities] upstream unavailable:', error?.message || error);
    const kind = path.endsWith('/voice') ? 'voice' : 'video';
    return res.json(buildCapabilityResponse(kind, loadCapabilityOverride(kind) || {}));
  }
}

router.get('/video', async (_req, res) => {
  return proxyCapabilities(_req, res, '/model-capabilities/video');
});

router.get('/voice', async (_req, res) => {
  return proxyCapabilities(_req, res, '/model-capabilities/voice');
});

export default router;
