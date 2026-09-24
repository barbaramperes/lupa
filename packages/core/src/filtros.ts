import { normalize } from './normalize';

/**
 * FILTROS DE EXCLUSÃO NOMEADOS.
 *
 * Distintos dos anexos do Reg. 1223/2009 por natureza, e a interface tem de o
 * dizer: os anexos são lei, um filtro destes é uma preferência. Nenhum dos dois
 * é "a verdade" — mas confundi-los é o erro que esta aplicação existe para não
 * cometer, nos dois sentidos.
 *
 * Um ingrediente excluído por um filtro NÃO é um alerta regulamentar e nunca
 * entra nas contagens dos anexos. Aparece em secção própria, com o nome do
 * filtro que o excluiu à vista.
 */

export type Veredicto = 'excluido' | 'condicional' | 'ok';

export interface RegraFiltro {
  /** o que o filtro escreve */
  rotulo: string;
  /** padrões INCI que a regra apanha */
  padroes: RegExp[];
  veredicto: 'excluido' | 'condicional';
  /** para as condicionais: o que a torna aceitável segundo o autor do filtro */
  condicao?: string;
}

export interface Filtro {
  id: string;
  nome: string;
  autor: string;
  natureza: 'preferencia_pessoal' | 'referencial_certificacao' | 'regulamentar';
  atualizado: string;
  aviso: string;
  regras: RegraFiltro[];
}

/**
 * Lista "Ingredients to Avoid — Beauty & Personal Care", @morganlkeen,
 * atualizada em 4 out 2025. Transcrita do PDF, verbatim.
 *
 * O próprio documento se declara: "based on my personal research and
 * preferences". Não é um referencial de certificação nem um instrumento
 * regulamentar, e trata-se aqui como o que é.
 */
