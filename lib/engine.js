// Engineering Intelligence v2 — motor de raciocínio técnico contextual.
// Pipeline (tudo determinístico, sem IA, roda no navegador e no servidor):
//   Intent → Domain → Expert Routing → Knowledge Mapping → Requirements →
//   Architecture → Security → Standards → Composer → Anti-Repetition →
//   Critical Review → Quality Score → Knowledge Intelligence (aprendizagem).
import { ARCHETYPES, STANDARDS, ALIASES, GENERIC_PHRASES, CONFLICTS } from './knowledge.js';
import { commercialContext, authSpecialist, adminSpecialist, paymentSpecialist, monetizationSpecialist, productJourney, viability } from './specialists.js';

export const VERSION = '3.0.0';
export const MAX_INPUT = 2000;
export const LEVELS = { essencial: 'Essencial', profissional: 'Profissional', avancado: 'Avançado', enterprise: 'Enterprise' };
const LIMITS = {
  essencial: { rf: 5, rnf: 2, normas: 3, ameacas: 2 },
  profissional: { rf: 10, rnf: 4, normas: 5, ameacas: 4 },
  avancado: { rf: 14, rnf: 6, normas: 7, ameacas: 6 },
  enterprise: { rf: 24, rnf: 10, normas: 10, ameacas: 10 },
};
export const DEFAULTS = { maxRevisions: 2 };

// ---------------------------------------------------------------------------
// Texto: normalização, correção de digitação e negações
// ---------------------------------------------------------------------------
export function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s/+.-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const VOCAB = (() => {
  const v = new Set();
  for (const a of ARCHETYPES) for (const t of a.detect) t.split(' ').forEach(w => w.length >= 4 && v.add(w));
  ['desenvolver', 'criar', 'aplicativo', 'plataforma', 'ferramenta', 'sistema', 'seguranca', 'usuarios', 'pagamento', 'agendamento', 'implantar', 'publicar', 'analisar'].forEach(w => v.add(w));
  return [...v];
})();

/** Corrige erros comuns de digitação e transcrição. Devolve texto e correções feitas. */
export function correct(text) {
  const fixes = [];
  const words = normalize(text).split(' ').map(w => {
    if (ALIASES[w]) { if (ALIASES[w] !== w) fixes.push([w, ALIASES[w]]); return ALIASES[w]; }
    if (w.length < 5 || VOCAB.includes(w)) return w;
    let best = null, bd = 9;
    for (const v of VOCAB) { const d = lev(w, v); if (d < bd) { bd = d; best = v; } }
    // não troca flexões da mesma palavra (pesquisar → pesquisa, vendas → venda)
    const inflection = best && (best.startsWith(w.slice(0, -2)) || w.startsWith(best.slice(0, -2))) && Math.abs(best.length - w.length) <= 2 && w.slice(0, 4) === best.slice(0, 4) && bd <= 2 && (w.length - best.length !== 0 || /[rs]$/.test(w) || /[rs]$/.test(best));
    if (best && !inflection && bd <= (w.length >= 8 ? 2 : 1)) { fixes.push([w, best]); return best; }
    return w;
  });
  return { text: words.join(' '), fixes };
}

