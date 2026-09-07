import { normalize } from './normalize';

/**
 * TRADUÇÃO PT → INCI.
 *
 * O mercado português vende cosméticos com a lista de ingredientes traduzida,
 * apesar de o art. 19.º do Reg. 1223/2009 exigir nomenclatura INCI. Metade dos
 * rótulos reais testados vinha assim, e sem esta camada o motor reconhecia
 * zero entradas — o que, antes da guarda de cobertura, se lia como "produto
 * limpo".
 *
 * Duas vias, por esta ordem:
 *
 * 1. Léxico de nomes químicos. Tradução direta, curada à mão. É onde está o
 *    risco: "esqualeno" e "esqualano" são substâncias diferentes, e trocá-las
 *    seria pior do que não traduzir. Por isso o léxico é explícito e testado,
 *    e não uma heurística.
 *
 * 2. Regra estrutural para nomes botânicos. Estes já vêm em latim no rótulo
 *    português — o que muda é a ordem e as palavras de estrutura:
 *      "óleo da semente de Prunus Armeniaca"  →  PRUNUS ARMENIACA SEED OIL
 *      "manteiga de Butyrospermum parkii"     →  BUTYROSPERMUM PARKII BUTTER
 *
 * Segurança: uma tradução que não produza um nome existente no índice é
 * descartada em silêncio, e a entrada fica "por identificar". Traduzir mal
 * nunca gera um alerta — no pior caso não gera nada.
 */

/** Palavras de tipo: o que a matéria é. */
const TIPOS: Array<[RegExp, string]> = [
  [/^oleos?\b/, 'OIL'],
  [/^manteigas?\b/, 'BUTTER'],
  [/^extratos?\b/, 'EXTRACT'],
  [/^ceras?\b/, 'WAX'],
  [/^(sumo|suco)s?\b/, 'JUICE'],
  [/^amidos?\b/, 'STARCH'],
  [/^agua\b/, 'WATER'],
  [/^po\b/, 'POWDER'],
  [/^farinhas?\b/, 'FLOUR'],
  [/^protein[ao]s?\b/, 'PROTEIN'],
];

/** Palavras de parte: de onde da planta vem. */
const PARTES: Array<[RegExp, string]> = [
  [/\bsementes?\b/, 'SEED'],
  [/\bfolhas?\b/, 'LEAF'],
  [/\b(frutas?|frutos?)\b/, 'FRUIT'],
  [/\braizes?\b|\braiz\b/, 'ROOT'],
  [/\bflor(es)?\b/, 'FLOWER'],
  [/\bcascas?\b/, 'PEEL'],
  [/\b(caroco|amendoa)s?\b/, 'KERNEL'],
  [/\bcaules?\b/, 'STEM'],
];

/** Léxico de nomes químicos. Curado à mão, uma entrada por linha, com os
 *  pares perigosos separados de propósito. */
