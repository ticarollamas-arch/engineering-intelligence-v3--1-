// Gerador universal de ideias de startups e projetos de hackathon.
// As ideias NÃO ficam guardadas: cada índice corresponde a uma combinação
// válida de problema × segmento × abordagem × variações, calculada sob demanda.
// Nada aqui é pesquisa de mercado: problemas são hipóteses a validar.
import { analyze, normalize, similarity } from './engine.js';

const SEGMENTS = [
  ['clínicas veterinárias', 'Vet', ['saude', 'servicos']], ['consultórios de psicologia', 'Psi', ['saude', 'servicos']], ['clínicas odontológicas', 'Odonto', ['saude', 'servicos']],
  ['salões de beleza', 'Beleza', ['beleza', 'servicos']], ['barbearias', 'Barber', ['beleza', 'servicos']], ['estúdios de pilates e academias', 'Fit', ['saude', 'servicos']],
  ['escolas de idiomas', 'Idiomas', ['educacao']], ['professores autônomos', 'Prof', ['educacao', 'servicos']], ['cursinhos e reforço escolar', 'Edu', ['educacao']],
  ['restaurantes', 'Resto', ['alimentacao', 'varejo']], ['food trucks', 'Truck', ['alimentacao', 'varejo']], ['padarias', 'Pao', ['alimentacao', 'varejo']],
  ['lojas que vendem pelo Instagram', 'Insta', ['varejo']], ['pequenos e-commerces', 'Shop', ['varejo', 'tech']], ['pet shops', 'Pet', ['varejo', 'servicos']],
  ['oficinas mecânicas', 'Oficina', ['servicos']], ['eletricistas e encanadores autônomos', 'Pro', ['servicos']], ['empresas de limpeza', 'Clean', ['servicos', 'logistica']],
  ['escritórios de contabilidade', 'Conta', ['financas', 'servicos']], ['advogados autônomos', 'Jus', ['juridico', 'servicos']], ['imobiliárias pequenas', 'Imob', ['imobiliario', 'servicos']],
  ['condomínios residenciais', 'Condo', ['condominio']], ['síndicos profissionais', 'Sindico', ['condominio', 'servicos']], ['administradoras de aluguel por temporada', 'Stay', ['imobiliario', 'eventos']],
  ['ONGs', 'Ong', ['social']], ['igrejas e comunidades religiosas', 'Comunidade', ['religioso', 'social']], ['cooperativas', 'Coop', ['agro', 'social']],
  ['produtores rurais familiares', 'Campo', ['agro']], ['hortas e feiras orgânicas', 'Feira', ['agro', 'alimentacao']], ['transportadoras pequenas', 'Frete', ['logistica']],
  ['entregadores e motoboys', 'Entrega', ['logistica']], ['organizadores de eventos', 'Evento', ['eventos', 'servicos']], ['casas de festas', 'Festa', ['eventos']],
  ['desenvolvedores independentes', 'Dev', ['tech']], ['startups em fase inicial', 'Start', ['tech', 'financas']], ['times de segurança enxutos', 'Sec', ['tech']],
  ['agências de marketing pequenas', 'Agencia', ['servicos', 'tech']], ['criadores de conteúdo', 'Creator', ['conteudo', 'servicos']], ['autores de cursos online', 'Curso', ['educacao', 'conteudo']],
  ['bibliotecas comunitárias', 'Biblio', ['educacao', 'social']], ['associações de bairro', 'Bairro', ['social', 'condominio']], ['artesãos', 'Arte', ['varejo']],
  ['gráficas rápidas', 'Grafica', ['servicos', 'varejo']], ['lavanderias', 'Lava', ['servicos']], ['óticas', 'Otica', ['varejo', 'saude']],
  ['farmácias de bairro', 'Farma', ['varejo', 'saude']], ['hotéis e pousadas pequenas', 'Pousada', ['eventos', 'imobiliario']], ['corretores de seguros', 'Seguro', ['financas', 'servicos']],
  ['prefeituras de cidades pequenas', 'Cidade', ['gov', 'social']], ['secretarias municipais de saúde', 'SaudePub', ['gov', 'saude']], ['escolas públicas', 'Escola', ['gov', 'educacao']],
];

