/** Estado de uma entrada do rótulo depois da correspondência.
 *  São três, e nunca dois: o erro clássico deste tipo de app é só ter
 *  "alerta" e "ok", o que faz um desconhecido passar por seguro. */
export type MatchState = 'reconhecido' | 'sugestao' | 'por_identificar';

export type ClaimKind =
  | 'annex_ii_banned'
  | 'annex_iii_restricted'
  | 'annex_iv_colorant'
  | 'annex_v_preservative'
  | 'annex_vi_uv_filter'
  | 'clp_harmonised'
  | 'reach_xvii_restricted'
  | 'food_additive';

/** Severidade regulamentar: ordena-se, não se soma.
 *  A ordem decorre da própria lei — proibido é pior que restringido,
 *  categoria 1 é pior que categoria 2 — e é por isso que ordenar é
 *  defensável e somar não. */
export const SEVERIDADE_REGULAMENTAR: Record<ClaimKind, number> = {
  annex_ii_banned: 100,
  clp_harmonised: 80,
  reach_xvii_restricted: 60,
  annex_iii_restricted: 40,
  annex_v_preservative: 30,
  annex_vi_uv_filter: 30,
  annex_iv_colorant: 20,
  food_additive: 20,
};

export interface Source {
  dataset: 'cosing' | 'eurlex-clp' | 'eurlex-reach' | 'fip' | 'pubchem';
  celex?: string;
  annex?: string;
  /** linha do ficheiro de origem — permite reconstruir a proveniência até à célula */
  row_id: string;
  retrieved_at: string;
  source_url: string;
  licence: string;
}

/** UMA afirmação, UMA proveniência. Nunca pré-agregada.
 *  Se alguém perguntar "porque é que a app diz isto?", a resposta é
 *  um CELEX, um anexo, uma linha e uma data. */
export interface Claim {
  substance_id: string;
  kind: ClaimKind;
  /** texto legal literal — copiado, nunca parafraseado */
  payload: {
    reference_number?: string;
    condicoes?: string;
    concentracao_maxima?: string;
    tipo_produto?: string;
    outros?: string;
    advertencias?: string;
    cmr?: string;
    codigos_h?: string[];
  };
  source: Source;
}

export interface Substance {
  id: string;
  inci_name?: string;
  chem_name?: string;
  cas: string[];
  ec: string[];
  /** todas as formas normalizadas que apontam para esta substância */
  names_norm: string[];
}

export interface CoreBundle {
  built_at: string;
  substances: Substance[];
  claims: Claim[];
  /** nome normalizado → ids de substância. N:N por construção: um nome pode
   *  apontar para várias substâncias (sais, hidratos, misturas). */
  index: Record<string, string[]>;
  stats: Record<string, number>;
}
