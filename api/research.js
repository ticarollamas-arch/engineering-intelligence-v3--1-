// POST /api/research { "consulta": "...", "fontes": ["github","hackernews"] }
import { research } from '../lib/research.js';
import { allow, clientIp, readJson, send, usage } from './_shared.js';

const LIMIT = { perIp: Number(process.env.RESEARCH_LIMIT_PER_IP || 20), windowMs: 60 * 60_000, daily: Infinity };

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { erro: 'use POST' }); }
  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { erro: 'JSON inválido' }); }
  const lim = allow(clientIp(req), LIMIT, Date.now(), 'research');
  if (!lim.ok) return send(res, 429, { erro: lim.motivo });
  try {
    const out = await research(body.consulta, { fontes: Array.isArray(body.fontes) ? body.fontes : undefined, fetch: deps.fetch || globalThis.fetch, env: process.env, usage });
    return send(res, 200, out);
  } catch (e) { return send(res, 400, { erro: e.message }); }
}