const PROBLEMS = [
  ['perdem receita com faltas e esquecimentos de horários', ['saude', 'servicos', 'educacao', 'beleza'], ['agenda', 'mensagens']],
  ['gastam horas por semana com planilhas e tarefas repetitivas', ['*'], ['automacao', 'integracao', 'relatorios']],
  ['não sabem se o site ou sistema está exposto a falhas de segurança', ['tech', 'varejo', 'servicos', 'financas', 'gov'], ['seguranca']],
  ['não acompanham o fluxo de caixa com clareza', ['*'], ['relatorios', 'integracao']],
  ['dependem de atendimento manual e lento por mensagens', ['varejo', 'servicos', 'saude', 'alimentacao', 'imobiliario', 'beleza'], ['mensagens', 'ia']],
  ['perdem vendas por estoque desatualizado', ['varejo', 'alimentacao', 'agro'], ['integracao', 'mobile', 'relatorios']],
  ['têm dados de clientes espalhados em várias ferramentas', ['*'], ['integracao', 'relatorios']],
  ['têm dificuldade para cumprir obrigações da LGPD', ['saude', 'servicos', 'educacao', 'financas', 'tech', 'juridico'], ['conformidade', 'automacao']],
  ['não conseguem divulgar o trabalho online com regularidade', ['servicos', 'beleza', 'alimentacao', 'eventos', 'religioso', 'social', 'conteudo'], ['divulgacao']],
  ['perdem prazos e documentos importantes', ['juridico', 'financas', 'imobiliario', 'servicos', 'condominio', 'gov'], ['agenda', 'automacao', 'ia']],
  ['não medem a satisfação dos clientes', ['*'], ['relatorios', 'mensagens']],
  ['sofrem com fraudes e golpes em pagamentos', ['varejo', 'financas', 'eventos'], ['antifraude']],
  ['têm dificuldade para treinar novos colaboradores', ['varejo', 'alimentacao', 'servicos', 'saude', 'logistica', 'gov'], ['treinamento', 'ia']],
  ['não sabem precificar produtos e serviços', ['servicos', 'beleza', 'alimentacao', 'varejo', 'agro', 'conteudo'], ['relatorios']],
  ['têm dificuldade de organizar escalas e turnos', ['saude', 'alimentacao', 'logistica', 'eventos', 'servicos'], ['agenda', 'mobile']],
  ['perdem tempo revisando código e dependências manualmente', ['tech'], ['codigo', 'automacao']],
  ['não conseguem acompanhar entregas e rotas', ['logistica', 'alimentacao', 'varejo', 'agro'], ['mobile', 'integracao']],
  ['têm dificuldade de engajar membros e voluntários', ['social', 'religioso', 'educacao', 'condominio'], ['mensagens', 'divulgacao', 'mobile']],
  ['não encontram informação confiável rapidamente nos próprios documentos', ['*'], ['ia']],
  ['têm alto índice de inadimplência', ['educacao', 'condominio', 'servicos', 'saude'], ['mensagens', 'automacao', 'integracao']],
  ['acompanham a produção só no papel', ['agro', 'alimentacao'], ['mobile', 'relatorios']],
  ['não conseguem comprovar a acessibilidade dos seus sites', ['tech', 'servicos', 'educacao', 'social', 'gov'], ['acessibilidade']],
  ['perdem oportunidades por não acompanhar editais', ['servicos', 'tech', 'social', 'juridico'], ['ia', 'automacao']],
  ['desperdiçam alimentos e insumos', ['alimentacao', 'agro', 'varejo'], ['relatorios', 'mobile', 'ia']],
  ['têm dificuldade de organizar reservas e ocupação', ['eventos', 'imobiliario', 'servicos', 'alimentacao'], ['agenda']],
  ['não usam os dados abertos que já publicam para decidir', ['gov'], ['transparencia', 'relatorios', 'ia']],
  ['recebem pedidos de cidadãos e moradores por canais desorganizados', ['gov', 'condominio', 'social'], ['mensagens', 'integracao']],
  ['não conseguem prestar contas de forma transparente', ['social', 'condominio', 'religioso', 'gov'], ['relatorios', 'transparencia']],
];

