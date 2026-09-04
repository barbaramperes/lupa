import { describe, it, expect } from 'vitest';
import { Matcher, normalize, distancia, orcamentoEdicao } from '../packages/core/src/match';
import { nucleo, estatutoDe, proibido } from './corpus';

const matcher = new Matcher(nucleo.index);
const chaves = Object.keys(nucleo.index);

/**
 * INVARIANTE DOS PARES PERIGOSOS.
 *
 * Gerado do corpus, não escrito à mão — por isso cresce sozinho quando a UE
 * acrescenta substâncias, e não apodrece.
 *
 * Um par é perigoso quando dois nomes estão a distância de edição ≤2 mas têm
 * estatuto regulamentar DIVERGENTE: um proibido e outro não. Trocá-los é
 * exatamente a falha que faz uma app destas mentir, e é invisível para quem lê.
 */
function paresPerigosos(): Array<[string, string]> {
  const baldes = new Map<string, string[]>();
  for (const k of chaves) {
    const a = k.slice(0, 2);
    (baldes.get(a) ?? baldes.set(a, []).get(a)!).push(k);
  }
  const pares: Array<[string, string]> = [];
  for (const balde of baldes.values()) {
    for (let i = 0; i < balde.length; i++) {
      for (let j = i + 1; j < balde.length; j++) {
        const a = balde[i]!, b = balde[j]!;
        if (Math.abs(a.length - b.length) > 2) continue;
        if (a.length < 6) continue;
        if (distancia(a, b, 2) > 2) continue;
        if (proibido(a) !== proibido(b)) pares.push([a, b]);
      }
    }
  }
  return pares;
}

const PARES = paresPerigosos();

describe('pares perigosos gerados do corpus', () => {
  it(`encontra pares com estatuto divergente a distância ≤2 (é o risco a mitigar)`, () => {
    console.log(`\n    ${PARES.length} pares perigosos no corpus. Exemplos:`);
    for (const [a, b] of PARES.slice(0, 6)) {
      console.log(`      "${a}" (${proibido(a) ? 'PROIBIDO' : 'permitido'}) ⟷ "${b}" (${proibido(b) ? 'PROIBIDO' : 'permitido'})`);
    }
    expect(PARES.length).toBeGreaterThan(0);
  });

  it('a sugestão nunca atravessa um par com estatuto divergente', () => {
    const falhas: string[] = [];
    for (const [a, b] of PARES) {
      const sa = matcher.sugere(a);
      if (sa?.candidato === b) falhas.push(`${a} → ${b}`);
      const sb = matcher.sugere(b);
      if (sb?.candidato === a) falhas.push(`${b} → ${a}`);
    }
    expect(falhas, `travessias indevidas:\n  ${falhas.slice(0, 20).join('\n  ')}`).toEqual([]);
  });
});

/**
 * OS BANAIS.
 * Ingredientes que aparecem em quase todos os rótulos e que NÃO constam dos
 * anexos. O que se exige: nenhum deles resolve para algo perigoso. Preferimos
 * "por identificar" a um alerta inventado.
 */
const BANAIS = [
  'AQUA', 'WATER', 'GLYCERIN', 'GLYCERINE', 'PANTHENOL', 'SODIUM CHLORIDE',
  'NIACINAMIDE', 'TOCOPHEROL', 'SQUALANE', 'ALLANTOIN', 'XANTHAN GUM',
  'CITRIC ACID', 'SODIUM HYALURONATE', 'CETEARYL ALCOHOL', 'DIMETHICONE',
  'SODIUM BENZOATE', 'POTASSIUM SORBATE', 'SUCROSE', 'COCO GLUCOSIDE',
  'SORBIC ACID', 'BUTYLENE GLYCOL', 'PROPANEDIOL',
];

describe('ingredientes banais', () => {
  it('nenhum resolve para uma substância proibida', () => {
    const falhas: string[] = [];
    for (const nome of BANAIS) {
      const n = normalize(nome);
      if (matcher.exata(n)) continue; // está mesmo nos anexos: legítimo
      const s = matcher.sugere(n);
      if (s && proibido(s.candidato)) falhas.push(`${nome} → ${s.candidato} (via ${s.via}, d=${s.distancia})`);
    }
    expect(falhas, `substituições perigosas:\n  ${falhas.join('\n  ')}`).toEqual([]);
  });

  it('as três trocas de manual são bloqueadas por guardas estruturais', () => {
    // Cada uma destas sobrevive a qualquer limiar de distância de edição.
    // São bloqueadas por guarda, não por limiar.
    const casos: Array<[string, string]> = [
      ['SODIUM CHLORIDE', 'SODIUM CHLORATE'],  // guarda de sufixo: -IDE/-ATE
      ['PANTHENOL', 'PHENOL'],                  // guarda de âncora: PA vs PH
      ['GLYCERIN', 'NITROGLYCERINE'],           // âncora + classe de comprimento
    ];
    for (const [entrada, proibida] of casos) {
      const s = matcher.sugere(normalize(entrada));
      expect(s?.candidato, `${entrada} não pode sugerir ${proibida}`).not.toBe(normalize(proibida));
    }
  });

  it('nomes com menos de 6 caracteres não fazem correspondência aproximada de todo', () => {
    expect(orcamentoEdicao(5)).toBe(0);
    expect(orcamentoEdicao(4)).toBe(0);
    expect(matcher.sugere('AQUA')).toBeNull();
  });
});

describe('correspondência de erros de OCR', () => {
  it('resolve dígitos trocados por letras quando há um único candidato exato', () => {
    // Um caso real de OCR: o zero lido onde estava um O.
    const alvo = chaves.find((k) => k.includes('O') && k.length > 8 && !/\d/.test(k));
    if (!alvo) return;
    const corrompido = alvo.replace('O', '0');
    const s = matcher.sugere(corrompido);
    expect(s?.via).toBe('ocr');
    expect(s?.candidato).toBe(alvo);
  });

  it('nunca troca dígitos dentro de números de Colour Index', () => {
    // CI 77491 e CI 77492 são pigmentos diferentes. Um dígito trocado aqui
    // é uma substância diferente, não um erro de leitura a corrigir.
    const ciKeys = chaves.filter((k) => /^CI \d{5}$/.test(k));
    if (ciKeys.length < 2) return;
    for (const k of ciKeys.slice(0, 30)) {
      const s = matcher.sugere(k.replace(/\d/, (d) => (d === '0' ? '8' : '0')));
      expect(s?.via, `${k} não pode ser resolvido por substituição de dígito`).not.toBe('ocr');
    }
  });
});
