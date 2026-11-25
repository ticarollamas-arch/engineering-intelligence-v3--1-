// Módulos da plataforma: navegação, startups, hackathon, pesquisa, histórico e configurações.
// Todos usam o mesmo motor central (lib/engine.js) através de lib/ideas.js.
import { generateIdeas, ideaDetail, CAPACITY, hackathonProjects } from './lib/ideas.js';
import { store, download } from './lib/store.js';

const $ = s => document.querySelector(s);
const h = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); kids.flat().forEach(k => k != null && e.append(k)); return e; };
const ul = (items, cls = 'sublist') => h('ul', { className: cls }, items.map(i => h('li', { textContent: i })));
const sec = t => h('h3', { className: 'sec', textContent: t });
const fmt = n => n.toLocaleString('pt-BR');

// ---------------------------------------------------------------- navegação
const tabs = [...document.querySelectorAll('.modnav button')];
function openMod(id) {
  tabs.forEach(b => { const on = b.dataset.mod === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('.mod').forEach(m => { m.hidden = m.id !== `mod-${id}`; });
  if (id === 'historico') renderStore();
  if (id === 'config') loadConfig();
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
}
tabs.forEach(b => b.addEventListener('click', () => openMod(b.dataset.mod)));
const initial = location.hash.slice(1);
if (tabs.some(b => b.dataset.mod === initial)) openMod(initial);

// ---------------------------------------------------------------- startups
let page = 1, shown = [];
$('#cap').textContent = `${fmt(CAPACITY.total)} combinações disponíveis, geradas sob demanda`;
function ideaCard(i) {
  const chave = `ideia:${i.id}`;
  const fav = h('button', { className: 'btn ghost sm', type: 'button', textContent: store.ehFavorito(chave) ? '★ Favorita' : '☆ Favoritar' });
  fav.onclick = () => { if (store.ehFavorito(chave)) { store.desfavoritar(chave); fav.textContent = '☆ Favoritar'; } else { store.favoritar({ chave, tipo: 'ideia', titulo: `${i.nome}: ${i.resumo}`, id: i.id }); fav.textContent = '★ Favorita'; } };
  const ver = h('button', { className: 'btn sm', type: 'button', textContent: 'Ver ideia completa' });
  ver.onclick = () => showIdea(i.id);
  return h('article', { className: 'card idea' },
    h('h3', { textContent: i.nome }),
    h('p', { textContent: i.resumo }),
    h('div', { className: 'meta' }, h('span', { textContent: i.modelo }), h('span', { textContent: i.diferencial }), i.aderencia ? h('span', { textContent: i.aderencia }) : null),
    h('div', { className: 'acts' }, ver, fav));
}
function loadIdeas(reset) {
  if (reset) { page = 1; shown = []; $('#ideas').replaceChildren(); $('#ideaDetail').hidden = true; }
  const tema = $('#tema').value;
  const r = generateIdeas({ pagina: page, tamanho: 6, tema, excluirNucleos: shown.map(i => i.nucleo) });
  shown.push(...r.ideias);
  r.ideias.forEach(i => $('#ideas').append(ideaCard(i)));
  if (!r.ideias.length) $('#ideas').append(h('p', { className: 'small', textContent: 'Nenhuma combinação encontrada para esse tema. Tente termos mais amplos.' }));
  if (r.aviso) $('#ideas').append(h('p', { className: 'small', textContent: r.aviso }));
  $('#moreIdeas').hidden = !r.ideias.length;
  page++;
  if (reset) store.registrar({ tipo: 'ideias', titulo: tema ? `Ideias sobre "${tema}"` : 'Ideias de startups', tema });
}
$('#genIdeas').onclick = () => loadIdeas(true);
$('#moreIdeas').onclick = () => loadIdeas(false);
$('#tema').addEventListener('keydown', e => { if (e.key === 'Enter') loadIdeas(true); });

function kv(pairs) { return h('dl', { className: 'kv' }, pairs.filter(([, v]) => v).flatMap(([k, v]) => [h('dt', { textContent: k }), h('dd', {}, v)])); }
function tag(text, kind) { return h('span', { className: `tagx tag-${kind}`, textContent: text }); }
function showIdea(id) {
  const d = ideaDetail(id);
  const box = $('#ideaDetail'); box.hidden = false;
  const copy = h('button', { className: 'btn ghost sm', type: 'button', textContent: 'Copiar prompt' });
  copy.onclick = async () => { try { await navigator.clipboard.writeText(d.prompt); copy.textContent = 'Copiado ✓'; } catch { copy.textContent = 'Selecione e copie'; } };
  const md = h('button', { className: 'btn ghost sm', type: 'button', textContent: 'Baixar .md' });
  md.onclick = () => download(`ideia-${d.nome}.md`, ideaMarkdown(d));
  box.replaceChildren(
    h('div', { className: 'phead' }, h('h2', { textContent: `${d.nome} — ideia completa` }), h('div', { className: 'pacts' }, copy, md)),
    h('p', { className: 'note', textContent: `${d.nomeAviso} Rótulos: hipótese = precisa de validação; estimativa = cálculo grosseiro com premissas.` }),
    kv([
      ['Problema', h('span', {}, tag('hipótese', 'h'), d.problemaDetalhe)],
      ['Evidências', h('div', {}, h('span', { textContent: d.evidencias.status }), ul(d.evidencias.comoValidar), ul(d.evidencias.buscas))],
      ['Solução', d.solucao], ['Público-alvo', d.publico], ['Nicho', d.nicho],
      ['Proposta de valor', h('span', {}, tag('hipótese', 'h'), d.propostaValor)],
      ['Diferencial', h('span', {}, tag('hipótese', 'h'), d.diferencial)],
      ['Concorrentes', h('div', {}, h('span', { textContent: `${d.concorrentes.status} ${d.concorrentes.aviso}` }), ul(d.concorrentes.alternativasTipicas))],
      ['Modelo de negócio', d.modeloNegocio],
      ['Monetização', d.monetizacao ? h('div', {}, ul(d.monetizacao.modelos.map(m => m.nome)), h('small', { textContent: d.monetizacao.aviso })) : null],
      ['Canais de aquisição', ul(d.canaisAquisicao)],
      ['Custos', d.custos ? h('span', {}, tag('estimativa', 'e'), `Inicial: ${d.custos.inicial}. Mensal: ${d.custos.mensal}.`) : null],
      ['Complexidade técnica', h('span', {}, tag('estimativa', 'e'), d.complexidade)],
      ['Recursos necessários', ul(d.recursos)],
      ['Riscos comerciais', ul(d.riscosComerciais)], ['Riscos técnicos', ul(d.riscosTecnicos)],
      ['Requisitos regulatórios', ul(d.regulatorio)],
      ['Estratégia de validação', ul(d.validacao)],
      ['MVP recomendado', ul(d.mvp)], ['Roadmap', ul(d.roadmap)],
      ['Pitch', d.pitch], ['Pitch comercial', d.pitchComercial],
    ]),
    sec(`Prompt de desenvolvimento (nota ${d.qualidadePrompt}/100)`),
    h('pre', { textContent: d.prompt, tabIndex: 0 }));
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  store.registrar({ tipo: 'ideia', titulo: `${d.nome}: ${d.resumo}`, id });
}
function ideaMarkdown(d) {
  return [`# ${d.nome}`, '', `> ${d.nomeAviso}`, '', `**Problema (hipótese):** ${d.problemaDetalhe}`, `**Evidências:** ${d.evidencias.status}`, `**Solução:** ${d.solucao}`, `**Público:** ${d.publico}`, `**Proposta de valor (hipótese):** ${d.propostaValor}`, `**Diferencial (hipótese):** ${d.diferencial}`, `**Concorrentes:** ${d.concorrentes.status} ${d.concorrentes.aviso}`, `**Modelo de negócio:** ${d.modeloNegocio}`, '', '## Validação', ...d.validacao.map(x => `- ${x}`), '', '## MVP', ...d.mvp.map(x => `- ${x}`), '', '## Pitch', d.pitch, '', d.prompt].join('\n');
}

// ---------------------------------------------------------------- hackathon
$('#genHack').onclick = () => {
  const r = hackathonProjects({ regulamento: $('#reg').value, tema: $('#hTema').value, quantidade: 3 });
  const out = [];
  out.push(...r.avisos.map(a => h('p', { className: 'note', textContent: a })));
  if (r.regulamento) {
    const g = r.regulamento;
    out.push(h('section', { className: 'card' }, h('h2', { textContent: 'O que foi lido no regulamento' }), kv([
      ['Tema', g.tema || 'não identificado'],
      ['Critérios', g.criterios.length ? ul(g.criterios.map(c => `${c.texto}${c.peso && !c.texto.includes(c.peso) ? ` (${c.peso})` : ''}`)) : 'não identificados'],
      ['Prazos', g.prazos.join(', ') || 'não identificados'], ['Duração', g.duracaoHoras ? `${g.duracaoHoras} horas` : 'não informada'],
      ['Tecnologias', g.tecnologias.join(', ') || 'não restringidas'], ['Submissão', g.submissao.length ? ul(g.submissao) : 'não identificada'],
      ['Restrições', g.restricoes.length ? ul(g.restricoes) : 'nenhuma identificada'],
    ])));
  }
  r.projetos.forEach(p => {
    const copy = h('button', { className: 'btn ghost sm', type: 'button', textContent: 'Copiar prompt' });
    copy.onclick = async () => { try { await navigator.clipboard.writeText(p.prompt); copy.textContent = 'Copiado ✓'; } catch { copy.textContent = 'Selecione e copie'; } };
    out.push(h('section', { className: 'card' },
      h('div', { className: 'phead' }, h('h2', { textContent: p.nome }), h('div', { className: 'pacts' }, copy)),
      kv([['Problema', p.problema], ['Solução', p.solucao], ['Originalidade', p.originalidade], ['Impacto', p.impacto], ['Arquitetura', p.arquitetura], ['Tecnologias', p.tecnologias], ['MVP', ul(p.mvp)], ['Plano', ul(p.plano)], ['Demonstração', ul(p.demo)], ['Roteiro do pitch (3 min)', ul(p.roteiroPitch)],
        ['Critérios da competição', p.atendimentoCriterios.length ? ul(p.atendimentoCriterios.map(c => `${c.criterio}: ${c.comoAtender}`)) : 'cole o regulamento para mapear os critérios'],
        ['Evolução para startup', p.evolucaoStartup]])));
  });
  $('#hackOut').replaceChildren(...out);
  store.registrar({ tipo: 'hackathon', titulo: r.regulamento?.tema || $('#hTema').value || 'Projetos de hackathon' });
};

// ---------------------------------------------------------------- pesquisa
let fontesInfo = [];
async function health() { try { const r = await fetch('api/health'); return r.ok ? await r.json() : null; } catch { return null; } }
async function loadFontes() {
  const hres = await health();
  fontesInfo = hres?.pesquisa || [];
  const box = $('#fontes');
  if (!fontesInfo.length) { box.replaceChildren(h('span', { className: 'small', textContent: 'Servidor de pesquisa indisponível nesta pré-visualização (as fontes funcionam com o deploy na Vercel).' })); return; }
  box.replaceChildren(...fontesInfo.map(f => h('label', { className: `chk${f.ativo ? '' : ' off'}`, title: f.motivo || f.custo || '' },
    h('input', { type: 'checkbox', value: f.id, checked: f.ativo, disabled: !f.ativo }), f.nome)));
}
loadFontes();
$('#doSearch').onclick = async () => {
  const consulta = $('#q').value.trim();
  const out = $('#searchOut');
  if (consulta.length < 3) { out.replaceChildren(h('p', { className: 'err', textContent: 'Digite pelo menos 3 caracteres.' })); return; }
  const fontes = [...document.querySelectorAll('#fontes input:checked')].map(i => i.value);
  out.replaceChildren(h('p', { className: 'small', textContent: 'Pesquisando…' }));
  try {
    const r = await fetch('api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consulta, fontes: [...fontes, 'reddit', 'producthunt', 'googletrends', 'devpost'] }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || r.status);
    out.replaceChildren(h('p', { className: 'note', textContent: `${j.aviso} Consulta em ${new Date(j.consultadoEm).toLocaleString('pt-BR')}.` }),
      ...j.fontes.map(f => h('section', { className: 'card src' },
        h('h3', {}, f.nome, h('span', { className: 'status', textContent: f.status + (f.cache ? ' (cache)' : '') })),
        f.confiabilidade ? h('p', { className: 'small', textContent: `Confiabilidade: ${f.confiabilidade}` }) : null,
        f.motivo ? h('p', { className: 'small', textContent: f.motivo }) : null,
        f.resultados.length ? h('ul', {}, f.resultados.map(x => h('li', {}, h('a', { href: x.url, textContent: x.titulo, target: '_blank', rel: 'noopener' }), h('small', { textContent: [x.metrica, x.data ? `item de ${new Date(x.data).toLocaleDateString('pt-BR')}` : '', x.resumo].filter(Boolean).join(' · ') })))) : (f.status === 'ok' ? h('p', { className: 'small', textContent: 'Nenhum resultado.' }) : null))));
    store.registrar({ tipo: 'pesquisa', titulo: `Pesquisa: ${consulta}` });
  } catch (e) {
    out.replaceChildren(h('p', { className: 'err', textContent: `Não foi possível pesquisar agora (${e.message}). A pesquisa precisa do servidor (deploy na Vercel ou vercel dev).` }));
  }
};
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') $('#doSearch').click(); });

// ---------------------------------------------------------------- histórico e favoritos
const TIPOS = { prompt: 'Prompt', ideias: 'Ideias', ideia: 'Ideia', hackathon: 'Hackathon', pesquisa: 'Pesquisa' };
function renderStore() {
  const hist = store.historico(), favs = store.favoritos();
  $('#hist').replaceChildren(...(hist.length ? hist.map(x => {
    const li = h('li', {}, h('span', { textContent: `${TIPOS[x.tipo] || x.tipo}: ${x.titulo}` }), h('small', { textContent: new Date(x.em).toLocaleString('pt-BR') }));
    if (x.tipo === 'prompt') { const b = h('button', { className: 'btn ghost sm', type: 'button', textContent: 'Abrir' }); b.onclick = () => { openMod('prompt'); window.dispatchEvent(new CustomEvent('ei:restaurar', { detail: x })); }; li.append(b); }
    if (x.tipo === 'ideia') { const b = h('button', { className: 'btn ghost sm', type: 'button', textContent: 'Abrir' }); b.onclick = () => { openMod('startups'); showIdea(x.id); }; li.append(b); }
    return li;
  }) : [h('li', { textContent: 'Nada por aqui ainda.' })]));
  $('#favs').replaceChildren(...(favs.length ? favs.map(x => {
    const abrir = h('button', { className: 'btn ghost sm', type: 'button', textContent: 'Abrir' }); abrir.onclick = () => { openMod('startups'); showIdea(x.id); };
    const rm = h('button', { className: 'btn ghost sm', type: 'button', textContent: 'Remover' }); rm.onclick = () => { store.desfavoritar(x.chave); renderStore(); };
    return h('li', {}, h('span', { textContent: x.titulo }), abrir, rm);
  }) : [h('li', { textContent: 'Favorite ideias no módulo Startups.' })]));
}
window.addEventListener('ei:store', () => { if (!$('#mod-historico').hidden) renderStore(); });
$('#clrHist').onclick = () => { store.limparHistorico(); renderStore(); };
$('#expHist').onclick = () => download('historico.json', JSON.stringify(store.historico(), null, 2), 'application/json');
$('#expFav').onclick = () => download('favoritos.md', store.favoritos().map(f => `- ${f.titulo}`).join('\n'));

// ---------------------------------------------------------------- configurações
async function loadConfig() {
  const r = await health();
  if (!r) { $('#cfgIA').replaceChildren(h('p', { className: 'small', textContent: 'Servidor indisponível nesta pré-visualização. Faça o deploy (ou rode vercel dev) para ver o estado real.' })); $('#cfgUse').replaceChildren(); $('#cfgSrc').replaceChildren(); return; }
  $('#cfgIA').replaceChildren(r.ia.ativa
    ? kv([['Provedor', r.ia.provedor], ['Modelo', r.ia.modelo], ['Limite por visitante', String(r.ia.limitePorVisitante)], ['Limite diário', String(r.ia.limiteDiario)]])
    : h('p', { textContent: 'IA desativada: o motor local está respondendo. Para ativar, configure AI_PROVIDER, AI_API_KEY e AI_MODEL no servidor.' }));
  $('#cfgUse').replaceChildren(kv(Object.entries(r.consumo).filter(([k]) => k !== 'observacao').map(([k, v]) => [k, `${v} chamada(s)`])), h('p', { className: 'small', textContent: r.consumo.observacao }));
  $('#cfgSrc').replaceChildren(...r.pesquisa.map(p => h('li', {}, h('b', { textContent: `${p.nome} — ${p.ativo ? 'ativo' : 'não integrado'}` }), h('span', { textContent: p.ativo ? `Credencial: ${p.credencial}. Custo: ${p.custo}.` : p.motivo }), p.doc ? h('small', { textContent: p.doc }) : null)));
}