// [tag, descrição, raiz do nome, canais compatíveis (vazio = todos)]
const APPROACHES = [
  ['agenda', 'agenda online com lembretes e confirmação automática', 'Agenda', []],
  ['agenda', 'gestão de escalas com trocas aprovadas pelo celular', 'Escala', ['aplicativo mobile', 'aplicação web']],
  ['mensagens', 'mensagens automáticas pela API oficial do WhatsApp Business', 'Zap', ['integração com WhatsApp Business']],
  ['mensagens', 'central de atendimento com respostas sugeridas e histórico do cliente', 'Atende', ['aplicação web']],
  ['automacao', 'automação de rotinas sem código, com registro de cada execução', 'Flow', ['aplicação web']],
  ['automacao', 'robô que lê documentos recebidos e preenche os sistemas', 'Doc', ['aplicação web']],
  ['integracao', 'painel único que integra planilhas, banco e meios de pagamento', 'Hub', ['aplicação web']],
  ['integracao', 'API de integração entre os sistemas que o cliente já usa', 'Link', ['API para outros sistemas']],
  ['relatorios', 'relatórios automáticos semanais com indicadores explicados', 'Relata', []],
  ['relatorios', 'painel de indicadores em tempo real', 'Painel', ['aplicação web', 'aplicativo mobile']],
  ['seguranca', 'verificação passiva e contínua de segurança com alertas priorizados', 'Guard', ['aplicação web']],
  ['codigo', 'análise automática de código e dependências a cada mudança', 'Scan', ['integração com GitHub']],
  ['codigo', 'revisão de pull requests com explicação de cada alerta', 'Review', ['integração com GitHub']],
  ['antifraude', 'monitoramento de transações com regras explicáveis e revisão humana', 'Alerta', ['aplicação web']],
  ['conformidade', 'checklist guiado com evidências e lembretes de prazos', 'Check', ['aplicação web']],
  ['conformidade', 'inventário automatizado de dados pessoais', 'Mapa', ['aplicação web']],
  ['acessibilidade', 'verificação automática de acessibilidade com relatório de correções', 'Acessa', ['aplicação web']],
  ['divulgacao', 'gerador de calendário de conteúdo com sugestões revisáveis', 'Pauta', ['aplicação web', 'aplicativo mobile']],
  ['treinamento', 'trilhas de microtreinamento pelo celular', 'Trilha', ['aplicativo mobile']],
  ['treinamento', 'base de procedimentos com vídeos curtos e quiz', 'Saber', ['aplicação web', 'aplicativo mobile']],
  ['transparencia', 'portal de transparência com dados abertos e gráficos simples', 'Aberto', ['aplicação web']],
  ['transparencia', 'mapa interativo de dados públicos com indicadores por bairro', 'Mapa', ['aplicação web']],
  ['ia', 'assistente de IA que responde com base nos documentos da organização, citando a fonte', 'Sabe', ['aplicação web', 'integração com WhatsApp Business']],
  ['ia', 'classificação automática por IA com revisão humana', 'Triagem', ['aplicação web']],
  ['mobile', 'app mobile que funciona sem internet e sincroniza depois', 'Campo', ['aplicativo mobile']],
  ['mobile', 'registro por foto no celular com leitura automática', 'Foto', ['aplicativo mobile']],
];


