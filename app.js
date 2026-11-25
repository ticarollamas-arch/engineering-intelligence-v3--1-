import { analyze, MAX_INPUT, VERSION } from './lib/engine.js';
import { store, download } from './lib/store.js';

const $ = s => document.querySelector(s);
const EXAMPLES = [
  'Quero desenvolver um e-commerce com pagamento por Pix',
  'Quero pesquisar vulnerabilidades em um programa de Bug Bounty',
  'Quero desenvolver um aplicativo Android',
  'Quero criar um agente de IA que responde clientes',
  'Quero corrigir os erros do meu site e melhorar a performance',
  'Quero fazer o deploy da minha API com Docker numa VPS',
  'Sistema de agendamento para clínica veterinária',
];
let state = { local: '', ia: '', tab: 'local' };
$('#ver').textContent = VERSION;

const ex = $('#examples');
for (const t of EXAMPLES) {
  const b = Object.assign(document.createElement('button'), { className: 'chip', type: 'button', textContent: t });
  b.onclick = () => { $('#pedido').value = t; updateCount(); $('#pedido').focus(); };
  ex.append(b);
}
const pedidoEl = $('#pedido');
function updateCount() { $('#count').textContent = `${pedidoEl.value.length}/${MAX_INPUT}`; }
pedidoEl.addEventListener('input', updateCount);
pedidoEl.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') gerar(); });

// A IA só fica disponível se o servidor tiver um provedor configurado.
fetch('api/health').then(r => r.ok ? r.json() : null).then(h => {
  if (h?.ia?.ativa) { $('#useAI').disabled = false; $('#aiLabel').textContent = `Refinar com IA (${h.ia.modelo})`; }
}).catch(() => {});

function fill(el, items, render) { el.replaceChildren(...items.map(render)); }
function li(text) { return Object.assign(document.createElement('li'), { textContent: text }); }

const LEVEL_NAMES = { essencial: 'Essencial', profissional: 'Profissional', avancado: 'Avançado', enterprise: 'Enterprise' };
function el(tag, text) { return Object.assign(document.createElement(tag), { textContent: text }); }
function renderLearning(l) {
  const box = $('#rLearn'); const card = $('#learnCard');
  card.hidden = !l; if (!l) return;
  const parts = [];
  const sec = (title, nodes) => { if (!nodes.length) return; parts.push(el('h3', title), ...nodes); };
  const ul = items => { const u = document.createElement('ul'); items.forEach(i => u.append(el('li', i))); return u; };
  const status = document.createElement('div'); status.className = 'status';
  status.append(Object.assign(el('span', `Gerado: ${l.status.gerado}`), { className: 'g' }), Object.assign(el('span', `Validado: ${l.status.validado}`), { className: 'v' }), Object.assign(el('span', `Para estudar: ${l.status.estudar}`), { className: 'e' }));
  parts.push(status);
  sec('Como funciona', [el('p', l.fluxo)]);
  const dl = document.createElement('dl'); l.glossario.forEach(g => dl.append(el('dt', g.termo), el('dd', g.definicao)));
  sec('Glossário', l.glossario.length ? [dl] : []);
  sec('Conceitos e referenciais', l.conceitos.length ? [ul(l.conceitos)] : []);
  sec('Decisões técnicas', l.decisoes.length ? [ul(l.decisoes)] : []);
  sec('Diagrama (Mermaid)', [el('pre', l.diagrama)]);
  sec('Comandos úteis', l.comandos.length ? [el('pre', l.comandos.join('\n'))] : []);
  sec('Erros comuns', l.erros.length ? [ul(l.erros.map(e => `${e.sintoma} → ${e.causa}`))] : []);
  sec('Exercícios', l.exercicios.length ? [ul(l.exercicios)] : []);
  sec('Como validar por conta própria', l.validacaoIndependente.length ? [ul(l.validacaoIndependente)] : []);
  box.replaceChildren(...parts);
}

