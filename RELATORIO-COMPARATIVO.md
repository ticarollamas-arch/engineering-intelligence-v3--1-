# Relatório comparativo — motor v1 × v2

Gerado por `node tools/compare.mjs` sobre os 15 cenários de `tools/cenarios.json` (os mesmos do pedido de upgrade). Os números abaixo foram medidos, não estimados.

## Diagnóstico da v1

- Em **15 de 15** cenários, a v1 copiava o pedido como requisito ("Implementar o objetivo descrito: …").
- **Nenhum** requisito tinha identificador, entradas, saídas ou teste associado.
- Seção fixa de 19 itens para qualquer pedido, inclusive "quero um sistema" (599 palavras sem conteúdo específico).
- Não reconhecia erros de digitação ("andorid"), não detectava conflitos nem repetição.

## Resultado

| # | Pedido | Eco do pedido v1→v2 | RF com ID v1→v2 | Linhas repetidas v1→v2 | Palavras v1→v2 | Modo v2 | Nota v2 |
|---|---|---|---|---|---|---|---|
| 1 | Quero desenvolver uma ferramenta de Bug Bounty para análise e pesquisa de segurança | 1 → 0 | 0 → 6 | 0 → 0 | 568 → 1649 | Desenvolvimento | 98 |
| 2 | Quero desenvolver um e-commerce | 1 → 0 | 0 → 6 | 0 → 0 | 829 → 1911 | Desenvolvimento | 98 |
| 3 | Criar um aplicativo Android | 1 → 0 | 0 → 5 | 0 → 0 | 631 → 1327 | Desenvolvimento | 98 |
| 4 | Criar uma ferramenta que pega um ZIP e publica no GitHub | 1 → 0 | 0 → 5 | 0 → 0 | 623 → 1392 | Desenvolvimento | 98 |
| 5 | Implantar minha aplicação em uma VPS | 1 → 0 | 0 → 5 | 0 → 0 | 606 → 1269 | Infraestrutura e deploy | 98 |
| 6 | Desenvolver uma API REST | 1 → 0 | 0 → 4 | 0 → 0 | 652 → 1204 | Desenvolvimento | 98 |
| 7 | Criar uma plataforma de inteligência artificial | 1 → 0 | 0 → 5 | 0 → 0 | 793 → 1416 | Inteligência artificial | 98 |
| 8 | Corrigir um projeto existente que está com erros | 1 → 0 | 0 → 4 | 0 → 0 | 637 → 1072 | Melhoria de projeto existente | 96 |
| 9 | Criar um pipeline DevSecOps | 1 → 0 | 0 → 4 | 0 → 0 | 600 → 1078 | Infraestrutura e deploy | 99 |
| 10 | Sistema de agendamento para clínica veterinária | 1 → 0 | 0 → 6 | 0 → 0 | 608 → 1457 | Desenvolvimento | 88 |
| 11 | qero cria um aplicativo andorid pra vende roupa com pix | 1 → 0 | 0 → 14 | 0 → 0 | 724 → 3194 | Desenvolvimento | 98 |
| 12 | plataforma com IA que analisa repositórios do GitHub e gera relatório de segurança | 1 → 0 | 0 → 11 | 0 → 0 | 838 → 2546 | Inteligência artificial | 98 |
| 13 | quero um sistema | 1 → 0 | 0 → 0 | 0 → 0 | 599 → 109 | Descoberta de requisitos | 19 |
| 14 | site estático sem backend com login de usuários | 1 → 0 | 0 → 9 | 0 → 0 | 787 → 2057 | Desenvolvimento | 94 |
| 15 | quero uma API REST, uma API REST segura, com uma API REST | 1 → 0 | 0 → 4 | 0 → 0 | 676 → 1204 | Desenvolvimento | 98 |

Observações de leitura:

- **Eco do pedido** = linhas do prompt que contêm o pedido literal. Zero em todos os casos da v2.
- **RF com ID** = requisitos distintos (RF-001…), cada um com finalidade, comportamento, entradas, saídas, restrições, aceitação e teste (T-001…).
- **Palavras** cresce porque agora há conteúdo específico (requisitos, matriz de rastreabilidade, referenciais com verificação e evidência). No cenário 13, pedido vago, o prompt encolheu de 599 para 109 palavras: a v2 pede descoberta de requisitos em vez de inventar.
- **Nota v2** é calculada pelos critérios da rubrica (100 pontos) e desconta informações ausentes, conflitos, requisitos sem controle e decomposição genérica. Nenhum cenário recebe 100 automaticamente.

## O que mudou no código

| Componente pedido | Onde está |
|---|---|
| Intent / Domain Intelligence | `interpret()` em `lib/engine.js`: correção de digitação (aliases + distância de edição), negações ("sem backend"), combinação de arquétipos, extração de objeto e público para pedidos inéditos, conflitos e repetições |
| Expert Routing / Knowledge Mapping | `build()` + `lib/knowledge.js` (11 arquétipos com especialistas, componentes, requisitos, ameaças, normas e material didático) |
| Requirement Intelligence | requisitos com 8 campos; decomposição genérica (`genericRequirements`) para domínios não cadastrados; requisitos transversais (autenticação, LGPD) |
| Architecture Intelligence | componentes por arquétipo e regra de proporcionalidade (monólito modular até 6 componentes) |
| Security / Standards Mapping | ameaças com controle; 18 referenciais com motivo, requisito, controle, implementação, verificação e evidência; normas exigidas pelo pedido (LGPD, PCI) nunca são cortadas pelo limite do nível |
| Contextual Prompt Composer | `composePrompt()`: seções dinâmicas, 4 níveis (Essencial, Profissional, Avançado, Enterprise) |
| Anti-Repetition | `antiRepetition()`: frases genéricas proibidas, eco do pedido, linhas idênticas e quase idênticas |
| Critical Review | `reviewChecks()` com 9 perguntas e laço de correção com limite configurável (`maxRevisions`, padrão 2, máximo 5) |
| Quality Validation | `scoreQuality()`: rubrica de 100 pontos com justificativas e deficiências |
| Rastreabilidade | requisito → componente → controle → teste → aceitação → evidência |
| Knowledge Intelligence | `learning()`: glossário, conceitos, fluxo, diagrama Mermaid, decisões, comandos, erros comuns, exercícios, validação independente, separação gerado/validado/estudar |