const DIFFERENTIALS = [
  'foco profundo em um nicho pouco atendido', 'preço acessível para pequenos negócios', 'configuração em menos de 10 minutos',
  'integração com Pix desde o início', 'interface pensada para quem não é técnico', 'explica o motivo de cada sugestão (nada de caixa-preta)',
  'acessibilidade desde a primeira versão', 'núcleo de código aberto com versão gerenciada paga', 'privacidade por padrão, com coleta mínima de dados',
  'suporte e documentação em português', 'funciona bem em celulares simples e conexões lentas', 'importação automática dos dados que o cliente já tem',
  'relatório de impacto mensal que comprova o valor entregue', 'implantação assistida na primeira semana', 'modo multiunidade para quem tem mais de um endereço',
];
const CHANNELS = ['aplicação web', 'aplicativo mobile', 'integração com WhatsApp Business'];
const channelsOf = a => (a[3] && a[3].length ? a[3] : CHANNELS);
const MODEL_BY_SOL = {
  agenda: ['SaaS por assinatura', 'Freemium'], mensagens: ['SaaS por assinatura', 'Créditos de uso'], automacao: ['Automação como serviço', 'SaaS por assinatura'],
  integracao: ['SaaS por assinatura', 'API paga'], relatorios: ['SaaS por assinatura', 'Freemium'], seguranca: ['SaaS por assinatura', 'Planos empresariais'],
  codigo: ['Freemium', 'Planos empresariais'], antifraude: ['SaaS por assinatura', 'Créditos de uso'], conformidade: ['SaaS por assinatura', 'Serviços premium / consultoria'],
  acessibilidade: ['SaaS por assinatura', 'Serviços premium / consultoria'], divulgacao: ['Freemium', 'SaaS por assinatura'], treinamento: ['SaaS por assinatura', 'Freemium'],
  transparencia: ['Planos empresariais', 'Serviços premium / consultoria'], ia: ['Créditos de uso', 'SaaS por assinatura'], mobile: ['Freemium', 'SaaS por assinatura'],
};
const REGULATORY = { saude: 'sigilo de dados de saúde (LGPD, dado sensível) e regras do conselho profissional do setor', financas: 'LGPD e, se movimentar dinheiro, regras do Banco Central para arranjos de pagamento', educacao: 'LGPD com atenção a dados de menores, se houver', juridico: 'sigilo profissional e LGPD', condominio: 'LGPD e prestação de contas prevista em convenção', social: 'LGPD e transparência na prestação de contas' };

// Rótulo curto do problema, usado no nome da ideia (evita nomes iguais para ideias diferentes)
const PROBLEM_LABELS = [['faltas', 'Faltas'], ['planilhas', 'Rotina'], ['exposto', 'Seguro'], ['fluxo de caixa', 'Caixa'], ['atendimento', 'Atende'], ['estoque', 'Estoque'], ['espalhados', 'Dados'], ['LGPD', 'LGPD'], ['divulgar', 'Divulga'], ['prazos', 'Prazos'], ['satisfação', 'NPS'], ['fraudes', 'Fraude'], ['treinar', 'Treina'], ['precificar', 'Preço'], ['escalas', 'Turnos'], ['revisando código', 'Code'], ['entregas', 'Rotas'], ['engajar', 'Engaja'], ['informação confiável', 'Docs'], ['inadimplência', 'Cobra'], ['papel', 'Produção'], ['acessibilidade', 'Acessível'], ['editais', 'Editais'], ['desperdiçam', 'Desperdício'], ['reservas', 'Reservas'], ['dados abertos', 'Aberto'], ['cidadãos', 'Pedidos'], ['prestar contas', 'Contas']];
const labelOf = txt => (PROBLEM_LABELS.find(([k]) => txt.includes(k)) || [null, 'Pro'])[1];

// Núcleos válidos: problema × segmento × abordagem compatíveis
const CORES = (() => {
  const out = [];
  PROBLEMS.forEach(([, segTags, sols], pi) => {
    SEGMENTS.forEach(([, , tags], si) => {
      if (!((segTags.includes('*') && !tags.includes('gov')) || tags.some(t => segTags.includes(t)))) return;
      APPROACHES.forEach((ap, ai) => { if (sols.includes(ap[0])) channelsOf(ap).forEach((ch, ci) => out.push([pi, si, ai, ci])); });
    });
  });
  return out;
})();

const VARIANTS = DIFFERENTIALS.length * 2; // diferencial × 2 modelos por abordagem
export const CAPACITY = { nucleos: CORES.length, variacoes: VARIANTS, total: CORES.length * VARIANTS };

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
const STEP = (() => { let p = 7919; while (gcd(p, CAPACITY.total) !== 1) p += 2; return p; })();