function list(items) { const u = document.createElement('ul'); u.className = 'sublist'; items.forEach(i => u.append(el('li', i))); return u; }
function sec(title) { return Object.assign(document.createElement('h3'), { className: 'sec', textContent: title }); }
function renderBusiness(a) {
  const s = [];
  if (a.autenticacao) { s.push(sec(`Autenticação${a.autenticacao.provedores.length ? ` (${a.autenticacao.provedores.join(', ')})` : ''}`), list(a.autenticacao.controles.slice(0, 8))); if (a.autenticacao.documentacao.length) s.push(list(a.autenticacao.documentacao)); }
  if (a.painelAdmin) s.push(sec('Painel administrativo'), list(a.painelAdmin.modulos));
  if (a.pagamentos) { s.push(sec(`Pagamentos e webhooks${a.pagamentos.plataformas.length ? ` (${a.pagamentos.plataformas.map(p => p.nome).join(', ')})` : ''}`)); s.push(list([...a.pagamentos.confirmacoes, ...a.pagamentos.pendencias, ...a.pagamentos.documentacao])); }
  $('#rSec').replaceChildren(...s); $('#secCard').hidden = !s.length;
  const b = [];
  b.push(el('p', `Análise comercial: ${a.comercial.comercial ? 'ativa' : 'desativada'} (${a.comercial.motivo}).`));
  if (a.monetizacao) { b.push(sec('Modelos de monetização compatíveis'), list(a.monetizacao.modelos.map(m => `${m.nome}: ${m.quando}`)), el('p', a.monetizacao.cenario), Object.assign(el('p', a.monetizacao.aviso), { className: 'small' })); }
  if (a.jornada) { b.push(sec('Jornada do produto')); const ol = document.createElement('ol'); ol.className = 'sublist'; a.jornada.forEach(j => ol.append(el('li', `${j.etapa}: ${j.componente}`))); b.push(ol); }
  if (a.viabilidade) b.push(sec('Viabilidade (estimativa)'), list([`Complexidade: ${a.viabilidade.complexidade}`, `MVP: ${a.viabilidade.mvp}`, `Custo inicial: ${a.viabilidade.custoInicial}`, `Custo mensal: ${a.viabilidade.custoMensal}`, a.viabilidade.validacao]));
  $('#rBiz').replaceChildren(...b); $('#bizCard').hidden = !(a.monetizacao || a.jornada || a.viabilidade);
  $('#bizRow').hidden = $('#secCard').hidden && $('#bizCard').hidden;
}

function show(a) {
  $('#rObj').textContent = a.objetivo;
  $('#rMode').textContent = a.modo;
  fill($('#rSpec'), a.especialidades, t => Object.assign(document.createElement('span'), { textContent: t }));
  fill($('#rRefs'), a.normas, n => { const e = document.createElement('li'); const b = document.createElement('b'); b.textContent = n.nome; const s = document.createElement('span'); s.textContent = n.porque; const d = document.createElement('small'); d.textContent = n.verificacao ? `Verificação: ${n.verificacao}. Evidência: ${n.evidencia}.` : ''; e.append(b, s, d); return e; });
  // interpretação: correções, repetições e conflitos
  const notes = [];
  if (a.interpretacao?.correcoes?.length) notes.push(`Entendi: ${a.interpretacao.correcoes.map(([de, para]) => `"${de}" → "${para}"`).join(', ')}.`);
  if (a.interpretacao?.repeticoesNoPedido?.length) notes.push(`Repetições ignoradas: ${a.interpretacao.repeticoesNoPedido.join('; ')}.`);
  if (a.interpretacao?.conflitos?.length) notes.push(`Atenção: ${a.interpretacao.conflitos.join(' ')}`);
  const ip = $('#interp'); ip.textContent = notes.join(' '); ip.hidden = !notes.length;
  // classificação
  const cls = a.classificacao;
  fill($('#rCls'), cls ? [['Domínio principal', cls.principal], ['Complementares', cls.secundarios.join(', ') || '—'], ['Nível', `${LEVEL_NAMES[a.nivel]}${a.nivel === a.nivelRecomendado ? ' (recomendado)' : ` (recomendado: ${LEVEL_NAMES[a.nivelRecomendado]})`}`]] : [['Nível', LEVEL_NAMES[a.nivel]]], ([k, v]) => { const e = document.createElement('li'); const b = document.createElement('b'); b.textContent = `${k}: `; e.append(b, v); return e; });
  // qualidade
  const q = a.qualidade;
  $('#qTotal').textContent = q.total;
  fill($('#qCrit'), q.criterios, c => { const e = document.createElement('li'); const n = document.createElement('span'); n.textContent = c.nome; const p = document.createElement('span'); p.textContent = `${c.pontos}/${c.max}`; const bar = document.createElement('i'); bar.style.setProperty('--w', `${Math.round(100 * c.pontos / c.max)}%`); e.append(n, p, bar); return e; });
  fill($('#qDefs'), q.deficiencias, d => Object.assign(document.createElement('p'), { textContent: d }));
  $('#qAviso').textContent = q.aviso;
  // rastreabilidade e revisão
  $('#traceCard').hidden = !a.rastreabilidade.length;
  fill($('#rTrace'), a.rastreabilidade, t => { const tr = document.createElement('tr'); for (const v of [t.requisito, t.componente, t.controle, t.teste, t.aceitacao]) tr.append(Object.assign(document.createElement('td'), { textContent: v })); return tr; });
  fill($('#rChecks'), a.revisao.checagens, c => { const e = document.createElement('li'); if (!c.ok) e.className = 'no'; const b = document.createElement('span'); b.textContent = c.q; const sm = document.createElement('small'); sm.textContent = c.nota; e.append(b, sm); return e; });
  renderLearning(a.aprendizagem);
  renderBusiness(a);
  fill($('#rDel'), a.entregaveis, li);
  fill($('#rVal'), a.validacao, li);
  state.local = a.prompt;
  const r = $('#result'); r.hidden = false; r.classList.remove('reveal'); void r.offsetWidth; r.classList.add('reveal');
}
function paintPrompt() {
  $('#rPrompt').textContent = state.tab === 'ia' && state.ia ? state.ia : state.local;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.t === state.tab));
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { state.tab = t.dataset.t; paintPrompt(); });

