import { normalize } from './normalize';

/**
 * REGRA DE OURO, implementada e não apenas escrita:
 * um veredicto só existe se houver correspondência EXATA.
 * A correspondência aproximada pergunta; nunca afirma.
 *
 * Isto não é conservadorismo estético. Correspondência aproximada ingénua
 * (Levenshtein ≤3 sobre candidatos por trigramas) troca, entre os
 * ingredientes mais banais que existem:
 *   SODIUM CHLORIDE (sal)      → SODIUM CHLORATE (herbicida)   distância 1
 *   PANTHENOL (pró-vitamina B5) → PHENOL (Anexo II, proibido)
 *   GLYCERIN                    → NITROGLYCERINE
 * A distância de edição é a primitiva errada para nomes químicos, e nenhum
 * ajuste de limiar resolve o primeiro caso. Por isso as guardas abaixo são
 * estruturais e não paramétricas.
 */

/** Pares de sufixo que trocam a espécie química. Fechado por desenho:
 *  acrescentar entradas é seguro, remover não. */
const SUFIXOS_QUE_TROCAM_ESPECIE: Array<[string, string]> = [
  ['IDE', 'ATE'],   // chloride → chlorate
  ['ITE', 'ATE'],   // nitrite → nitrate
  ['IDE', 'ITE'],
  ['OL', 'AL'],     // retinol → retinal
  ['ANE', 'ENE'],   // hexane → hexene
  ['YL', 'YLENE'],
  ['ANE', 'ANOL'],
  ['ONE', 'OL'],
];

const CONFUSAVEIS_OCR: Record<string, string[]> = {
  '0': ['O'], O: ['0'],
  '1': ['I', 'L'], I: ['1'], L: ['1'],
  '5': ['S'], S: ['5'],
  '8': ['B'], B: ['8'],
  '2': ['Z'], Z: ['2'],
  '6': ['G'], G: ['6'],
};

/** Orçamento de edição proporcional ao comprimento.
 *  Corolário deliberado: nomes com menos de 6 caracteres normalizados têm
 *  orçamento ZERO e não fazem correspondência aproximada de todo.
 *  É isto que mata AQUA → um corante azo, por construção e não por limiar. */
export function orcamentoEdicao(len: number): number {
  if (len < 6) return 0;
  return Math.min(2, Math.floor(len / 6));
}

export function distancia(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let melhorNaLinha = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + custo);
      cur.push(v);
      if (v < melhorNaLinha) melhorNaLinha = v;
    }
    if (melhorNaLinha > maxDist) return maxDist + 1; // corte antecipado
    prev = cur;
  }
  return prev[b.length]!;
}

const semDigitos = (s: string) => s.replace(/[0-9]/g, '');
const digitos = (s: string) => s.replace(/[^0-9]/g, '');
const ultimoToken = (s: string) => s.split(' ').pop() ?? s;

/** Se a única diferença entre os dois nomes estiver em caracteres numéricos,
 *  rejeita. Mata a maior fatia dos pares perigosos do corpus:
 *  ACID RED 33 / ACID RED 35, 2,4,5- / 2,4,6-TRICLOROFENOL,
 *  4-AMINO-2- / 4-AMINO-3-NITROFENOL. */
export function violaGuardaLocante(a: string, b: string): boolean {
  return semDigitos(a) === semDigitos(b) && digitos(a) !== digitos(b);
}

/** Se a diferença cai num par de sufixos que troca a espécie química,
 *  rejeita. É isto que mata CHLORIDE → CHLORATE, que sobrevive a qualquer
 *  limiar de distância por ter distância 1 e o mesmo comprimento. */
export function violaGuardaSufixo(a: string, b: string): boolean {
  const ta = ultimoToken(a);
  const tb = ultimoToken(b);
  if (ta === tb) return false;
  for (const [x, y] of SUFIXOS_QUE_TROCAM_ESPECIE) {
    for (const [s1, s2] of [[x, y], [y, x]] as const) {
      if (ta.endsWith(s1) && tb.endsWith(s2)) {
        if (ta.slice(0, ta.length - s1.length) === tb.slice(0, tb.length - s2.length)) return true;
      }
    }
  }
  return false;
}

