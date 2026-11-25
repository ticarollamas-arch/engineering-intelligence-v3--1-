// Utilidades das funções serverless (arquivos com "_" não viram rota na Vercel).
const hits = new Map(); // limite por IP, em memória (melhor esforço por instância)
export const usage = { ia: 0 }; // consumo por provedor desde o início da instância
let day = new Date().toISOString().slice(0, 10), dayCount = 0;

export function aiConfig() {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  const key = process.env.AI_API_KEY || '';
  if (!provider || !key) return null;
  return {
    provider,
    key,
    model: process.env.AI_MODEL || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    perIp: Number(process.env.AI_LIMIT_PER_IP || 5),
    windowMs: Number(process.env.AI_LIMIT_WINDOW_MIN || 60) * 60_000,
    daily: Number(process.env.AI_DAILY_LIMIT || 100),
    maxTokens: Number(process.env.AI_MAX_TOKENS || 2500),
  };
}

export function allow(ip, cfg, now = Date.now(), bucket = 'ia') {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (bucket === 'ia' && dayCount >= cfg.daily) return { ok: false, motivo: 'limite diário de uso de IA atingido' };
  const k = `${bucket}:${ip}`;
  const list = (hits.get(k) || []).filter(t => now - t < cfg.windowMs);
  if (list.length >= cfg.perIp) return { ok: false, motivo: 'limite de uso por visitante atingido; tente mais tarde' };
  list.push(now); hits.set(k, list); if (bucket === 'ia') dayCount++;
  return { ok: true };
}

export function _resetLimits() { hits.clear(); dayCount = 0; }

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '');
  return xf.split(',')[0].trim() || req.socket?.remoteAddress || 'desconhecido';
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req, limit = 16_384) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > limit) throw new Error('corpo grande demais'); }
  return raw ? JSON.parse(raw) : {};
}
