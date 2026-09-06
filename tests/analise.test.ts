import { describe, it, expect } from 'vitest';
import { Matcher } from '../packages/core/src/match';
import { analisar, extrairCmr } from '../packages/core/src/analisar';
import { nucleo } from './corpus';

const matcher = new Matcher(nucleo.index, nucleo.fuzzy_keys);
const corre = (texto: string) => analisar(nucleo, matcher, texto, 'cos');

/** Rótulos reais transcritos à mão. Ninguém nos dá isto e vale mais que
 *  qualquer benchmark publicado: é a única coisa que apanha uma regressão
 *  na cadeia inteira, da segmentação ao veredicto. */
const ROTULOS = {
  esfoliante_organico:
    'Sucrose*, Coco Glucoside*, Guava Seed Oil*, Mango Seed Oil*, Glycerine*, Benzyl Alcohol*, Salicylic Acid*, Glycerin, and Sorbic Acid*, Orange Sweet Essential Oil*, Tocopherol*',
  protetor_solar:
    'Aqua, Homosalate, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Octocrylene, Benzophenone-3, Glycerin, Alcohol Denat., Dimethicone, Phenoxyethanol, Parfum, Tocopheryl Acetate, Sodium Benzoate, Limonene, Linalool',
  creme_simples:
    'Aqua, Glycerin, Cetearyl Alcohol, Squalane, Niacinamide, Panthenol, Sodium Hyaluronate, Xanthan Gum, Citric Acid',
};

describe('extração de classificação CMR', () => {
  it('lê o formato quase-estruturado do Anexo II', () => {
    expect(extrairCmr('Reprotoxic Cat. 1B(C=>0.001%)')).toEqual([
      { tipo: 'reprotoxico', categoria: '1B', condicao: 'C=>0.001%' },
    ]);
  });
  it('lê várias classificações na mesma célula', () => {
    const r = extrairCmr('Carcinogenic Cat. 1B(),Mutagenic Cat. 1B()');
    expect(r.map((c) => c.tipo)).toEqual(['carcinogenico', 'mutagenico']);
  });
  it('devolve vazio em vez de inventar quando a célula está vazia', () => {
    expect(extrairCmr(undefined)).toEqual([]);
    expect(extrairCmr('')).toEqual([]);
  });
});

describe('rótulos golden', () => {
  it('esfoliante orgânico: reconhece o conservante e a matéria-prima composta', () => {
    const a = corre(ROTULOS.esfoliante_organico);
    expect(a.resumo.total).toBe(11);
    expect(a.resumo.proibidos).toBe(0);

    // A conjunção "and" declara um blend: os componentes são frações de uma
    // única matéria-prima e pesam menos do que a posição sugere.
    expect(a.resumo.blend_na_posicao).toBe(9);
    const salicilico = a.entradas.find((e) => e.raw === 'Salicylic Acid')!;
    expect(salicilico.no_blend).toBe(true);

    // O ácido salicílico está em DOIS anexos, e isso não é conflito: tem
    // regimes diferentes conforme seja restrição de uso ou conservante.
    const kinds = salicilico.afirmacoes.map((c) => c.kind);
    expect(kinds).toContain('annex_iii_restricted');
    expect(kinds).toContain('annex_v_preservative');

    // O texto legal é literal, não parafraseado.
    const anexoV = salicilico.afirmacoes.find((c) => c.kind === 'annex_v_preservative')!;
    expect(anexoV.payload.concentracao_maxima).toMatch(/0,5\s*%/);
    expect(anexoV.source.annex).toBe('V');
    expect(anexoV.source.licence).toMatch(/CC BY 4\.0/);
  });

  it('protetor solar: reconhece os filtros UV do Anexo VI', () => {
    const a = corre(ROTULOS.protetor_solar);
    const nomes = a.entradas.filter((e) => e.afirmacoes.some((c) => c.kind === 'annex_vi_uv_filter')).map((e) => e.raw);
    expect(nomes).toContain('Homosalate');
    expect(nomes).toContain('Octocrylene');
    expect(nomes).toContain('Benzophenone-3');
  });

  it('creme simples: nada reconhecido não é o mesmo que nada perigoso', () => {
    const a = corre(ROTULOS.creme_simples);
    expect(a.resumo.proibidos).toBe(0);
    expect(a.resumo.sugestoes).toBe(0); // nenhuma sugestão inventada
    // A propriedade que separa esta app de um marketing de "clean": um rótulo
    // sem alertas E com entradas por identificar NÃO pode ser apresentado como
    // limpo. O resumo tem de continuar a contar os desconhecidos.
    expect(a.resumo.por_identificar).toBeGreaterThan(0);
    expect(a.resumo.reconhecidos + a.resumo.sugestoes + a.resumo.por_identificar).toBe(a.resumo.total);
  });
});

