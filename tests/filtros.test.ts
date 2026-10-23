import { describe, it, expect } from 'vitest';
import { aplicarFiltro, descreverFiltro, FILTRO_LOWTOX } from '../packages/core/src/filtros';

describe('filtro de exclusão', () => {
  it('diz a posição no rótulo, não só o nome', () => {
    // A posição importa: em INCI a ordem é decrescente em concentração acima
    // de 1%, por isso um excluído em 2.º lugar não é o mesmo que em 20.º.
    const r = aplicarFiltro('Aqua, Dimethicone, Glycerin, Carbomer');
    expect(r.excluidos.map((e) => [e.pos, e.regra])).toEqual([
      [2, 'Ciclopentasiloxano e silicones'],
      [4, 'Acrilatos'],
    ]);
  });

  it('separa excluídos de condicionais', () => {
    const r = aplicarFiltro('Aqua, Petrolatum, Phenoxyethanol, Parfum');
    expect(r.excluidos.map((e) => e.ingrediente)).toEqual(['Petrolatum']);
    expect(r.condicionais.map((e) => e.ingrediente)).toEqual(['Phenoxyethanol', 'Parfum']);
    expect(r.passa, 'uma condicional não faz o produto chumbar').toBe(false);
  });

  it('um produto só com condicionais passa', () => {
    const r = aplicarFiltro('Aqua, Glycerin, Phenoxyethanol, Tocopherol');
    expect(r.passa).toBe(true);
    expect(r.condicionais.length).toBe(1);
  });

  it('carrega a proveniência, para a interface não poder esconder o que é', () => {
    const r = aplicarFiltro('Aqua');
    expect(r.natureza).toBe('preferencia_pessoal');
    expect(r.autor).toBe('@morganlkeen');
    expect(r.aviso).toMatch(/não é lei/i);
    expect(descreverFiltro(FILTRO_LOWTOX).regras).toBeGreaterThan(30);
  });

  it('só filtros minerais: o Anexo VI inteiro exceto zinco e titânio', () => {
    const quimico = aplicarFiltro('Aqua, Zinc Oxide, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine');
    expect(quimico.passa, 'um híbrido não passa').toBe(false);
    const mineral = aplicarFiltro('Aqua, Zinc Oxide, Glycerin, Butyrospermum Parkii Butter');
    expect(mineral.passa).toBe(true);
  });

  it('um perfume acabado em -salicylate não é filtro UV', () => {
    // Rótulos reais: Infinito (Philip Martin's) e Metal Detox (L'Oréal).
    const r = aplicarFiltro('Cyclopentasiloxane, Parfum, Benzyl Salicylate, Amyl Salicylate, Ethylhexyl Salicylate');
    const regra = (nome: string) => r.excluidos.find((e) => e.ingrediente === nome)?.regra;
    expect(regra('Amyl Salicylate'), 'perfume, e não está na lista').toBeUndefined();
    expect(regra('Benzyl Salicylate'), 'está na lista, mas pelo nome dele').toBe('Salicilato de benzilo');
    expect(regra('Ethylhexyl Salicylate'), 'este sim, é do Anexo VI').toBe('Filtro UV químico (só minerais)');
  });

  it('um estabilizador da fórmula não é filtro UV; o Tinosorb M é', () => {
    expect(aplicarFiltro('Aqua, Benzotriazolyl Dodecyl p-Cresol').passa).toBe(true);
    expect(aplicarFiltro('Aqua, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol').excluidos[0]?.regra)
      .toBe('Filtro UV químico (só minerais)');
  });

  it('apanha a família dos silicones pela raiz', () => {
    const r = aplicarFiltro('Dimethiconol, Amodimethicone, Caprylyl Methicone, Phenyl Trimethicone, Trimethylsiloxysilicate, Cyclomethicone');
    expect(r.excluidos.length).toBe(6);
    expect(new Set(r.excluidos.map((e) => e.regra))).toEqual(new Set(['Ciclopentasiloxano e silicones']));
    expect(aplicarFiltro('Aqua, Polysilicone-15').excluidos[0]?.regra, 'é filtro UV antes de ser silicone')
      .toBe('Filtro UV químico (só minerais)');
  });

  it('apanha etoxilados pela convenção -eth-N, não só pelos nomes que alguém listou', () => {
    const r = aplicarFiltro('PPG-5-Ceteth-20, C12-13 Alketh-23, Trideceth-6, Glycereth-26, Oleth-10');
    expect(r.excluidos.map((e) => e.regra)).toEqual(Array(5).fill('PEG e etoxilados'));
    // e não confunde com o que só tem "eth" no meio
    expect(aplicarFiltro('Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine').excluidos[0]?.regra)
      .toBe('Filtro UV químico (só minerais)');
    expect(aplicarFiltro('Aqua, Methylpropanediol, Ethylhexylglycerin').passa).toBe(true);
  });

  it('polímeros de poliacrilamida com outro sufixo', () => {
    expect(aplicarFiltro('Aqua, Polyacrylamidopropyltrimonium Chloride').excluidos[0]?.regra).toBe('Acrilatos');
  });

  it('sulfato etoxilado sem número e sais de etanolamina', () => {
    // Organethic OLIGO shampoo e Kérastase Genesis
    expect(aplicarFiltro('Aqua, Sodium Coceth Sulfate').excluidos[0]?.regra).toBe('PEG e etoxilados');
    expect(aplicarFiltro('Aqua, Sodium Myreth Sulfate').excluidos[0]?.regra).toBe('PEG e etoxilados');
    expect(aplicarFiltro('Aqua, Piroctone Olamine').excluidos[0]?.regra).toBe('DEA / etanolaminas');
    expect(aplicarFiltro('Aqua, Cocamide MEA').excluidos[0]?.regra).toBe('DEA / etanolaminas');
    // e não apanha o que só se parece
    expect(aplicarFiltro('Aqua, Sodium Coco-Sulfate, Sodium Methyl Cocoyl Taurate').excluidos).toEqual([]);
  });

  it('PEG escrito com espaço, e "phthalate free" que não é um ftalato', () => {
    // Lola Dream Cream ("PEG 180 M") e Bounce Curl ("Fragrance (Phthalate Free)")
    expect(aplicarFiltro('Aqua, PEG 180 M, Glycerin').excluidos[0]?.regra).toBe('PEG e etoxilados');
    expect(aplicarFiltro('Aqua, Glycerin, Fragrance (Phthalate Free)').excluidos).toEqual([]);
    expect(aplicarFiltro('Aqua, Diethyl Phthalate').excluidos[0]?.regra).toBe('Ftalatos');
  });

  it('separadores que não são vírgula', () => {
    // travessão (Uriage) e ponto médio (Rilastil)
    expect(aplicarFiltro('AQUA — DIMETHICONE — GLYCERIN').excluidos.length).toBe(1);
    expect(aplicarFiltro('Aqua • Carbomer • Glycerin').excluidos.length).toBe(1);
  });
});
