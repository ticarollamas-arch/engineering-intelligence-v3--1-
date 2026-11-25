// Engineering Intelligence — motor local de interpretação técnica.
// Transforma um pedido em linguagem natural numa análise (modo, especialidades,
// referenciais, premissas) e num prompt técnico estruturado em 19 seções.
// Determinístico e sem IA: roda igual no navegador, na função da Vercel e nos testes.

export const VERSION = '1.0.0';
export const MAX_INPUT = 2000;

/** Normaliza para comparação: minúsculas, sem acentos, espaços simples. */
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cada termo é procurado como palavra inteira (evita "ia" dentro de "média").
function has(text, terms) {
  return terms.some(t => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text));
}

// ---------------------------------------------------------------------------
// Sinais detectados no pedido
// ---------------------------------------------------------------------------
const SIGNALS = {
  web: ['site', 'sites', 'loja', 'e-commerce', 'ecommerce', 'vendas', 'landing page', 'portal', 'marketplace', 'web', 'pagina', 'blog', 'painel', 'dashboard', 'saas', 'plataforma'],
  api: ['api', 'apis', 'backend', 'back-end', 'microsservico', 'microsservicos', 'rest', 'graphql', 'servidor de aplicacao', 'webhook'],
  mobile: ['android', 'ios', 'aplicativo', 'app mobile', 'mobile', 'apk', 'flutter', 'react native', 'kotlin', 'celular'],
  research: ['bug bounty', 'vulnerabilidade', 'vulnerabilidades', 'pentest', 'teste de invasao', 'hackerone', 'bugcrowd', 'vrp', 'inspectiv', 'cve', 'reconhecimento', 'recon', 'poc', 'prova de conceito', 'engenharia reversa'],
  improve: ['melhorar', 'corrigir', 'refatorar', 'refatoracao', 'legado', 'existente', 'otimizar', 'atualizar', 'migrar', 'migracao', 'debug', 'erro', 'erros', 'bug', 'bugs'],
  infra: ['deploy', 'implantar', 'implantacao', 'servidor', 'vps', 'docker', 'kubernetes', 'k8s', 'terraform', 'cloud', 'nuvem', 'gcp', 'google cloud', 'aws', 'ci/cd', 'pipeline', 'dns', 'hospedagem', 'infraestrutura'],
  ai: ['ia', 'inteligencia artificial', 'agente', 'agentes', 'llm', 'llms', 'chatbot', 'chat', 'gpt', 'claude', 'gemini', 'rag', 'prompt', 'prompts', 'machine learning', 'modelo de linguagem', 'multiagente', 'multiagentes', 'vertex ai'],
  data: ['dados', 'big data', 'json', 'csv', 'parquet', 'etl', 'bigquery', 'pandas', 'relatorio', 'relatorios', 'analytics', 'catalogo', 'banco de dados', 'planilha'],
  payments: ['pagamento', 'pagamentos', 'pix', 'checkout', 'cartao', 'cartoes', 'assinatura', 'assinaturas', 'cobranca', 'stripe', 'mercado pago'],
  personal: ['cadastro', 'login', 'usuario', 'usuarios', 'cliente', 'clientes', 'dados pessoais', 'lgpd', 'e-mail', 'email', 'conta', 'contas', 'perfil', 'pacientes', 'alunos'],
  automation: ['automatizar', 'automacao', 'robo', 'bot', 'script', 'scripts', 'agendar', 'scraper', 'cli', 'tarefa', 'tarefas'],
  secops: ['monitoramento', 'monitorar', 'logs', 'siem', 'soar', 'incidente', 'incidentes', 'alerta', 'alertas', 'auditoria', 'observabilidade', 'deteccao'],
};

export function detectSignals(pedido) {
  const t = normalize(pedido);
  const s = {};
  for (const [k, terms] of Object.entries(SIGNALS)) s[k] = has(t, terms);
  // loja virtual implica clientes (dados pessoais) e pagamentos
  if (has(t, ['loja', 'loja virtual', 'e-commerce', 'ecommerce', 'marketplace', 'vendas online', 'site de vendas'])) { s.personal = true; s.payments = true; }
  // "app" sozinho: mobile só se não houver contexto web
  if (!s.mobile && has(t, ['app', 'apps']) && !s.web) s.mobile = true;
  return s;
}

