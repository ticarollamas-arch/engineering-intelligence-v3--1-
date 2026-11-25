// Camada extensível de provedores de pesquisa.
// Só estão ATIVOS provedores com API pública documentada e testável.
// Os demais aparecem com o motivo de não estarem integrados, sem endpoints inventados.
// Cada resultado traz fonte, link, data do item, data da consulta e confiabilidade.

export const PROVIDERS = {
  github: {
    nome: 'GitHub (busca de repositórios)', ativo: true, credencial: 'opcional (GITHUB_TOKEN aumenta o limite)',
    doc: 'https://docs.github.com/rest/search/search', custo: 'gratuito, com limite de requisições',
    confiabilidade: 'sinal de interesse técnico (estrelas, atividade); não prova demanda de mercado',
    async buscar(q, { fetch, env }) {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`;
      const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'engineering-intelligence' };
      if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
      const j = await r.json();
      return (j.items || []).map(x => ({ titulo: x.full_name, url: x.html_url, resumo: x.description || '', data: x.pushed_at, metrica: `${x.stargazers_count} estrelas` }));
    },
  },
  hackernews: {
    nome: 'Hacker News (via API do Algolia)', ativo: true, credencial: 'não exige',
    doc: 'https://hn.algolia.com/api', custo: 'gratuito',
    confiabilidade: 'discussões de comunidade técnica; indica interesse e dores relatadas, não tamanho de mercado',
    async buscar(q, { fetch }) {
      const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=5`);
      if (!r.ok) throw new Error(`Hacker News respondeu ${r.status}`);
      const j = await r.json();
      return (j.hits || []).map(h => ({ titulo: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, resumo: '', data: h.created_at, metrica: `${h.points ?? 0} pontos, ${h.num_comments ?? 0} comentários` }));
    },
  },
  reddit: { nome: 'Reddit', ativo: false, motivo: 'exige aplicativo OAuth registrado e aceite das regras da API do Reddit; não integrado' },
  producthunt: { nome: 'Product Hunt', ativo: false, motivo: 'API GraphQL exige token de desenvolvedor; não integrado' },
  googletrends: { nome: 'Google Trends', ativo: false, motivo: 'sem acesso de API configurado nesta ferramenta; não integrado' },
  devpost: { nome: 'Devpost', ativo: false, motivo: 'sem API pública documentada conhecida; não integrado (cole o regulamento no módulo Hackathon)' },
  websearch: { nome: 'Busca web', ativo: false, motivo: 'exige provedor de busca com chave; não configurado' },
};

const cache = new Map();
const TTL = 30 * 60_000;
export function _clearCache() { cache.clear(); }

export function providerStatus() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({ id, nome: p.nome, ativo: !!p.ativo, motivo: p.motivo || null, credencial: p.credencial || null, custo: p.custo || null, doc: p.doc || null }));
}

export async function research(consulta, { fontes, fetch = globalThis.fetch, env = {}, usage, timeoutMs = 8000, now = () => new Date() } = {}) {
  const q = String(consulta || '').trim().slice(0, 120);
  if (q.length < 3) throw new Error('Consulta muito curta.');
  const ids = (fontes && fontes.length ? fontes : Object.keys(PROVIDERS)).filter(id => PROVIDERS[id]);
  const consultadoEm = now().toISOString();
  const tasks = ids.map(async id => {
    const p = PROVIDERS[id];
    if (!p.ativo) return { fonte: id, nome: p.nome, status: 'indisponível', motivo: p.motivo, resultados: [] };
    const key = `${id}:${q.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return { ...hit.v, cache: true };
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const wrappedFetch = (u, o = {}) => fetch(u, { ...o, signal: ctrl.signal });
      if (usage) usage[id] = (usage[id] || 0) + 1;
      const itens = await p.buscar(q, { fetch: wrappedFetch, env });
      const v = { fonte: id, nome: p.nome, status: 'ok', confiabilidade: p.confiabilidade, consultadoEm, resultados: itens.map(x => ({ ...x, fonte: p.nome })) };
      cache.set(key, { t: Date.now(), v });
      return v;
    } catch (e) {
      return { fonte: id, nome: p.nome, status: 'falha', motivo: e.name === 'AbortError' ? 'tempo esgotado' : e.message, resultados: [] };
    } finally { clearTimeout(timer); }
  });
  const fontesRes = await Promise.all(tasks);
  return { consulta: q, consultadoEm, fontes: fontesRes, aviso: 'Resultados são sinais para orientar a validação; não comprovam demanda, receita nem originalidade.' };
}
