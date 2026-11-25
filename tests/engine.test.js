import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, correct, similarity, antiRepetition } from '../lib/engine.js';

const titles = a => a.requisitos.map(r => r.t).join(' | ');
const normas = a => a.normas.map(n => n.nome).join(' | ');
const FIELDS = ['t', 'f', 'c', 'in', 'out', 'r', 'ac', 'v'];

function assertQuality(a) {
  assert.ok(!a.prompt.toLowerCase().includes(a.pedido.toLowerCase()) || a.pedido.length < 13, 'o pedido não pode ser copiado como requisito');
  for (const r of a.requisitos) for (const k of FIELDS) assert.ok(r[k] && r[k].length > 3, `${r.id} sem campo ${k}`);
  for (const n of a.normas) for (const k of ['porque', 'requisito', 'controle', 'implementacao', 'verificacao', 'evidencia']) assert.ok(n[k], `${n.nome} sem ${k}`);
  assert.equal(new Set(a.requisitos.map(r => r.id)).size, a.requisitos.length);
  assert.ok(a.qualidade.total <= 100 && a.qualidade.total >= 0);
}

// ---- 15 cenários do pedido de upgrade -------------------------------------
test('01 ferramenta de Bug Bounty: escopo, análise, achados e relatório', () => {
  const a = analyze('Quero desenvolver uma ferramenta de Bug Bounty para análise e pesquisa de segurança');
  assert.equal(a.mode, 'desenvolvimento');
  for (const t of ['escopo', 'Análise estática', 'achados', 'Relatório']) assert.match(titles(a), new RegExp(t, 'i'));
  assert.doesNotMatch(titles(a), /Linha de base/); // "bug" de "bug bounty" não ativa correção de projeto
  assert.match(normas(a), /WSTG/); assertQuality(a);
});
test('02 e-commerce: catálogo, checkout, pagamento, LGPD e PCI', () => {
  const a = analyze('Quero desenvolver um e-commerce');
  for (const t of ['Catálogo', 'checkout', 'Pagamento', 'estoque']) assert.match(titles(a), new RegExp(t, 'i'));
  for (const n of ['LGPD', 'PCI DSS', 'ASVS']) assert.match(normas(a), new RegExp(n));
  assertQuality(a);
});
test('03 Android: permissões, armazenamento seguro, assinatura, MASVS', () => {
  const a = analyze('Criar um aplicativo Android');
  for (const t of ['Permissões', 'Armazenamento', 'assinado']) assert.match(titles(a), new RegExp(t, 'i'));
  assert.match(normas(a), /MASVS/); assertQuality(a);
});
test('04 ZIP para GitHub: extração segura, permissão mínima, commits', () => {
  const a = analyze('Criar uma ferramenta que pega um ZIP e publica no GitHub');
  for (const t of ['extração segura', 'permissão mínima', 'commit']) assert.match(titles(a), new RegExp(t, 'i'));
  assert.match(a.prompt, /zip slip/i); assertQuality(a);
});
test('05 VPS: endurecimento, HTTPS, rollback, CIS', () => {
  const a = analyze('Implantar minha aplicação em uma VPS');
  assert.equal(a.mode, 'infra');
  for (const t of ['Endurecimento', 'HTTPS', 'rollback']) assert.match(titles(a), new RegExp(t, 'i'));
  assert.match(normas(a), /CIS/); assertQuality(a);
});
test('06 API REST: OpenAPI, BOLA, paginação', () => {
  const a = analyze('Desenvolver uma API REST');
  for (const t of ['OpenAPI', 'objeto', 'Paginação']) assert.match(titles(a), new RegExp(t, 'i'));
  assert.match(normas(a), /API Security/); assertQuality(a);
});
test('07 plataforma de IA: servidor, RAG, prompt injection, custo', () => {
  const a = analyze('Criar uma plataforma de inteligência artificial');
  assert.equal(a.mode, 'ia');
  for (const t of ['servidor', 'RAG', 'prompt injection', 'custo']) assert.match(titles(a), new RegExp(t, 'i'));
  assertQuality(a);
});
test('08 corrigir projeto existente: linha de base e regressão', () => {
  const a = analyze('Corrigir um projeto existente que está com erros');
  assert.equal(a.mode, 'melhoria');
  assert.match(titles(a), /Linha de base/); assert.match(titles(a), /regressão/i); assertQuality(a);
});
test('09 pipeline DevSecOps: gates, SBOM, SLSA', () => {
  const a = analyze('Criar um pipeline DevSecOps');
  assert.match(titles(a), /Gates/); assert.match(titles(a), /SBOM/); assert.match(normas(a), /SLSA/); assertQuality(a);
});
test('10 pedido inédito é decomposto em entidades (agendamento)', () => {
  const a = analyze('Sistema de agendamento para clínica veterinária');
  assert.ok(a.derivado);
  assert.match(titles(a), /Agenda e disponibilidade/);
  assert.match(titles(a), /papéis/);
  assert.ok(a.qualidade.deficiencias.some(d => /decomposição genérica/.test(d)));
  assertQuality(a);
});
test('11 erros ortográficos e fala informal', () => {
  const a = analyze('qero cria um aplicativo andorid pra vende roupa com pix');
  assert.ok(a.interpretacao.correcoes.some(([de, para]) => de === 'andorid' && para === 'android'));
  assert.ok(a.arquetipos.includes('Aplicativo Android'));
  assert.ok(a.arquetipos.includes('Loja virtual (e-commerce)'));
  assert.match(normas(a), /PCI/);
});
test('12 múltiplos domínios combinados', () => {
  const a = analyze('plataforma com IA que analisa repositórios do GitHub e gera relatório de segurança');
  assert.ok(a.arquetipos.length >= 2);
  assert.match(titles(a), /prompt injection/i); assert.match(titles(a), /Análise estática/);
});
test('13 pedido incompleto vira descoberta de requisitos, com nota baixa', () => {
  const a = analyze('quero um sistema');
  assert.equal(a.mode, 'descoberta');
  assert.equal(a.requisitos.length, 0);
  assert.match(a.prompt, /Perguntas obrigatórias/);
  assert.ok(a.qualidade.total < 40);
});
test('14 requisitos conflitantes são sinalizados', () => {
  const a = analyze('site estático sem backend com login de usuários');
  assert.ok(a.interpretacao.conflitos.length >= 1);
  assert.match(a.prompt, /Conflitos a resolver/);
  assert.ok(!a.arquetipos.includes('API REST'), '"sem backend" não pode ativar API');
});
test('15 conteúdo repetitivo: no pedido e no texto gerado', () => {
  const a = analyze('quero uma API REST, uma API REST segura, com uma API REST');
  assert.ok(a.interpretacao.repeticoesNoPedido.length >= 1);
  const r = antiRepetition('- Validar a entrada do usuário no servidor sempre\n- Validar a entrada do usuário no servidor sempre\n- Implementar o objetivo descrito: x', 'x');
  assert.equal(r.removidas.length, 1); assert.equal(r.genericas.length, 1);
});

