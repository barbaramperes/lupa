import { readFileSync, existsSync } from 'node:fs';
import type { CoreBundle } from '../packages/core/src/types';

const CAMINHO = new URL('../data/build/core.json', import.meta.url).pathname;

if (!existsSync(CAMINHO)) {
  throw new Error('data/build/core.json não existe. Corre `pnpm ingest` antes dos testes.');
}

export const nucleo: CoreBundle = JSON.parse(readFileSync(CAMINHO, 'utf8'));
export const porId = new Map(nucleo.substances.map((s) => [s.id, s]));

/** Afirmações agrupadas por substância, para saber o estatuto regulamentar
 *  de cada uma sem varrer o array a cada consulta. */
export const claimsPorId = new Map<string, string[]>();
for (const c of nucleo.claims) {
  const l = claimsPorId.get(c.substance_id);
  if (l) l.push(c.kind); else claimsPorId.set(c.substance_id, [c.kind]);
}

export function estatutoDe(nomeNormalizado: string): Set<string> {
  const ids = nucleo.index[nomeNormalizado] ?? [];
  const out = new Set<string>();
  for (const id of ids) for (const k of claimsPorId.get(id) ?? []) out.add(k);
  return out;
}

export const proibido = (nomeNormalizado: string) =>
  estatutoDe(nomeNormalizado).has('annex_ii_banned');