export const FILTRO_LOWTOX: Filtro = {
  id: 'lowtox-morganlkeen',
  nome: 'Ingredients to Avoid — Beauty & Personal Care',
  autor: '@morganlkeen',
  natureza: 'preferencia_pessoal',
  atualizado: '2025-10-04',
  aviso: 'Lista de preferência pessoal, declarada como tal pelo próprio documento. Não é lei nem referencial de certificação.',
  regras: [
    { rotulo: 'Alumínio', padroes: [/\baluminum\b/i, /\baluminium\b/i], veredicto: 'excluido' },
    { rotulo: 'Acrilatos', padroes: [/acrylate/i, /acrylic acid/i, /carbomer/i, /polyacrylamide/i], veredicto: 'excluido' },
    /* FILTROS UV: só minerais.
     *
     * A lista original nomeia seis filtros químicos. Ela confirmou que o
     * critério é "só filtros minerais", e nesse caso nomear seis de vinte e
     * oito deixaria passar os outros vinte e dois — incluindo os Tinosorb,
     * a triazona e o salicilato de etilhexilo, que são dos mais usados.
     *
     * Esta regra é gerada do Anexo VI do Reg. (CE) 1223/2009: exclui todos
     * os filtros UV autorizados na UE EXCETO óxido de zinco e dióxido de
     * titânio. Assim não apodrece quando a UE autorizar um filtro novo. */
    { rotulo: 'Filtro UV químico (só minerais)', veredicto: 'excluido', padroes: [
      /benzophenone/i, /benzylidene camphor/i, /dibenzoylmethane/i, /methoxycinnamate/i,
      /\bsalicylate\b/i, /homosalate/i, /octocrylene/i, /octinoxate/i, /oxybenzone/i, /avobenzone/i,
      /triazine/i, /triazone/i, /\bpaba\b/i, /benzimidazole/i, /benzotriazolyl/i,
      /drometrizole/i, /polysilicone-15/i, /camphor sulfonic acid/i, /piperazine\b/i,
      /diethylamino hydroxybenzoyl/i, /cyanoacetate/i, /camphor benzalkonium/i,
    ] },
    { rotulo: 'Cloreto de benzalcónio', padroes: [/benzalkonium/i], veredicto: 'excluido' },
    { rotulo: 'Benzeno', padroes: [/^benzene$/i], veredicto: 'excluido' },
    { rotulo: 'Benzoato de benzilo', padroes: [/benzyl benzoate/i], veredicto: 'excluido' },
    { rotulo: 'Salicilato de benzilo', padroes: [/benzyl salicylate/i], veredicto: 'excluido' },
    { rotulo: 'BHA', padroes: [/butylated hydroxyanisole/i, /\bbha\b/i], veredicto: 'excluido' },
    { rotulo: 'BHT', padroes: [/butylated hydroxytoluene/i, /\bbht\b/i], veredicto: 'excluido' },
    { rotulo: 'Ceteareth', padroes: [/ceteareth/i], veredicto: 'excluido' },
    { rotulo: 'Clorfenesina', padroes: [/chlorphenesin/i], veredicto: 'excluido' },
    { rotulo: 'Cloroxilenol', padroes: [/chloroxylenol/i], veredicto: 'excluido' },
    { rotulo: 'Cocamidopropil hidroxisultaína', padroes: [/cocamidopropyl hydroxysultaine/i], veredicto: 'excluido' },
    { rotulo: 'Ciclopentasiloxano e silicones', padroes: [/cyclopentasiloxane/i, /cyclohexasiloxane/i, /cyclotetrasiloxane/i, /dimethicone/i, /siloxane/i, /silsesquioxane/i], veredicto: 'excluido' },
    { rotulo: 'DEA / etanolaminas', padroes: [/diethanolamine/i, /\bdea\b/i, /^ethanolamine/i, /triethanolamine/i, /\btea-/i], veredicto: 'excluido' },
    { rotulo: 'EDTA', padroes: [/\bedta\b/i], veredicto: 'excluido' },
    { rotulo: 'Etilenoglicol', padroes: [/ethylene glycol/i], veredicto: 'excluido' },
    { rotulo: 'Formaldeído e libertadores', padroes: [/formaldehyde/i, /diazolidinyl urea/i, /imidazolidinyl urea/i, /quaternium-15/i, /dmdm hydantoin/i, /methenamine/i, /bronopol/i], veredicto: 'excluido' },
    { rotulo: 'Hidroquinona', padroes: [/hydroquinone/i], veredicto: 'excluido' },
    { rotulo: 'Isoceteth', padroes: [/isoceteth/i], veredicto: 'excluido' },
    { rotulo: 'Corantes lake', padroes: [/\blake\b/i, /\bci \d{5}.*lake/i], veredicto: 'condicional', condicao: 'aceitável se a marca fizer teste de metais pesados' },
    { rotulo: 'Laureth', padroes: [/laureth/i], veredicto: 'excluido' },
    { rotulo: 'Lauramidopropil betaína', padroes: [/lauramidopropyl betaine/i], veredicto: 'excluido' },
    { rotulo: 'Isotiazolinonas', padroes: [/methylisothiazolinone/i, /methylchloroisothiazolinone/i, /isothiazolinone/i], veredicto: 'excluido' },
    { rotulo: 'Óleo mineral, parafina, vaselina', padroes: [/mineral oil/i, /paraffinum/i, /\bparaffin\b/i, /petrolatum/i, /petroleum/i, /cera microcristallina/i, /microcrystalline wax/i, /ozokerite/i], veredicto: 'excluido' },
    { rotulo: 'Parabenos', padroes: [/paraben/i], veredicto: 'excluido' },
    { rotulo: 'Ftalatos', padroes: [/phthalate/i], veredicto: 'excluido' },
    { rotulo: 'PEG e etoxilados', padroes: [/\bpeg-\d/i, /polyethylene glycol/i, /\bpolysorbate/i, /steareth/i, /trideceth/i, /\boleth-/i, /\bpareth-/i], veredicto: 'excluido' },
    { rotulo: 'PTFE', padroes: [/polytetrafluoroethylene/i, /\bptfe\b/i], veredicto: 'excluido' },
    { rotulo: 'PAPB', padroes: [/polyaminopropyl biguanide/i], veredicto: 'excluido' },
    { rotulo: 'Polyquaternium', padroes: [/polyquaternium/i], veredicto: 'excluido' },
    { rotulo: 'Sarcosinato de lauroílo de sódio', padroes: [/sodium lauroyl sarcosinate/i], veredicto: 'excluido' },
    { rotulo: 'Talco', padroes: [/\btalc\b/i], veredicto: 'excluido' },
    { rotulo: 'TBHQ', padroes: [/\btbhq\b/i, /tert-butylhydroquinone/i], veredicto: 'excluido' },
    { rotulo: 'Tolueno', padroes: [/\btoluene\b/i], veredicto: 'excluido' },
    { rotulo: 'Triclocarban', padroes: [/triclocarban/i], veredicto: 'excluido' },
    { rotulo: 'Triclosan', padroes: [/triclosan/i], veredicto: 'excluido' },

    // ─── as condicionais, tal como o documento as escreve ───
    { rotulo: 'Fenoxietanol', padroes: [/phenoxyethanol/i], veredicto: 'condicional',
      condicao: 'a lista aceita-o se a marca for transparente sobre a origem' },
    { rotulo: 'Cocamidopropil betaína', padroes: [/cocamidopropyl betaine/i], veredicto: 'condicional',
      condicao: 'a lista aceita-o se a marca declarar origem de coco' },
    { rotulo: 'Fragrância', padroes: [/\bparfum\b/i, /\bfragrance\b/i, /\baroma\b/i, /\bflavor\b/i], veredicto: 'condicional',
      condicao: 'a lista aceita-o se a marca divulgar a composição da fragrância' },
    { rotulo: 'Dióxido de titânio', padroes: [/titanium dioxide/i, /\bci 77891\b/i], veredicto: 'condicional',
      condicao: 'a lista evita-o em pó solto, aerossol e zonas sensíveis — não em creme' },
  ],
};

export interface ResultadoFiltro {
  filtro: string;
  excluidos: Array<{ ingrediente: string; regra: string }>;
  condicionais: Array<{ ingrediente: string; regra: string; condicao: string }>;
  passa: boolean;
}

export function aplicarFiltro(inci: string, filtro: Filtro = FILTRO_LOWTOX): ResultadoFiltro {
  const excluidos: ResultadoFiltro['excluidos'] = [];
  const condicionais: ResultadoFiltro['condicionais'] = [];
  // Separadores encontrados em rótulos reais: vírgula, ponto e vírgula,
  // travessão rodeado de espaços (Uriage) e ponto médio (Rilastil).
  const entradas = inci
    .split(/[,;\n•·]|\s+[—–]\s+/)
    .map((s) => s.trim().replace(/^\(|\)$/g, '').trim())
    .filter(Boolean);

  for (const entrada of entradas) {
    for (const regra of filtro.regras) {
      if (!regra.padroes.some((re) => re.test(entrada))) continue;
      if (regra.veredicto === 'excluido') {
        if (!excluidos.some((e) => e.ingrediente === entrada)) excluidos.push({ ingrediente: entrada, regra: regra.rotulo });
      } else {
        if (!condicionais.some((e) => e.ingrediente === entrada)) {
          condicionais.push({ ingrediente: entrada, regra: regra.rotulo, condicao: regra.condicao ?? '' });
        }
      }
      break;
    }
  }
  return { filtro: filtro.nome, excluidos, condicionais, passa: excluidos.length === 0 };
}
