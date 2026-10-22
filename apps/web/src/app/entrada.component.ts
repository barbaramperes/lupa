import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ANEXO_NUM, ANEXO_ROTULO, CMR_ROTULO, limpar, type Entrada } from './modelos';

@Component({
  selector: 'lupa-entrada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'ent',
    '[class.realce]': 'realcado()',
    '[attr.data-estado]': 'e().estado',
    '[attr.data-tem]': 'classeDaRisca()',
    '[attr.data-repr]': 'realcado() ? 1 : 0',
  },
  template: `
    <div class="risca"></div>
    <div class="corpo">
      <div class="l1">
        <span class="pos">{{ e().pos }}</span>
        <span class="nome">{{ e().raw }}</span>
        @if (e().percentagem !== undefined) {
          <span class="pct" title="Percentagem declarada no próprio rótulo — a única concentração real que um rótulo dá">{{ e().percentagem }}%</span>
        }
        @if (e().estado === 'por_identificar') {
          <span class="marcas">
            <span class="marca-p aberto">Por identificar</span>
            @if (e().condicional) { <span class="marca-p aberto">Pode conter</span> }
            @if (e().no_blend) { <span class="marca-p blend">Matéria-prima composta</span> }
            @if (filtroRegra(); as f) {
              <span class="marca-p" [class.filtro-fora]="!f.condicional" [class.filtro-cond]="f.condicional">
                {{ f.condicional ? 'Condicional' : 'Fora do teu filtro' }} · {{ f.regra }}
              </span>
            }
          </span>
        }
      </div>

      @if (e().estado !== 'por_identificar') {
        <div class="marcas">
          @if (proibidoAbsoluto()) { <span class="marca-p proibido">Proibido na UE</span> }
          @if (proibidoCondicional()) { <span class="marca-p condicional">Proibido salvo condição</span> }
          @for (k of anexosOutros(); track k) {
            <span class="marca-p limites">{{ rotuloAnexo(k) }}</span>
          }
          @for (c of e().cmr; track c.tipo + c.categoria) {
            <span class="marca-p" [class]="'marca-p ' + c.tipo">
              {{ rotuloCmr(c.tipo) }} cat. {{ c.categoria }}{{ c.condicao ? ' (' + c.condicao + ')' : '' }}
            </span>
          }
          @if (e().condicional) { <span class="marca-p aberto">Pode conter</span> }
          @if (e().no_blend) { <span class="marca-p blend">Matéria-prima composta</span> }
          @if (filtroRegra(); as f) {
            <span class="marca-p" [class.filtro-fora]="!f.condicional" [class.filtro-cond]="f.condicional">
              {{ f.condicional ? 'Condicional no teu filtro' : 'Fora do teu filtro' }} · {{ f.regra }}
            </span>
          }
        </div>
      }

      @if (e().traduzido_de; as t) {
        <span class="traduzido">
          Traduzido de «{{ t.original }}» para <b>{{ t.inci }}</b>
          {{ t.via === 'botanica' ? ' (regra botânica)' : ' (léxico)' }}
        </span>
      }

      @for (a of e().afirmacoes; track a.source.dataset + a.source.row_id + $index) {
        <div class="afirmacao">
          <span class="cabeca">
            {{ a.payload.excecao ? 'Proibido salvo condição' : rotuloAnexo(a.kind) }} ·
            Anexo {{ numAnexo(a.kind) }}, entrada {{ a.payload.reference_number }}
          </span>

          @if (a.payload.excecao) {
            @if (soTintas(a.payload.excecao)) {
              <p class="excecao">
                A proibição só vale para tintas de cabelo: <b>{{ limpar(a.payload.excecao) }}</b>. Noutro
                produto (por exemplo, como corante de um champô) não se aplica; numa tinta de cabelo, aplica-se.
              </p>
            } @else {
              <p class="excecao">
                A proibição tem uma condição: <b>{{ limpar(a.payload.excecao) }}</b>. Um produto no mercado
                europeu presume-se conforme — quem a tem de cumprir e documentar é o fabricante.
              </p>
            }
          }

          @if (a.kind === 'reach_xvii_restricted') {
            <p class="excecao">
              Não vem da lei dos cosméticos, vem do REACH (químicos), por razões ambientais: persiste e
              acumula-se. A partir de 0,1%: nos produtos que se enxaguam, o D4 e o D5 já estão limitados desde
              31 jan 2020; em todos os outros cosméticos, incluindo os que ficam na pele ou no cabelo, a partir
              de <b>6 jun 2027</b>.
            </p>
          }

          @if (a.payload.concentracao_maxima) {
            <dl><dt>máx.</dt><dd>{{ limpar(a.payload.concentracao_maxima) }}</dd></dl>
          }

          @if (a.payload.tipo_produto || a.payload.outros || a.payload.advertencias) {
            <details class="condicoes">
              <summary>Condições completas, tal como publicadas</summary>
              <dl>
                @if (a.payload.tipo_produto) { <dt>âmbito</dt><dd>{{ limpar(a.payload.tipo_produto) }}</dd> }
                @if (a.payload.outros) { <dt>outras</dt><dd>{{ limpar(a.payload.outros) }}</dd> }
                @if (a.payload.advertencias) { <dt>rótulo</dt><dd>{{ limpar(a.payload.advertencias) }}</dd> }
              </dl>
            </details>
          }

          <span class="proveniencia">
            @if (a.source.dataset === 'eurlex-reach') {
              Reg. (UE) 2024/1328 (REACH, Anexo XVII, entrada {{ a.payload.reference_number }}) · Jornal Oficial · {{ a.source.licence }}
            } @else {
              Reg. (CE) 1223/2009, Anexo {{ numAnexo(a.kind) }} · extraído {{ a.source.retrieved_at }} · {{ a.source.licence }}
            }
          </span>
        </div>
      }

      @if (e().estado === 'sugestao' && e().sugestao; as s) {
        <p class="nota-aberta">
          Não corresponde a nenhuma entrada. Quis dizer <b>{{ s.candidato }}</b>?
          {{ s.via === 'ocr' ? 'Parece um erro de leitura de caracteres.' : 'Grafia próxima.' }}
          Uma sugestão não é um veredicto e não entra nas contagens.
        </p>
      }
    </div>
  `,
})
export class EntradaComponent {
  readonly e = input.required<Entrada>();
  readonly realcarRepr = input(false);
  /** Regra do filtro que apanhou esta entrada, se alguma. Vem do campo
   *  separado da resposta — nunca de `afirmacoes`, que é o que a lei diz. */
  readonly filtroRegra = input<{ regra: string; condicional: boolean } | null>(null);

