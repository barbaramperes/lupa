import { createHash } from 'node:crypto';
import { parseCsv } from './csv';
import { normalize } from '../../core/src/normalize';
import type { Claim, ClaimKind, Substance, CoreBundle } from '../../core/src/types';

const BASE = 'https://api.tech.ec.europa.eu/cosing20/1.0/api/annexes';
const LICENCA = 'CC BY 4.0 (Decisão 2011/833/UE) — Comissão Europeia, CosIng';

interface EspecAnexo {
  anexo: string;
  kind: ClaimKind;
  colunas: number;
  pisoDeLinhas: number;
  /** índice da coluna com o nome INCI, ou null quando o anexo não tem
   *  (é o caso do Anexo II, e é o maior problema desta fonte) */
  colInci: number | null;
  colNomeQuimico: number;
  colCas: number;
  colEc: number;
  colIdentificados: number;
}

/** Piso de linhas: uma queda abrupta é falha de ingestão, não são dados novos.
 *  Valores a ~95% do contado em 4 set 2026. */
export const ANEXOS: EspecAnexo[] = [
  { anexo: 'II',  kind: 'annex_ii_banned',        colunas: 11, pisoDeLinhas: 1700, colInci: null, colNomeQuimico: 1, colCas: 2, colEc: 3, colIdentificados: 8 },
  { anexo: 'III', kind: 'annex_iii_restricted',   colunas: 16, pisoDeLinhas: 360,  colInci: 2,    colNomeQuimico: 1, colCas: 3, colEc: 4, colIdentificados: 13 },
  { anexo: 'IV',  kind: 'annex_iv_colorant',      colunas: 17, pisoDeLinhas: 145,  colInci: 2,    colNomeQuimico: 1, colCas: 3, colEc: 4, colIdentificados: 14 },
  { anexo: 'V',   kind: 'annex_v_preservative',   colunas: 16, pisoDeLinhas: 55,   colInci: 2,    colNomeQuimico: 1, colCas: 3, colEc: 4, colIdentificados: 13 },
  { anexo: 'VI',  kind: 'annex_vi_uv_filter',     colunas: 16, pisoDeLinhas: 32,   colInci: 2,    colNomeQuimico: 1, colCas: 3, colEc: 4, colIdentificados: 13 },
];

export class FalhaDeContrato extends Error {
  constructor(anexo: string, qual: string, detalhe: string) {
    super(`Anexo ${anexo} — assert de contrato "${qual}" falhou: ${detalhe}`);
    this.name = 'FalhaDeContrato';
  }
}

/**
 * Descarrega um anexo e corre os asserts ANTES de qualquer parse.
 *
 * O modo de falha que estes asserts existem para apanhar: qualquer caminho
 * inventado sob ec.europa.eu/growth/tools-databases/cosing/** devolve
 * HTTP 200 com o shell da aplicação Angular. Um teste que só verifique o
 * código de estado passa a 100% em URLs falsos, o pipeline produz um dataset
 * vazio, e a app passa a dizer "sem restrições" a tudo — o pior modo de falha
 * possível para este produto, porque é silencioso.
 */
export async function descarregarAnexo(esp: EspecAnexo): Promise<{ texto: string; url: string }> {
  const url = `${BASE}/${esp.anexo}/export-csv`;
  const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });

  if (!r.ok) throw new FalhaDeContrato(esp.anexo, 'http', `HTTP ${r.status}`);

  // Assert 1 — o tipo de conteúdo. É este que apanha o shell Angular.
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('text/plain')) {
    throw new FalhaDeContrato(esp.anexo, 'content-type', `esperado text/plain, veio "${ct}". Provável shell HTML de uma SPA a fingir-se de ficheiro.`);
  }

  // Assert 2 — o nome do ficheiro anunciado
  const cd = r.headers.get('content-disposition') ?? '';
  if (!cd.includes(`COSING_Annex_${esp.anexo}`)) {
    throw new FalhaDeContrato(esp.anexo, 'content-disposition', `esperado COSING_Annex_${esp.anexo}, veio "${cd}"`);
  }

  return { texto: await r.text(), url };
}

export interface AnexoLido {
  esp: EspecAnexo;
  cabecalho: string[];
  dados: string[][];
  ultimaAtualizacao: string;
  /** hash SÓ das linhas de dados. A linha 1 do CSV é "File creation date: hoje"
   *  e muda todos os dias independentemente do conteúdo — fazer hash do
   *  ficheiro inteiro abre um PR de ruído por semana e ensina a ignorá-los. */
  hashDados: string;
  url: string;
}

