import { Matcher } from './match';
import { segment, normalize } from './normalize';
import { traduzirPt, pareceEscritoEmPortugues } from './portugues';
import { SEVERIDADE_REGULAMENTAR, type Claim, type CoreBundle, type MatchState, type Substance } from './types';

export type TipoCmr = 'carcinogenico' | 'mutagenico' | 'reprotoxico';
export interface Cmr { tipo: TipoCmr; categoria: '1A' | '1B' | '2'; condicao?: string }

const RE_CMR = /(Carcinogenic|Mutagenic|Reprotoxic)\s*Cat\.?\s*(1A|1B|2)\s*\(([^)]*)\)/gi;
const TIPO: Record<string, TipoCmr> = { carcinogenic: 'carcinogenico', mutagenic: 'mutagenico', reprotoxic: 'reprotoxico' };

/** A classificação CMR vem numa coluna própria do Anexo II em formato
 *  quase-estruturado: "Reprotoxic Cat. 1B(C=>0.001%)". É esta a via legítima
 *  para o eixo reprotóxico/teratogénico — sai do próprio regulamento da UE e
 *  não da IARC, cuja licença não permite redistribuição. */
export function extrairCmr(texto: string | undefined): Cmr[] {
  if (!texto) return [];
  const out: Cmr[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(RE_CMR);
  while ((m = re.exec(texto))) {
    out.push({
      tipo: TIPO[m[1]!.toLowerCase()]!,
      categoria: m[2] as Cmr['categoria'],
      condicao: m[3]?.trim() || undefined,
    });
  }
  return out;
}

export interface Entrada {
  pos: number;
  raw: string;
  norm: string;
  estado: MatchState;
  condicional: boolean;
  inicia_blend: boolean;
  /** cai dentro da janela da matéria-prima composta detetada */
  no_blend: boolean;
  substancias: Substance[];
  afirmacoes: Claim[];
  cmr: Cmr[];
  sugestao?: { candidato: string; distancia: number; via: 'aproximada' | 'ocr' };
  /** Preenchido quando a entrada só foi reconhecida depois de traduzida de
   *  português para INCI. Fica visível na interface porque a tradução é um
   *  passo a mais entre o rótulo e o veredicto, e quem lê tem direito a saber
   *  que ele existiu. */
  traduzido_de?: { original: string; inci: string; via: 'lexico' | 'botanica' };
}

export interface Resumo {
  /** frase factual derivada só dos anexos, nunca do índice editorial */
  veredicto: string;
  /** fração das entradas que foi possível reconhecer */
  cobertura: number;
  /** A lista parece escrita numa língua que não é a nomenclatura INCI. */
  lista_traduzida: boolean;
  /** Falso quando não há nada a reportar E a lista não foi compreendida.
   *
   *  Um rótulo em português dava zero reconhecimentos, zero alertas e índice
   *  100 — indistinguível de um produto genuinamente limpo. Mas a guarda não
   *  pode ir ao ponto de calar um achado: se se encontrou uma substância
   *  proibida no meio de uma lista traduzida, isso é um facto e reporta-se.
   *  Um facto encontrado vence sempre a incerteza sobre o que ficou por ler. */
  avaliavel: boolean;
  total: number;
  reconhecidos: number;
  sugestoes: number;
  por_identificar: number;
  /** proibições absolutas */
  proibidos: number;
  /** proibições com cláusula de exceção — "except if…", "unless…". A exceção
   *  é o regime normal: é dela que depende toda a vaselina refinada, os
   *  pigmentos de sulfato de bário e os derivados de petróleo em uso legal. */
  proibidos_condicionais: number;
  com_limites: number;
  com_cmr: number;
  reprotoxicos: number;
  /** entradas reconhecidas só depois de traduzidas de português */
  traduzidos: number;
  /** posição da entrada que traz a conjunção declarando um blend, se houver */
  blend_na_posicao: number | null;
}

export interface LeituraEditorial {
  /** null quando a cobertura é baixa demais. Mostrar um número calculado
   *  sobre entradas que não se reconheceram é inventar precisão. */
  indice: number | null;
  /** a fórmula em texto, para poder ser lida por quem vê o número */
  formula: string;
  penalizacoes: Array<{ entrada: string; motivo: string; pontos: number }>;
}

export interface Analise {
  entradas: Entrada[];
  resumo: Resumo;
  editorial: LeituraEditorial;
  fonte: { anexos: string; extraido_em: string; licenca: string };
}

/** Penalizações da leitura editorial.
 *  Isto é julgamento, não medição, e a interface tem de o dizer. Constar de um
 *  anexo de conservantes ou de filtros UV não é um defeito — é o regime normal
 *  de uma substância autorizada —, por isso pesa pouco. O que pesa é a
 *  proibição e a classificação CMR harmonizada. */
const PESO_CMR: Record<string, number> = { '1A': 26, '1B': 22, '2': 12 };
const PESO_ANEXO: Partial<Record<Claim['kind'], number>> = {
  annex_iii_restricted: 5,
  annex_v_preservative: 2,
  annex_vi_uv_filter: 2,
  annex_iv_colorant: 2,
};

export function analisar(nucleo: CoreBundle, matcher: Matcher, texto: string, modo: 'cos' | 'food' = 'cos'): Analise {
  const porId = new Map(nucleo.substances.map((s) => [s.id, s]));
  const claimsPorId = new Map<string, Claim[]>();
  for (const c of nucleo.claims) {
    const l = claimsPorId.get(c.substance_id);
    if (l) l.push(c); else claimsPorId.set(c.substance_id, [c]);
  }

  const segs = segment(texto);
  const blendPos = segs.find((s) => s.inicia_blend)?.pos ?? null;
  const noBlend = (pos: number) => blendPos !== null && pos <= blendPos && pos >= blendPos - 3;

  const entradas: Entrada[] = segs.map((s) => {
    const ids = matcher.exata(s.norm);
    if (ids) {
      const substancias = ids.map((i) => porId.get(i)).filter(Boolean) as Substance[];
      const afirmacoes = ids
        .flatMap((i) => claimsPorId.get(i) ?? [])
        .sort((a, b) => SEVERIDADE_REGULAMENTAR[b.kind] - SEVERIDADE_REGULAMENTAR[a.kind]);
      const cmr: Cmr[] = [];
      for (const a of afirmacoes) {
        // Numa entrada condicional, a classificação CMR descreve a forma NÃO
        // isenta — a vaselina mal refinada, não a que está no frasco. Arrastá-la
        // para o resumo daria "cancerígeno 1B" a um creme de farmácia.
        if (a.payload.excecao) continue;
        for (const c of extrairCmr(a.payload.cmr)) {
          if (!cmr.some((x) => x.tipo === c.tipo && x.categoria === c.categoria)) cmr.push(c);
        }
      }
      return { ...s, estado: 'reconhecido' as MatchState, no_blend: noBlend(s.pos), substancias, afirmacoes, cmr };
    }
    // Tradução PT→INCI. Só vale se produzir um nome que EXISTE no índice:
    // uma tradução errada não encontra nada e a entrada fica "por
    // identificar". Traduzir mal nunca gera um alerta.
    const trad = traduzirPt(s.raw);
    if (trad) {
      const idsTrad = matcher.exata(normalize(trad.inci));
      if (idsTrad) {
        const substancias = idsTrad.map((i) => porId.get(i)).filter(Boolean) as Substance[];
        const afirmacoes = idsTrad
          .flatMap((i) => claimsPorId.get(i) ?? [])
          .sort((a, b) => SEVERIDADE_REGULAMENTAR[b.kind] - SEVERIDADE_REGULAMENTAR[a.kind]);
        const cmr: Cmr[] = [];
        for (const a of afirmacoes) for (const c of extrairCmr(a.payload.cmr)) {
          if (!cmr.some((x) => x.tipo === c.tipo && x.categoria === c.categoria)) cmr.push(c);
        }
        return {
          ...s,
          estado: 'reconhecido' as MatchState,
          no_blend: noBlend(s.pos),
          substancias, afirmacoes, cmr,
          traduzido_de: { original: s.raw, inci: trad.inci, via: trad.via },
        };
      }
    }

    const sug = matcher.sugere(s.norm);
    return {
      ...s,
      estado: (sug ? 'sugestao' : 'por_identificar') as MatchState,
      no_blend: noBlend(s.pos),
      substancias: [], afirmacoes: [], cmr: [],
      sugestao: sug ?? undefined,
    };
  });

  const reconhecidos = entradas.filter((e) => e.estado === 'reconhecido').length;
  const cobertura = entradas.length ? reconhecidos / entradas.length : 0;

  /* Uma taxa de correspondência baixa NÃO é sinal de incompreensão: a maioria
   * dos ingredientes de qualquer rótulo é autorizada sem restrição e por isso
   * não consta de anexo nenhum. Um gel de banho com 18 ingredientes e 4 nos
   * anexos é um resultado correto e comum.
   *
   * O que é sinal de incompreensão é a lista estar escrita numa língua que
   * não é a nomenclatura INCI. Esse mede-se diretamente, olhando para a forma
   * das entradas que não foram reconhecidas. */
  const naoLidas = entradas.filter((e) => e.estado === 'por_identificar');
  const emPortugues = naoLidas.filter((e) => pareceEscritoEmPortugues(e.raw)).length;
  const fracaoPt = entradas.length ? emPortugues / entradas.length : 0;
  const listaTraduzida = entradas.length >= 5 && fracaoPt >= 0.4;

  const resumo: Resumo = {
    veredicto: '',
    cobertura,
    lista_traduzida: listaTraduzida,
    avaliavel: true, // recalculado abaixo, depois de se saber o que se achou
    total: entradas.length,
    reconhecidos: entradas.filter((e) => e.estado === 'reconhecido').length,
    sugestoes: entradas.filter((e) => e.estado === 'sugestao').length,
    por_identificar: entradas.filter((e) => e.estado === 'por_identificar').length,
    proibidos: entradas.filter((e) => e.afirmacoes.some((a) => a.kind === 'annex_ii_banned' && !a.payload.excecao)).length,
    proibidos_condicionais: entradas.filter((e) => e.afirmacoes.some((a) => a.kind === 'annex_ii_banned' && a.payload.excecao)).length,
    com_limites: entradas.filter((e) => e.afirmacoes.some((a) => a.kind !== 'annex_ii_banned')).length,
    com_cmr: entradas.filter((e) => e.cmr.length > 0).length,
    traduzidos: entradas.filter((e) => e.traduzido_de).length,
    reprotoxicos: entradas.filter((e) => e.cmr.some((c) => c.tipo === 'reprotoxico')).length,
    blend_na_posicao: blendPos,
  };

  // ── leitura editorial ────────────────────────────────────────────────
  const penalizacoes: LeituraEditorial['penalizacoes'] = [];
  let total = 0;
  let temProibido = false;

  for (const e of entradas) {
    if (e.estado !== 'reconhecido') continue;
    let pontos = 0;
    const motivos: string[] = [];

    if (e.afirmacoes.some((a) => a.kind === 'annex_ii_banned' && !a.payload.excecao)) {
      temProibido = true;
      pontos += 40; motivos.push('proibido no Anexo II');
    } else if (e.afirmacoes.some((a) => a.kind === 'annex_ii_banned' && a.payload.excecao)) {
      // Não trava o índice: a exceção é a via legal normal, e um produto no
      // mercado europeu presume-se conforme com ela.
      pontos += 6; motivos.push('proibido no Anexo II salvo condição');
    }
    for (const c of e.cmr) {
      pontos += PESO_CMR[c.categoria]!;
      motivos.push(`${c.tipo} categoria ${c.categoria}`);
    }
    const kinds = new Set(e.afirmacoes.map((a) => a.kind));
    for (const k of kinds) {
      const p = PESO_ANEXO[k];
      if (p) { pontos += p; motivos.push(`sujeito a limites (${k.replace('annex_', 'Anexo ').replace(/_.*/, '').toUpperCase()})`); }
    }
    if (pontos === 0) continue;

    let mult = 1;
    if (modo === 'cos' && entradas.length >= 6) {
      const rank = (e.pos - 1) / entradas.length;
      mult = rank < 0.25 ? 1.15 : rank > 0.66 ? 0.85 : 1;
    }
    if (e.no_blend) { mult *= 0.55; motivos.push('componente de matéria-prima composta'); }

    const final = pontos * mult;
    total += final;
    penalizacoes.push({ entrada: e.raw, motivo: motivos.join(' · '), pontos: Math.round(final * 10) / 10 });
  }

  let indice: number | null = Math.max(0, Math.round(100 - total));
  if (temProibido) indice = Math.min(indice, 25);
  // O índice cai sempre que a lista está traduzida, mesmo havendo achados: com
  // parte das entradas por ler, o número só pode ser um limite superior, e
  // apresentar um limite superior como se fosse medição é o erro a evitar.
  if (listaTraduzida) indice = null;

  /** O veredicto descreve o que os anexos dizem, e nada mais. Não deriva do
   *  índice: derivar dele permitiria a contradição de anunciar "sem alertas"
   *  numa lista que mostra uma classificação reprotóxica. */
  // Só se recusa avaliar quando não há NADA para dizer. Um achado é um facto
  // e reporta-se, mesmo que o resto da lista tenha ficado por ler.
  resumo.avaliavel = !(listaTraduzida && resumo.reconhecidos === 0);

  const veredicto =
      resumo.proibidos > 0 ? 'Contém substância proibida na UE'
    : resumo.proibidos_condicionais > 0 ? 'Contém substância proibida salvo condição, que cabe ao fabricante cumprir'
    : resumo.reprotoxicos > 0 ? 'Contém classificação de toxicidade reprodutiva'
    : resumo.com_cmr > 0 ? 'Contém classificação CMR harmonizada'
    : resumo.com_limites > 0 ? 'Só substâncias autorizadas, algumas sujeitas a limites'
    : resumo.reconhecidos > 0 ? 'Nada sujeito a restrição nos anexos II a VI'
    : listaTraduzida ? 'Não foi possível avaliar: a lista parece estar traduzida e não em nomenclatura INCI'
    : 'Nenhuma entrada consta dos anexos II a VI';

  resumo.veredicto = veredicto;

  return {
    entradas,
    resumo,
    editorial: {
      indice,
      formula: 'Proibição no Anexo II: 40 pontos. Classificação CMR harmonizada: 26 (cat. 1A), 22 (1B), 12 (2). Sujeição a limites: 2 a 5. Em cosméticos a posição na lista pondera ±15%, porque a ordem INCI é decrescente em concentração acima de 1%; componentes de uma matéria-prima composta pesam 55%. Qualquer proibição trava o índice em 25.',
      penalizacoes: penalizacoes.sort((a, b) => b.pontos - a.pontos),
    },
    fonte: {
      anexos: 'Anexos II a VI do Reg. (CE) 1223/2009, via CosIng',
      extraido_em: nucleo.built_at,
      licenca: 'CC BY 4.0 — Comissão Europeia',
    },
  };
}
