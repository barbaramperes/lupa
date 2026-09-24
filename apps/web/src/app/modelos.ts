/** Os tipos vêm do núcleo partilhado: a mesma definição que a API serve e que
 *  a suite de testes exercita. Não há uma cópia do modelo no frontend. */
export type {
  Analise, Entrada, Resumo, LeituraEditorial, Cmr,
} from '../../../../packages/core/src/analisar';
export type { Claim, ClaimKind, Substance, MatchState } from '../../../../packages/core/src/types';

export const ANEXO_ROTULO: Record<string, string> = {
  annex_ii_banned: 'Proibido na UE',
  annex_iii_restricted: 'Permitido com limites',
  annex_iv_colorant: 'Corante autorizado',
  annex_v_preservative: 'Conservante autorizado',
  annex_vi_uv_filter: 'Filtro UV autorizado',
};

export const ANEXO_NUM: Record<string, string> = {
  annex_ii_banned: 'II', annex_iii_restricted: 'III', annex_iv_colorant: 'IV',
  annex_v_preservative: 'V', annex_vi_uv_filter: 'VI',
};

export const CMR_ROTULO: Record<string, string> = {
  reprotoxico: 'Reprotóxico', carcinogenico: 'Cancerígeno', mutagenico: 'Mutagénico',
};

/** As células do CosIng trazem linhas em branco duplicadas entre alíneas.
 *  Colapsá-las é formatação; o texto legal não é alterado. */
export const limpar = (t: string): string => t.replace(/\n{2,}/g, '\n').trim();