export const LEXICO_PT: Record<string, string> = {
  'agua': 'AQUA',
  'glicerina': 'GLYCERIN',
  'tocoferol': 'TOCOPHEROL',
  'goma xantana': 'XANTHAN GUM',
  'goma guar': 'GUAR GUM',
  'acido citrico': 'CITRIC ACID',
  'acido latico': 'LACTIC ACID',
  'acido lactico': 'LACTIC ACID',
  'acido salicilico': 'SALICYLIC ACID',
  'acido sorbico': 'SORBIC ACID',
  'acido benzoico': 'BENZOIC ACID',
  'acido hialuronico': 'HYALURONIC ACID',
  'acido ascorbico': 'ASCORBIC ACID',
  'acido azelaico': 'AZELAIC ACID',
  'acido glicolico': 'GLYCOLIC ACID',
  'acido desidroacetico': 'DEHYDROACETIC ACID',
  'hialuronato de sodio': 'SODIUM HYALURONATE',
  'benzoato de sodio': 'SODIUM BENZOATE',
  'sorbato de potassio': 'POTASSIUM SORBATE',
  'levulinato de sodio': 'SODIUM LEVULINATE',
  'anisato de sodio': 'SODIUM ANISATE',
  'gluconato de sodio': 'SODIUM GLUCONATE',
  'cloreto de sodio': 'SODIUM CHLORIDE',
  'hidroxido de sodio': 'SODIUM HYDROXIDE',
  'bicarbonato de sodio': 'SODIUM BICARBONATE',
  'lauril sulfato de sodio': 'SODIUM LAURYL SULFATE',
  'estearato de glicerila': 'GLYCERYL STEARATE',
  'estearato de glicerila se': 'GLYCERYL STEARATE SE',
  'caprilato de glicerila': 'GLYCERYL CAPRYLATE',
  'oleato de decil': 'DECYL OLEATE',
  'palmitato de isopropila': 'ISOPROPYL PALMITATE',
  'miristato de isopropila': 'ISOPROPYL MYRISTATE',
  'estearato de sorbitana': 'SORBITAN STEARATE',
  'alcool cetilico': 'CETYL ALCOHOL',
  'alcool cetearilico': 'CETEARYL ALCOHOL',
  'alcool estearilico': 'STEARYL ALCOHOL',
  'alcool benzilico': 'BENZYL ALCOHOL',
  'alcool desnaturado': 'ALCOHOL DENAT',
  'cetearil glucosideo': 'CETEARYL GLUCOSIDE',
  'coco glucosideo': 'COCO-GLUCOSIDE',
  'lauril glucosideo': 'LAURYL GLUCOSIDE',
  'decil glucosideo': 'DECYL GLUCOSIDE',
  'cocamidopropil betaina': 'COCAMIDOPROPYL BETAINE',
  'celulose microcristalina': 'MICROCRYSTALLINE CELLULOSE',
  'microcristalino celulose': 'MICROCRYSTALLINE CELLULOSE',
  'triglicerideo caprilico caprico': 'CAPRYLIC/CAPRIC TRIGLYCERIDE',
  'coco caprilato': 'COCO-CAPRYLATE',
  'beta sitosterol': 'BETA-SITOSTEROL',
  'pantenol': 'PANTHENOL',
  'niacinamida': 'NIACINAMIDE',
  'alantoina': 'ALLANTOIN',
  'cafeina': 'CAFFEINE',
  'ureia': 'UREA',
  'lecitina': 'LECITHIN',
  'dimeticone': 'DIMETHICONE',
  'parfum': 'PARFUM',
  'perfume': 'PARFUM',
  'fragrancia': 'PARFUM',
  'oxido de zinco': 'ZINC OXIDE',
  'dioxido de titanio': 'TITANIUM DIOXIDE',
  'fenoxietanol': 'PHENOXYETHANOL',
  'hidroquinona': 'HYDROQUINONE',
  'resorcinol': 'RESORCINOL',
  'formaldeido': 'FORMALDEHYDE',
  'tolueno': 'TOLUENE',
  'acido borico': 'BORIC ACID',
  'retinol': 'RETINOL',
  'palmitato de retinilo': 'RETINYL PALMITATE',
  'oleo mineral': 'PARAFFINUM LIQUIDUM',
  'vaselina': 'PETROLATUM',
  'manteiga de karite': 'BUTYROSPERMUM PARKII BUTTER',
  'manteiga de cacau': 'THEOBROMA CACAO SEED BUTTER',
  'oleo de amendoa doce': 'PRUNUS AMYGDALUS DULCIS OIL',
  'oleo de jojoba': 'SIMMONDSIA CHINENSIS SEED OIL',
  'oleo de girassol': 'HELIANTHUS ANNUUS SEED OIL',
  'oleo de coco': 'COCOS NUCIFERA OIL',
  'oleo de argan': 'ARGANIA SPINOSA KERNEL OIL',
  'oleo de rosa mosqueta': 'ROSA MOSCHATA SEED OIL',
  // pares que NÃO se podem confundir — substâncias diferentes
  'oleo de glicina soja': 'GLYCINE SOJA OIL',
  'oleo de soja': 'GLYCINE SOJA OIL',
  'esqualeno': 'SQUALENE',
  'esqualano': 'SQUALANE',
  'sulfito de sodio': 'SODIUM SULFITE',
  'sulfato de sodio': 'SODIUM SULFATE',
};

const PREPOSICOES = /\b(de|da|do|das|dos|em|com|e)\b/g;
const ORGANICO = /\b(organic[oa]s?|biologic[oa]s?|de agricultura biologica|de cultivo biologico)\b/g;

