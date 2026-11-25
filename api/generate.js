// POST /api/generate  { "pedido": "...", "refinarComIA": true|false }
// Sempre roda o motor local. Se a IA estiver configurada no servidor e o limite
// permitir, pede ao modelo um prompt refinado usando a análise local como base.
import { analyze, MAX_INPUT } from '../lib/engine.js';
import { MASTER_PROMPT } from '../lib/master-prompt.js';
import { aiConfig, allow, clientIp, readJson, send, usage } from './_shared.js';

async function callModel(cfg, analysis, signal) {
  const user = `Pedido do usuário: "${analysis.pedido}"\n\nAnálise prévia do motor local (use como base, corrija o que estiver errado):\n` +
    JSON.stringify({ modo: analysis.modo, nivel: analysis.nivel, classificacao: analysis.classificacao, especialidades: analysis.especialidades, requisitos: analysis.requisitos.map(r => `${r.id} ${r.t}: ${r.c} | aceitação: ${r.ac}`), normas: analysis.normas.map(n => n.nome), conflitos: analysis.interpretacao.conflitos, perguntas: analysis.perguntas }) +
    '\n\nMelhore a especificação: mantenha os IDs, não repita o pedido como requisito, não invente normas nem resultados.';
  if (cfg.provider === 'gemini') {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: MASTER_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: cfg.maxTokens, temperature: 0.3 } }),
    });
    if (!r.ok) throw new Error(`provedor respondeu ${r.status}`);
    const j = await r.json();
    return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  }
  const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: cfg.model, temperature: 0.3, max_tokens: cfg.maxTokens, messages: [{ role: 'system', content: MASTER_PROMPT }, { role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`provedor respondeu ${r.status}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || '').trim();
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { erro: 'use POST' }); }
  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { erro: 'JSON inválido' }); }
  const pedido = String(body.pedido || '');
  if (pedido.length > MAX_INPUT) return send(res, 413, { erro: `pedido maior que ${MAX_INPUT} caracteres` });
  let analysis;
  try { analysis = analyze(pedido, { nivel: body.nivel, comercial: body.comercial }); } catch (e) { return send(res, 400, { erro: e.message }); }

  const out = { fonte: 'motor-local', analise: analysis, ia: null };
  const cfg = (deps.aiConfig || aiConfig)();
  if (!body.refinarComIA) return send(res, 200, out);
  if (!cfg) { out.ia = { usada: false, motivo: 'IA não configurada neste servidor' }; return send(res, 200, out); }
  const lim = allow(clientIp(req), cfg);
  if (!lim.ok) { out.ia = { usada: false, motivo: lim.motivo }; return send(res, 200, out); }

  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    usage.ia++;
    const texto = await (deps.callModel || callModel)(cfg, analysis, ctrl.signal);
    if (!texto) throw new Error('resposta vazia');
    out.fonte = 'ia'; out.ia = { usada: true, provedor: cfg.provider, modelo: cfg.model, texto };
  } catch (e) {
    out.ia = { usada: false, motivo: `falha ao consultar a IA (${e.name === 'AbortError' ? 'tempo esgotado' : e.message}); mostrando o resultado do motor local` };
  } finally { clearTimeout(timer); }
  return send(res, 200, out);
}