function has(text, term) {
  const t = term.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${t}($|[^a-z0-9])`).test(text);
}
const hasAny = (text, terms) => terms.some(t => has(text, t));

// "sem backend", "nao precisa de servidor" não devem ativar o arquétipo correspondente
function stripNegations(t) { return t.replace(/\b(sem|nao precisa de|nao quero|exceto)\s+([a-z0-9-]+(\s[a-z0-9-]+)?)/g, ' '); }

// ---------------------------------------------------------------------------
// Intent Intelligence + Domain Intelligence
// ---------------------------------------------------------------------------
const BUILD_VERBS = ['desenvolver', 'criar', 'construir', 'fazer', 'montar', 'programar', 'ferramenta', 'plataforma', 'sistema', 'aplicativo', 'app', 'site', 'software', 'api'];
const RESEARCH_OPS = ['pesquisar vulnerabilidades em', 'testar o programa', 'participar de', 'cacar bugs', 'encontrar vulnerabilidades em', 'pesquisar vulnerabilidades no'];

const SIGNALS = {
  web: ['site', 'loja', 'ecommerce', 'e-commerce', 'portal', 'painel', 'dashboard', 'saas', 'web', 'pagina'],
  personal: ['login', 'cadastro', 'usuario', 'usuarios', 'cliente', 'clientes', 'pacientes', 'alunos', 'conta', 'contas', 'tutores', 'dados pessoais'],
  payments: ['pix', 'pagamento', 'pagamentos', 'cartao', 'checkout', 'assinatura', 'cobranca'],
  enterprise: ['grande empresa', 'corporativo', 'enterprise', 'escala', 'milhoes', 'multi-tenant', 'compliance', 'auditoria', 'iso 27001'],
  simple: ['simples', 'mvp', 'prototipo', 'basico', 'rapido'],
};

export function interpret(pedido) {
  const { text, fixes } = correct(pedido);
  const clean = stripNegations(text);
  const signals = {};
  for (const [k, terms] of Object.entries(SIGNALS)) signals[k] = hasAny(clean, terms);

  const matched = [];
  for (const a of ARCHETYPES) {
    const hits = a.detect.filter(t => has(clean, t));
    if (!hits.length) continue;
    if (a.id === 'correcao-projeto' && hits.every(h => h === 'bug' || h === 'bugs') && has(clean, 'bug bounty')) continue;
    if (a.id === 'github-zip' && !hasAny(clean, ['zip', 'commit', 'branch', 'publicar', 'publica', 'enviar para o github', 'subir para o github'])) continue;
    matched.push({ a, score: hits.length + (hits.some(h => h.includes(' ')) ? 1 : 0), hits });
  }
  // "analisa repositórios e gera relatório de segurança" também é pesquisa de segurança
  if (!matched.find(m => m.a.id === 'pesquisa-seguranca') && has(clean, 'seguranca') && hasAny(clean, ['analisa', 'analisar', 'analise', 'relatorio', 'auditoria'])) {
    matched.push({ a: ARCHETYPES.find(x => x.id === 'pesquisa-seguranca'), score: 1, hits: ['seguranca + analise'] });
  }
  // produto digital (curso, área de membros) não é loja física: "vender" sozinho não ativa e-commerce
  if (matched.some(m => m.a.id === 'produto-digital')) {
    const i = matched.findIndex(m => m.a.id === 'ecommerce');
    if (i >= 0 && matched[i].hits.every(h => ['vender', 'vendas', 'vende', 'produtos'].includes(h))) matched.splice(i, 1);
  }
  // site genérico só entra quando nenhum produto mais específico explica o pedido
  const specific = matched.filter(m => !['site-web', 'dados', 'saas-plataforma'].includes(m.a.id));
  const final = specific.length ? matched.filter(m => !['site-web', 'saas-plataforma'].includes(m.a.id)) : [...matched];
  matched.length = 0; matched.push(...final);
  matched.sort((x, y) => y.score - x.score);

  // repetição dentro do próprio pedido (ex.: "API REST, API REST segura, API REST")
  const ws = clean.split(' ');
  const grams = {};
  for (let i = 0; i + 1 < ws.length; i++) { const g = ws[i] + ' ' + ws[i + 1]; if (ws[i].length > 2 && ws[i + 1].length > 2) grams[g] = (grams[g] || 0) + 1; }
  const repeticoes = Object.entries(grams).filter(([, n]) => n >= 3).map(([g, n]) => `"${g}" aparece ${n} vezes no pedido`);

  const building = hasAny(clean, BUILD_VERBS);
  const researchOp = !building && (hasAny(clean, RESEARCH_OPS) || (matched[0]?.a.id === 'pesquisa-seguranca' && hasAny(clean, ['pesquisar', 'testar', 'cacar'])));

  // Pedido genérico: tenta extrair o objeto ("sistema de agendamento para clínica")
  let objeto = null, publico = null;
  const m = clean.match(/\b(sistema|plataforma|aplicacao|aplicativo|app|site|ferramenta|software|portal|painel|bot|servico|saas|produto|solucao)\s+(?:web\s+)?(?:de|para|que)\s+([a-z0-9 ]{3,60})/);
  if (m) {
    const parts = m[2].split(/\s+para\s+/);
    objeto = parts[0].replace(/\b(um|uma|o|a|os|as|meu|minha)\b/g, ' ').replace(/\s+/g, ' ').trim();
    publico = parts[1] ? parts[1].trim() : null;
  }
  const incompleto = !matched.length && !objeto;
  const conflitos = CONFLICTS.filter(c => hasAny(text, c.a) && hasAny(text, c.b)).map(c => c.msg);
  return { texto: text, correcoes: fixes, signals, arquetipos: matched, building, researchOp, objeto, publico, incompleto, conflitos, repeticoes };
}

export function recommendLevel(it) {
  if (it.signals.enterprise) return 'enterprise';
  if (it.signals.simple || it.incompleto) return 'essencial';
  if (it.arquetipos.length >= 2 || it.arquetipos[0]?.a.id === 'pesquisa-seguranca') return 'avancado';
  return 'profissional';
}

// ---------------------------------------------------------------------------
// Requirement Intelligence (inclui decomposição genérica para pedidos inéditos)
// ---------------------------------------------------------------------------
const tokens = s => new Set(normalize(s).split(' ').filter(w => w.length > 3));
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0;
  let i = 0; for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i);
}

function genericRequirements(it) {
  const obj = it.objeto, pub = it.publico;
  const rf = [
    { core: true, t: `Cadastro e gestão de ${obj}`, f: `Manter os registros de ${obj} que sustentam o produto.`, c: `Criar, listar, editar e arquivar registros de ${obj}, com validação de campos obrigatórios e histórico de alterações.`, in: `Dados de cada registro de ${obj}.`, out: 'Registro salvo e listagem atualizada.', r: 'Exclusão lógica (arquivamento) para não perder histórico.', ac: 'Registro sem campo obrigatório é recusado com mensagem clara; edição gera entrada no histórico.', v: 'Testes de API e de interface para criar, editar e arquivar.', comp: `Módulo de ${obj}`, ctrl: 'Validação de entrada no servidor' },
    { core: true, t: `Busca e filtros de ${obj}`, f: 'Encontrar rapidamente o registro certo.', c: `Buscar ${obj} por texto e filtrar por status e período, com paginação.`, in: 'Termo de busca e filtros.', out: 'Lista paginada.', r: 'Página com tamanho máximo fixo.', ac: 'Busca retorna só registros que correspondem ao termo e aos filtros.', v: 'Testes com massa de dados conhecida.', comp: `Módulo de ${obj}`, ctrl: 'Consultas parametrizadas' },
  ];
  if (pub || it.signals.personal) rf.push({ core: true, t: 'Contas e papéis de acesso', f: `Separar o que cada perfil${pub ? ` (${pub})` : ''} pode ver e fazer.`, c: 'Login com senha forte ou provedor externo, papéis (ex.: administrador, operador, cliente) e permissões por papel.', in: 'Credenciais e papel.', out: 'Sessão autenticada com permissões do papel.', r: 'Cada usuário acessa só os registros permitidos ao seu papel.', ac: 'Operador não acessa telas de administrador (403).', v: 'Testes de autorização por papel.', comp: 'Autenticação e autorização', ctrl: 'RBAC e autorização por objeto' });
  if (/agend|consulta|horario|reserva/.test(obj)) {
    rf.push({ core: true, t: 'Agenda e disponibilidade', f: 'Evitar conflitos de horário.', c: 'Definir horários disponíveis, marcar, remarcar e cancelar, bloqueando sobreposição.', in: 'Data, horário, recurso/profissional.', out: 'Agendamento confirmado ou conflito explicado.', r: 'Dois agendamentos no mesmo horário e recurso são impossíveis.', ac: 'Tentativa de agendar horário ocupado é recusada.', v: 'Teste de concorrência em horário disputado.', comp: 'Agenda', ctrl: 'Transação no banco' });
    rf.push({ t: 'Lembretes automáticos', f: 'Reduzir faltas.', c: 'Enviar lembrete por e-mail ou mensagem antes do horário, com opção de confirmar ou cancelar.', in: 'Agendamentos futuros e contato.', out: 'Lembrete enviado e status registrado.', r: 'Envio só para quem consentiu.', ac: 'Lembrete sai no prazo configurado para agendamentos confirmados.', v: 'Teste com relógio simulado.', comp: 'Agenda', ctrl: 'Consentimento registrado' });
  }
  rf.push({ t: `Relatórios de ${obj}`, f: 'Apoiar decisões com dados.', c: `Exibir indicadores de ${obj} por período e exportar CSV.`, in: 'Período e filtros.', out: 'Painel e arquivo exportado.', r: 'Exportação respeita as permissões do usuário.', ac: 'Totais do relatório batem com a contagem no banco.', v: 'Teste de reconciliação.', comp: 'Relatórios', ctrl: 'Controle de acesso na exportação' });
  return {
    id: 'generico', nome: `Sistema de ${obj}`, produto: `sistema de ${obj}${pub ? ` para ${pub}` : ''}`,
    dominios: { principal: 'Engenharia de Software', secundarios: ['Application Security'], operacao: 'Gestão de informação' },
    especialistas: ['Engenheiro(a) full stack', 'Especialista em AppSec', 'Especialista em UX'],
    componentes: [`Módulo de ${obj}`, 'Autenticação e autorização', ...(rf.some(r => r.comp === 'Agenda') ? ['Agenda'] : []), 'Relatórios'],
    rf, rnf: [{ t: 'Usabilidade', m: 'Tarefas principais concluídas em até 3 telas.' }, { t: 'Desempenho', m: 'Listagens respondem em até 1 s com o volume esperado.' }],
    ameacas: [{ a: 'Acesso indevido a registros', c: 'Autorização por objeto e por papel' }, { a: 'Injeção via campos de formulário', c: 'Validação e consultas parametrizadas' }],
    normas: ['asvs', 'top10', 'ssdf', ...(it.signals.personal || pub ? ['lgpd'] : []), 'wcag'],
    tech: [{ i: 'Aplicação web com backend (ex.: FastAPI ou Node.js) e PostgreSQL', p: 'cobre cadastro, autenticação e relatórios sem complexidade extra' }],
    glossario: [['CRUD', 'criar, ler, atualizar e remover registros'], ['RBAC', 'controle de acesso baseado em papéis']],
    comandos: [], erros: [], exercicios: [`Modele as tabelas de ${obj} e escreva o teste de busca.`],
    perguntas: [`Quais informações cada registro de ${obj} precisa ter?`, 'Quantos usuários e quais perfis de acesso?'],
    derivado: true,
  };
}

const AUTH_RF = { core: true, t: 'Autenticação de usuários', f: 'Identificar quem usa o sistema.', c: 'Cadastro e login com senha armazenada com hash forte (Argon2id/bcrypt), recuperação de senha por link de uso único e bloqueio após tentativas repetidas.', in: 'E-mail e senha.', out: 'Sessão autenticada.', r: 'Mensagens de erro não revelam se o e-mail existe.', ac: '10 tentativas erradas seguidas bloqueiam temporariamente a conta.', v: 'Testes de força bruta e de recuperação de senha.', comp: 'Autenticação e autorização', ctrl: 'Hash de senha, rate limiting, sessão segura' };
const PRIVACY_RF = { t: 'Direitos do titular de dados', f: 'Atender à LGPD.', c: 'Permitir exportar e excluir os dados pessoais da conta, com registro do pedido.', in: 'Pedido do titular autenticado.', out: 'Arquivo exportado ou conta anonimizada.', r: 'Dados exigidos por lei (ex.: fiscais) ficam retidos pelo prazo legal.', ac: 'Após exclusão, os dados pessoais não aparecem em nenhuma consulta.', v: 'Teste do fluxo de exclusão e busca no banco.', comp: 'Área do usuário', ctrl: 'Minimização e anonimização' };

// ---------------------------------------------------------------------------
// Composição com anti-repetição
// ---------------------------------------------------------------------------
function mergeUnique(list, keyFn, threshold, log, what) {
  const out = [];
  for (const item of list) {
    // itens marcados como distintos (ex.: um login por provedor) só são unificados se o título for idêntico
    const dup = out.find(o => (item.distinto || o.distinto) ? o.t === item.t : similarity(keyFn(o), keyFn(item)) >= threshold);
    if (dup) { log.push(`${what} semelhante unificado: "${keyFn(item).slice(0, 60)}"`); continue; }
    out.push(item);
  }
  return out;
}
const pad = n => String(n).padStart(3, '0');

function build(it, nivel, log, ctx) {
  const L = LIMITS[nivel];
  let arqs = it.arquetipos.map(m => m.a);
  // só arquétipos genéricos (SaaS, site)? o objeto do pedido (ex.: agendamento) vira o domínio principal
  if (it.objeto && arqs.every(a => ['saas-plataforma', 'site-web'].includes(a.id))) arqs = [genericRequirements(it), ...arqs];
  const primary = arqs[0];
  if (!primary) return { arqs: [], primary: null, rf: [], rnf: [], ameacas: [], normas: [], especialistas: ['Analista de requisitos', 'Arquiteto(a) de software'], componentes: [], tech: [], dominios: null, perguntas: [], auth: null, admin: null, pay: null, monetizacao: null, jornada: null, viabilidade: null };

  // especialistas transversais (autenticação, administração, pagamentos)
  const t = it.texto;
  const auth = authSpecialist(t, it.signals);
  const admin = adminSpecialist(t, it.signals, ctx);
  const pay = paymentSpecialist(t, it.signals, ctx);
  const spec = [...(auth ? auth.rf.map(r => ({ ...r, origem: 'Especialista em autenticação' })) : []), ...(admin ? admin.rf.map(r => ({ ...r, origem: 'Especialista em painéis administrativos' })) : []), ...(pay ? pay.rf.map(r => ({ ...r, origem: 'Especialista em pagamentos e webhooks' })) : [])];
  const archRF = arqs.flatMap(a => a.rf.map(r => ({ ...r, origem: a.nome })))
    .filter(r => !(admin && /painel administrativo/i.test(r.t)))
    .filter(r => !(auth && /^(autenticacao de usuarios|contas e papeis de acesso)$/.test(normalize(r.t))));
  let rf = [...archRF.filter(r => r.core), ...spec.filter(r => r.core), ...archRF.filter(r => !r.core), ...spec.filter(r => !r.core)];
  const hasAuth = rf.some(r => /autentica|login|contas e papeis|area do cliente|cadastro e login/.test(normalize(r.t)));
  if ((it.signals.personal || it.signals.payments) && !hasAuth) rf.splice(1, 0, { ...AUTH_RF, origem: 'requisito transversal' });
  if (it.signals.personal && nivel !== 'essencial') rf.push({ ...PRIVACY_RF, origem: 'requisito transversal (LGPD)' });
  rf = mergeUnique(rf, r => `${r.t} ${r.c}`, 0.55, log, 'Requisito');
  if (nivel === 'essencial') rf = rf.filter(r => r.core);
  // requisitos principais (core) nunca são cortados; o limite do nível vale para os complementares
  rf = rf.slice(0, Math.max(L.rf, rf.filter(r => r.core).length)).map((r, i) => ({ id: `RF-${pad(i + 1)}`, teste: `T-${pad(i + 1)}`, ...r }));

  const rnf = mergeUnique(arqs.flatMap(a => a.rnf), r => r.t + ' ' + r.m, 0.5, log, 'Requisito não funcional').slice(0, L.rnf).map((r, i) => ({ id: `RNF-${pad(i + 1)}`, ...r }));
  const ameacas = mergeUnique(arqs.flatMap(a => a.ameacas), x => x.a, 0.5, log, 'Ameaça').slice(0, L.ameacas).map((x, i) => ({ id: `AM-${pad(i + 1)}`, ...x }));

  // Standards Mapping: só os ligados a arquétipos ativos ou a sinais concretos
  const keys = [];
  const push = k => { if (STANDARDS[k] && !keys.includes(k)) keys.push(k); };
  arqs.forEach(a => a.normas.forEach(push));
  if (auth) auth.normas.forEach(push);
  if (it.signals.personal) push('lgpd');
  if (it.signals.payments) push('pci');
  if (nivel === 'enterprise') { push('iso27001'); push('csf'); }
  // normas exigidas pelo próprio pedido (dados pessoais, pagamento) nunca são cortadas pelo limite
  const must = new Set([it.signals.personal && 'lgpd', it.signals.payments && 'pci'].filter(Boolean));
  let chosen = keys.slice(0, L.normas);
  for (const k of must) if (keys.includes(k) && !chosen.includes(k)) {
    const drop = [...chosen].reverse().find(x => !must.has(x));
    chosen = chosen.filter(x => x !== drop); chosen.push(k);
  }
  const normas = chosen.map(k => ({ chave: k, ...STANDARDS[k] }));

  const especialistas = [...new Set([...arqs.flatMap(a => a.especialistas), ...(auth ? ['Especialista em identidade e autenticação'] : []), ...(admin ? ['Especialista em painéis administrativos'] : []), ...(pay ? ['Especialista em pagamentos e webhooks'] : []), ...(ctx.comercial ? ['Estrategista de produto e monetização'] : [])])];
  const componentes = [...new Set([...arqs.flatMap(a => a.componentes), ...(auth ? ['Serviço de identidade'] : []), ...(admin ? ['Painel administrativo'] : []), ...(pay ? ['Gateway de webhooks', 'Fila de processamento', 'Serviço de assinaturas'] : [])])];
  const tech = mergeUnique(arqs.flatMap(a => a.tech), x => x.i, 0.6, log, 'Tecnologia');
  const dominios = {
    principal: primary.dominios.principal,
    secundarios: [...new Set(arqs.flatMap(a => [a.dominios.principal, ...a.dominios.secundarios]).filter(d => d !== primary.dominios.principal))],
    especializacao: primary.dominios.especializacao || null,
    operacao: primary.dominios.operacao,
    produto: arqs.map(a => a.produto).join(' + '),
  };
  const perguntas = [...new Set(arqs.flatMap(a => a.perguntas))].slice(0, nivel === 'essencial' ? 2 : 4);
  const out = { arqs, primary, rf, rnf, ameacas, normas, especialistas, componentes, tech, dominios, perguntas, auth, admin, pay };
  out.monetizacao = monetizationSpecialist(t, it.signals, ctx, arqs.map(a => a.id));
  out.jornada = productJourney(ctx, auth, pay);
  out.viabilidade = viability(out, { auth, admin, pay });
  return out;
}

// ---------------------------------------------------------------------------
// Contextual Prompt Composer (seções dinâmicas)
// ---------------------------------------------------------------------------
const bullets = xs => xs.map(x => `- ${x}`).join('\n');

function composePrompt(it, nivel, b) {
  const S = [];
  const add = (titulo, corpo) => { if (corpo && corpo.trim()) S.push([titulo, corpo.trim()]); };
  const render = titulo => `# ${titulo}\n\n${S.map(([t, c], i) => `## ${i + 1}. ${t}\n${c}`).join('\n\n')}\n`;
  if (it.incompleto) {
    add('Executor', 'Atue como analista de requisitos e arquiteto(a) de software.');
    add('Situação', 'O pedido ainda não define o que o sistema deve fazer. Antes de qualquer código, conduza uma descoberta de requisitos.');
    add('Perguntas obrigatórias', bullets(['Qual problema o sistema resolve e para quem?', 'Quais são as 3 tarefas mais importantes que o usuário fará?', 'Haverá contas de usuário, pagamentos ou dados pessoais?', 'Onde vai rodar (web, celular, servidor interno)?']));
    add('Entregável desta etapa', 'Documento de requisitos com funcionalidades numeradas (RF-xxx), critérios de aceitação e riscos. Só depois gerar o plano de implementação.');
    return render('Prompt técnico — descoberta de requisitos');
  }
  const { primary, rf, rnf, ameacas, normas, especialistas, componentes, tech, dominios } = b;
  const op = it.researchOp;
  add('Executor', `Atue como uma equipe formada por: ${especialistas.join(', ')}.`);
  add('Objetivo', op
    ? 'Conduzir pesquisa de segurança autorizada, do escopo ao relatório, sem testes fora das regras do programa.'
    : `Construir ${dominios.produto}, com requisitos verificáveis, segurança desde a concepção e evidência de funcionamento.`);
  add('Classificação do projeto', bullets([`Domínio principal: ${dominios.principal}`, `Domínios complementares: ${dominios.secundarios.join(', ') || '—'}`, dominios.especializacao ? `Especialização: ${dominios.especializacao}` : null, `Operação: ${dominios.operacao}`, `Nível de profundidade: ${LEVELS[nivel]}`].filter(Boolean)));
  if (it.conflitos.length) add('Conflitos a resolver antes de implementar', bullets(it.conflitos));
  add(op ? 'Atividades e entregas da pesquisa' : 'Requisitos funcionais', rf.map(r => [
    `### ${r.id} — ${r.t}`,
    `- Finalidade: ${r.f}`, `- Comportamento esperado: ${r.c}`, `- Entradas: ${r.in}`, `- Saídas: ${r.out}`,
    `- Restrições: ${r.r}`, `- Critério de aceitação: ${r.ac}`, `- Validação (${r.teste}): ${r.v}`,
  ].join('\n')).join('\n\n'));
  if (rnf.length) add('Requisitos não funcionais', bullets(rnf.map(r => `${r.id} — ${r.t}: ${r.m}`)));
  if (!op) add('Arquitetura proporcional', [
    `Componentes: ${componentes.join(' · ')}.`,
    componentes.length <= 6 ? 'Comece com uma aplicação modular única (monólito modular); separe em serviços só quando uma métrica justificar.' : 'Organize os componentes em módulos com fronteiras claras; extraia serviços apenas onde houver necessidade medida de escala ou isolamento.',
  ].join('\n'));
  if (tech.length) add('Tecnologias e justificativas', bullets(tech.map(t => `${t.i} — ${t.p}`)) + '\nTroque qualquer escolha se o contexto pedir, registrando o motivo.');
  if (ameacas.length && nivel !== 'essencial') add('Modelo de ameaças (resumo)', bullets(ameacas.map(x => `${x.id} — ${x.a} → controle: ${x.c}`)));
  if (b.auth) add('Identidade e acesso — controles obrigatórios', bullets(b.auth.controles) + (b.auth.docs.length ? `\nDocumentação oficial dos provedores:\n${bullets(b.auth.docs)}` : '') + '\nNão crie criptografia própria; use bibliotecas consolidadas e os fluxos oficiais de cada provedor.');
  if (b.admin && nivel !== 'essencial') add('Painel administrativo', bullets(b.admin.modulos) + '\nSegurança do painel: MFA para administradores, permissões checadas no backend, reautenticação para ações críticas, auditoria de todas as ações, mascaramento de dados sensíveis, proteção contra IDOR e isolamento entre organizações. Administradores nunca veem senhas.');
  if (b.pay) add('Pagamentos e webhooks', [b.pay.plataformas.length ? `Plataformas: ${b.pay.plataformas.map(p => p.nome).join(', ')}.` : 'Plataforma de pagamento ainda não definida.', ...b.pay.confirmacoes, bullets(b.pay.pendencias), b.pay.docs.length ? `Documentação oficial:\n${bullets(b.pay.docs)}` : ''].filter(Boolean).join('\n'));
  if (b.jornada) add('Jornada completa do produto', b.jornada.map(j => `${j.ordem}. ${j.etapa}: ${j.componente}`).join('\n'));
  if (b.monetizacao) add('Monetização (cenários hipotéticos)', [bullets(b.monetizacao.modelos.map(m => `${m.nome}: indicado quando há ${m.quando}`)), bullets(b.monetizacao.precificacao), b.monetizacao.cenario, `Métricas: ${b.monetizacao.metricas.join('; ')}.`, b.monetizacao.aviso].join('\n'));
  if (b.viabilidade && nivel !== 'essencial') add('Viabilidade', bullets([`Complexidade: ${b.viabilidade.complexidade}`, `Tempo de MVP: ${b.viabilidade.mvp}`, `Custo inicial: ${b.viabilidade.custoInicial}`, `Custo mensal: ${b.viabilidade.custoMensal}`, b.viabilidade.dependencias.length ? `Dependências externas: ${b.viabilidade.dependencias.join('; ')}` : 'Sem dependências externas pagas obrigatórias', `Validação recomendada: ${b.viabilidade.validacao}`, `Premissas: ${b.viabilidade.premissas.join(' ')}`]));
  add('Referenciais aplicáveis', normas.map(n => [
    `### ${n.nome}`, `- Motivo: ${n.motivo}`, `- Requisito aplicável: ${n.req}`, `- Controle técnico: ${n.ctrl}`,
    `- Implementação: ${n.impl}`, `- Verificação: ${n.verif}`, `- Evidência esperada: ${n.evid}`,
  ].join('\n')).join('\n\n') + '\n\nNão declare conformidade ou certificação sem auditoria formal; cite identificadores de controles só a partir da fonte oficial.');
  if (nivel !== 'essencial') add('Matriz de rastreabilidade', ['| Requisito | Componente | Controle | Teste | Aceitação |', '|---|---|---|---|---|', ...rf.map(r => `| ${r.id} | ${r.comp} | ${r.ctrl} | ${r.teste} | ${r.ac.replace(/\|/g, '/')} |`)].join('\n'));
  if (!op) add('Pipeline e implantação', bullets([
    'CI a cada push: lint, testes dos requisitos (T-xxx) e build.',
    'Gates: SAST, SCA e varredura de segredos bloqueando achados críticos/altos.',
    nivel === 'essencial' ? 'Deploy simples com rollback documentado.' : 'Ambientes de homologação e produção separados, deploy com aprovação e rollback testado.',
  ]));
  if (nivel === 'enterprise') {
    add('Confiabilidade e operação', bullets(['Definir SLOs (disponibilidade e latência) e alertas baseados neles.', 'Plano de continuidade com RPO/RTO definidos e restauração testada.', 'Runbooks de incidente e revisão pós-incidente sem culpados.']));
    add('Governança', bullets(['Registro de riscos e decisões de arquitetura (ADR).', 'Gestão de mudanças com revisão obrigatória.', 'Trilha de auditoria de acessos administrativos.']));
  }
  if (b.perguntas.length) add('Informações ausentes (assuma um padrão razoável e declare)', bullets(b.perguntas));
  add('Entregáveis', bullets(op
    ? ['Relatório por achado validado (passos, evidência, impacto, CWE, CVSS justificado, correção).', 'Registro dos testes executados e do escopo usado.']
    : ['Código-fonte versionado com histórico de commits.', `Testes automatizados cobrindo ${rf.map(r => r.teste).join(', ')}.`, 'Pipeline de CI/CD funcionando.', 'Documentação: README, decisões de arquitetura e, se houver API, contrato OpenAPI.']));
  add('Regras de honestidade', bullets(['Não invente resultados, testes ou funcionalidades.', 'Separe o que foi implementado, o que foi testado e o que ficou pendente.', 'Se algo não puder ser feito, explique o motivo e a alternativa.']));
  return render(`Prompt técnico — ${primary.nome}${b.arqs.length > 1 ? ` + ${b.arqs.slice(1).map(a => a.nome).join(' + ')}` : ''}`);
}

