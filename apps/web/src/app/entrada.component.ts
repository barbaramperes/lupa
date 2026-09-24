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
        @if (e().estado === 'por_identificar') {
          <span class="marcas">
            <span class="marca-p aberto">Por identificar</span>
            @if (e().condicional) { <span class="marca-p aberto">Pode conter</span> }
            @if (e().no_blend) { <span class="marca-p blend">Matéria-prima composta</span> }
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
            <p class="excecao">
              A proibição não é absoluta: <b>{{ limpar(a.payload.excecao) }}</b>. Um produto no mercado
              europeu presume-se conforme com esta condição — quem a tem de cumprir e documentar é o fabricante.
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
            Reg. (CE) 1223/2009, Anexo {{ numAnexo(a.kind) }} · extraído {{ a.source.retrieved_at }} · {{ a.source.licence }}
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

  protected readonly limpar = limpar;
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