// ---------------------------------------------------------------------------
// Modo de operação (seção 5 do prompt mestre)
// ---------------------------------------------------------------------------
export const MODES = {
  pesquisa: 'Pesquisa de vulnerabilidades',
  melhoria: 'Melhoria de projeto existente',
  infra: 'Infraestrutura e deploy',
  ia: 'Inteligência artificial',
  desenvolvimento: 'Desenvolvimento',
};

export function chooseMode(s) {
  if (s.research) return 'pesquisa';
  if (s.improve) return 'melhoria';
  if (s.infra && !s.web && !s.api && !s.mobile) return 'infra';
  if (s.ai && !s.web && !s.mobile) return 'ia';
  return 'desenvolvimento';
}

// ---------------------------------------------------------------------------
// Especialidades e referenciais
// ---------------------------------------------------------------------------
export function selectSpecialties(s, mode) {
  const out = new Set(['Engenharia de software']);
  if (mode === 'pesquisa') ['AppSec', 'Pesquisa de segurança'].forEach(x => out.add(x));
  if (s.web) ['Full stack', 'UX/UI'].forEach(x => out.add(x));
  if (s.api) out.add('Backend e APIs');
  if (s.mobile) out.add('Desenvolvimento mobile');
  if (s.web || s.api || s.mobile || mode === 'melhoria') ['AppSec', 'DevSecOps'].forEach(x => out.add(x));
  if (s.infra || mode === 'desenvolvimento') out.add('Cloud e infraestrutura');
  if (s.ai) out.add('Inteligência artificial');
  if (s.data) out.add('Dados');
  if (s.automation) out.add('Automação');
  if (s.secops || s.infra) out.add('SecOps');
  if (s.payments) out.add('Pagamentos');
  out.add('Testes e qualidade');
  return [...out];
}

const REF = {
  ssdf: { nome: 'NIST SSDF (SP 800-218)', porque: 'práticas de desenvolvimento seguro ao longo do ciclo de vida' },
  asvs: { nome: 'OWASP ASVS', porque: 'requisitos verificáveis de segurança para aplicações web' },
  top10: { nome: 'OWASP Top 10', porque: 'riscos mais comuns em aplicações web, usados como checklist mínimo' },
  api: { nome: 'OWASP API Security Top 10', porque: 'riscos específicos de APIs (BOLA, autenticação, exposição de dados)' },
  masvs: { nome: 'OWASP MASVS', porque: 'requisitos de segurança para aplicativos móveis' },
  wstg: { nome: 'OWASP WSTG', porque: 'metodologia de teste para validar as hipóteses de segurança' },
  cwe: { nome: 'CWE / CVE / CVSS', porque: 'classificar a causa raiz, referenciar falhas conhecidas e medir severidade' },
  stride: { nome: 'STRIDE (threat modeling)', porque: 'mapear ameaças antes de implementar' },
  lgpd: { nome: 'LGPD', porque: 'o projeto trata dados pessoais: base legal, minimização, direitos do titular' },
  pci: { nome: 'PCI DSS (se armazenar ou processar cartão)', porque: 'pagamentos com cartão; usar gateway certificado reduz o escopo' },
  slsa: { nome: 'SLSA', porque: 'integridade da cadeia de build e das dependências' },
  cis: { nome: 'CIS Benchmarks', porque: 'endurecimento de servidores, containers e nuvem' },
  csf: { nome: 'NIST Cybersecurity Framework', porque: 'organizar monitoramento, detecção, resposta e recuperação' },
  iso25010: { nome: 'ISO/IEC 25010', porque: 'atributos de qualidade (desempenho, manutenibilidade, usabilidade)' },
  samm: { nome: 'OWASP SAMM', porque: 'medir e evoluir a maturidade de segurança do processo existente' },
};

export function selectReferences(s, mode) {
  const r = [];
  const add = k => { if (!r.includes(REF[k])) r.push(REF[k]); };
  if (mode === 'pesquisa') { add('wstg'); add('cwe'); add('top10'); if (s.api) add('api'); if (s.mobile) add('masvs'); return r; }
  add('ssdf');
  if (s.web) { add('asvs'); add('top10'); }
  if (s.api || s.web) add('api');
  if (s.mobile) add('masvs');
  if (s.web || s.api || s.mobile || s.ai) add('stride');
  if (s.personal || s.payments || (s.web && (s.data || s.ai))) add('lgpd');
  if (s.payments) add('pci');
  if (s.infra || mode === 'desenvolvimento') add('slsa');
  if (s.infra) add('cis');
  if (s.secops) add('csf');
  if (mode === 'melhoria') { add('samm'); add('iso25010'); }
  return r;
}

