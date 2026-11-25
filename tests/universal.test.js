import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/engine.js';
import { generateIdeas, ideaAt, ideaDetail, CAPACITY, hackathonProjects, parseRegulation, dedupeIdeas } from '../lib/ideas.js';
import { research, providerStatus, _clearCache } from '../lib/research.js';
import { detectPlatforms } from '../lib/specialists.js';

const titles = a => a.requisitos.map(r => r.t).join(' | ');
const req = (a, t) => a.requisitos.find(r => r.t === t);

test('login com Google: OIDC com PKCE, state e nonce, sem pedir a senha do Google', () => {
  const a = analyze('Quero um SaaS com login com Google para clínicas');
  const g = req(a, 'Login com Google');
  assert.ok(g, titles(a));
  assert.match(g.c, /PKCE/); assert.match(g.c, /state/); assert.match(g.c, /nonce/);
  assert.match(g.r, /nunca pede nem armazena a senha/);
  assert.ok(a.autenticacao.documentacao.some(d => d.includes('developers.google.com')));
});
test('login com Facebook pelo fluxo oficial da Meta, junto com Google', () => {
  const a = analyze('plataforma com login com Google e Facebook');
  assert.ok(req(a, 'Login com Facebook')); assert.ok(req(a, 'Login com Google'));
  assert.match(req(a, 'Login com Facebook').c, /Facebook Login \(Meta/);
});
test('"Google Cloud" e "minha meta" não ativam login social', () => {
  const a = analyze('Quero fazer deploy no Google Cloud de um sistema de cadastro de clientes; minha meta é crescer');
  assert.equal(a.autenticacao.provedores.length, 0);
});
test('controles de credenciais aparecem em todo prompt com autenticação', () => {
  const a = analyze('sistema de agendamento com login de usuários');
  for (const c of ['Argon2id', 'CSRF', 'enumeração', 'logs sem senhas']) assert.match(a.prompt, new RegExp(c));
  assert.doesNotMatch(a.prompt, /invulnerável/);
});
test('painel administrativo contextual com segurança própria', () => {
  const a = analyze('Quero vender cursos com área de membros e assinatura');
  const p = req(a, 'Painel administrativo contextual');
  assert.ok(p);
  assert.match(p.r, /MFA obrigatório/); assert.match(p.r, /nunca veem senhas/); assert.match(p.r, /reautenticação/);
  assert.ok(a.painelAdmin.modulos.includes('Conteúdo'));
});
test('script local não recebe painel administrativo nem monetização', () => {
  const a = analyze('script local em python para renomear arquivos');
  assert.equal(a.painelAdmin, null); assert.equal(a.monetizacao, null);
  assert.ok(a.arquetipos.includes('Automação / script'));
});
test('produto SaaS: assinatura, jornada completa de 11 etapas e viabilidade', () => {
  const a = analyze('Quero um SaaS de agendamento para psicólogos com login com Google e assinatura mensal');
  assert.equal(a.comercial.comercial, true);
  assert.ok(a.monetizacao.modelos.some(m => m.nome === 'SaaS por assinatura'));
  assert.equal(a.jornada.length, 11);
  assert.equal(a.jornada[6].etapa, 'Validação do pagamento');
  assert.match(a.monetizacao.aviso, /não garantia/);
  assert.ok(['baixa', 'média', 'alta'].includes(a.viabilidade.complexidade));
  assert.match(a.prompt, /Jornada completa do produto/);
});
test('monetização pode ser desativada e some em projetos educacionais', () => {
  assert.equal(analyze('Quero um SaaS de agendamento com login', { comercial: false }).monetizacao, null);
  assert.equal(analyze('API REST para meu TCC de estudo').monetizacao, null);
});
test('e-commerce continua com venda direta e PCI DSS', () => {
  const a = analyze('Quero desenvolver um e-commerce de roupas');
  assert.ok(a.monetizacao.modelos.some(m => m.nome === 'Venda direta de produtos'));
  assert.match(a.normas.map(n => n.nome).join(), /PCI DSS/);
});
test('Hotmart e Kiwify com erro de digitação: identifica, pede confirmação e não inventa eventos', () => {
  const a = analyze('Quero vender meu curso na hotmat e na kiwfy e liberar acesso na área de membros por webhook');
  const nomes = a.pagamentos.plataformas.map(p => p.nome);
  assert.deepEqual(nomes.sort(), ['Hotmart', 'Kiwify']);
  assert.equal(a.pagamentos.confirmacoes.length, 2);
  assert.ok(a.pagamentos.pendencias.some(p => /documentação oficial/.test(p)));
  assert.ok(a.pagamentos.documentacao.some(d => d.includes('docs.kiwify.com.br')));
  assert.ok(a.arquetipos.includes('Produto digital e área de membros'));
  assert.ok(!a.arquetipos.includes('Loja virtual (e-commerce)'));
});
test('Eduzz/Monetizze/Braip sem documentação cadastrada geram pendência, não link inventado', () => {
  const a = analyze('integrar meu infoproduto com eduzz, monetizze e braip por webhook');
  assert.ok(a.pagamentos.pendencias.some(p => /não está cadastrada/.test(p)));
  assert.equal(a.pagamentos.documentacao.length, 0);
});
test('"monetizar" não é confundido com Monetizze', () => {
  assert.equal(detectPlatforms('quero monetizar e monetize meu app').length, 0);
});
test('webhooks: autenticidade, idempotência, replay e acesso nunca liberado pelo front-end', () => {
  const a = analyze('receber webhooks do stripe para assinaturas do meu SaaS');
  for (const t of ['Recebimento e verificação de webhooks', 'Idempotência, deduplicação e proteção contra replay', 'Ciclo de acesso a partir do pagamento']) assert.ok(req(a, t), t);
  assert.match(req(a, 'Ciclo de acesso a partir do pagamento').r, /nunca é liberado com base em dado vindo do navegador/);
  assert.match(req(a, 'Recebimento e verificação de webhooks').r, /somente eventos e campos que a documentação oficial descreve/);
});
test('aplicação de IA mantém controles de custo e prompt injection', () => {
  const a = analyze('Criar um chatbot com IA para atender clientes da minha loja');
  assert.match(titles(a), /prompt injection/i); assert.match(titles(a), /custo/i);
});
test('pesquisa de segurança autorizada continua exigindo escopo', () => {
  const a = analyze('Quero pesquisar vulnerabilidades em um programa de bug bounty da HackerOne');
  assert.equal(a.mode, 'pesquisa'); assert.match(a.prompt, /escopo/);
});
test('prompts comerciais completos não têm linhas repetidas', () => {
  for (const p of ['Quero um SaaS de agendamento para psicólogos com login com Google e Facebook e assinatura mensal pelo stripe', 'Quero vender meu curso na hotmart com área de membros']) {
    const a = analyze(p, { nivel: 'enterprise' });
    const items = a.prompt.split('\n').filter(l => l.trim().startsWith('- ') && l.length > 30);
    assert.equal(items.length, new Set(items).size, p);
    assert.equal(a.antirrepeticao.genericas.length, 0);
  }
});

// ---- startups -------------------------------------------------------------
test('capacidade acima de 100.000 ideias sem armazenamento prévio', () => {
  assert.ok(CAPACITY.total > 100000, JSON.stringify(CAPACITY));
});
test('ideias não se repetem: 5.000 índices distintos geram 5.000 ideias distintas', () => {
  const keys = new Set();
  for (let i = 0; i < 5000; i++) { const x = ideaAt(i); keys.add(`${x.nucleo}|${x.canal}|${x.diferencial}|${x.modelo}`); }
  assert.equal(keys.size, 5000);
});
test('página de ideias deduplica por núcleo e respeita exclusões', () => {
  const p1 = generateIdeas({ tamanho: 12 });
  assert.equal(new Set(p1.ideias.map(i => i.nucleo)).size, 12);
  const p2 = generateIdeas({ tamanho: 12, excluirNucleos: p1.ideias.map(i => i.nucleo) });
  assert.ok(p2.ideias.every(i => !p1.ideias.some(j => j.nucleo === i.nucleo)));
});
test('filtro por tema prioriza aderência', () => {
  const p = generateIdeas({ tamanho: 3, tema: 'fraude em pagamentos' });
  assert.ok(p.ideias.length > 0);
  assert.ok(p.ideias.every(i => /fraude/.test(i.problema)));
});
test('ideia completa traz todos os campos, separa hipótese de fato e não inventa demanda', () => {
  const d = ideaDetail(42);
  for (const k of ['nome', 'problemaDetalhe', 'evidencias', 'solucao', 'publico', 'nicho', 'propostaValor', 'diferencial', 'concorrentes', 'modeloNegocio', 'canaisAquisicao', 'custos', 'complexidade', 'recursos', 'riscosComerciais', 'riscosTecnicos', 'regulatorio', 'validacao', 'mvp', 'roadmap', 'pitch', 'pitchComercial', 'prompt']) assert.ok(d[k] !== undefined && d[k] !== null, k);
  assert.match(d.evidencias.status, /Não verificadas/);
  assert.match(d.concorrentes.status, /Não pesquisados/);
  assert.ok(d.rotulos.hipotese.includes('problema'));
  assert.equal(d.rotulos.fato.length, 0);
  assert.match(d.prompt, /RF-001/);
  assert.doesNotMatch(JSON.stringify(d), /garantid[oa] de sucesso|faturamento garantido/i);
});
test('deduplicação semântica de listas de ideias', () => {
  const a = { resumo: 'agenda online com lembretes para clínicas veterinárias' };
  const b = { resumo: 'agenda online com lembretes para clínicas veterinárias pequenas' };
  const c = { resumo: 'monitoramento de fraudes em pagamentos de farmácias' };
  assert.equal(dedupeIdeas([a, b, c]).length, 2);
});

// ---- hackathon ------------------------------------------------------------
const REG = 'Tema: dados abertos para cidades inteligentes\nCritérios de avaliação:\n- Impacto social 30%\n- Inovação 25%\n- Execução técnica 25%\n- Pitch 20%\nDuração: 48 horas\nTecnologias permitidas: Python, React e dados abertos\nSubmissão: vídeo de 3 minutos e repositório público até 20/03/2027';
test('regulamento: tema, critérios com pesos, prazo, duração e tecnologias', () => {
  const r = parseRegulation(REG);
  assert.match(r.tema, /dados abertos/);
  assert.deepEqual(r.criterios.map(c => c.peso), ['30%', '25%', '25%', '20%']);
  assert.deepEqual(r.prazos, ['20/03/2027']); assert.equal(r.duracaoHoras, 48);
  assert.ok(r.tecnologias.includes('python') && r.tecnologias.includes('react'));
  assert.equal(r.submissao.length, 1);
});
test('projetos de hackathon alinhados aos critérios reais e sem garantia de prêmio', () => {
  const h = hackathonProjects({ regulamento: REG });
  assert.equal(h.projetos.length, 3);
  const p = h.projetos[0];
  assert.equal(p.atendimentoCriterios.length, 4);
  assert.match(p.tecnologias, /python, react/);
  assert.equal(p.roteiroPitch.length, 5);
  assert.ok(h.avisos.some(a => /Nenhuma premiação é garantida/.test(a)));
});
test('sem regulamento, não inventa critérios', () => {
  const h = hackathonProjects({ tema: 'saúde' });
  assert.ok(h.avisos.some(a => /não foram inventados/.test(a)));
  assert.equal(h.projetos[0].atendimentoCriterios.length, 0);
});

// ---- pesquisa -------------------------------------------------------------
function fakeFetch(map) {
  return async (url) => {
    const key = Object.keys(map).find(k => url.includes(k));
    if (!key) throw new Error('sem rota');
    const v = map[key];
    if (v instanceof Error) throw v;
    return { ok: v.status ? v.status < 400 : true, status: v.status || 200, json: async () => v.body };
  };
}
test('pesquisa com fontes externas: fonte, data da consulta e confiabilidade', async () => {
  _clearCache();
  const out = await research('agendamento clinicas', {
    fontes: ['github', 'hackernews', 'reddit'],
    now: () => new Date('2026-11-25T12:00:00Z'),
    fetch: fakeFetch({
      'api.github.com': { body: { items: [{ full_name: 'x/agenda', html_url: 'https://github.com/x/agenda', description: 'agenda', stargazers_count: 10, pushed_at: '2026-10-01' }] } },
      'hn.algolia.com': { body: { hits: [{ title: 'Ask HN: no-shows', objectID: '1', points: 5, num_comments: 2, created_at: '2025-01-01' }] } },
    }),
  });
  const gh = out.fontes.find(f => f.fonte === 'github');
  assert.equal(gh.status, 'ok'); assert.equal(gh.consultadoEm, '2026-11-25T12:00:00.000Z');
  assert.match(gh.confiabilidade, /não prova demanda/);
  assert.equal(gh.resultados[0].url, 'https://github.com/x/agenda');
  const hn = out.fontes.find(f => f.fonte === 'hackernews');
  assert.equal(hn.resultados[0].url, 'https://news.ycombinator.com/item?id=1');
  const rd = out.fontes.find(f => f.fonte === 'reddit');
  assert.equal(rd.status, 'indisponível'); assert.match(rd.motivo, /OAuth/);
});
test('falha de uma fonte não derruba as outras, e o cache evita nova chamada', async () => {
  _clearCache();
  let calls = 0;
  const f = async (url) => { calls++; if (url.includes('github')) return { ok: false, status: 403, json: async () => ({}) }; return { ok: true, json: async () => ({ hits: [] }) }; };
  const a = await research('teste cache', { fontes: ['github', 'hackernews'], fetch: f });
  assert.equal(a.fontes.find(x => x.fonte === 'github').status, 'falha');
  assert.equal(a.fontes.find(x => x.fonte === 'hackernews').status, 'ok');
  const before = calls;
  const b = await research('teste cache', { fontes: ['hackernews'], fetch: f });
  assert.equal(calls, before); assert.ok(b.fontes[0].cache);
});
test('status dos provedores declara o que não está integrado', () => {
  const s = providerStatus();
  assert.ok(s.find(p => p.id === 'github').ativo);
  for (const id of ['reddit', 'producthunt', 'googletrends', 'devpost']) assert.ok(!s.find(p => p.id === id).ativo && s.find(p => p.id === id).motivo);
});
test('ideias diferentes nunca recebem o mesmo nome', () => {
  const byName = new Map();
  for (let i = 0; i < 3000; i++) { const x = ideaAt(i); if (byName.has(x.nome)) assert.equal(byName.get(x.nome), x.nucleo, x.nome); byName.set(x.nome, x.nucleo); }
});
