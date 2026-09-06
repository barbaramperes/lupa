import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Matcher } from '../../../packages/core/src/match';
import { analisar } from '../../../packages/core/src/analisar';
import type { CoreBundle } from '../../../packages/core/src/types';

const CAMINHO_NUCLEO = process.env.LUPA_NUCLEO
  ?? new URL('../../../data/build/core.json', import.meta.url).pathname;

const nucleo: CoreBundle = JSON.parse(readFileSync(CAMINHO_NUCLEO, 'utf8'));
const matcher = new Matcher(nucleo.index);
const porId = new Map(nucleo.substances.map((s) => [s.id, s]));
const claimsPorId = new Map<string, typeof nucleo.claims>();
for (const c of nucleo.claims) {
  const l = claimsPorId.get(c.substance_id);
  if (l) l.push(c); else claimsPorId.set(c.substance_id, [c]);
}

/**
 * PRIVACIDADE POR CONSTRUÇÃO.
 *
 * A lista de ingredientes dos produtos que alguém usa, cruzada com um filtro
 * de gravidez, é dado de saúde na aceção do art. 9.º do RGPD. A decisão D1
 * aceitou ter servidor; o que não se aceita é ele guardar isto.
 *
 * Por isso: os corpos dos pedidos NUNCA são registados, não há base de dados
 * de análises, e o log de acesso não inclui query string. Se um dia alguém
 * acrescentar `logger: true` sem redação, esta é a linha que estará a violar.
 */
const app = Fastify({
  logger: {
    level: 'info',
    serializers: {
      req: (r) => ({ method: r.method, url: r.url.split('?')[0] }),
      res: (r) => ({ statusCode: r.statusCode }),
    },
  },
  bodyLimit: 256 * 1024,
});

await app.register(cors, { origin: true });

app.get('/api/saude', async () => ({
  ok: true,
  nucleo: {
    construido_em: nucleo.built_at,
    substancias: nucleo.substances.length,
    afirmacoes: nucleo.claims.length,
    chaves: Object.keys(nucleo.index).length,
  },
  fontes: 'Anexos II a VI do Reg. (CE) 1223/2009 via CosIng · CC BY 4.0 · Comissão Europeia',
}));

app.post<{ Body: { texto?: string; modo?: 'cos' | 'food' } }>('/api/analisar', async (req, reply) => {
  const texto = req.body?.texto;
  if (typeof texto !== 'string' || texto.trim() === '') {
    return reply.code(400).send({ erro: 'Falta o campo "texto" com a lista de ingredientes.' });
  }
  if (texto.length > 20_000) {
    return reply.code(413).send({ erro: 'Lista demasiado longa. O limite é 20 000 caracteres.' });
  }
  return analisar(nucleo, matcher, texto, req.body?.modo === 'food' ? 'food' : 'cos');
});

app.get<{ Params: { id: string } }>('/api/substancia/:id', async (req, reply) => {
  const s = porId.get(req.params.id);
  if (!s) return reply.code(404).send({ erro: 'Substância não encontrada.' });
  return { substancia: s, afirmacoes: claimsPorId.get(s.id) ?? [] };
});

const porta = Number(process.env.PORT ?? 8787);
await app.listen({ port: porta, host: '127.0.0.1' });
console.log(`\n  Lupa API em http://127.0.0.1:${porta}`);
console.log(`  ${nucleo.substances.length} substâncias · ${nucleo.claims.length} afirmações · núcleo de ${nucleo.built_at}\n`);