export function lerAnexo(esp: EspecAnexo, texto: string, url: string): AnexoLido {
  const linhas = parseCsv(texto);

  // Assert 3 — cabeçalho na linha 5, com a contagem exata de colunas
  const cabecalho = linhas[4] ?? [];
  if (cabecalho.length !== esp.colunas) {
    throw new FalhaDeContrato(esp.anexo, 'colunas', `esperadas ${esp.colunas}, vieram ${cabecalho.length}. A fonte mudou de formato.`);
  }
  if (!(cabecalho[0] ?? '').includes('Reference Number')) {
    throw new FalhaDeContrato(esp.anexo, 'cabecalho', `coluna 0 é "${cabecalho[0]}", esperado "Reference Number"`);
  }

  const dados = linhas.slice(5).filter((l) => l.some((c) => c.trim() !== ''));

  // Assert 4 — piso de linhas
  if (dados.length < esp.pisoDeLinhas) {
    throw new FalhaDeContrato(esp.anexo, 'piso-de-linhas', `${dados.length} registos, piso é ${esp.pisoDeLinhas}. Queda abrupta é falha, não são dados novos.`);
  }

  const ultimaAtualizacao = (linhas[1]?.[1] ?? '').replace('Last update: ', '').trim();
  const hashDados = createHash('sha256').update(JSON.stringify(dados)).digest('hex').slice(0, 16);

  return { esp, cabecalho, dados, ultimaAtualizacao, hashDados, url };
}

// ─── normalização de identificadores ────────────────────────────────────

const RE_CAS = /^\d{2,7}-\d{2}-\d$/;

/** Valida o dígito de controlo de um número CAS. Um CAS que falha é erro de
 *  fonte — regista-se no relatório, não se silencia. */
export function casValido(cas: string): boolean {
  if (!RE_CAS.test(cas)) return false;
  const digitos = cas.replace(/-/g, '');
  const controlo = Number(digitos.at(-1));
  let soma = 0;
  const corpo = digitos.slice(0, -1);
  for (let i = 0; i < corpo.length; i++) {
    soma += Number(corpo[corpo.length - 1 - i]) * (i + 1);
  }
  return soma % 10 === controlo;
}

/** Células multi-valor explodem. Guardadas inteiras, funcionam como ímanes
 *  de correspondência aproximada e envenenam o matcher. */
/** O CosIng usa "-" como marcador de "não aplicável". Tratá-lo como texto faz
 *  com que `inci || nomeQuimico` devolva "-" e a entrada fique sem chave —
 *  foi assim que 25 entradas genéricas do Anexo III (famílias de corantes
 *  capilares, com restrições reais) desapareciam em silêncio. */
export function limpo(v: string | undefined): string {
  const t = (v ?? '').trim();
  return t === '-' || t === '—' || t.toLowerCase() === 'n/a' ? '' : t;
}

export function explodir(celula: string): string[] {
  return celula
    .split(/\s*[\/;]\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== '' && s !== '-' && s !== '/');
}

/** A coluna do glossário INCI agrega uma substância e os seus sais numa só
 *  célula: "SORBIC ACID / CALCIUM SORBATE / SODIUM SORBATE / POTASSIUM SORBATE".
 *  Indexada inteira, nenhum rótulo lhe corresponde e os quatro nomes ficam
 *  inalcançáveis.
 *
 *  Só se separa em " / " COM espaços à volta: há nomes INCI legítimos com
 *  barra sem espaços — CAPRYLIC/CAPRIC TRIGLYCERIDE é um nome só, e parti-lo
 *  destruiria a correspondência de um dos emolientes mais comuns que há. */
