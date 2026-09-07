import { describe, it, expect } from 'vitest';
import { traduzirPt, pareceEscritoEmPortugues } from '../packages/core/src/portugues';
import { Matcher } from '../packages/core/src/match';
import { analisar } from '../packages/core/src/analisar';
import { nucleo } from './corpus';

const matcher = new Matcher(nucleo.index, nucleo.fuzzy_keys);
const corre = (t: string) => analisar(nucleo, matcher, t, 'cos');

describe('tradução PT → INCI', () => {
  it('traduz nomes químicos pelo léxico', () => {
    expect(traduzirPt('hidroquinona')?.inci).toBe('HYDROQUINONE');
    expect(traduzirPt('fenoxietanol')?.inci).toBe('PHENOXYETHANOL');
    expect(traduzirPt('álcool cetearílico')?.inci).toBe('CETEARYL ALCOHOL');
    expect(traduzirPt('goma xantana')?.inci).toBe('XANTHAN GUM');
  });

  it('monta nomes botânicos pela regra estrutural', () => {
    expect(traduzirPt('óleo da semente de Prunus Armeniaca')?.inci).toBe('PRUNUS ARMENIACA SEED OIL');
    expect(traduzirPt('manteiga de Butyrospermum parkii (karité) orgânica')?.inci).toBe('BUTYROSPERMUM PARKII BUTTER');
    expect(traduzirPt('extrato da folha de Aloe Barbadensis')?.inci).toBe('ALOE BARBADENSIS LEAF EXTRACT');
    expect(traduzirPt('óleo da fruta Olea Europaea')?.inci).toBe('OLEA EUROPAEA FRUIT OIL');
  });

  it('o nome comum entre parênteses não vira parte da planta', () => {
    // "(amêndoa doce)" é o nome vulgar, não uma indicação de que se usa o
    // caroço. Antes de o retirar ANTES de normalizar, isto dava KERNEL OIL.
    expect(traduzirPt('óleo orgânico de Prunus amygdalus dulcis (amêndoa doce)')?.inci)
      .toBe('PRUNUS AMYGDALUS DULCIS OIL');
  });

  it('não confunde substâncias vizinhas', () => {
    // esqualeno e esqualano são substâncias diferentes
    expect(traduzirPt('esqualeno')?.inci).toBe('SQUALENE');
    expect(traduzirPt('esqualano')?.inci).toBe('SQUALANE');
    expect(traduzirPt('sulfito de sódio')?.inci).toBe('SODIUM SULFITE');
    expect(traduzirPt('sulfato de sódio')?.inci).toBe('SODIUM SULFATE');
  });

  it('devolve null quando não sabe, em vez de arriscar', () => {
    expect(traduzirPt('filtrado de fermento de raiz de Leuconostoc / rabanete')).toBeNull();
    expect(traduzirPt('xpto qualquer coisa')).toBeNull();
  });

  it('uma tradução que não existe no índice não produz veredicto', () => {
    // "óleo de glicina azul" é uma tradução automática defeituosa do rótulo.
    // A regra: só vale se o resultado existir no índice; senão fica por
    // identificar. Traduzir mal nunca gera um alerta.
    const a = corre('Aqua, óleo de glicina azul, Glycerin, Xanthan Gum, Tocopherol');
    const entrada = a.entradas.find((e) => e.raw.includes('glicina'))!;
    expect(entrada.estado).not.toBe('reconhecido');
    expect(entrada.afirmacoes).toEqual([]);
  });

  it('uma lista PT com substância regulada é apanhada, e a tradução fica visível', () => {
    const a = corre('Água, glicerina, hidroquinona, fenoxietanol, goma xantana, tocoferol, manteiga de karité, óleo de jojoba');
    // A lista está traduzida, mas encontrou-se uma substância proibida. O
    // facto vence a incerteza: reporta-se, e o índice é que desaparece.
    expect(a.resumo.lista_traduzida).toBe(true);
    expect(a.resumo.avaliavel, 'houve achados, logo é avaliável').toBe(true);
    expect(a.resumo.veredicto).toMatch(/proibida/i);
    expect(a.editorial.indice, 'com parte da lista por ler, o índice é só um limite superior').toBeNull();
    const hq = a.entradas.find((e) => e.raw === 'hidroquinona')!;
    expect(hq.estado).toBe('reconhecido');
    expect(hq.traduzido_de?.inci).toBe('HYDROQUINONE');
    expect(hq.afirmacoes.map((c) => c.kind)).toContain('annex_ii_banned');
  });
});

describe('deteção de lista traduzida', () => {
  it('reconhece vocabulário de estrutura que não existe em INCI', () => {
    expect(pareceEscritoEmPortugues('óleo da semente de Prunus Armeniaca')).toBe(true);
    expect(pareceEscritoEmPortugues('manteiga de karité')).toBe(true);
    expect(pareceEscritoEmPortugues('goma xantana')).toBe(true);
  });

  it('não marca nomes INCI legítimos como portugueses', () => {
    for (const n of ['LAURYL GLUCOSIDE', 'SODIUM LAUROYL SARCOSINATE', 'COCAMIDOPROPYL BETAINE',
                     'PEG-120 METHYL GLUCOSE DIOLEATE', 'ALOE BARBADENSIS LEAF JUICE POWDER',
                     'BUTYROSPERMUM PARKII BUTTER', 'TOCOPHEROL', 'INULIN']) {
      expect(pareceEscritoEmPortugues(n), n).toBe(false);
    }
  });
});