  protected readonly limpar = limpar;
  /** Proibição cujo âmbito é a tinta de cabelo, não uma condição de matéria-prima (D22). */
  protected readonly soTintas = (excecao: string) => /^when used as (a )?substance in hair/i.test(excecao.trim());
  protected readonly rotuloAnexo = (k: string) => ANEXO_ROTULO[k] ?? k;
  protected readonly numAnexo = (k: string) => ANEXO_NUM[k] ?? '?';
  protected readonly rotuloCmr = (t: string) => CMR_ROTULO[t] ?? t;

  protected readonly proibidoAbsoluto = computed(() =>
    this.e().afirmacoes.some((a) => a.kind === 'annex_ii_banned' && !a.payload.excecao));

  protected readonly proibidoCondicional = computed(() =>
    this.e().afirmacoes.some((a) => a.kind === 'annex_ii_banned' && !!a.payload.excecao));

  protected readonly anexosOutros = computed(() =>
    [...new Set(this.e().afirmacoes.filter((a) => a.kind !== 'annex_ii_banned').map((a) => a.kind))]);

  protected readonly realcado = computed(() =>
    this.realcarRepr() && this.e().cmr.some((c) => c.tipo === 'reprotoxico'));

  /** A risca lateral codifica a severidade regulamentar, ordenada como a lei
   *  a ordena: proibição absoluta, depois classificação CMR, depois limites. */
  protected readonly classeDaRisca = computed(() => {
    const e = this.e();
    if (this.proibidoAbsoluto()) return 'proibido';
    if (this.proibidoCondicional()) return 'condicional';
    if (e.cmr.length) return 'cmr';
    if (e.afirmacoes.length) return 'limites';
    return 'nenhum';
  });
}