describe('leitura editorial', () => {
  it('o veredicto é factual e nunca contradiz as contagens', () => {
    // A contradição a impedir: anunciar "sem alertas" numa lista que mostra
    // uma classificação reprotóxica. O veredicto deriva dos anexos, não do
    // índice, e por isso não pode divergir deles.
    const a = corre(ROTULOS.esfoliante_organico);
    expect(a.resumo.reprotoxicos).toBeGreaterThan(0);
    expect(a.resumo.veredicto).toMatch(/toxicidade reprodutiva/i);
    expect(a.resumo.veredicto).not.toMatch(/sem alertas/i);

    const limpo = corre('Aqua, Glycerin, Xanthan Gum');
    expect(limpo.resumo.veredicto).toMatch(/nenhuma entrada|nada sujeito/i);
  });

  it('é separável dos factos e traz a fórmula consigo', () => {
    const a = corre(ROTULOS.esfoliante_organico);
    expect(a.editorial.formula).toMatch(/Anexo II/);
    expect(a.editorial.indice).toBeGreaterThanOrEqual(0);
    expect(a.editorial.indice).toBeLessThanOrEqual(100);
    // cada penalização diz de onde veio
    for (const p of a.editorial.penalizacoes) expect(p.motivo.length).toBeGreaterThan(0);
  });

  it('uma substância proibida trava o índice em 25 independentemente do resto', () => {
    const banido = nucleo.claims.find((c) => c.kind === 'annex_ii_banned')!;
    const sub = nucleo.substances.find((s) => s.id === banido.substance_id)!;
    const nome = sub.names_norm.find((n) => n.length > 5 && !/^\d/.test(n));
    if (!nome) return;
    const a = corre(`Aqua, Glycerin, ${nome}, Xanthan Gum`);
    expect(a.resumo.proibidos).toBe(1);
    expect(a.editorial.indice).toBeLessThanOrEqual(25);
    expect(a.resumo.veredicto).toMatch(/proibida/i);
  });
});

describe('nomes INCI embutidos no nome químico do Anexo II', () => {
  it('encontra os parabenos proibidos pelo nome que está no rótulo', () => {
    // "Isobutyl 4-hydroxybenzoate (INCI: Isobutylparaben)" — quem lê um rótulo
    // escreve "Isobutylparaben", não a nomenclatura IUPAC. Sem esta extração,
    // cinco substâncias PROIBIDAS ficavam invisíveis à pesquisa.
    for (const nome of ['Isobutylparaben', 'Isopropylparaben', 'Phenylparaben', 'Benzylparaben', 'Pentylparaben']) {
      const a = corre(`Aqua, Glycerin, ${nome}`);
      const e = a.entradas.find((x) => x.raw === nome)!;
      expect(e.estado, `${nome} devia ser reconhecido`).toBe('reconhecido');
      expect(e.afirmacoes.map((c) => c.kind), `${nome} está no Anexo II`).toContain('annex_ii_banned');
    }
  });

  it('os parabenos autorizados continuam a não ser confundidos com os proibidos', () => {
    const a = corre('Aqua, Methylparaben, Ethylparaben');
    for (const e of a.entradas.filter((x) => x.raw.includes('paraben'))) {
      expect(e.afirmacoes.map((c) => c.kind)).not.toContain('annex_ii_banned');
    }
  });
});