// ---------------------------------------------------------------------------
// Anti-Repetition Engine (sobre o texto final)
// ---------------------------------------------------------------------------
const LABEL = /^- (finalidade|comportamento esperado|entradas|saidas|restricoes|criterio de aceitacao|validacao \(t-\d+\)|motivo|requisito aplicavel|controle tecnico|implementacao|verificacao|evidencia esperada):/;
export function antiRepetition(prompt, pedido) {
  const out = [], removed = [], generic = [], seen = [];
  const ped = normalize(pedido);
  for (const line of prompt.split('\n')) {
    const n = normalize(line);
    const isItem = /^\s*-\s/.test(line) && n.length > 25;
    if (GENERIC_PHRASES.some(g => n.includes(g))) { generic.push(line.trim()); continue; }
    if (isItem && ped.length > 12 && n.includes(ped)) { generic.push(line.trim()); continue; }
    const raw = line.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (isItem && LABEL.test(raw)) { out.push(line); continue; } // campos de um requisito/referencial pertencem a ele
    if (isItem) {
      const body = n;
      if (seen.some(s => s === body || (body.length > 40 && similarity(s, body) >= 0.85))) { removed.push(line.trim()); continue; }
      seen.push(body);
    }
    out.push(line);
  }
  return { prompt: out.join('\n'), removidas: removed, genericas: generic };
}

