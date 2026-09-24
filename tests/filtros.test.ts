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

  it('separadores que não são vírgula', () => {
    // travessão (Uriage) e ponto médio (Rilastil)
    expect(aplicarFiltro('AQUA — DIMETHICONE — GLYCERIN').excluidos.length).toBe(1);
    expect(aplicarFiltro('Aqua • Carbomer • Glycerin').excluidos.length).toBe(1);
  });
});