async function gerar() {
  const err = $('#err'); err.hidden = true;
  let a;
  try { a = analyze(pedidoEl.value, { nivel: $('#nivel').value || undefined, comercial: $('#comercial').value || undefined }); }
  catch (e) { err.textContent = e.message; err.hidden = false; return; }
  store.registrar({ tipo: 'prompt', titulo: a.pedido.slice(0, 90), pedido: a.pedido, nivel: a.nivel });
  state = { local: '', ia: '', tab: 'local' };
  show(a); $('#rSrc').textContent = 'motor local'; $('#tabs').hidden = true; $('#aiNote').hidden = true; paintPrompt();
  if (!$('#useAI').checked) { $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const go = $('#go'); go.disabled = true; go.textContent = 'Refinando com IA…';
  try {
    const r = await fetch('api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido: pedidoEl.value, nivel: $('#nivel').value || undefined, comercial: $('#comercial').value || undefined, refinarComIA: true }) });
    const j = await r.json();
    if (j.ia?.usada) { state.ia = j.ia.texto; state.tab = 'ia'; $('#tabs').hidden = false; $('#rSrc').textContent = `refinado por IA (${j.ia.modelo})`; }
    else if (j.ia?.motivo) { $('#aiNote').textContent = `IA não usada: ${j.ia.motivo}.`; $('#aiNote').hidden = false; }
  } catch { $('#aiNote').textContent = 'Não foi possível falar com o servidor; mostrando o resultado do motor local.'; $('#aiNote').hidden = false; }
  finally { go.disabled = false; go.textContent = 'Gerar prompt'; paintPrompt(); }
}
$('#go').onclick = gerar;

$('#copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('#rPrompt').textContent); $('#copy').textContent = 'Copiado ✓'; }
  catch { $('#copy').textContent = 'Selecione e copie'; }
  setTimeout(() => ($('#copy').textContent = 'Copiar'), 1800);
};
$('#dl').onclick = () => download('prompt-tecnico.md', $('#rPrompt').textContent);
// restaurar um pedido vindo do histórico
window.addEventListener('ei:restaurar', e => { pedidoEl.value = e.detail.pedido; if (e.detail.nivel) $('#nivel').value = e.detail.nivel; updateCount(); gerar(); });
updateCount();