// ---------------------------------------------------------------------------
// Critical Review + Quality Validation
// ---------------------------------------------------------------------------
const FIELDS = ['t', 'f', 'c', 'in', 'out', 'r', 'ac', 'v'];
function reviewChecks(a) {
  const rf = a.requisitos;
  const inc = a.interpretacao.incompleto;
  return [
    { q: 'A intenção foi compreendida?', ok: !inc, nota: inc ? 'Pedido incompleto: o prompt pede descoberta de requisitos.' : `Arquétipos: ${a.arquetipos.join(', ')}.` },
    { q: 'Os requisitos são específicos?', ok: inc || (rf.length > 0 && rf.every(r => FIELDS.every(k => r[k] && r[k].length > 3))), nota: `${rf.length} requisitos com 8 campos.` },
    { q: 'Existem requisitos duplicados?', ok: !rf.some((r, i) => rf.some((s, j) => j > i && (r.distinto || s.distinto ? r.t === s.t : similarity(r.t + ' ' + r.c, s.t + ' ' + s.c) >= 0.55))), nota: 'Comparação por similaridade de título e comportamento.' },
    { q: 'O pedido foi apenas repetido como requisito?', ok: !rf.some(r => a.pedido.length > 12 && normalize(r.c).includes(normalize(a.pedido))), nota: 'Nenhum requisito pode ser cópia do pedido.' },
    { q: 'As tecnologias têm justificativa?', ok: a.tecnologias.every(t => t.p), nota: `${a.tecnologias.length} tecnologias justificadas.` },
    { q: 'As normas são pertinentes?', ok: inc || a.normas.length > 0, nota: 'Selecionadas a partir dos arquétipos e dos sinais (dados pessoais, pagamentos).' },
    { q: 'Há conflitos no pedido?', ok: true, nota: a.interpretacao.conflitos.length ? `${a.interpretacao.conflitos.length} conflito(s) registrado(s) no prompt.` : 'Nenhum conflito detectado.' },
    { q: 'Os critérios de aceitação são verificáveis?', ok: rf.every(r => r.teste && r.v), nota: 'Cada requisito tem teste identificado.' },
    { q: 'A arquitetura é proporcional?', ok: a.componentes.length <= 14, nota: `${a.componentes.length} componentes.` },
  ];
}

