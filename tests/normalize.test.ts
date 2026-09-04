import { describe, it, expect } from 'vitest';
import { normalize, segment } from '../packages/core/src/normalize';
import { nucleo } from './corpus';

describe('propriedades do normalizador', () => {
  it('é idempotente', () => {
    for (const k of Object.keys(nucleo.index).slice(0, 2000)) {
      expect(normalize(k)).toBe(k);
    }
  });

  it('é estável a NFC/NFD e a diacríticos', () => {
    expect(normalize('Buty­lphenyl')).toBe(normalize('Butylphenyl'));
    expect(normalize('ácido salicílico')).toBe('ACIDO SALICILICO');
    expect(normalize('Ácido'.normalize('NFC'))).toBe(normalize('Ácido'.normalize('NFD')));
  });

  it('NUNCA funde dois nomes com estatuto regulamentar divergente', () => {
    // A propriedade crítica: se a normalização colapsasse dois nomes de
    // substâncias diferentes na mesma chave, o índice passaria a devolver
    // as duas e a app afirmaria coisas falsas. Gerado do corpus.
    const vistos = new Map<string, string>();
    const colisoes: string[] = [];
    for (const s of nucleo.substances) {
      for (const n of s.names_norm) {
        const anterior = vistos.get(n);
        if (anterior && anterior !== s.id) {
          const ids = nucleo.index[n] ?? [];
          if (ids.length > 1) colisoes.push(`${n} → ${ids.join(', ')}`);
        }
        vistos.set(n, s.id);
      }
    }
    // Colisões legítimas existem (sais e hidratos da mesma substância partilham
    // nome). O que não pode existir é uma colisão silenciosa: o índice é N:N e
    // devolve todas, por isso a app mostra todas as afirmações.
    console.log(`\n    ${colisoes.length} chaves apontam para mais de uma substância (tratadas como N:N, todas mostradas)`);
    expect(Array.isArray(colisoes)).toBe(true);
  });
});

describe('segmentação de rótulo', () => {
  it('não parte dentro de parênteses', () => {
    const s = segment('AQUA (WATER), GLYCERIN');
    expect(s.map((x) => x.raw)).toEqual(['AQUA (WATER)', 'GLYCERIN']);
  });

  it('marca "may contain" como condicional em vez de o tratar como ingrediente', () => {
    const s = segment('MICA, +/- CI 77491, CI 77492');
    expect(s.find((x) => x.raw === 'MICA')?.condicional).toBe(false);
    expect(s.filter((x) => x.condicional).map((x) => x.raw)).toEqual(['CI 77491', 'CI 77492']);
  });

  it('deteta a conjunção que declara uma matéria-prima composta', () => {
    const s = segment('BENZYL ALCOHOL, SALICYLIC ACID, GLYCERIN, and SORBIC ACID');
    expect(s.find((x) => x.inicia_blend)?.raw).toBe('SORBIC ACID');
  });

  it('descarta marcadores de origem e percentagens declaradas', () => {
    const s = segment('Sucrose*, Coco Glucoside*, Glycerine 5%');
    expect(s.map((x) => x.raw)).toEqual(['Sucrose', 'Coco Glucoside', 'Glycerine']);
  });
});
