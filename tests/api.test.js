import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler from '../api/generate.js';
import health from '../api/health.js';
import { _resetLimits } from '../api/_shared.js';

function req(method, body, ip = '1.2.3.4') {
  const r = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  r.method = method; r.headers = { 'x-forwarded-for': ip }; return r;
}
function res() {
  const r = { statusCode: 0, headers: {}, body: '' };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = b => { r.body = b; };
  r.json = () => JSON.parse(r.body);
  return r;
}
const cfg = { provider: 'openai', key: 'x', model: 'm', baseUrl: 'http://x', perIp: 2, windowMs: 60_000, daily: 100, maxTokens: 10 };
beforeEach(() => _resetLimits());

test('GET é recusado', async () => { const r = res(); await handler(req('GET'), r); assert.equal(r.statusCode, 405); });

test('sem IA configurada devolve o motor local', async () => {
  const r = res(); await handler(req('POST', { pedido: 'Quero desenvolver um e-commerce', refinarComIA: true }), r, { aiConfig: () => null });
  const j = r.json(); assert.equal(r.statusCode, 200); assert.equal(j.fonte, 'motor-local'); assert.equal(j.ia.usada, false);
  assert.match(j.analise.prompt, /RF-001/);
});

test('com IA configurada usa o modelo e respeita o limite por IP', async () => {
  const deps = { aiConfig: () => cfg, callModel: async () => 'prompt refinado' };
  for (let i = 0; i < 2; i++) { const r = res(); await handler(req('POST', { pedido: 'Quero um app Android', refinarComIA: true }), r, deps); assert.equal(r.json().fonte, 'ia'); }
  const r = res(); await handler(req('POST', { pedido: 'Quero um app Android', refinarComIA: true }), r, deps);
  assert.equal(r.json().fonte, 'motor-local'); assert.match(r.json().ia.motivo, /limite/);
});

test('falha do provedor não derruba a resposta', async () => {
  const r = res(); await handler(req('POST', { pedido: 'Quero um app Android', refinarComIA: true }), r, { aiConfig: () => cfg, callModel: async () => { throw new Error('provedor respondeu 500'); } });
  assert.equal(r.statusCode, 200); assert.equal(r.json().fonte, 'motor-local'); assert.match(r.json().ia.motivo, /500/);
});

test('pedido longo demais é recusado', async () => {
  const r = res(); await handler(req('POST', { pedido: 'a'.repeat(2001) }), r); assert.equal(r.statusCode, 413);
});

test('health não expõe a chave', async () => {
  process.env.AI_PROVIDER = 'openai'; process.env.AI_API_KEY = 'segredo-123';
  const r = res(); health(req('GET'), r);
  assert.equal(r.json().ia.ativa, true); assert.doesNotMatch(r.body, /segredo-123/);
  delete process.env.AI_PROVIDER; delete process.env.AI_API_KEY;
});

import researchHandler from '../api/research.js';
test('POST /api/research usa fetch injetado e devolve fontes', async () => {
  const r = res();
  const fetch = async () => ({ ok: true, json: async () => ({ hits: [{ title: 't', objectID: '9', points: 1, num_comments: 0, created_at: '2026-01-01' }] }) });
  await researchHandler(req('POST', { consulta: 'pix para ongs', fontes: ['hackernews'] }, '9.9.9.9'), r, { fetch });
  assert.equal(r.statusCode, 200); assert.equal(r.json().fontes[0].status, 'ok');
});
test('health lista provedores de pesquisa e consumo', async () => {
  const r = res(); health(req('GET'), r);
  assert.ok(Array.isArray(r.json().pesquisa)); assert.ok('ia' in r.json().consumo);
});