export function scoreQuality(a, rev) {
  const rf = a.requisitos, def = [], crit = [];
  const inc = a.interpretacao.incompleto, derivado = a.derivado;
  let s1 = inc ? 4 : derivado ? 10 : 15;
  if (!inc && a.perguntas.length) { s1 -= Math.min(2, a.perguntas.length); def.push(`${a.perguntas.length} informação(ões) ausente(s) substituída(s) por premissas; confirme-as.`); }
  if (a.interpretacao.repeticoesNoPedido.length) def.push('O pedido tem trechos repetidos; foram considerados uma única vez.');
  if (!inc && a.interpretacao.conflitos.length) s1 -= 3;
  crit.push(['Compreensão da intenção', s1, 15]);
  if (inc) def.push('Pedido incompleto: sem objeto definido; o prompt gerado é de descoberta.');
  else if (derivado) def.push('Domínio não cadastrado: requisitos obtidos por decomposição genérica; revise os nomes das entidades.');
  const complete = rf.filter(r => FIELDS.every(k => r[k] && r[k].length > 10)).length;
  let s2 = rf.length ? Math.round(20 * complete / rf.length) : 0; if (derivado) s2 = Math.min(s2, 15);
  crit.push(['Especificidade técnica', s2, 20]);
  let s3 = rf.length ? Math.min(15, Math.round(15 * Math.min(1, rf.length / 4))) : 0;
  if (rev.some(c => c.q.startsWith('O pedido') && !c.ok)) { s3 -= 5; def.push('Há requisito que repete o pedido.'); }
  crit.push(['Engenharia de requisitos', Math.max(0, s3), 15]);
  let s4 = inc ? 2 : a.componentes.length ? (a.tecnologias.length ? 10 : 7) : 4;
  if (!inc && !a.naoFuncionais.some(r => /\d/.test(r.m))) { s4 -= 2; def.push('Requisitos não funcionais sem metas numéricas.'); }
  crit.push(['Arquitetura', s4, 10]);
  const fullStd = a.normas.filter(n => n.porque && n.requisito && n.controle && n.implementacao && n.verificacao && n.evidencia).length;
  let s5 = a.normas.length ? Math.round(10 * fullStd / a.normas.length) + (a.ameacas.length ? 5 : (a.nivel === 'essencial' ? 3 : 0)) : 0;
  if (!a.ameacas.length && a.nivel !== 'essencial' && !inc) def.push('Sem modelo de ameaças.');
  const semCtrl = rf.filter(r => r.core && (!r.ctrl || r.ctrl === '—')).length;
  if (semCtrl) { s5 -= Math.min(3, semCtrl); def.push(`${semCtrl} requisito(s) principal(is) sem controle de segurança associado.`); }
  crit.push(['Segurança e referenciais', Math.max(0, Math.min(15, s5)), 15]);
  crit.push(['Testabilidade', rf.length ? Math.round(10 * rf.filter(r => r.teste && r.v && r.ac).length / rf.length) : 0, 10]);
  const rem = a.antirrepeticao.removidas.length + a.antirrepeticao.genericas.length;
  if (rem) def.push(`${rem} linha(s) repetida(s) ou genérica(s) removida(s) na revisão.`);
  crit.push(['Ausência de redundância', Math.max(0, 10 - 2 * rem), 10]);
  const w = a.prompt.split(/\s+/).length;
  const [lo, hi] = { essencial: [120, 1800], profissional: [300, 4000], avancado: [450, 5500], enterprise: [600, 8000] }[a.nivel];
  const s8 = w >= lo && w <= hi ? 5 : 3; if (s8 < 5) def.push(`Tamanho fora da faixa esperada para o nível (${w} palavras).`);
  crit.push(['Clareza e aplicabilidade', s8, 5]);
  if (a.interpretacao.conflitos.length) def.push('Conflitos no pedido precisam de decisão humana.');
  return { total: crit.reduce((x, c) => x + c[1], 0), criterios: crit.map(([nome, pontos, max]) => ({ nome, pontos, max })), deficiencias: def, aviso: 'A nota mede o atendimento aos critérios definidos; não garante a qualidade ou a segurança do software final.' };
}

