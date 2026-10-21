import { normalize } from '../../core/src/normalize';
import type { Claim, CoreBundle } from '../../core/src/types';

/**
 * REACH, ANEXO XVII, ENTRADA 70 — D4, D5 e D6.
 *
 * Os anexos do Reg. 1223/2009 não são a única lei que toca nos cosméticos. O
 * D5 (Cyclopentasiloxane) não consta de nenhum: é autorizado como cosmético e
 * restringido como químico, no REACH. Sem esta entrada, a Lupa dizia "por
 * identificar" ao primeiro ingrediente de um sérum que deixa de poder ser
 * vendido na UE a 6 jun 2027.
 *
 * Texto copiado do Jornal Oficial, Reg. (UE) 2024/1328 (L, 17.5.2024), na
 * versão XHTML servida pelo Serviço das Publicações da UE. Só se retiraram as
 * chamadas de nota de rodapé "( *1 )"; o resto é literal, como o contrato do
 * Claim exige. É curto e estável o bastante para viver no código: uma entrada,
 * três substâncias, sem API para descarregar.
 *
 * Os nomes INCI não estão no texto legal (que usa os nomes químicos). A
 * correspondência CAS → INCI é a do glossário comum de ingredientes, e é
 * inequívoca para estas três: um CAS, um nome.
 */
const FONTE = {
  dataset: 'eurlex-reach' as const,
  celex: '32024R1328',
  annex: 'XVII',
  row_id: '70',
  source_url: 'https://eur-lex.europa.eu/eli/reg/2024/1328/oj',
  licence: '© União Europeia — reutilização autorizada (Decisão 2011/833/UE)',
};

const PARAGRAFO_1 =
  '1. Shall not be placed on the market (a) as a substance on its own; (b) as a constituent of other substances; or (c) in mixtures; in a concentration equal to or greater than 0,1 % by weight of the respective substance after 6 June 2026.';

const PARAGRAFO_3_COSMETICOS =
  '3. By way of derogation: (a) for D4 and D5 in wash-off cosmetic products, paragraph 1, point (c), shall apply after 31 January 2020. For the purposes of this point, “wash-off cosmetic products” means cosmetic products as defined in Article 2(1), point (a), of Regulation (EC) No 1223/2009 of the European Parliament and of the Council that, under normal conditions of use, are washed off with water after application; (b) for all cosmetic products other than the ones mentioned in paragraph 3(a), paragraph 1 shall apply after 6 June 2027;';

export const ENTRADA_70 = [
  { quimico: 'Octamethylcyclotetrasiloxane', sigla: 'D4', cas: '556-67-2', ec: '209-136-7', inci: 'CYCLOTETRASILOXANE' },
  { quimico: 'Decamethylcyclopentasiloxane', sigla: 'D5', cas: '541-02-6', ec: '208-764-9', inci: 'CYCLOPENTASILOXANE' },
  { quimico: 'Dodecamethylcyclohexasiloxane', sigla: 'D6', cas: '540-97-6', ec: '208-762-8', inci: 'CYCLOHEXASILOXANE' },
] as const;

/**
 * Junta a entrada 70 ao núcleo. Se a substância já existir (o D4 está no
 * Anexo II desde 2019), a afirmação junta-se à dela e o nome INCI entra no
 * índice; senão cria-se a substância. Corre ANTES da ponte do PubChem, para o
 * CAS do D5 e do D6 também receber sinónimos.
 */
export function aplicarReach(nucleo: CoreBundle, dataExtracao: string): { criadas: number; afirmacoes: number } {
  let criadas = 0;
  for (const s of ENTRADA_70) {
    const nomes = [s.inci, s.quimico, `${s.quimico} (${s.sigla})`, s.cas, s.ec].map(normalize);
    let alvo = nucleo.substances.find((x) => x.cas.includes(s.cas));
    if (!alvo) {
      alvo = { id: `reach-70-${s.sigla.toLowerCase()}`, inci_name: s.inci, chem_name: s.quimico, cas: [s.cas], ec: [s.ec], names_norm: [] };
      nucleo.substances.push(alvo);
      criadas++;
    }
    alvo.names_norm = [...new Set([...alvo.names_norm, ...nomes])];
    for (const n of nomes) {
      const ids = (nucleo.index[n] ??= []);
      if (!ids.includes(alvo.id)) ids.push(alvo.id);
    }

    const afirmacao: Claim = {
      substance_id: alvo.id,
      kind: 'reach_xvii_restricted',
      payload: {
        reference_number: '70',
        concentracao_maxima: '0,1 % by weight of the respective substance',
        tipo_produto: PARAGRAFO_3_COSMETICOS,
        outros: PARAGRAFO_1,
      },
      source: { ...FONTE, retrieved_at: dataExtracao },
    };
    nucleo.claims.push(afirmacao);
  }
  nucleo.stats.reach_xvii_entrada_70 = ENTRADA_70.length;
  nucleo.stats.substancias = nucleo.substances.length;
  nucleo.stats.afirmacoes = nucleo.claims.length;
  nucleo.stats.chaves_no_indice = Object.keys(nucleo.index).length;
  return { criadas, afirmacoes: ENTRADA_70.length };
}
