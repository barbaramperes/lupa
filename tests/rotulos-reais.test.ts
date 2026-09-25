import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Matcher } from '../packages/core/src/match';
import { analisar } from '../packages/core/src/analisar';
import { aplicarFiltro } from '../packages/core/src/filtros';
import { nucleo } from './corpus';

const matcher = new Matcher(nucleo.index, nucleo.fuzzy_keys);
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/rotulos-reais.json', import.meta.url).pathname, 'utf8'));

describe('rótulos reais', () => {
  for (const r of fixtures.rotulos as Array<Record<string, any>>) {
    it(r.nome, () => {
      const a = analisar(nucleo, matcher, r.lista, 'cos');
      const e = r.espera;
      if (e.lista_traduzida !== undefined) expect(a.resumo.lista_traduzida).toBe(e.lista_traduzida);
      if (e.avaliavel !== undefined) expect(a.resumo.avaliavel).toBe(e.avaliavel);
      if (e.proibidos !== undefined) expect(a.resumo.proibidos).toBe(e.proibidos);
      if (e.indice_nulo) expect(a.editorial.indice).toBeNull();
      for (const nome of e.reconhece ?? []) {
        const entrada = a.entradas.find((x) => x.raw.toUpperCase().includes(nome.toUpperCase()));
        expect(entrada?.estado, `${nome} devia ser reconhecido`).toBe('reconhecido');
        expect(entrada!.afirmacoes.length, `${nome} devia trazer afirmações`).toBeGreaterThan(0);
      }
      if (e.total !== undefined) expect(a.resumo.total).toBe(e.total);
      for (const raw of e.contem_raw ?? []) {
        expect(a.entradas.map((x) => x.raw), `devia conter a entrada "${raw}" intacta`).toContain(raw);
      }
      if (e.filtro_exclui) {
        const f = aplicarFiltro(r.lista);
        expect(f.excluidos.map((x) => x.ingrediente).sort()).toEqual([...e.filtro_exclui].sort());
        // as posições do filtro têm de coincidir com as da análise
        for (const x of f.excluidos) expect(a.entradas[x.pos - 1]?.raw).toBe(x.ingrediente);
      }
      for (const nome of e.nao_reconhece ?? []) {
        const entrada = a.entradas.find((x) => x.raw.toUpperCase() === nome.toUpperCase());
        expect(entrada?.afirmacoes ?? [], `${nome} não pode arrastar restrições que não são suas`).toEqual([]);
      }
    });
  }
});