/** Ideia resumida para o índice i (0 ≤ i < total). Determinística. */
export function ideaAt(i) {
  const n = ((i % CAPACITY.total) + CAPACITY.total) % CAPACITY.total;
  const k = (n * STEP + 104729) % CAPACITY.total; // permutação: vizinhos ficam variados
  const core = CORES[k % CORES.length];
  let v = Math.floor(k / CORES.length);
  const d = v % DIFFERENTIALS.length; v = Math.floor(v / DIFFERENTIALS.length);
  const m = v % 2;
  const [problema, , ] = PROBLEMS[core[0]];
  const [segmento, curto, segTags] = SEGMENTS[core[1]];
  const ap = APPROACHES[core[2]];
  const [sol, abordagem, raiz] = ap;
  const canal = channelsOf(ap)[core[3]];
  return {
    id: n, nucleo: core.slice(0, 3).join('-'),
    nome: `${raiz}${curto} ${labelOf(problema)}`,
    segmento, segTags, problema, sol, abordagem,
    canal, diferencial: DIFFERENTIALS[d], modelo: MODEL_BY_SOL[sol][m],
    resumo: `${abordagem[0].toUpperCase()}${abordagem.slice(1)} para ${segmento} que ${problema}, como ${canal}.`,
  };
}

/** Página de ideias, com filtro por tema e deduplicação por núcleo. */
export function generateIdeas({ pagina = 1, tamanho = 6, tema = '', excluirNucleos = [] } = {}) {
  tamanho = Math.max(1, Math.min(24, tamanho));
  const STOP = new Set(['para', 'com', 'que', 'dos', 'das', 'uma', 'por', 'sem']);
  const termos = normalize(tema).split(' ').filter(w => w.length > 2 && !STOP.has(w));
  const vistos = new Set(excluirNucleos);
  let i = (pagina - 1) * tamanho * 7, scans = 0;
  if (!termos.length) {
    const out = [];
    while (out.length < tamanho && scans < 40000) { const idea = ideaAt(i++); scans++; if (vistos.has(idea.nucleo)) continue; vistos.add(idea.nucleo); out.push(idea); }
    return { ideias: out, capacidade: CAPACITY, pagina, varridas: scans, aviso: null };
  }
  // com tema: pontua pela quantidade de termos presentes e prefere as mais aderentes
  const cand = [];
  while (cand.length < tamanho * 30 && scans < 60000) {
    const idea = ideaAt(i++); scans++;
    if (vistos.has(idea.nucleo)) continue;
    const txt = normalize(`${idea.segmento} ${idea.problema} ${idea.abordagem} ${idea.segTags.join(' ')} ${idea.sol}`);
    const score = termos.filter(t => txt.includes(t) || (t.length > 5 && txt.includes(t.slice(0, -1)))).length;
    if (score) { cand.push({ idea, score }); vistos.add(idea.nucleo); }
  }
  cand.sort((a, b) => b.score - a.score);
  const out = cand.slice(0, tamanho).map(c => ({ ...c.idea, aderencia: `${c.score}/${termos.length} termos do tema` }));
  return { ideias: out, capacidade: CAPACITY, pagina, varridas: scans, aviso: out.length < tamanho ? 'Poucas combinações para esse tema; tente termos mais amplos.' : null };
}

/** Remove ideias semanticamente parecidas (para listas vindas de várias fontes). */
export function dedupeIdeas(list, limiar = 0.6) {
  const out = [];
  for (const x of list) if (!out.some(o => similarity(o.resumo, x.resumo) >= limiar)) out.push(x);
  return out;
}

