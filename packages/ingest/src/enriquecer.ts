import { normalize } from '../../core/src/normalize';
import type { CoreBundle } from '../../core/src/types';

export interface RelatorioPonte {
  substancias_com_cas: number;
  substancias_enriquecidas: number;
  chaves_antes: number;
  chaves_depois: number;
  nomes_adicionados: number;
  rejeitados_por_colisao: number;
  rejeitados_por_duplicado: number;
  exemplos_colisao: string[];
  exemplos_novos: string[];
}

/**
 * Junta os sinónimos do PubChem ao núcleo, por número CAS.
 *
 * REGRA DE SEGURANÇA, e é a razão de ser deste ficheiro:
 * um sinónimo só pode criar uma chave NOVA. Se a chave normalizada já existe
 * no índice — venha ela do CosIng ou de outro sinónimo — o candidato é
 * rejeitado, não fundido.
 *
 * Porquê tão restritivo: os nomes do CosIng vêm de um texto legal e são a
 * fonte de maior confiança que temos. Os do PubChem são um agregado de
 * proveniências variadas, incluindo nomes comerciais e traduções. Deixar o
 * segundo sobrepor-se ao primeiro permitiria que um sinónimo de uma substância
 * autorizada apontasse para uma entrada de substância proibida — que é a
 * mentira que este projeto inteiro existe para não contar.
 *
 * O custo é perder sinónimos legítimos que colidem. É o custo certo: um nome
 * por indexar produz um "por identificar" honesto; um nome mal indexado produz
 * um alerta falso com aspeto de facto regulamentar.
 */
export function enriquecerComPonte(
  nucleo: CoreBundle,
  porCas: Map<string, string[]>,
  dataExtracao: string,
): RelatorioPonte {
  // Fotografia das chaves ANTES da ponte: são estas, e só estas, as que
  // podem ser propostas como sugestão.
  nucleo.fuzzy_keys = Object.keys(nucleo.index);
  const chavesAntes = nucleo.fuzzy_keys.length;
  const jaExiste = new Set(Object.keys(nucleo.index));

  let comCas = 0, enriquecidas = 0, adicionados = 0;
  let porColisao = 0, porDuplicado = 0;
  const exemplosColisao: string[] = [];
  const exemplosNovos: string[] = [];

  for (const s of nucleo.substances) {
    if (!s.cas.length) continue;
    comCas++;

    const candidatos = new Set<string>();
    for (const cas of s.cas) for (const nome of porCas.get(cas) ?? []) candidatos.add(nome);
    if (!candidatos.size) continue;

    const propriosNormalizados = new Set(s.names_norm);
    const aceites: string[] = [];

    for (const nome of candidatos) {
      const n = normalize(nome);
      if (n.length < 3 || n.length > 120) continue;

      if (propriosNormalizados.has(n)) { porDuplicado++; continue; }

      if (jaExiste.has(n)) {
        // A chave já está tomada. Não se funde: se o dono for outra
        // substância, fundir seria afirmar uma equivalência que não temos
        // como verificar.
        const donos = nucleo.index[n] ?? [];
        if (!donos.includes(s.id)) {
          porColisao++;
          if (exemplosColisao.length < 8) exemplosColisao.push(`"${nome}" já pertence a outra substância`);
        } else {
          porDuplicado++;
        }
        continue;
      }

      aceites.push(n);
      jaExiste.add(n);
      propriosNormalizados.add(n);
      adicionados++;
      if (exemplosNovos.length < 8) exemplosNovos.push(`${nome} → ${s.inci_name ?? s.chem_name ?? s.id}`);
    }

    if (!aceites.length) continue;
    enriquecidas++;
    s.names_norm.push(...aceites);
    // proveniência: distingue-se o que veio do texto legal do que veio do
    // agregado de sinónimos, porque a confiança não é a mesma
    (s as unknown as { names_pubchem?: string[] }).names_pubchem = aceites;
    for (const n of aceites) (nucleo.index[n] ??= []).push(s.id);
  }

  nucleo.stats.ponte_pubchem_nomes = adicionados;
  nucleo.stats.ponte_pubchem_substancias = enriquecidas;
  nucleo.stats.chaves_no_indice = Object.keys(nucleo.index).length;
  (nucleo as unknown as { ponte?: unknown }).ponte = {
    fonte: 'PubChem CID-Synonym-filtered (NCBI/NLM)',
    licenca: 'Domínio público — obra do governo dos EUA',
    extraido_em: dataExtracao,
    regra: 'só chaves novas; qualquer colisão com uma chave existente é rejeitada',
  };

  return {
    substancias_com_cas: comCas,
    substancias_enriquecidas: enriquecidas,
    chaves_antes: chavesAntes,
    chaves_depois: Object.keys(nucleo.index).length,
    nomes_adicionados: adicionados,
    rejeitados_por_colisao: porColisao,
    rejeitados_por_duplicado: porDuplicado,
    exemplos_colisao: exemplosColisao,
    exemplos_novos: exemplosNovos,
  };
}
