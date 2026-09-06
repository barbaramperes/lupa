import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

/**
 * PONTE CAS → NOMES DE RÓTULO.
 *
 * O problema que resolve: o Anexo II (substâncias PROIBIDAS) não tem coluna de
 * nome INCI. Tem nomenclatura química, e a coluna de ingredientes identificados
 * está preenchida em 319 de 1758 entradas. Ou seja, 82% das substâncias
 * proibidas na UE são inalcançáveis a quem escreve o nome que está no rótulo.
 *
 * A fonte é o CID-Synonym-filtered do PubChem: pares CID → nome, ordenados por
 * CID, com os sinónimos de cada composto contíguos. Os números CAS estão entre
 * os sinónimos, o que permite juntar por CAS numa única passagem em streaming:
 * acumula-se o bloco de nomes de um CID e, quando o CID muda, verifica-se se
 * algum dos nomes acumulados é um CAS que está no núcleo.
 *
 * Domínio público (obra do governo dos EUA, NCBI/NLM).
 */

const RE_CAS = /^\d{2,7}-\d{2}-\d$/;

/** Identificadores de registo e códigos de fornecedor. Não são nomes que
 *  alguém escreva num rótulo, e no índice só servem para inchar e para atrair
 *  correspondências aproximadas erradas. */
const LIXO = [
  /^DTXSID/i, /^DTXCID/i, /^CHEBI:/i, /^CHEMBL/i, /^SCHEMBL/i, /^AKOS/i, /^MFCD/i,
  /^RefChem:/i, /^EINECS/i, /^EC\s?\d{3}-\d{3}-\d/i, /^UNII[-:]?/i, /^NSC[-\s]?\d/i,
  /^BRN\s?\d/i, /^CCRIS\s?\d/i, /^HSDB\s?\d/i, /^NCGC/i, /^AC1[A-Z]/i, /^CAS-/i,
  /^Q\d{4,}$/, /^InChI[=/]/i, /^[A-Z]{10,14}-[A-Z]{8,10}-[A-Z]$/, // InChIKey
  /^SMR\d/i, /^SR-\d/i, /^BDBM/i, /^ZINC\d/i, /^STK\d/i, /^BBL\d/i, /^STL\d/i,
  /^Tox21_/i, /^NCIOpen/i, /^cid_\d/i, /^DB\d{5}$/i, /^FT-\d/i, /^J-\d{6}/i,
  /^(?=.*\d)[0-9A-Z]{10}$/,            // UNII da FDA: exatamente 10 alfanuméricos com dígito (07OP6H4V4A)
  /^\d+[A-Z]{2,}\d*[A-Z]*$/,           // outros códigos que começam por dígitos
  /^[A-Z]{1,3}-?\d{3,}$/,              // códigos de catálogo
  /^\d{4,}$/,                          // números soltos
];

/** Variantes isotópicas e de marcação. São compostos distintos e nunca
 *  aparecem num rótulo de cosmético ou de alimento. */
const MARCADO = /(-d\d+\b|-13C|-14C|-15N|-18O|\bdeuter|\btritiat|-\dH\b)/i;

export function nomeUtilizavel(nome: string): boolean {
  const t = nome.trim();
  if (t.length < 3 || t.length > 120) return false;
  // Números CAS ficam de fora por decisão deliberada: a ACS reivindica direitos
  // sobre a redistribuição em massa de números CAS, e a exceção que nos cobre é
  // a dos CAS que constam de textos legais da UE — esses já vêm do CosIng.
  if (RE_CAS.test(t)) return false;
  if (MARCADO.test(t)) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;
  for (const re of LIXO) if (re.test(t)) return false;
  // linhas com separadores de campo são despejos de base de dados, não nomes
  if (/[|\t]/.test(t)) return false;
  return true;
}

export interface ResultadoPonte {
  /** CAS normalizado → nomes encontrados */
  porCas: Map<string, string[]>;
  linhasLidas: number;
  blocosLidos: number;
  blocosCasados: number;
  nomesAceites: number;
  nomesRejeitados: number;
}

/**
 * Passagem única sobre o ficheiro. Só se guardam nomes de compostos cujo CAS
 * já está no núcleo — não se ingere o PubChem inteiro, ingere-se a interseção.
 */
export async function construirPonte(
  caminhoGz: string,
  casDoNucleo: Set<string>,
  aoProgredir?: (linhas: number) => void,
): Promise<ResultadoPonte> {
  const porCas = new Map<string, string[]>();
  let linhasLidas = 0, blocosLidos = 0, blocosCasados = 0, nomesAceites = 0, nomesRejeitados = 0;

  let cidAtual = '';
  let bloco: string[] = [];

  const fecharBloco = () => {
    if (!bloco.length) return;
    blocosLidos++;
    // o bloco interessa se algum dos seus nomes for um CAS que está no núcleo
    const casRelevantes = bloco.filter((n) => RE_CAS.test(n) && casDoNucleo.has(n));
    if (casRelevantes.length) {
      blocosCasados++;
      const nomes: string[] = [];
      for (const n of bloco) {
        if (nomeUtilizavel(n)) { nomes.push(n); nomesAceites++; }
        else nomesRejeitados++;
      }
      for (const cas of casRelevantes) {
        const existentes = porCas.get(cas);
        if (existentes) existentes.push(...nomes);
        else porCas.set(cas, [...nomes]);
      }
    }
    bloco = [];
  };

  const rl = createInterface({
    input: createReadStream(caminhoGz).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  for await (const linha of rl) {
    linhasLidas++;
    if (aoProgredir && linhasLidas % 5_000_000 === 0) aoProgredir(linhasLidas);
    const sep = linha.indexOf('\t');
    if (sep < 1) continue;
    const cid = linha.slice(0, sep);
    if (cid !== cidAtual) { fecharBloco(); cidAtual = cid; }
    bloco.push(linha.slice(sep + 1));
  }
  fecharBloco();

  for (const [k, v] of porCas) porCas.set(k, [...new Set(v)]);
  return { porCas, linhasLidas, blocosLidos, blocosCasados, nomesAceites, nomesRejeitados };
}
