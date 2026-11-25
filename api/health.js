import { aiConfig, send, usage } from './_shared.js';
import { VERSION } from '../lib/engine.js';
import { providerStatus } from '../lib/research.js';

export default function handler(req, res) {
  const cfg = aiConfig();
  send(res, 200, {
    ok: true, versao: VERSION,
    ia: cfg ? { ativa: true, provedor: cfg.provider, modelo: cfg.model, limitePorVisitante: cfg.perIp, limiteDiario: cfg.daily } : { ativa: false },
    pesquisa: providerStatus(),
    consumo: { ...usage, observacao: 'contagem desde o início desta instância do servidor' },
  });
}
