// Histórico e favoritos no armazenamento local do navegador (melhor esforço).
const KEY_H = 'ei:historico', KEY_F = 'ei:favoritos', MAX = 50;
function read(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
export const store = {
  historico: () => read(KEY_H),
  favoritos: () => read(KEY_F),
  registrar(item) { const h = read(KEY_H); h.unshift({ ...item, em: new Date().toISOString() }); write(KEY_H, h.slice(0, MAX)); window.dispatchEvent(new Event('ei:store')); },
  limparHistorico() { write(KEY_H, []); window.dispatchEvent(new Event('ei:store')); },
  favoritar(item) { const f = read(KEY_F); if (!f.some(x => x.chave === item.chave)) { f.unshift({ ...item, em: new Date().toISOString() }); write(KEY_F, f); } window.dispatchEvent(new Event('ei:store')); },
  desfavoritar(chave) { write(KEY_F, read(KEY_F).filter(x => x.chave !== chave)); window.dispatchEvent(new Event('ei:store')); },
  ehFavorito: chave => read(KEY_F).some(x => x.chave === chave),
};
export function download(nome, conteudo, tipo = 'text/markdown') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