// ---------------------------------------------------------------------------
// Knowledge Intelligence (aprendizagem)
// ---------------------------------------------------------------------------
function learning(b) {
  if (!b.arqs.length) return null;
  const comp = b.componentes;
  const esc = s => s.replace(/[[\]()]/g, '');
  const diagrama = ['flowchart LR', `  U[Usuário] --> C1[${esc(comp[0])}]`, ...comp.slice(1).map((c, i) => `  C${i + 1} --> C${i + 2}[${esc(c)}]`)].join('\n');
  return {
    conceitos: b.normas.map(n => `${n.nome}: ${n.motivo}`),
    glossario: [...b.arqs.flatMap(x => x.glossario), ...(b.auth ? b.auth.glossario : [])].map(([termo, definicao]) => ({ termo, definicao })),
    documentacao: [...(b.auth ? b.auth.docs : []), ...(b.pay ? b.pay.docs : [])],
    prerequisitos: [...new Set(b.arqs.flatMap(x => x.glossario.map(g => g[0])))].slice(0, 6).map(t => `Entender: ${t}`),
    diagrama,
    fluxo: `O usuário interage com ${comp[0]}; os dados passam por ${comp.slice(1, -1).join(', ') || 'o núcleo da aplicação'} e terminam em ${comp[comp.length - 1]}. Cada passo tem um requisito (RF) e um teste (T) associados.`,
    decisoes: b.tech.map(t => `${t.i}: ${t.p}`),
    comandos: b.arqs.flatMap(x => x.comandos),
    erros: b.arqs.flatMap(x => x.erros).map(([sintoma, causa]) => ({ sintoma, causa })),
    exercicios: b.arqs.flatMap(x => x.exercicios),
    validacaoIndependente: b.rf.slice(0, 3).map(r => `${r.teste}: ${r.v}`),
    status: { gerado: 'Requisitos, arquitetura e referenciais foram gerados pela ferramenta.', validado: 'Nada foi executado: nenhuma parte deste plano foi validada em código ainda.', estudar: 'Revise conceitos e glossário antes de aceitar as decisões técnicas.' },
  };
}