// ---------------------------------------------------------------------------
// Tecnologias sugeridas (apenas como ponto de partida, sempre justificáveis)
// ---------------------------------------------------------------------------
export function selectTech(s, mode) {
  const t = [];
  if (s.web) t.push('Front-end: TypeScript com um framework web moderno (ex.: Next.js) ou HTML/CSS/JS se o escopo for simples');
  if (s.web || s.api) t.push('Back-end: Python (FastAPI) ou Node.js (TypeScript), com APIs REST documentadas em OpenAPI');
  if (s.mobile) t.push('Mobile: Kotlin nativo ou Flutter, com comunicação somente via HTTPS');
  if (s.web || s.api || s.data) t.push('Banco de dados: PostgreSQL, com migrações versionadas');
  if (s.ai) t.push('IA: provedor de LLM via API no servidor (chave nunca no cliente), com limite de custo e avaliação de respostas');
  if (s.data) t.push('Dados: Python (Pandas/DuckDB) com processamento em streaming para arquivos grandes');
  if (s.automation) t.push('Automação: scripts Python com logs, idempotência e agendamento controlado');
  t.push('Infra: Docker, GitHub Actions para CI/CD e hospedagem compatível com o tipo de aplicação (ex.: Vercel, Cloud Run ou VPS)');
  if (mode === 'pesquisa') return ['Ferramentas de análise permitidas pelo programa (análise estática, proxy de interceptação, decompilador para APK)', 'Ambiente local ou laboratório para reproduzir os achados'];
  return t;
}

// ---------------------------------------------------------------------------
// Construção do prompt
// ---------------------------------------------------------------------------
const EXECUTOR = {
  desenvolvimento: 'engenheira(o) de software sênior full stack com prática em AppSec e DevSecOps',
  pesquisa: 'pesquisador(a) de segurança de aplicações que atua somente em escopo autorizado',
  melhoria: 'engenheira(o) de software sênior especializada(o) em evolução de sistemas existentes',
  infra: 'engenheira(o) de DevOps/SRE com foco em segurança operacional',
  ia: 'engenheira(o) de IA aplicada, com experiência em LLMs, agentes e MLOps',
};

function list(items) { return items.map(i => `- ${i}`).join('\n'); }

function functionalReqs(s, mode, pedido) {
  const r = [`Implementar o objetivo descrito: "${pedido}".`];
  if (s.personal) r.push('Cadastro e autenticação de usuários, com recuperação de senha segura.');
  if (s.payments) r.push('Fluxo de pagamento por gateway externo certificado; nunca armazenar dados completos de cartão.');
  if (s.web && has(normalize(pedido), ['loja', 'vendas', 'e-commerce', 'ecommerce', 'marketplace'])) r.push('Catálogo de produtos, carrinho, pedidos e painel administrativo.');
  if (s.ai) r.push('Integração com LLM no servidor, com tratamento de erros, tempo limite e resposta de fallback honesta.');
  if (s.data) r.push('Importação e consulta de dados sem carregar arquivos grandes inteiros na memória.');
  if (s.automation) r.push('Execução automatizada com registro de cada etapa e possibilidade de reexecução segura.');
  if (mode === 'melhoria') r.push('Preservar todas as funcionalidades atuais; nenhuma regressão é aceitável.');
  return r;
}

function securityReqs(s, mode) {
  if (mode === 'pesquisa') return [
    'Confirmar o programa, o escopo e as regras antes de qualquer teste; fora do escopo, não testar.',
    'Priorizar análise de código e reconhecimento permitido; nada de testes destrutivos, DoS ou acesso a dados de terceiros.',
    'Diferenciar observação, hipótese e vulnerabilidade confirmada; só reportar o que for reproduzível.',
    'Não armazenar nem divulgar dados sensíveis encontrados; seguir a política de divulgação do programa.',
  ];
  const r = ['Segredos somente em variáveis de ambiente ou cofre; nunca no repositório nem no front-end.', 'Validação de entrada no servidor e codificação de saída (prevenção de XSS e injeção).'];
  if (s.personal) r.push('Senhas com hash forte (Argon2id ou bcrypt), sessões seguras, MFA opcional, proteção contra força bruta.');
  if (s.web || s.api) r.push('Autorização por objeto em cada endpoint (prevenção de BOLA/IDOR), CORS restrito, rate limiting.');
  if (s.web) r.push('Cabeçalhos de segurança: CSP, HSTS, X-Content-Type-Options, frame-ancestors.');
  if (s.mobile) r.push('Armazenamento seguro no dispositivo (Keystore/Keychain), certificate pinning quando aplicável, sem segredos no APK.');
  if (s.ai) r.push('Proteção contra prompt injection, limite de custo por usuário e sem enviar dados pessoais desnecessários ao provedor.');
  if (s.personal || s.payments) r.push('Minimização e criptografia de dados pessoais em trânsito e em repouso; registro de consentimento quando exigido.');
  r.push('Dependências fixadas e verificadas (SCA) e varredura de segredos no CI.');
  return r;
}