/** Nome latino: duas ou mais palavras que não são vocabulário estrutural. */
function extrairLatino(texto: string): string | null {
  const estrutural = new Set([
    'OLEO', 'OLEOS', 'MANTEIGA', 'MANTEIGAS', 'EXTRATO', 'EXTRATOS', 'CERA', 'CERAS',
    'SUMO', 'SUCO', 'AMIDO', 'AGUA', 'PO', 'FARINHA', 'PROTEINA',
    'SEMENTE', 'SEMENTES', 'FOLHA', 'FOLHAS', 'FRUTA', 'FRUTO', 'FRUTAS', 'FRUTOS',
    'RAIZ', 'RAIZES', 'FLOR', 'FLORES', 'CASCA', 'CASCAS', 'CAROCO', 'AMENDOA', 'CAULE',
    'DE', 'DA', 'DO', 'DAS', 'DOS', 'EM', 'COM', 'E', 'ORGANICO', 'ORGANICA', 'BIOLOGICO', 'BIOLOGICA',
  ]);
  const palavras = texto.split(' ').filter((p) => p && !estrutural.has(p));
  if (palavras.length < 2) return null;
  return palavras.slice(0, 3).join(' ');
}

export interface Traducao {
  inci: string;
  via: 'lexico' | 'botanica';
}

/**
 * Tenta traduzir uma entrada de rótulo em português para nomenclatura INCI.
 * Devolve null quando não sabe — que é a resposta certa na dúvida.
 */
export function traduzirPt(bruto: string): Traducao | null {
  // O nome comum entre parênteses sai ANTES de normalizar: o normalizador
  // converte parênteses em espaços, e depois disso já não há como distinguir
  // "Prunus amygdalus dulcis (amêndoa doce)" de uma menção a caroço — que foi
  // exatamente como "amêndoa" passou a produzir KERNEL OIL onde devia ser OIL.
  const semParentesesBruto = bruto.replace(/\([^)]*\)/g, ' ');

  let t = normalize(bruto).toLowerCase().replace(ORGANICO, ' ').replace(/\s+/g, ' ').trim();
  const semParenteses = normalize(semParentesesBruto).toLowerCase()
    .replace(ORGANICO, ' ').replace(/\s+/g, ' ').trim();

  for (const candidato of [t, semParenteses]) {
    const chave = candidato.replace(PREPOSICOES, ' ').replace(/[\/-]/g, ' ').replace(/\s+/g, ' ').trim();
    const direto = LEXICO_PT[candidato] ?? LEXICO_PT[chave];
    if (direto) return { inci: direto, via: 'lexico' };
  }

  // via botânica
  const alvo = semParenteses;
  let tipo: string | null = null;
  for (const [re, en] of TIPOS) if (re.test(alvo)) { tipo = en; break; }
  if (!tipo) return null;

  let parte: string | null = null;
  for (const [re, en] of PARTES) if (re.test(alvo)) { parte = en; break; }

  const latino = extrairLatino(normalize(alvo));
  if (!latino) return null;

  return { inci: [latino, parte, tipo].filter(Boolean).join(' '), via: 'botanica' };
}

/** Vocabulário de estrutura que não existe em nomenclatura INCI. A presença
 *  destas palavras é o sinal de que a lista foi traduzida. */
const MARCAS_PT = /\b(oleo|oleos|manteiga|extrato|agua|goma|alcool|acido|semente|folha|fruta|fruto|raiz|flor|casca|amido|sumo|suco|po|sodio|potassio|glicerila|glicerina|organic[oa]|biologic[oa]|de|da|do|das|dos|com)\b/;

/**
 * Uma entrada parece escrita em português e não em INCI?
 *
 * Serve para distinguir dois casos que uma taxa de correspondência baixa não
 * distingue: "a maioria destes ingredientes não é regulada" (resultado
 * legítimo e comum) e "não percebi nada do que aqui está escrito". Só o
 * segundo é motivo para recusar avaliar.
 */
export function pareceEscritoEmPortugues(bruto: string): boolean {
  const n = normalize(bruto).toLowerCase();
  if (/[çãõ]/.test(bruto)) return true;
  return MARCAS_PT.test(n);
}