/** Se os dois nomes só diferem no último token e esse token é curto, rejeita.
 *
 *  Em nomenclatura de corantes e de químicos, um token final curto é um
 *  DESIGNADOR — o que distingue uma substância da seguinte da mesma família.
 *  ACID ORANGE G e ACID ORANGE 6 são corantes diferentes com estatuto
 *  regulamentar divergente, e "G" é confundível com "6" num OCR. A guarda
 *  anti-locante não os apanha porque só dispara quando as formas sem dígitos
 *  são iguais, e aqui não são: uma tem letra onde a outra tem número. */
export function violaGuardaDesignador(a: string, b: string): boolean {
  const ta = a.split(' ');
  const tb = b.split(' ');
  if (ta.length !== tb.length || ta.length < 2) return false;
  for (let i = 0; i < ta.length - 1; i++) if (ta[i] !== tb[i]) return false;
  const ua = ta.at(-1)!;
  const ub = tb.at(-1)!;
  if (ua === ub) return false;
  return ua.length <= 3 || ub.length <= 3;
}

/**
 * Guarda estrita, para o caminho da distância de edição.
 *
 * Em nomenclatura química o nome é composicional: cada token carrega
 * identidade. Trocar UM token inteiro quase nunca é uma gralha — é outra
 * substância. Medido no corpus, todos estes pares têm estatuto regulamentar
 * divergente e distância de edição ≤2:
 *
 *   CADMIUM CARBONATE   ⟷ CALCIUM CARBONATE     o catião muda tudo
 *   SODIUM SORBATE      ⟷ SODIUM BORATE         o anião muda tudo
 *   BENZOPHENONE        ⟷ BENZOPHENONE 3        proibida vs filtro UV autorizado
 *   4 NITRO M PHENYL…   ⟷ 4 NITRO O PHENYL…     isómeros meta e orto
 *
 * A única diferença de um token que É uma gralha: quando um token é prefixo
 * do outro, ou seja falta ou sobra o fim de uma palavra.
 */
export function violaGuardaTokens(a: string, b: string): boolean {
  const ta = a.split(' ');
  const tb = b.split(' ');

  // Diferença só de espaçamento: o mesmo texto partido de outra maneira.
  // Não se atravessa, porque no corpus estas formas correspondem a entradas
  // distintas com estatuto próprio.
  if (ta.join('') === tb.join('')) return true;

  // Um token a mais ou a menos: é um designador de família acrescentado
  // (BENZOPHENONE → BENZOPHENONE 3).
  if (Math.abs(ta.length - tb.length) === 1) {
    const [curto, longo] = ta.length < tb.length ? [ta, tb] : [tb, ta];
    for (let i = 0; i <= longo.length - curto.length; i++) {
      if (curto.every((t, j) => t === longo[i + j])) return true;
    }
    return false;
  }

  if (ta.length !== tb.length) return false;

  const diferentes: Array<[string, string]> = [];
  for (let i = 0; i < ta.length; i++) if (ta[i] !== tb[i]) diferentes.push([ta[i]!, tb[i]!]);
  if (diferentes.length !== 1) return false;

  const [x, y] = diferentes[0]!;
  // gralha de truncamento: aceitável
  if (x.startsWith(y) || y.startsWith(x)) return false;
  return true;
}

/** Âncora nos dois primeiros caracteres.
 *  Mata PANTHENOL → PHENOL (PA vs PH) e GLYCERIN → NITROGLYCERINE (GL vs NI). */
export function violaGuardaAncora(a: string, b: string): boolean {
  return a.slice(0, 2) !== b.slice(0, 2);
}

export interface Sugestao {
  candidato: string;
  distancia: number;
  via: 'aproximada' | 'ocr';
}

export class Matcher {
  private readonly index: Map<string, string[]>;
  /** baldes por âncora (2 primeiros caracteres). A âncora já é guarda dura,
   *  por isso indexar por ela é gratuito e torna a busca linear no balde. */
  private readonly baldes = new Map<string, string[]>();