// ---- comportamento geral ---------------------------------------------------
test('níveis mudam a profundidade sem repetir', () => {
  const e = analyze('Quero desenvolver um e-commerce', { nivel: 'essencial' });
  const x = analyze('Quero desenvolver um e-commerce', { nivel: 'enterprise' });
  assert.ok(e.requisitos.length < x.requisitos.length);
  assert.doesNotMatch(e.prompt, /Matriz de rastreabilidade/);
  assert.match(x.prompt, /Governança/); assert.match(normas(x), /27001/);
});
test('nota nunca é 100 automaticamente e lista deficiências', () => {
  const a = analyze('Sistema de agendamento para clínica veterinária');
  assert.ok(a.qualidade.total < 100); assert.ok(a.qualidade.deficiencias.length > 0);
  assert.equal(a.qualidade.criterios.reduce((s, c) => s + c.max, 0), 100);
});
test('rastreabilidade liga cada requisito a teste e evidência', () => {
  const a = analyze('Desenvolver uma API REST');
  assert.equal(a.rastreabilidade.length, a.requisitos.length);
  for (const t of a.rastreabilidade) assert.ok(t.teste.startsWith('T-') && t.evidencia && t.controle);
});
test('módulo de aprendizagem separa gerado, validado e a estudar', () => {
  const a = analyze('Criar um aplicativo Android');
  assert.ok(a.aprendizagem.glossario.length > 0);
  assert.match(a.aprendizagem.diagrama, /flowchart/);
  assert.match(a.aprendizagem.status.validado, /Nada foi executado/);
});
test('limite de revisões é respeitado', () => {
  const a = analyze('Quero desenvolver um e-commerce', { maxRevisions: 1 });
  assert.ok(a.revisao.rodadas.length <= 1);
});
test('utilitários: correção e similaridade', () => {
  assert.equal(correct('aplicatvo andorid').text, 'aplicativo android');
  assert.ok(similarity('carrinho e checkout', 'checkout e carrinho') > 0.9);
});
test('rejeita pedido vazio', () => { assert.throws(() => analyze('  '), /pelo menos/); });
