// Especialistas transversais: autenticação, painel administrativo, pagamentos e
// webhooks, monetização, jornada do produto e viabilidade. São acionados pelo
// motor central (engine.js) a partir do texto já normalizado e dos sinais.
// Regra geral: nada de endpoints, eventos ou números de mercado inventados.

const has = (t, term) => new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^a-z0-9])`).test(t);
const any = (t, terms) => terms.some(x => has(t, x));

// ---------------------------------------------------------------------------
// Contexto comercial
// ---------------------------------------------------------------------------
const COMMERCIAL = ['vender', 'vendas', 'saas', 'assinatura', 'assinaturas', 'monetizar', 'startup', 'produto digital', 'infoproduto', 'curso online', 'clientes', 'negocio', 'hotmart', 'kiwify', 'eduzz', 'monetizze', 'braip', 'stripe', 'mercado pago', 'paypal', 'planos', 'cobrar', 'faturar', 'marketplace', 'loja', 'ecommerce', 'e-commerce', 'area de membros'];
const NON_COMMERCIAL = ['pessoal', 'uso pessoal', 'estudo', 'estudar', 'academico', 'cientifico', 'educacional', 'tcc', 'sem fins lucrativos', 'script local', 'para mim', 'aprendizado', 'portfolio'];
const LOCAL_ONLY = ['script', 'cli', 'linha de comando', 'script local', 'automacao local', 'biblioteca', 'sdk', 'extensao do vscode'];

export function commercialContext(t, opt) {
  if (opt === true || opt === 'sim') return { comercial: true, motivo: 'ativado pelo usuário' };
  if (opt === false || opt === 'nao') return { comercial: false, motivo: 'desativado pelo usuário' };
  if (any(t, NON_COMMERCIAL)) return { comercial: false, motivo: 'pedido indica uso pessoal, educacional ou científico' };
  if (any(t, COMMERCIAL)) return { comercial: true, motivo: 'pedido indica venda, clientes ou cobrança' };
  return { comercial: false, motivo: 'sem sinal comercial no pedido (ative manualmente se quiser)' };
}

// ---------------------------------------------------------------------------
// Autenticação e identidade
// ---------------------------------------------------------------------------
const AUTH_TRIGGERS = ['login', 'cadastro', 'entrar com', 'conta', 'contas', 'autenticacao', 'usuarios', 'senha', 'google', 'facebook', 'apple', 'passkey', 'passkeys', 'webauthn', 'mfa', '2fa', 'sso', 'oauth', 'area de membros', 'saas'];
const PROVIDERS = {
  google: { nome: 'Google', termos: ['login com google', 'entrar com google', 'conta google', 'login google', 'google login', 'com google', 'autenticacao google', 'sso do google'], via: 'Google Identity Services / OpenID Connect do Google', doc: 'https://developers.google.com/identity' },
  facebook: { nome: 'Facebook', termos: ['facebook', 'login com facebook', 'login com meta', 'conta meta'], via: 'Facebook Login (Meta for Developers), OAuth 2.0', doc: 'https://developers.facebook.com/docs/facebook-login' },
  github: { nome: 'GitHub', termos: ['login com github', 'entrar com github', 'oauth do github'], via: 'GitHub OAuth App ou GitHub App', doc: 'https://docs.github.com/apps/oauth-apps' },
  apple: { nome: 'Apple', termos: ['login com apple', 'entrar com apple', 'sign in with apple', 'conta apple', 'com apple'], via: 'Sign in with Apple (OpenID Connect)', doc: 'https://developer.apple.com/sign-in-with-apple/' },
};

export function authSpecialist(t, signals) {
  const need = signals.personal || any(t, AUTH_TRIGGERS);
  if (!need) return null;
  const sociais = Object.entries(PROVIDERS).filter(([k, p]) => any(t, p.termos) || (k === 'google' && /(login|entrar) com [a-z ]*google|google (e|ou) (facebook|apple|github)|(facebook|apple|github) (e|ou) google/.test(t))).map(([k, p]) => ({ id: k, ...p }));
  const passkeys = any(t, ['passkey', 'passkeys', 'webauthn', 'sem senha']);
  const mfa = any(t, ['mfa', '2fa', 'dois fatores', 'multifator']) || signals.payments || signals.enterprise;
  const orgs = any(t, ['organizacao', 'organizacoes', 'empresas clientes', 'multi-tenant', 'equipes', 'times', 'b2b']);
  const rf = [];
  rf.push({ core: true, t: 'Cadastro e login com e-mail e senha', f: 'Permitir acesso com credenciais próprias.', c: 'Cadastro com verificação de e-mail, senha armazenada com Argon2id (ou bcrypt), recuperação por link de uso único e expiração curta, bloqueio progressivo após falhas.', in: 'E-mail e senha.', out: 'Conta verificada e sessão autenticada.', r: 'Respostas idênticas para e-mail existente e inexistente (sem enumeração de contas).', ac: 'Cadastrar e-mail já existente e e-mail novo produz a mesma mensagem; 10 falhas seguidas bloqueiam temporariamente.', v: 'Testes de enumeração, força bruta e expiração do link.', comp: 'Serviço de identidade', ctrl: 'Hash Argon2id, rate limiting, link de uso único' });
  for (const p of sociais) rf.push({ core: true, distinto: true, t: `Login com ${p.nome}`, f: `Entrar usando a conta ${p.nome} sem criar nova senha.`, c: `Fluxo oficial (${p.via}) com Authorization Code + PKCE, parâmetros state e nonce, validação do token no servidor (assinatura, emissor, audiência e expiração) e vínculo à conta local.`, in: `Autorização do usuário no ${p.nome}.`, out: `Sessão autenticada e conta local vinculada à identidade ${p.nome}.`, r: `A aplicação nunca pede nem armazena a senha do ${p.nome}; vínculo automático com conta existente só se o e-mail vier verificado pelo provedor.`, ac: `Token do ${p.nome} emitido para outro app, sem state ou com nonce divergente é rejeitado.`, v: `Testes com tokens adulterados e state/nonce inválidos; revisão contra a documentação oficial (${p.doc}).`, comp: 'Serviço de identidade', ctrl: 'OAuth 2.0 / OIDC com PKCE, state e nonce' });
  if (passkeys) rf.push({ core: true, t: 'Passkeys (WebAuthn)', f: 'Login sem senha resistente a phishing.', c: 'Registro e autenticação com WebAuthn usando biblioteca consolidada, com desafio de uso único e verificação da origem.', in: 'Credencial do dispositivo.', out: 'Sessão autenticada.', r: 'Usuário pode cadastrar mais de uma passkey e removê-las.', ac: 'Desafio reutilizado é rejeitado.', v: 'Testes com desafio repetido e origem incorreta.', comp: 'Serviço de identidade', ctrl: 'WebAuthn' });
  if (mfa) rf.push({ core: true, t: 'Autenticação multifator', f: 'Proteger contas mesmo com senha vazada.', c: 'MFA por aplicativo autenticador (TOTP) ou passkey, códigos de recuperação de uso único e exigência de reautenticação para ações críticas.', in: 'Segundo fator.', out: 'Sessão com nível de garantia elevado.', r: 'SMS só como último recurso, se usado.', ac: 'Ação crítica sem segundo fator recente é bloqueada.', v: 'Testes de fluxo com e sem MFA.', comp: 'Serviço de identidade', ctrl: 'MFA e step-up' });
  rf.push({ t: 'Gestão de sessões e dispositivos', f: 'Dar controle ao usuário e limitar o estrago de sessões roubadas.', c: 'Sessões em cookie HttpOnly, Secure e SameSite, com expiração por inatividade; tela de dispositivos conectados com revogação individual e "sair de todos".', in: 'Sessões ativas.', out: 'Lista de dispositivos e revogação.', r: 'Tokens sensíveis nunca ficam em localStorage; troca de senha revoga as outras sessões.', ac: 'Após "sair de todos", sessão antiga recebe 401.', v: 'Teste de revogação e de proteção CSRF.', comp: 'Serviço de identidade', ctrl: 'Cookies seguros, CSRF token, revogação' });
  rf.push({ t: orgs ? 'Autorização por papel e organização' : 'Autorização por papel', f: 'Cada usuário vê e faz só o que lhe cabe.', c: orgs ? 'RBAC por organização (dono, administrador, membro) com isolamento total de dados entre organizações; ABAC onde regras dependem de atributos do recurso.' : 'RBAC com papéis definidos e checagem de permissão no servidor em toda operação.', in: 'Usuário, papel, organização e recurso.', out: 'Permitido ou negado (403).', r: 'Permissões nunca decididas pelo front-end.', ac: orgs ? 'Usuário da organização A não acessa nenhum dado da organização B, mesmo trocando IDs.' : 'Usuário comum recebe 403 em rotas administrativas.', v: 'Testes de IDOR e de escalonamento de privilégio.', comp: 'Serviço de identidade', ctrl: orgs ? 'Isolamento multi-tenant' : 'RBAC no servidor' });
  return {
    rf,
    sociais,
    controles: ['Argon2id para senhas', 'segredos só no servidor ou cofre', 'nenhuma credencial no código', 'nenhum token sensível no front-end', 'cookies HttpOnly/Secure/SameSite', 'HTTPS', 'proteção CSRF e XSS', 'rate limiting', 'prevenção de enumeração de contas', 'autorização no servidor', 'privilégio mínimo', 'rotação de segredos', 'logs sem senhas ou tokens', 'testes de segurança', 'plano de resposta a incidentes'],
    normas: ['asvs'],
    glossario: [['OAuth 2.0', 'protocolo de autorização delegada'], ['OpenID Connect', 'camada de identidade sobre o OAuth 2.0'], ['PKCE', 'proteção do fluxo de autorização contra interceptação do código'], ['Passkey', 'credencial WebAuthn guardada no dispositivo']],
    docs: sociais.map(p => `${p.nome}: ${p.doc}`),
  };
}

// ---------------------------------------------------------------------------
// Painel administrativo
// ---------------------------------------------------------------------------
export function adminSpecialist(t, signals, ctx) {
  if (any(t, LOCAL_ONLY) && !signals.personal && !ctx.comercial) return null;
  const needs = signals.personal || signals.payments || ctx.comercial || any(t, ['conteudo', 'blog', 'cursos', 'painel', 'admin', 'administrativo', 'gestao']);
  if (!needs) return null;
  const mod = ['Dashboard com indicadores do produto', 'Auditoria de ações administrativas', 'Configurações'];
  if (signals.personal) mod.push('Gestão de usuários', 'Gestão de permissões e administradores');
  if (any(t, ['organizacao', 'organizacoes', 'b2b', 'equipes', 'multi-tenant'])) mod.push('Gestão de organizações');
  if (signals.payments || ctx.comercial) mod.push('Assinaturas e pagamentos', 'Reembolsos e chargebacks');
  if (any(t, ['loja', 'ecommerce', 'e-commerce', 'produtos', 'marketplace'])) mod.push('Produtos e estoque');
  if (any(t, ['conteudo', 'blog', 'curso', 'cursos', 'aulas', 'area de membros'])) mod.push('Conteúdo');
  if (any(t, ['webhook', 'webhooks', 'hotmart', 'kiwify', 'stripe', 'mercado pago', 'integracao', 'integracoes'])) mod.push('Integrações e webhooks (com reprocessamento manual)');
  if (any(t, ['ia', 'llm', 'agente', 'chatbot'])) mod.push('Consumo e custo de IA');
  mod.push('Suporte (atendimento ao usuário)');
  const rf = [{ core: true, t: 'Painel administrativo contextual', f: 'Operar o produto com segurança.', c: `Módulos: ${mod.join('; ')}.`, in: 'Ações de administradores autenticados.', out: 'Operações realizadas e registradas na auditoria.', r: 'MFA obrigatório para administradores; reautenticação para ações críticas (reembolso, troca de papel, exclusão); dados sensíveis mascarados; administradores nunca veem senhas.', ac: 'Usuário sem papel administrativo recebe 403 em todas as rotas do painel; toda ação crítica gera registro de auditoria com autor e horário.', v: 'Testes de autorização por rota, de escalonamento de privilégio e de IDOR entre organizações.', comp: 'Painel administrativo', ctrl: 'MFA, RBAC granular no backend, auditoria' }];
  return { rf, modulos: mod };
}

// ---------------------------------------------------------------------------
// Pagamentos e webhooks
// ---------------------------------------------------------------------------
// Só nomes, apelidos e documentação oficial conhecida. Eventos, formatos e
// mecanismos de verificação devem ser confirmados na documentação oficial.
export const PAYMENT_PLATFORMS = {
  stripe: { nome: 'Stripe', apelidos: ['stripe', 'straipe'], doc: 'https://docs.stripe.com/webhooks' },
  mercadopago: { nome: 'Mercado Pago', apelidos: ['mercado pago', 'mercadopago', 'mercado pag'], doc: 'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks' },
  hotmart: { nome: 'Hotmart', apelidos: ['hotmart', 'hotmat', 'hotmarte', 'rotmart', 'hot mart'], doc: 'https://help.hotmart.com/pt-br/article/como-configurar-sua-api-atraves-do-webhook-postback-/360001491352' },
  kiwify: { nome: 'Kiwify', apelidos: ['kiwify', 'kiwfy', 'kiwifi', 'kiuifi', 'quiwify', 'kiwi fy'], doc: 'https://docs.kiwify.com.br' },
  eduzz: { nome: 'Eduzz', apelidos: ['eduzz', 'eduz'], doc: null },
  monetizze: { nome: 'Monetizze', apelidos: ['monetizze', 'monetizi'], doc: null },
  braip: { nome: 'Braip', apelidos: ['braip', 'braipe', 'braipi'], doc: null },
  paypal: { nome: 'PayPal', apelidos: ['paypal', 'pay pal', 'paipal'], doc: 'https://developer.paypal.com' },
};

export function detectPlatforms(t) {
  const found = [];
  for (const [id, p] of Object.entries(PAYMENT_PLATFORMS)) {
    const hit = p.apelidos.find(a => has(t, a));
    if (hit) found.push({ id, nome: p.nome, doc: p.doc, escrito: hit, corrigido: hit !== p.apelidos[0] });
  }
  return found;
}

export function paymentSpecialist(t, signals, ctx) {
  const plats = detectPlatforms(t);
  const webhook = any(t, ['webhook', 'webhooks', 'postback', 'notificacao de pagamento']);
  if (!plats.length && !webhook && !(signals.payments && ctx.comercial)) return null;
  const nomes = plats.length ? plats.map(p => p.nome).join(', ') : 'o provedor escolhido';
  const rf = [
    { core: true, t: 'Recebimento e verificação de webhooks', f: 'Aceitar apenas eventos legítimos do provedor.', c: `Endpoint dedicado por provedor (${nomes}) que valida a autenticidade pelo mecanismo oficial do provedor (assinatura, token ou equivalente documentado) antes de qualquer processamento, e responde rápido delegando o trabalho a uma fila.`, in: 'Requisição do provedor (cabeçalhos e corpo bruto).', out: 'Evento aceito e enfileirado, ou rejeitado (401/400).', r: 'Usar somente eventos e campos que a documentação oficial descreve; sem autenticidade válida, nada muda no sistema.', ac: 'Evento com assinatura/token inválido é rejeitado e registrado; evento válido é enfileirado em menos de 2 s.', v: 'Testes com payloads válidos do ambiente de testes do provedor (quando existir) e com payloads adulterados.', comp: 'Gateway de webhooks', ctrl: 'Verificação de autenticidade pelo mecanismo oficial' },
    { core: true, t: 'Idempotência, deduplicação e proteção contra replay', f: 'Processar cada evento uma única vez.', c: 'Registrar o identificador de cada evento, ignorar repetidos e recusar eventos antigos demais quando o provedor fornecer marca de tempo.', in: 'Identificador e data do evento.', out: 'Evento processado uma vez.', r: 'Retentativas do provedor nunca duplicam acesso, cobrança ou e-mail.', ac: 'O mesmo evento enviado 3 vezes gera exatamente 1 efeito.', v: 'Teste de reenvio do mesmo evento.', comp: 'Gateway de webhooks', ctrl: 'Chave de idempotência e janela de replay' },
    { core: true, t: 'Ciclo de acesso a partir do pagamento', f: 'Liberar e retirar acesso conforme a situação real do pagamento.', c: 'Mapear os eventos documentados do provedor para: liberar acesso (pagamento aprovado), suspender (atraso/falha de renovação), revogar (cancelamento, reembolso, chargeback) e renovar (assinatura renovada).', in: 'Eventos validados.', out: 'Estado de acesso do cliente atualizado e notificado.', r: 'Acesso premium nunca é liberado com base em dado vindo do navegador; em dúvida, consultar a API oficial do provedor.', ac: 'Chamar a rota de liberação a partir do front-end, sem evento válido, não libera acesso.', v: 'Testes por tipo de evento e teste de tentativa de liberação pelo cliente.', comp: 'Serviço de assinaturas', ctrl: 'Estado de pagamento só do provedor' },
    { t: 'Processamento assíncrono com retentativas', f: 'Não perder eventos quando algo falha.', c: 'Fila com retentativas exponenciais, fila de erro (dead-letter) e reprocessamento manual pelo painel.', in: 'Eventos enfileirados.', out: 'Evento processado ou na fila de erro com motivo.', r: 'Número máximo de tentativas definido.', ac: 'Falha simulada no banco leva o evento para nova tentativa e, depois do limite, para a fila de erro.', v: 'Teste com falha injetada.', comp: 'Fila de processamento', ctrl: '—' },
    { t: 'Reconciliação periódica', f: 'Corrigir divergências entre o sistema e o provedor.', c: 'Rotina diária que compara pedidos e assinaturas locais com a API oficial do provedor e aponta diferenças.', in: 'Pedidos locais e dados do provedor.', out: 'Relatório de divergências e correções.', r: 'Correções automáticas só para casos inequívocos; o resto vai para revisão.', ac: 'Pagamento aprovado no provedor e pendente no sistema aparece no relatório.', v: 'Teste com divergência simulada.', comp: 'Serviço de assinaturas', ctrl: 'Auditoria' },
  ];
  const pend = plats.filter(p => !p.doc).map(p => p.nome);
  return {
    rf, plataformas: plats,
    confirmacoes: plats.filter(p => p.corrigido).map(p => `Entendi "${p.escrito}" como ${p.nome}. Confirme se é essa plataforma.`),
    pendencias: [
      'Consultar na documentação oficial: eventos disponíveis, formato do corpo, mecanismo de verificação de autenticidade, limites e ambiente de testes.',
      ...(pend.length ? [`Documentação oficial de ${pend.join(', ')} não está cadastrada na ferramenta: localizar no site oficial da plataforma antes de implementar.`] : []),
    ],
    docs: plats.filter(p => p.doc).map(p => `${p.nome}: ${p.doc}`),
  };
}

// ---------------------------------------------------------------------------
// Monetização (cenários, nunca promessas)
// ---------------------------------------------------------------------------
const MODELS = {
  assinatura: { nome: 'SaaS por assinatura', quando: 'uso recorrente que gera valor todo mês' },
  freemium: { nome: 'Freemium', quando: 'produto com custo marginal baixo e valor percebido rápido' },
  empresarial: { nome: 'Planos empresariais', quando: 'clientes com equipes, exigência de SSO, auditoria ou suporte' },
  creditos: { nome: 'Créditos de uso', quando: 'custo variável por uso (ex.: chamadas de IA)' },
  api: { nome: 'API paga', quando: 'o valor é consumido por outros sistemas' },
  marketplace: { nome: 'Comissão de marketplace', quando: 'o produto conecta compradores e vendedores' },
  produtoDigital: { nome: 'Produto digital (pagamento único)', quando: 'curso, e-book, template ou ferramenta entregue uma vez' },
  afiliados: { nome: 'Afiliados', quando: 'produto digital vendido também por parceiros' },
  licenca: { nome: 'Licença / pagamento único', quando: 'software instalado ou de uso local' },
  vendaDireta: { nome: 'Venda direta de produtos', quando: 'loja virtual com estoque' },
  publicidade: { nome: 'Publicidade', quando: 'audiência grande e conteúdo gratuito' },
  servicos: { nome: 'Serviços premium / consultoria', quando: 'implantação, personalização ou suporte dedicado' },
  automacao: { nome: 'Automação como serviço', quando: 'o cliente paga por um processo executado para ele' },
};

export function monetizationSpecialist(t, signals, ctx, arqIds) {
  if (!ctx.comercial) return null;
  const pick = new Set();
  if (arqIds.includes('ecommerce')) { pick.add('vendaDireta'); if (any(t, ['marketplace', 'vendedores'])) pick.add('marketplace'); }
  if (any(t, ['curso', 'cursos', 'ebook', 'e-book', 'infoproduto', 'area de membros', 'hotmart', 'kiwify', 'eduzz', 'monetizze', 'braip'])) { pick.add('produtoDigital'); pick.add('afiliados'); if (any(t, ['assinatura', 'mensal', 'comunidade'])) pick.add('assinatura'); }
  if (arqIds.includes('api-rest') && any(t, ['publica', 'desenvolvedores', 'parceiros', 'vender'])) pick.add('api');
  if (arqIds.includes('plataforma-ia')) { pick.add('creditos'); pick.add('assinatura'); }
  if (any(t, ['saas', 'plataforma', 'sistema', 'ferramenta']) && !pick.has('vendaDireta')) { pick.add('assinatura'); pick.add('freemium'); }
  if (any(t, ['empresas', 'b2b', 'corporativo', 'equipes', 'organizacoes'])) pick.add('empresarial');
  if (any(t, ['automatizar', 'automacao', 'robo', 'bot'])) pick.add('automacao');
  if (any(t, ['desktop', 'instalavel', 'offline', 'extensao'])) pick.add('licenca');
  if (any(t, ['blog', 'portal de noticias', 'conteudo gratuito'])) pick.add('publicidade');
  if (!pick.size) { pick.add('assinatura'); pick.add('servicos'); }
  const modelos = [...pick].slice(0, 4).map(k => ({ id: k, ...MODELS[k] }));
  return {
    modelos,
    precificacao: [
      'Defina 2 ou 3 planos ancorados no valor entregue (ex.: limite de uso, número de usuários, recursos avançados).',
      'Calcule o custo por cliente (infraestrutura, IA, taxas do meio de pagamento, suporte) antes de fixar o preço.',
      'Teste o preço com clientes reais (entrevistas, pré-venda ou lista de espera) antes de construir tudo.',
    ],
    cenario: 'Receita mensal (cenário) = clientes pagantes × preço médio − (custo por cliente × clientes + custos fixos). Preencha com dados medidos; sem dados, trate qualquer número como hipótese.',
    metricas: ['Conversão visitante → cadastro → pagante', 'Churn mensal', 'Custo de aquisição de cliente (CAC)', 'Receita recorrente mensal (MRR), quando houver assinatura'],
    aviso: 'Projeções são cenários hipotéticos, não garantia de faturamento. Nenhuma demanda ou receita foi verificada pela ferramenta.',
  };
}

// ---------------------------------------------------------------------------
// Jornada completa do produto comercial
// ---------------------------------------------------------------------------
export function productJourney(ctx, auth, pay) {
  if (!ctx.comercial || !auth) return null;
  const etapas = [
    ['Visitante', 'landing page com proposta de valor e planos, sem depoimentos fictícios'],
    ['Cadastro', 'formulário mínimo, verificação de e-mail, consentimento quando exigido'],
    ['Autenticação', 'e-mail/senha e provedores sociais escolhidos, com MFA quando aplicável'],
    ['Onboarding', 'primeira tarefa útil guiada em poucos passos'],
    ['Seleção de plano', 'comparação clara de planos e preços'],
    ['Pagamento', pay ? `checkout do provedor (${pay.plataformas.map(p => p.nome).join(', ') || 'a definir'})` : 'checkout do provedor de pagamento escolhido'],
    ['Validação do pagamento', 'somente por webhook verificado ou consulta à API oficial'],
    ['Liberação de acesso', 'ativação automática e idempotente do plano'],
    ['Uso do produto', 'funcionalidades do plano com limites aplicados no servidor'],
    ['Suporte', 'canal de suporte e base de ajuda'],
    ['Renovação ou cancelamento', 'renovação, cancelamento pelo próprio cliente, suspensão e revogação conforme eventos'],
  ];
  return etapas.map(([etapa, componente], i) => ({ ordem: i + 1, etapa, componente }));
}

// ---------------------------------------------------------------------------
// Viabilidade (estimativas qualitativas com premissas explícitas)
// ---------------------------------------------------------------------------
export function viability(b, extras) {
  const core = b.rf.filter(r => r.core).length;
  const integracoes = (extras.pay ? 1 : 0) + (extras.auth?.sociais.length || 0) + (b.arqs.some(a => a.id === 'plataforma-ia') ? 1 : 0);
  const pontos = core + integracoes * 1.5 + (extras.admin ? 1 : 0);
  const complexidade = pontos <= 5 ? 'baixa' : pontos <= 10 ? 'média' : 'alta';
  const semanas = Math.max(2, Math.ceil(pontos * 0.8));
  const dependencias = [
    ...(extras.pay ? extras.pay.plataformas.map(p => `Provedor de pagamento: ${p.nome}`) : []),
    ...(extras.auth ? extras.auth.sociais.map(p => `Provedor de identidade: ${p.nome}`) : []),
    ...(b.arqs.some(a => a.id === 'plataforma-ia') ? ['Provedor de modelo de IA'] : []),
  ];
  return {
    complexidade,
    mvp: `${semanas}–${semanas * 2} semanas para 1 pessoa em tempo parcial (estimativa grosseira a partir de ${core} requisitos principais e ${integracoes} integração(ões); refine após o primeiro protótipo).`,
    custoInicial: dependencias.length > 1 ? 'médio: contas de desenvolvedor, domínio, hospedagem e taxas dos provedores' : 'baixo: domínio e hospedagem com camada gratuita podem bastar no MVP',
    custoMensal: 'proporcional ao uso: hospedagem, banco, e-mail transacional' + (b.arqs.some(a => a.id === 'plataforma-ia') ? ', consumo de IA (maior variável)' : '') + (extras.pay ? ', taxas por transação do provedor' : ''),
    dependencias,
    manutencao: complexidade === 'alta' ? 'alta: várias integrações externas exigem monitoramento de mudanças de API' : 'moderada',
    riscos: [...b.ameacas.slice(0, 3).map(x => x.a), ...(extras.pay ? ['Mudanças nas regras ou eventos do provedor de pagamento'] : [])],
    validacao: 'Antes do MVP completo: 10 a 15 entrevistas com o público-alvo e uma página de lista de espera para medir interesse real.',
    premissas: ['Estimativas sem pesquisa de mercado verificada.', 'Equipe de uma pessoa com conhecimento das tecnologias sugeridas.', 'Infraestrutura simples (sem Kubernetes) no MVP.'],
  };
}