/** Ideia completa: todos os campos + análise do motor central (MVP e prompt). */
export function ideaDetail(i, opts = {}) {
  const s = ideaAt(i);
  const pedido = `Criar uma plataforma de ${s.abordagem} para ${s.segmento}, como ${s.canal}, com login de clientes e assinatura`;
  const a = analyze(pedido, { nivel: opts.nivel || 'profissional', comercial: true });
  const reg = s.segTags.map(t => REGULATORY[t]).filter(Boolean);
  const mvp = a.requisitos.filter(r => r.core).slice(0, 5).map(r => `${r.id} ${r.t}`);
  const busca = encodeURIComponent(`${s.segmento} ${s.problema}`.slice(0, 80));
  return {
    ...s,
    rotulos: { fato: [], estimativa: ['complexidade técnica', 'tempo de MVP', 'custos'], hipotese: ['problema', 'público', 'proposta de valor', 'diferencial', 'modelo de negócio'] },
    problemaDetalhe: `Hipótese: ${s.segmento} ${s.problema}.`,
    evidencias: { status: 'Não verificadas pela ferramenta.', comoValidar: ['10 a 15 entrevistas com o público-alvo, perguntando como resolvem o problema hoje e quanto isso custa.', 'Página de lista de espera para medir interesse real.', 'Busca por discussões e projetos parecidos nas fontes de pesquisa da ferramenta.'], buscas: [`https://hn.algolia.com/?q=${busca}`, `https://github.com/search?q=${busca}&type=repositories`] },
    solucao: `${s.abordagem[0].toUpperCase()}${s.abordagem.slice(1)}, entregue como ${s.canal}.`,
    publico: s.segmento,
    nicho: s.segTags.join(', '),
    propostaValor: `Ajudar ${s.segmento} a resolver o fato de que ${s.problema}, com ${s.diferencial}.`,
    concorrentes: { status: 'Não pesquisados.', alternativasTipicas: ['planilhas e processos manuais', `ferramentas genéricas de ${s.sol}`, 'contratação de mais pessoas para a tarefa'], aviso: 'Pesquise concorrentes diretos antes de afirmar que o diferencial é único.' },
    modeloNegocio: s.modelo,
    monetizacao: a.monetizacao,
    canaisAquisicao: ['conteúdo educativo para o nicho', 'parcerias com associações e fornecedores do setor', 'indicação entre clientes', 'grupos e eventos do segmento'],
    custos: a.viabilidade ? { inicial: a.viabilidade.custoInicial, mensal: a.viabilidade.custoMensal } : null,
    complexidade: a.viabilidade?.complexidade,
    recursos: ['1 pessoa desenvolvedora full stack', 'acesso a 10–15 pessoas do público para validação', 'conta no provedor de pagamento'],
    riscosComerciais: ['demanda não confirmada', 'disposição a pagar desconhecida', 'concorrentes estabelecidos não mapeados'],
    riscosTecnicos: a.ameacas.slice(0, 3).map(x => x.a),
    regulatorio: reg.length ? reg : ['LGPD, se houver dados pessoais'],
    validacao: ['Semana 1–2: entrevistas e lista de espera.', 'Semana 3–4: protótipo navegável testado com 5 usuários.', 'Critério para seguir: interesse explícito (pré-cadastro ou pré-venda) de parte relevante dos entrevistados.'],
    mvp,
    roadmap: ['MVP com o fluxo principal', 'Pagamento e onboarding', 'Relatórios e integrações pedidas pelos primeiros clientes', 'Planos empresariais, se houver demanda'],
    pitch: `${s.segmento[0].toUpperCase()}${s.segmento.slice(1)} ${s.problema}. ${s.nome} é ${s.abordagem}, entregue como ${s.canal}, com ${s.diferencial}. Estamos validando a hipótese com entrevistas antes de construir o produto completo.`,
    pitchComercial: `Você perde tempo ou dinheiro porque ${s.problema.replace(/^(têm|perdem|não|gastam|sofrem|dependem|acompanham|desperdiçam)/, m => m)}? O ${s.nome} ajuda com ${s.abordagem}. Teste grátis durante a fase de validação.`,
    nomeAviso: 'Nome provisório: verifique marca registrada (INPI) e disponibilidade de domínio.',
    viabilidade: a.viabilidade,
    prompt: a.prompt,
    qualidadePrompt: a.qualidade.total,
  };
}

// ---------------------------------------------------------------------------
// Hackathons
// ---------------------------------------------------------------------------
const TECH_WORDS = ['python', 'javascript', 'typescript', 'react', 'node', 'flutter', 'kotlin', 'java', 'go', 'gemini', 'openai', 'google cloud', 'firebase', 'aws', 'azure', 'nasa', 'dados abertos', 'ia', 'inteligencia artificial', 'blockchain', 'iot', 'arduino', 'android', 'api'];