  /**
   * @param index      todas as chaves — usadas para correspondência EXATA
   * @param fuzzyKeys  subconjunto elegível para correspondência aproximada.
   *                   Omitir usa todas, o que só é correto quando o índice
   *                   inteiro vem de uma fonte de alta confiança.
   */
  constructor(index: Record<string, string[]> | Map<string, string[]>, fuzzyKeys?: string[]) {
    this.index = index instanceof Map ? index : new Map(Object.entries(index));
    for (const chave of fuzzyKeys ?? [...this.index.keys()]) {
      const a = chave.slice(0, 2);
      const b = this.baldes.get(a);
      if (b) b.push(chave); else this.baldes.set(a, [chave]);
    }
  }

  /** A única via que produz veredicto. Sem limiar, sem exceções. */
  exata(nomeNormalizado: string): string[] | null {
    return this.index.get(nomeNormalizado) ?? null;
  }

  /** Nunca produz veredicto. Devolve no máximo uma sugestão, e só se
   *  sobreviver a todas as guardas. */
  sugere(nomeNormalizado: string): Sugestao | null {
    const n = nomeNormalizado;

    // Via OCR: só aceita se a variante der EXATAMENTE um hit exato.
    // Um dígito dentro de um token inteiramente numérico nunca é substituído,
    // o que protege CI 77491 de virar CI 77401.
    const variantes = this.variantesOcr(n);
    const acertos = variantes.filter((v) => this.index.has(v) && this.elegivelParaSugestao(v)).filter((v) =>
      // As mesmas guardas de espécie aplicam-se aqui. A âncora é a única que
      // NÃO se aplica: numa correção de OCR o caractere corrompido pode ser o
      // primeiro, e exigir âncora igual anularia o mecanismo. O que substitui
      // a âncora como travão é o requisito de acerto exato único.
      !violaGuardaLocante(n, v) && !violaGuardaSufixo(n, v) && !violaGuardaDesignador(n, v));
    if (acertos.length === 1) {
      return { candidato: acertos[0]!, distancia: 1, via: 'ocr' };
    }

    const orcamento = orcamentoEdicao(n.length);
    if (orcamento === 0) return null;

    const balde = this.baldes.get(n.slice(0, 2));
    if (!balde) return null;

    let melhor: Sugestao | null = null;
    for (const cand of balde) {
      if (cand === n) continue; // sugerir o próprio nome não é uma sugestão
      if (Math.abs(cand.length - n.length) > orcamento) continue;
      if (violaGuardaAncora(n, cand)) continue;
      if (violaGuardaLocante(n, cand)) continue;
      if (violaGuardaSufixo(n, cand)) continue;
      if (violaGuardaTokens(n, cand)) continue;
      const d = distancia(n, cand, orcamento);
      if (d > orcamento) continue;
      if (!melhor || d < melhor.distancia) melhor = { candidato: cand, distancia: d, via: 'aproximada' };
    }
    return melhor;
  }

  /** Uma sugestão só pode apontar para um nome de texto legal. Corrigir um
   *  erro de leitura para um nome de nomenclatura sistemática seria trocar uma
   *  incerteza por outra. */
  private elegivelParaSugestao(chave: string): boolean {
    return (this.baldes.get(chave.slice(0, 2)) ?? []).includes(chave);
  }

  private variantesOcr(n: string): string[] {
    const tokens = n.split(' ');
    const protegido = new Set<number>();
    let offset = 0;
    for (const t of tokens) {
      if (/^[0-9]+$/.test(t)) for (let i = 0; i < t.length; i++) protegido.add(offset + i);
      offset += t.length + 1;
    }
    const out: string[] = [];
    for (let i = 0; i < n.length; i++) {
      if (protegido.has(i)) continue;
      for (const sub of CONFUSAVEIS_OCR[n[i]!] ?? []) {
        out.push(n.slice(0, i) + sub + n.slice(i + 1));
      }
    }
    return out;
  }
}

export { normalize };
