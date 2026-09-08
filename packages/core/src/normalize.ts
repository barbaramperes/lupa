/**
 * Normalização determinística. É a única transformação aplicada antes da
 * correspondência exata, e é testada por propriedades.
 *
 * O que NÃO se faz aqui, deliberadamente: corrigir confusões de OCR
 * (0→O, 1→I, 5→S). Aplicá-las cegamente destrói números de Colour Index
 * (CI 77491 vs CI 77492) e locantes de isómeros (2,4,5- vs 2,4,6-).
 * As confusões de OCR são variantes de candidatura na fase de sugestão,
 * não normalização.
 */
export function normalize(input: string): string {
  return input
    // Invisíveis primeiro: um hífen suave ou um espaço de largura zero, vindos
    // de texto copiado de um PDF, partiriam o nome ao meio se virassem espaço.
    .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Segmentação de um rótulo em entradas.
 *
 * Separa por vírgula FORA de parênteses: "AQUA (WATER)" é um item, não dois.
 * "+/-" e "MAY CONTAIN" não são ingredientes — são um marcador de presença
 * condicional que muda o texto do veredicto ("pode conter"), não o veredicto.
 */
export interface Segment {
  raw: string;
  norm: string;
  /** posição na lista, 1-based. Em INCI a ordem é decrescente em
   *  concentração acima de 1%. */
  pos: number;
  condicional: boolean;
  /** a conjunção "and" a meio de uma lista INCI declara uma matéria-prima
   *  composta: um blend vendido como ingrediente único */
  inicia_blend: boolean;
}

const MARCADORES_CONDICIONAIS = /^(\+\s*\/\s*-|\+-|±|MAY CONTAIN|PODE CONTER|PEUT CONTENIR)\s*/i;

export function segment(label: string): Segment[] {
  const out: Segment[] = [];
  let condicional = false;
  let buf = '';
  let depth = 0;

  const flush = () => {
    const raw = buf.trim().replace(/[.;]+$/, '');
    buf = '';
    if (!raw) return;

    let texto = raw;
    if (MARCADORES_CONDICIONAIS.test(texto)) {
      condicional = true;
      texto = texto.replace(MARCADORES_CONDICIONAIS, '').trim();
      if (!texto) return;
    }

    const inicia_blend = /^(and|e)\s+\S/i.test(texto);
    if (inicia_blend) texto = texto.replace(/^(and|e)\s+/i, '');

    // marcadores de origem orgânica/natural não fazem parte do nome
    texto = texto.replace(/[*†°]+$/g, '').trim();
    // percentagens declaradas não fazem parte do nome
    texto = texto.replace(/\d+([.,]\d+)?\s*%/g, '').trim();

    const norm = normalize(texto);
    if (norm.length < 2) return;
    out.push({ raw: texto, norm, pos: out.length + 1, condicional, inicia_blend });
  };

  // Nem toda a gente separa por vírgula. A Uriage publica as listas com
  // travessões, e sem isto a lista inteira virava uma entrada só — que depois
  // não corresponde a nada e passa por "por identificar".
  // Só se separa em travessão RODEADO DE ESPAÇOS: o hífen dentro de um nome
  // (PEG-100, C10-30, Coco-Caprylate) nunca os tem, e parti-lo destruiria o nome.
  const normalizado = label.replace(/\s+[—–]\s+/g, ',').replace(/[\n\r;•|\t]+/g, ',');
  for (const ch of normalizado) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) flush();
    else buf += ch;
  }
  flush();
  return out;
}