function pipeline(mode) {
  if (mode === 'pesquisa') return ['Registrar cada teste com data, alvo autorizado, requisição e resposta.', 'Revisão humana do relatório antes do envio.'];
  return ['Lint e testes automatizados a cada push.', 'SAST, SCA e secret scanning como gates de bloqueio.', 'Build reprodutível e artefato versionado.', 'DAST no ambiente de homologação antes de produção.', 'Deploy com aprovação e possibilidade de rollback.'];
}

function acceptance(s, mode) {
  if (mode === 'pesquisa') return ['Cada achado tem passos de reprodução, evidência, impacto, CWE e severidade justificada (CVSS).', 'Nenhum teste fora do escopo foi realizado.', 'Recomendações de correção acompanham cada achado.'];
  const a = ['O fluxo principal funciona de ponta a ponta em ambiente real, com evidência (log, captura ou vídeo).', 'Testes automatizados passam no CI.', 'Nenhum achado crítico ou alto aberto nas varreduras de segurança.'];
  if (s.web) a.push('Interface responsiva sem quebra de layout em 360, 768 e 1440 px; acessibilidade básica (contraste, teclado, rótulos).');
  if (mode === 'melhoria') a.push('Comparação antes/depois mostra ganho sem regressão.');
  return a;
}

export function buildPrompt(pedido, a) {
  const { mode, signals: s } = a;
  const sec = [];
  sec.push(`## 1. Identidade do executor\nAtue como ${EXECUTOR[mode]}.`);
  sec.push(`## 2. Objetivo principal\n${a.objetivo}`);
  sec.push(`## 3. Contexto do projeto\nPedido original: "${pedido}"\nModo de trabalho: ${MODES[mode]}.`);
  sec.push(`## 4. Requisitos funcionais\n${list(functionalReqs(s, mode, pedido))}`);
  sec.push(`## 5. Requisitos não funcionais\n${list(['Segurança proporcional ao risco do projeto.', 'Desempenho adequado ao volume esperado, com métricas definidas.', 'Código legível, modular e documentado.', s.web || s.mobile ? 'Acessibilidade e responsividade.' : 'Operação estável e observável.'])}`);
  sec.push(`## 6. Arquitetura recomendada\n${mode === 'pesquisa' ? 'Não se aplica arquitetura de produto: organize o trabalho em reconhecimento autorizado → hipóteses → validação controlada → relatório.' : list(['Separar apresentação, regras de negócio e acesso a dados.', s.api || s.web ? 'API como única porta de acesso aos dados.' : 'Módulos com responsabilidades claras.', 'Começar simples; dividir em serviços só quando houver motivo medido.'])}`);
  sec.push(`## 7. Tecnologias selecionadas\n${list(a.tecnologias)}\nJustifique cada escolha e troque se o contexto pedir.`);
  sec.push(`## 8. Normas e metodologias\n${list(a.normas.map(n => `${n.nome}: ${n.porque}`))}\nExplique quais requisitos de cada referencial serão implementados e como serão verificados. Não declare conformidade ou certificação sem auditoria.`);
  sec.push(`## 9. Requisitos de segurança\n${list(securityReqs(s, mode))}`);
  sec.push(`## 10. Plano de implementação\n${list(mode === 'pesquisa' ? ['Ler as regras do programa e registrar o escopo.', 'Mapear superfície permitida e levantar hipóteses.', 'Validar cada hipótese de forma controlada.', 'Redigir o relatório.'] : ['Levantar requisitos e modelar ameaças.', 'Montar o esqueleto do projeto e o pipeline de CI.', 'Implementar o fluxo principal com testes.', 'Implementar os demais fluxos.', 'Endurecer segurança e desempenho.', 'Homologar e implantar.'])}`);
  sec.push(`## 11. Pipeline DevSecOps\n${list(pipeline(mode))}`);
  sec.push(`## 12. Testes e validação\n${list(mode === 'pesquisa' ? ['Reproduzir cada achado pelo menos duas vezes.', 'Descartar falsos positivos com evidência.'] : ['Testes unitários das regras de negócio.', 'Testes de integração da API e do banco.', 'Testes de ponta a ponta do fluxo principal.', 'Testes de segurança guiados pelos referenciais da seção 8.'])}`);
  sec.push(`## 13. Critérios de aceitação\n${list(acceptance(s, mode))}`);
  sec.push(`## 14. Estratégia de implantação\n${mode === 'pesquisa' ? 'Não se aplica. Entregue o relatório pela plataforma do programa.' : list(['Ambientes separados de desenvolvimento, homologação e produção.', 'Variáveis de ambiente por ambiente.', 'Deploy automatizado com rollback testado.'])}`);
  sec.push(`## 15. Monitoramento e manutenção\n${list(mode === 'pesquisa' ? ['Acompanhar a triagem e responder às perguntas do time do programa.'] : ['Logs estruturados sem dados pessoais.', 'Alertas de erro e de uso anômalo.', 'Atualização periódica de dependências.'])}`);
  sec.push(`## 16. Documentação\n${list(['README com instalação, configuração e uso.', 'Decisões de arquitetura registradas.', mode === 'pesquisa' ? 'Relatório técnico com evidências.' : 'Documentação da API.'])}`);
  sec.push(`## 17. Entregáveis finais\n${list(a.entregaveis)}`);
  sec.push(`## 18. Restrições e premissas\n${list([...a.premissas, 'Não invente resultados, testes ou funcionalidades. Se algo não puder ser feito, diga o motivo.'])}`);
  sec.push(`## 19. Evidências de funcionamento\n${list(a.validacao)}`);
  return `# Prompt técnico — ${MODES[mode]}\n\n${sec.join('\n\n')}\n`;
}