export function parseRegulation(text) {
  const raw = String(text || '');
  if (raw.trim().length < 20) return null;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const pick = re => lines.filter(l => re.test(normalize(l)) || re.test(l.toLowerCase()));
  const tema = pick(/\b(tema|desafio|trilha|problema proposto)\b/)[0] || null;
  const critLines = pick(/(\d+\s*%|\d+\s*pontos|\bpeso\b)/).concat(pick(/(criterio|avaliac|pontuac)/).filter(l => !/:\s*$/.test(l)));
  const criterios = [...new Set(critLines)].filter(l => !/:\s*$/.test(l)).map(l => {
    const w = l.match(/(\d+(?:[.,]\d+)?)\s*(%|pontos|pts)/i);
    return { texto: l.replace(/^[-*•\d.)\s]+/, ''), peso: w ? `${w[1]}${w[2] === '%' ? '%' : ' pontos'}` : null };
  });
  const datas = raw.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g) || [];
  const horas = raw.match(/\b(\d{2,3})\s*h(?:oras)?\b/i);
  const t = normalize(raw);
  const tecnologias = TECH_WORDS.filter(w => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t));
  const submissao = pick(/(submiss|entreg|video|reposit|apresentac|demo)/).filter(l => !critLines.includes(l));
  const restricoes = pick(/(proibid|nao e permitido|nao sera permitido|restric|obrigatori|somente|apenas)/);
  return { tema, criterios, prazos: datas, duracaoHoras: horas ? Number(horas[1]) : null, tecnologias, submissao, restricoes };
}

export function hackathonProjects({ regulamento = '', tema = '', quantidade = 3 } = {}) {
  const reg = parseRegulation(regulamento);
  const foco = tema || reg?.tema || '';
  const base = generateIdeas({ tamanho: quantidade, tema: foco.replace(/^(tema|desafio|trilha)\s*:?\s*/i, '') });
  const horas = reg?.duracaoHoras || 48;
  const fase = p => `${Math.max(1, Math.round(horas * p))} h`;
  const projetos = base.ideias.map(s => {
    const det = ideaDetail(s.id, { nivel: 'essencial' });
    const permitidas = reg?.tecnologias?.length ? reg.tecnologias : null;
    return {
      nome: s.nome, problema: det.problemaDetalhe, solucao: det.solucao,
      originalidade: `${s.diferencial}. Verifique projetos parecidos em edições anteriores antes de afirmar originalidade.`,
      impacto: `Se a hipótese se confirmar, reduz o problema de ${s.segmento} que ${s.problema}. Defina uma métrica de impacto mensurável para a demo.`,
      arquitetura: det.viabilidade ? `Componentes do MVP: ${det.mvp.join('; ')}.` : '',
      tecnologias: permitidas ? `Usar somente as tecnologias permitidas pelo regulamento: ${permitidas.join(', ')}.` : 'Regulamento não lista tecnologias; escolha as que a equipe já domina.',
      mvp: det.mvp,
      plano: [`Até ${fase(0.1)}: recorte do problema e protótipo em papel`, `Até ${fase(0.6)}: fluxo principal funcionando`, `Até ${fase(0.8)}: dados de exemplo e demo estável`, `Até ${fase(0.95)}: pitch, vídeo e README`],
      demo: ['Mostrar o problema com um caso concreto (dados de exemplo, nunca dados reais de terceiros).', 'Executar o fluxo principal ao vivo.', 'Mostrar o resultado e a métrica de impacto.'],
      roteiroPitch: ['0:00–0:30 problema e para quem', '0:30–1:15 solução e diferencial', '1:15–2:15 demo', '2:15–2:45 impacto e validação', '2:45–3:00 próximos passos'],
      atendimentoCriterios: reg?.criterios?.length ? reg.criterios.map(c => ({ criterio: c.texto, peso: c.peso, comoAtender: 'Relacione explicitamente este critério a uma parte da demo ou do pitch e prepare evidência.' })) : [],
      evolucaoStartup: `Modelo possível: ${s.modelo}. Antes, validar com entrevistas fora do hackathon.`,
      prompt: det.prompt,
    };
  });
  return {
    regulamento: reg,
    avisos: [
      reg ? null : 'Regulamento não informado: os critérios de avaliação não foram inventados; cole o regulamento para alinhar o projeto.',
      'Nenhuma premiação é garantida.',
    ].filter(Boolean),
    projetos,
  };
}