## Proteção contra regressões

- Ponto de recuperação: commit "v1 (ponto de recuperação)" e cópia do motor antigo em `tools/legacy/engine-v1.js`.
- A interface manteve layout, paleta, exemplos, cópia/download e refinamento opcional por IA; os campos que ela já usava (`objetivo`, `modo`, `especialidades`, `normas`, `entregaveis`, `validacao`, `prompt`) continuam existindo.
- A API `/api/generate` mantém o contrato e aceita o novo campo opcional `nivel`.
- Testes: 28 passando (22 do motor, incluindo os 15 cenários, e 6 da API).
- Interface verificada no navegador em 360, 390, 768, 1024, 1440 e 1920 px, sem rolagem horizontal.

## Limitações conhecidas

- A interpretação é por regras e conhecimento cadastrado, não por um modelo de linguagem. Pedidos de domínios não cadastrados recebem decomposição genérica, sinalizada na nota e nas deficiências.
- Os referenciais não citam números de controle: o motor não tem acesso às fontes oficiais e não inventa identificadores.
- O refinamento por IA continua opcional e depende de provedor configurado no servidor.

---

# v2 → v3 (plataforma universal)

## Preservado

- Motor de raciocínio contextual v2, níveis, rastreabilidade, revisão crítica, nota de qualidade e módulo de aprendizagem.
- Os 15 cenários de aceitação continuam passando com a mesma nota ou melhor (tabela acima regenerada com a v3).
- Layout, paleta, refinamento opcional por IA e contrato da API.

## Novo, no mesmo motor central

| Capacidade | Onde | Verificado por |
|---|---|---|
| Especialista em autenticação (e-mail/senha, Google, Facebook, GitHub, Apple, passkeys, MFA, sessões, RBAC/ABAC, organizações) | `lib/specialists.js` → `authSpecialist` | testes de Google, Facebook, falso positivo ("Google Cloud", "minha meta"), controles obrigatórios |
| Painel administrativo contextual com segurança própria | `adminSpecialist` | testes de MFA, reautenticação, "nunca vê senhas", ausência em scripts locais |
| Pagamentos e webhooks (Stripe, Mercado Pago, Hotmart, Kiwify, Eduzz, Monetizze, Braip, PayPal) | `paymentSpecialist` | correção de "hotmat"/"kiwfy" com pedido de confirmação; documentação oficial só quando verificada; pendência quando não há |
| Monetização por cenários, desativável | `monetizationSpecialist` | modelos compatíveis por tipo de produto; desativada em projetos educacionais |
| Jornada completa do produto comercial (11 etapas) | `productJourney` | teste da etapa "validação do pagamento" |
| Viabilidade com premissas | `viability` | complexidade, MVP, custos qualitativos, dependências |
| Novos domínios: produto digital/área de membros, automação/script, plataforma SaaS | `lib/knowledge.js` | curso na Hotmart não vira e-commerce; script não ganha painel |
| Gerador de startups sob demanda (126.300 combinações, sem banco estático) | `lib/ideas.js` | 5.000 índices → 5.000 ideias distintas; sem nomes repetidos; deduplicação por núcleo e semântica |
| Hackathons a partir do regulamento | `parseRegulation`, `hackathonProjects` | pesos 30/25/25/20 lidos; sem regulamento, critérios não são inventados |
| Pesquisa com fontes reais | `lib/research.js`, `api/research.js` | GitHub e Hacker News com fonte, data e confiabilidade; demais fontes declaradas como não integradas |
| Histórico, favoritos, exportação, configurações e consumo | `modules.js`, `lib/store.js`, `api/health.js` | teste de interface |

## Correções encontradas durante o desenvolvimento

- Corretor ortográfico trocava "pesquisar" por "pesquisa" e quebrava o modo de pesquisa: flexões da mesma palavra deixaram de ser "corrigidas".
- O antirrepetição apagava campos de requisitos diferentes (Google × Facebook): campos de um requisito agora pertencem a ele, e os textos foram tornados específicos por provedor.
- O limite de requisitos do nível cortava "Login com Facebook" pedido explicitamente: requisitos principais nunca são cortados.
- Termos ambíguos ("meta", "google", "strip", "monetize") geravam falsos positivos e foram restringidos.

## Não implementado (e por quê)

- Reddit, Product Hunt, Google Trends, Devpost e busca web: exigem credenciais, aceite de termos ou não têm API pública documentada; aparecem como "não integrados" com o motivo.
- RAG/busca semântica com índice vetorial e banco de dados: a arquitetura atual é estática + funções sem estado; adicionar exigiria um serviço de banco pago ou gerenciado, o que não foi autorizado.
- Pesquisa ao vivo não foi executada neste ambiente (sem acesso à internet a partir do servidor de testes); foi validada com respostas simuladas no formato documentado das APIs.