export function explodirNomes(celula: string): string[] {
  const partes = celula.split(/\s+\/\s+|\s*;\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  return [...new Set([celula.trim(), ...partes])].filter((s) => s !== '' && s !== '-');
}

/** A coluna de ingredientes identificados separa por vírgula — mas nomes
 *  químicos também têm vírgulas (N,N'-BIS(...), 2,4-DICLOROFENOL) e parti-los
 *  gera fragmentos que são ímanes de correspondência errada.
 *
 *  Regra conservadora: separa por vírgula apenas se TODOS os fragmentos
 *  resultantes tiverem pelo menos 4 caracteres. "N,N'-BIS(...)" produz um
 *  fragmento "N" e por isso a célula fica inteira; "CALCIUM SORBATE,POTASSIUM
 *  SORBATE" produz dois fragmentos longos e separa-se. Na dúvida, não separa:
 *  um nome por indexar é um "por identificar" honesto, um fragmento mau é um
 *  alerta falso. */
export function explodirIdentificados(celula: string): string[] {
  const base = explodirNomes(celula);
  const out: string[] = [];
  for (const parte of base) {
    if (!parte.includes(',')) { out.push(parte); continue; }
    const frags = parte.split(',').map((s) => s.trim());
    if (frags.every((f) => f.length >= 4)) out.push(...frags);
    else out.push(parte);
  }
  return [...new Set(out)].filter((s) => s !== '' && s !== '-');
}

/** Nomes muito longos são células que concatenam várias substâncias. Nenhum
 *  rótulo lhes vai corresponder exatamente, e no índice só servem para
 *  atrair correspondências aproximadas erradas. O registo mantém-se —
 *  encontrável por CAS —, apenas não entra no índice de nomes. */
const COMPRIMENTO_MAXIMO_INDEXAVEL = 120;

export function construirNucleo(lidos: AnexoLido[], dataExtracao: string): CoreBundle {
  const substancias = new Map<string, Substance>();
  const claims: Claim[] = [];
  const casInvalidos: string[] = [];

  const idPara = (cas: string[], nomeNorm: string) =>
    createHash('sha1').update(cas[0] ?? nomeNorm).digest('hex').slice(0, 12);

  for (const lido of lidos) {
    const { esp } = lido;
    /** Uma entrada dos anexos pode ocupar várias linhas: quando tem condições
     *  diferentes por tipo de produto, só a primeira linha traz os
     *  identificadores e as seguintes têm "-" em todas as colunas de
     *  identificação. Essas linhas não são substâncias novas — são condições
     *  adicionais da mesma. Descartá-las perde texto legal em silêncio. */
    let ultimoIdPorRef: { ref: string; id: string } | null = null;
    for (const linha of lido.dados) {
      const ref = (linha[0] ?? '').trim();
      const nomeQuimico = limpo(linha[esp.colNomeQuimico]);
      const inci = esp.colInci === null ? '' : limpo(linha[esp.colInci]);

      const cas = explodir(linha[esp.colCas] ?? '').filter((c) => {
        if (RE_CAS.test(c) && !casValido(c)) { casInvalidos.push(`${esp.anexo}/${ref}: ${c}`); return false; }
        return RE_CAS.test(c);
      });
      const ec = explodir(linha[esp.colEc] ?? '').filter((e) => /^\d{3}-\d{3}-\d$/.test(e));
      const identificados = explodirIdentificados(linha[esp.colIdentificados] ?? '');

      const nomesCandidatos = [...explodirNomes(inci), ...explodirNomes(nomeQuimico), ...identificados].filter(Boolean);
      const nomesNorm = [...new Set(
        nomesCandidatos.map(normalize).filter((n) => n.length >= 2 && n.length <= COMPRIMENTO_MAXIMO_INDEXAVEL),
      )];
      // identificadores escritos literalmente no rótulo também são chave
      for (const c of cas) nomesNorm.push(normalize(c));
      for (const e of ec) nomesNorm.push(normalize(e));

      const chave = cas[0] ?? normalize(inci || nomeQuimico);
      let id: string;
      if (chave) {
        id = idPara(cas, chave);
        ultimoIdPorRef = { ref, id };
      } else if (ultimoIdPorRef && ultimoIdPorRef.ref === ref) {
        // linha de continuação: mesma referência, sem identificadores próprios
        id = ultimoIdPorRef.id;
      } else {
        continue;
      }

      const existente = substancias.get(id);
      if (!chave && existente) {
        // continuação: só acrescenta a afirmação, não mexe na substância
      } else if (existente) {
        existente.cas = [...new Set([...existente.cas, ...cas])];
        existente.ec = [...new Set([...existente.ec, ...ec])];
        existente.names_norm = [...new Set([...existente.names_norm, ...nomesNorm])];
        if (!existente.inci_name && inci) existente.inci_name = inci;
      } else {
        substancias.set(id, {
          id,
          inci_name: inci || undefined,
          chem_name: nomeQuimico || undefined,
          cas, ec,
          names_norm: [...new Set(nomesNorm)],
        });
      }

      claims.push({
        substance_id: id,
        kind: esp.kind,
        payload: {
          reference_number: ref,
          tipo_produto: esp.anexo === 'II' ? undefined : limpo(linha[5]) || undefined,
          concentracao_maxima: esp.anexo === 'II' ? undefined : limpo(linha[esp.anexo === 'IV' ? 7 : 6]) || undefined,
          outros: esp.anexo === 'II' ? undefined : limpo(linha[esp.anexo === 'IV' ? 8 : 7]) || undefined,
          advertencias: esp.anexo === 'II' ? undefined : limpo(linha[esp.anexo === 'IV' ? 9 : 8]) || undefined,
          cmr: limpo(linha[esp.anexo === 'II' ? 9 : esp.anexo === 'IV' ? 15 : 14]) || undefined,
        },
        source: {
          dataset: 'cosing',
          annex: esp.anexo,
          row_id: ref,
          retrieved_at: dataExtracao,
          source_url: lido.url,
          licence: LICENCA,
        },
      });
    }
  }

  const index: Record<string, string[]> = {};
  for (const s of substancias.values()) {
    for (const n of s.names_norm) {
      (index[n] ??= []).push(s.id);
    }
  }
  for (const k of Object.keys(index)) index[k] = [...new Set(index[k]!)];

  return {
    built_at: dataExtracao,
    substances: [...substancias.values()],
    claims,
    index,
    stats: {
      substancias: substancias.size,
      afirmacoes: claims.length,
      chaves_no_indice: Object.keys(index).length,
      cas_invalidos_descartados: casInvalidos.length,
      ...Object.fromEntries(lidos.map((l) => [`anexo_${l.esp.anexo}`, l.dados.length])),
    },
  };
}
