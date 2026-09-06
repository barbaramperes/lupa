import { describe, it, expect } from 'vitest';
import { nomeUtilizavel } from '../packages/ingest/src/pubchem';

describe('filtro de nomes do PubChem', () => {
  it('aceita nomes que alguém escreveria num rótulo', () => {
    for (const n of ['Isobutylparaben', 'Hydroquinone', 'Butylphenyl Methylpropional', 'Zinc pyrithione', 'Sodium lauryl sulfate']) {
      expect(nomeUtilizavel(n), n).toBe(true);
    }
  });

  it('rejeita identificadores de registo e códigos de catálogo', () => {
    for (const n of ['DTXSID2048117', 'CHEBI:73024', 'SCHEMBL12345', 'MFCD00003477', 'AKOS015889982',
                     'RefChem:1076018', '07OP6H4V4A', 'NSC 12345', 'Q27102993', 'CHEMBL1234',
                     'RYYVLZVUVIJVGH-UHFFFAOYSA-N', 'Tox21_300045']) {
      expect(nomeUtilizavel(n), n).toBe(false);
    }
  });

  it('rejeita números CAS — a redistribuição em massa não nos está coberta', () => {
    // Os CAS que entram no núcleo vêm todos de textos legais da UE, onde são
    // parte do próprio regulamento. Os do agregado do PubChem não.
    expect(nomeUtilizavel('14992-62-2')).toBe(false);
    expect(nomeUtilizavel('50-00-0')).toBe(false);
  });

  it('rejeita variantes isotópicas, que nunca aparecem num rótulo', () => {
    for (const n of ['Acetyl-L-carnitine-(N-methyl-d3)', 'acetyl-l-carnitine-d3', 'Benzene-13C6']) {
      expect(nomeUtilizavel(n), n).toBe(false);
    }
  });

  it('rejeita fragmentos curtos e cadeias sem letras', () => {
    expect(nomeUtilizavel('ab')).toBe(false);
    expect(nomeUtilizavel('12345')).toBe(false);
    expect(nomeUtilizavel('x'.repeat(200))).toBe(false);
  });
});

describe('falsos positivos do filtro', () => {
  it('não confunde nomes legítimos com variantes isotópicas', () => {
    // "-d3" no fim marca deutério; "D3" no nome de uma vitamina não.
    expect(nomeUtilizavel('Vitamin D3')).toBe(true);
    expect(nomeUtilizavel('Cholecalciferol')).toBe(true);
    expect(nomeUtilizavel('Acetyl-L-carnitine-d3')).toBe(false);
  });

  it('não confunde nomes longos em maiúsculas com identificadores UNII', () => {
    // UNII tem exatamente 10 caracteres e inclui dígitos.
    expect(nomeUtilizavel('OCTOCRYLENE')).toBe(true);
    expect(nomeUtilizavel('HYDROQUINONE')).toBe(true);
    expect(nomeUtilizavel('07OP6H4V4A')).toBe(false);
  });
});
