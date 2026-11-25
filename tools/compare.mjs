// Compara o motor v1 (tools/legacy) com o motor atual nos mesmos cenários.
// Uso: node tools/compare.mjs
import fs from 'node:fs';
import * as v1 from './legacy/engine-v1.js';
import * as v2 from '../lib/engine.js';
const cases = JSON.parse(fs.readFileSync(new URL('./cenarios.json', import.meta.url)));
const norm = s => s.toLowerCase();
function measure(a) {
  const items = a.prompt.split('\n').filter(l => l.trim().startsWith('- '));
  return {
    eco: items.filter(l => norm(l).includes(norm(a.pedido))).length,
    rf: new Set(a.prompt.match(/RF-\d{3}/g) || []).size,
    repetidas: items.length - new Set(items.map(l => l.trim())).size,
    palavras: a.prompt.split(/\s+/).length,
  };
}
const rows = cases.map(c => {
  const a = v1.analyze(c), b = v2.analyze(c);
  return { pedido: c, v1: measure(a), v2: measure(b), modo1: a.modo, modo2: b.modo, nota: b.qualidade.total, arq: b.arquetipos.join(' + ') || '—' };
});
console.log('| # | Pedido | Eco do pedido v1→v2 | RF com ID v1→v2 | Linhas repetidas v1→v2 | Palavras v1→v2 | Modo v2 | Nota v2 |');
console.log('|---|---|---|---|---|---|---|---|');
rows.forEach((r, i) => console.log(`| ${i + 1} | ${r.pedido} | ${r.v1.eco} → ${r.v2.eco} | ${r.v1.rf} → ${r.v2.rf} | ${r.v1.repetidas} → ${r.v2.repetidas} | ${r.v1.palavras} → ${r.v2.palavras} | ${r.modo2} | ${r.nota} |`));