// ---------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------
export function analyze(pedidoBruto) {
  const pedido = String(pedidoBruto || '').trim().slice(0, MAX_INPUT);
  if (pedido.length < 5) throw new Error('Descreva o que você quer fazer em pelo menos uma frase.');
  const signals = detectSignals(pedido);
  const mode = chooseMode(signals);
  const especialidades = selectSpecialties(signals, mode);
  const normas = selectReferences(signals, mode);
  const tecnologias = selectTech(signals, mode);
  const objetivo = mode === 'pesquisa'
    ? `Conduzir pesquisa de segurança autorizada sobre: ${pedido}`
    : `${MODES[mode]}: ${pedido}`;
  const premissas = [];
  if (!signals.web && !signals.api && !signals.mobile && mode === 'desenvolvimento') premissas.push('O tipo de aplicação não foi informado; assumi uma aplicação web simples.');
  if (signals.payments) premissas.push('Pagamentos via gateway externo (ex.: Mercado Pago, Stripe), sem guardar dados de cartão.');
  if (mode === 'pesquisa') premissas.push('Só há autorização para o que estiver no escopo publicado do programa.');
  premissas.push('Volume inicial pequeno a médio; escalar quando houver demanda medida.');
  const entregaveis = mode === 'pesquisa'
    ? ['Relatório técnico por achado (passos, evidência, impacto, CWE, CVSS, correção).', 'Registro dos testes realizados.']
    : ['Código-fonte versionado no GitHub.', 'Pipeline de CI/CD funcionando.', 'Aplicação implantada e acessível.', 'Testes automatizados e relatório de segurança.', 'Documentação (README e arquitetura).'];
  const validacao = mode === 'pesquisa'
    ? ['Evidências reproduzíveis anexadas a cada achado.', 'Confirmação do escopo autorizado.']
    : ['URL ou build funcionando, com captura do fluxo principal.', 'Saída do CI com testes e varreduras aprovados.', 'Checklist dos requisitos da seção 8 com status de cada item.'];
  const a = { versao: VERSION, pedido, mode, modo: MODES[mode], signals, objetivo, especialidades, normas, tecnologias, premissas, entregaveis, validacao };
  a.prompt = buildPrompt(pedido, a);
  return a;
}
