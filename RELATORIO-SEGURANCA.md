# Relatório de segurança — Engineering Intelligence v3

Escopo: o código deste repositório (front-end estático, funções serverless em `api/`, motor em `lib/`). Não inclui os sistemas que os prompts gerados descrevem.

## Superfície exposta

| Rota | Entrada | Controles |
|---|---|---|
| `GET /` e arquivos estáticos | — | CSP `default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (vercel.json) |
| `POST /api/generate` | `pedido` (até 2.000 caracteres), `nivel`, `comercial`, `refinarComIA` | corpo JSON limitado a 16 KB; IA só com provedor configurado no servidor; limite por IP e limite diário; tempo máximo de 25 s; falha do provedor não expõe detalhes nem a chave |
| `POST /api/research` | `consulta` (até 120 caracteres), `fontes` (lista fechada) | só provedores cadastrados (GitHub, Hacker News); URLs montadas pelo servidor com `encodeURIComponent` (sem SSRF por URL do usuário); limite de 20 consultas/hora por IP; tempo máximo de 8 s por fonte; cache de 30 min |
| `GET /api/health` | — | informa apenas se a IA está ativa, modelo, limites, status das fontes e contagem de uso; nunca a chave |

## Segredos

- `AI_API_KEY` e `GITHUB_TOKEN` existem só em variáveis de ambiente do servidor. Testes automatizados verificam que `/api/health` não devolve a chave.
- Nada é gravado no navegador além de histórico e favoritos do próprio usuário (armazenamento local, sem dados sensíveis).

## Front-end

- Todo conteúdo dinâmico é inserido com `textContent` (sem `innerHTML` com dados), o que evita XSS a partir do pedido, das ideias ou dos resultados de pesquisa.
- Links de pesquisa abrem com `rel="noopener"`.

## Limites conhecidos

- Limites de uso ficam em memória por instância serverless: são uma proteção de melhor esforço. Para limite global, usar Vercel Firewall (rate limiting) ou um armazenamento compartilhado.
- Os provedores de pesquisa externos podem mudar o formato das respostas; o código trata falhas por fonte sem derrubar as outras.
- Não houve teste de intrusão externo. Este relatório descreve controles implementados e verificados por testes automatizados, não ausência de vulnerabilidades.

## Verificações executadas

- 59 testes automatizados (`npm test`), incluindo: rejeição de método, limite de tamanho, limite por IP, falha do provedor, ausência da chave no health, pesquisa com fetch simulado, falha parcial de fontes e cache.
- Interface verificada no navegador (Playwright) em 360, 390, 768, 1024, 1440 e 1920 px, sem erros de JavaScript.