// ---------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------
const MODES = { descoberta: 'Descoberta de requisitos', pesquisa: 'Pesquisa de vulnerabilidades', melhoria: 'Melhoria de projeto existente', infra: 'Infraestrutura e deploy', ia: 'Inteligência artificial', desenvolvimento: 'Desenvolvimento' };

export function analyze(pedidoBruto, opts = {}) {
  const pedido = String(pedidoBruto || '').trim().slice(0, MAX_INPUT);
  if (pedido.length < 5) throw new Error('Descreva o que você quer fazer em pelo menos uma frase.');
  const maxRevisions = Math.max(1, Math.min(5, opts.maxRevisions ?? DEFAULTS.maxRevisions));
  const it = interpret(pedido);
  const recomendado = recommendLevel(it);
  const nivel = LEVELS[opts.nivel] ? opts.nivel : recomendado;
  const log = [];
  const ctx = commercialContext(it.texto, opts.comercial);
  const b = build(it, nivel, log, ctx);
  const pid = b.primary?.id;
  const mode = it.incompleto ? 'descoberta' : it.researchOp ? 'pesquisa' : pid === 'correcao-projeto' ? 'melhoria' : (pid === 'deploy-vps' || pid === 'pipeline-devsecops') ? 'infra' : pid === 'plataforma-ia' ? 'ia' : 'desenvolvimento';

  const a = {
    versao: VERSION, pedido, nivel, nivelRecomendado: recomendado, mode, modo: MODES[mode],
    interpretacao: { correcoes: it.correcoes, repeticoesNoPedido: it.repeticoes, conflitos: it.conflitos, incompleto: it.incompleto, objeto: it.objeto, publico: it.publico, construindo: it.building },
    arquetipos: b.arqs.map(x => x.nome), derivado: !!b.arqs[0]?.derivado,
    classificacao: b.dominios, especialidades: b.especialistas, componentes: b.componentes,
    requisitos: b.rf, naoFuncionais: b.rnf, ameacas: b.ameacas, tecnologias: b.tech,
    perguntas: it.incompleto ? ['Qual problema o sistema resolve e para quem?', 'Quais as principais tarefas do usuário?', 'Haverá contas, pagamentos ou dados pessoais?'] : b.perguntas,
    normas: b.normas.map(n => ({ nome: n.nome, porque: n.motivo, requisito: n.req, controle: n.ctrl, implementacao: n.impl, verificacao: n.verif, evidencia: n.evid })),
    comercial: ctx,
    autenticacao: b.auth ? { provedores: b.auth.sociais.map(p => p.nome), controles: b.auth.controles, documentacao: b.auth.docs } : null,
    painelAdmin: b.admin ? { modulos: b.admin.modulos } : null,
    pagamentos: b.pay ? { plataformas: b.pay.plataformas, confirmacoes: b.pay.confirmacoes, pendencias: b.pay.pendencias, documentacao: b.pay.docs } : null,
    monetizacao: b.monetizacao, jornada: b.jornada, viabilidade: b.viabilidade,
    objetivo: it.incompleto ? 'Pedido ainda sem objeto definido: primeiro levantar requisitos.' : it.researchOp ? 'Conduzir pesquisa de segurança autorizada, do escopo ao relatório.' : `Construir ${b.dominios.produto}.`,
  };

  // Composer → Anti-repetição → Revisão crítica, com limite de rodadas
  const rodadas = [];
  let ar;
  for (let i = 0; i < maxRevisions; i++) {
    ar = antiRepetition(composePrompt(it, nivel, b), pedido);
    a.requisitos = b.rf;
    a.prompt = ar.prompt;
    a.antirrepeticao = { removidas: ar.removidas, genericas: ar.genericas, unificadas: [...log] };
    const falhas = reviewChecks(a).filter(c => !c.ok).map(c => c.q);
    rodadas.push({ rodada: i + 1, falhas });
    if (!falhas.some(q => /duplicados|repetido/.test(q))) break;
    const before = b.rf.length;
    b.rf = mergeUnique(b.rf, r => r.t + ' ' + r.c, 0.5, log, 'Requisito (revisão)').map((r, k) => ({ ...r, id: `RF-${pad(k + 1)}`, teste: `T-${pad(k + 1)}` }));
    if (b.rf.length === before) break;
  }
  a.revisao = { checagens: reviewChecks(a), rodadas, limite: maxRevisions };
  a.rastreabilidade = b.rf.map(r => ({ requisito: r.id, componente: r.comp, controle: r.ctrl, teste: r.teste, aceitacao: r.ac, evidencia: `Saída do teste ${r.teste} no CI` }));
  a.qualidade = scoreQuality(a, a.revisao.checagens);
  a.aprendizagem = learning(b);
  a.entregaveis = it.researchOp
    ? ['Relatório por achado validado (passos, evidência, impacto, CWE, CVSS, correção).', 'Registro dos testes e do escopo usado.']
    : it.incompleto ? ['Documento de requisitos numerados com critérios de aceitação.'] : ['Código-fonte versionado.', `Testes automatizados ${b.rf.map(r => r.teste).join(', ')}.`, 'Pipeline de CI/CD.', 'Documentação técnica.'];
  a.validacao = b.rf.length ? b.rf.slice(0, 5).map(r => `${r.id}: ${r.ac}`) : ['Respostas às perguntas obrigatórias registradas.'];
  a.signals = it.signals;
  return a;
}
