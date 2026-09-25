import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { EntradaComponent } from './entrada.component';
import { LupaService, type AnaliseComFiltro } from './lupa.service';

export interface Ficha { id: number; nome: string; texto: string }

@Component({
  selector: 'lupa-coluna',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EntradaComponent],
  template: `
    <div class="painel">
      <div class="entrada-produto">
        <header>
          <input type="text" [value]="ficha().nome" placeholder="Nome do produto" aria-label="Nome do produto"
                 (input)="nomeAlterado.emit(entrada($event))" />
          @if (!unica()) {
            <button class="fechar" (click)="remover.emit()" aria-label="Remover coluna">×</button>
          }
        </header>

        <textarea [value]="ficha().texto" spellcheck="false" aria-label="Lista de ingredientes"
                  placeholder="Cola aqui a lista de ingredientes…"
                  (input)="aoEscrever(entrada($event))"></textarea>

        <div class="rodape-painel">
          @for (ex of exemplos(); track ex[0]) {
            <button class="fantasma" (click)="exemploEscolhido.emit(ex)">{{ ex[0] }}</button>
          }
          <span class="conta">
            @if (lupa.aCarregarNucleo()) { a carregar a base… }
            @else if (ocupado()) { a analisar… }
            @else if (analise(); as a) { {{ a.resumo.total }} entradas }
          </span>
        </div>

        @if (erro(); as msg) { <p class="erro">{{ msg }}</p> }
      </div>

      <div class="resultado">
        @if (analise(); as a) {
          <p class="veredicto-factual" [class.incerto]="!a.resumo.avaliavel">{{ a.resumo.veredicto }}</p>

          @if (!a.filtro && a.resumo.reconhecidos === 0 && !a.resumo.lista_traduzida) {
            <p class="empurrao">
              A lei não restringe nada nesta lista — o que é comum. As tuas perguntas são outras:
              liga <b>O meu filtro</b> no topo para veres o que a tua lista exclui.
            </p>
          }

          @if (a.resumo.lista_traduzida) {
            <p class="aviso-cobertura">
              As minhas listas estão em nomenclatura INCI, e esta parece estar traduzida. Não é um resultado limpo —
              é um resultado em branco. O art. 19.º do Reg. 1223/2009 exige INCI na embalagem, por isso vale a pena
              procurar a lista original no frasco ou na página do fabricante.
            </p>
          }

          <div class="contagens">
            <div [class.destaque]="a.resumo.proibidos > 0"><b>{{ a.resumo.proibidos }}</b><span>proibidos</span></div>
            @if (a.resumo.proibidos_condicionais > 0) {
              <div class="condicional"><b>{{ a.resumo.proibidos_condicionais }}</b><span>proibidos salvo condição</span></div>
            }
            <div><b>{{ a.resumo.com_limites }}</b><span>com limites</span></div>
            <div [class.repr]="a.resumo.reprotoxicos > 0"><b>{{ a.resumo.reprotoxicos }}</b><span>reprotóxicos</span></div>
            <div class="aberto"><b>{{ a.resumo.por_identificar }}</b><span>por identificar</span></div>
          </div>

          @if (a.filtro; as f) {
            <section class="filtro-bloco" [class.chumba]="!f.passa">
              <div class="filtro-cabeca">
                <span class="sobrancelha">Filtro de preferência — não é um facto regulamentar</span>
                <span class="filtro-nome">{{ f.filtro }} <span class="filtro-autor">· {{ f.autor }}</span></span>
              </div>
              <p class="filtro-veredicto">
                @if (f.passa && !f.condicionais.length) {
                  Nada nesta lista é excluído pelo teu filtro.
                } @else if (f.passa) {
                  Nada excluído. {{ f.condicionais.length }}
                  {{ f.condicionais.length === 1 ? 'entrada é condicional' : 'entradas são condicionais' }}.
                } @else {
                  {{ f.excluidos.length }}
                  {{ f.excluidos.length === 1 ? 'entrada excluída' : 'entradas excluídas' }} pelo teu filtro.
                }
              </p>
              @if (f.excluidos.length) {
                <ul class="filtro-lista">
                  @for (e of f.excluidos; track e.ingrediente) {
                    <li><b>{{ e.ingrediente }}</b><span class="regra">{{ e.regra }}</span></li>
                  }
                </ul>
              }
              @if (f.condicionais.length) {
                <p class="filtro-sub">Condicionais — a lista aceita-as se a condição estiver cumprida:</p>
                <ul class="filtro-lista cond">
                  @for (c of f.condicionais; track c.ingrediente) {
                    <li><b>{{ c.ingrediente }}</b><span class="regra">{{ c.condicao }}</span></li>
                  }
                </ul>
              }
              <p class="filtro-aviso">{{ f.aviso }} Não entra nas contagens acima, que são só o que dizem os anexos.</p>
            </section>
          }

          <div class="entradas">
            @for (e of destacadas(); track e.pos) {
              <lupa-entrada [e]="e" [realcarRepr]="realcarRepr()" [filtroRegra]="regraDe(e.pos)" />
            }
          </div>

          @if (porIdentificar().length) {
            <div class="nao-identificados">
              <!-- A contagem de cima é a da lei (28 por identificar). Se o teu
                   filtro subiu algumas para linha própria, esta fila tem menos —
                   e tem de dizer porquê, senão parece que os números não batem. -->
              <span class="sobrancelha">
                @if (porIdentificar().length < a.resumo.por_identificar) {
                  Restantes {{ porIdentificar().length }} — não reguladas pelos anexos nem apanhadas pelo teu filtro
                } @else {
                  {{ porIdentificar().length }} por identificar
                }
              </span>
              <div class="chips-ni">
                @for (e of porIdentificar(); track e.pos) {
                  <span class="chip"><i>{{ e.pos }}</i>{{ e.raw }}@if (e.percentagem !== undefined) {<b class="pct-chip">{{ e.percentagem }}%</b>}</span>
                }
              </div>
              <p class="nota-rodape">
                Não constam dos Anexos II a VI. Isso não quer dizer que sejam seguras — quer dizer que não são reguladas
                por eles. A maioria dos ingredientes de um rótulo é autorizada sem restrição e por isso não aparece em
                anexo nenhum.
              </p>
            </div>
          }
        } @else if (lupa.aCarregarNucleo()) {
          <!-- 14 MB de núcleo numa ligação lenta parecem uma app congelada.
               Diz-se o que se está a fazer, em vez de deixar o ecrã mudo. -->
          <p class="veredicto-factual incerto" style="padding-bottom:6px">A carregar a base de substâncias…</p>
          <p class="aviso-cobertura" style="color:var(--tinta3)">
            São 14 MB, uma única vez — depois fica em cache. Numa ligação lenta pode levar uns segundos.
          </p>
        } @else {
          <p class="veredicto-factual incerto" style="padding-bottom:24px">Cola um rótulo para começar.</p>
        }
      </div>
    </div>

    @if (analise(); as a) {
      <div class="editorial">
        <div class="anel" [style.--v]="a.editorial.indice ?? 0">
          <span class="indice">{{ a.editorial.indice ?? '—' }}@if (a.editorial.indice !== null) {<span class="den">/100</span>}</span>
        </div>
        <div class="editorial-texto">
          <span class="sobrancelha">Leitura editorial — não é um facto regulamentar</span>
          @if (a.editorial.indice === null) {
            <p class="aviso">Sem índice: reconheci entradas a menos para que um número significasse alguma coisa. Preferir um traço a um número inventado é o ponto.</p>
          }
          <p class="aviso">
            Este número é julgamento meu, não uma medição. Os anexos da UE classificam por <i>classe de perigo</i>, não
            por severidade — somá-los num índice é uma escolha, e é discutível. Os factos acima são verificáveis; isto é
            uma leitura deles.
          </p>
          <details>
            <summary>Como foi calculado</summary>
            <p style="margin-top:6px">{{ a.editorial.formula }}</p>
            <div style="margin-top:8px">
              @for (p of a.editorial.penalizacoes; track p.entrada + p.motivo) {
                <div class="pen"><span>{{ p.entrada }} — {{ p.motivo }}</span><b>−{{ p.pontos }}</b></div>
              } @empty {
                <p>Nenhuma penalização: nada nesta lista consta dos anexos com restrição.</p>
              }
            </div>
          </details>
        </div>
      </div>
    }
  `,
})
export class ColunaComponent {
  protected readonly lupa = inject(LupaService);

  readonly ficha = input.required<Ficha>();
  readonly unica = input(true);
  readonly exemplos = input<Array<[string, string]>>([]);
  readonly realcarRepr = input(false);
  /** id do filtro a aplicar, ou null. Muda o pedido, por isso re-corre. */
  readonly filtroId = input<string | null>(null);

  readonly nomeAlterado = output<string>();
  readonly textoAlterado = output<string>();
  readonly exemploEscolhido = output<[string, string]>();
  readonly remover = output<void>();

  protected readonly analise = signal<AnaliseComFiltro | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly ocupado = signal(false);

  /** Posição → regra do filtro. Junção por POSIÇÃO: o filtro usa o mesmo
   *  segmentador que a análise, por isso as posições coincidem — e o nome não
   *  é chave fiável, porque o mesmo ingrediente pode aparecer duas vezes. */
  protected readonly porPosicao = computed(() => {
    const f = this.analise()?.filtro;
    const m = new Map<number, { regra: string; condicional: boolean }>();
    if (!f) return m;
    for (const e of f.excluidos) m.set(e.pos, { regra: e.regra, condicional: false });
    for (const c of f.condicionais) m.set(c.pos, { regra: c.regra, condicional: true });
    return m;
  });

  protected regraDe(pos: number) {
    return this.porPosicao().get(pos) ?? null;
  }

  /** Uma entrada merece linha própria se a LEI diz alguma coisa dela OU se a
   *  tua lista a apanha. Um Carbomer não é regulado pelos anexos, mas se o teu
   *  filtro o exclui, esconder-lo numa fila de chips cinzentos era responder
   *  à pergunta da lei e ignorar a tua. */
  protected readonly destacadas = computed(() =>
    (this.analise()?.entradas ?? []).filter((e) => e.estado !== 'por_identificar' || this.porPosicao().has(e.pos)));
  protected readonly porIdentificar = computed(() =>
    (this.analise()?.entradas ?? []).filter((e) => e.estado === 'por_identificar' && !this.porPosicao().has(e.pos)));

  private temporizador: ReturnType<typeof setTimeout> | undefined;
  /** Contador de pedidos: uma resposta lenta de um texto antigo não pode
   *  sobrepor-se ao resultado de um texto mais recente. */
  private geracao = 0;

  protected entrada(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected aoEscrever(texto: string): void {
    this.textoAlterado.emit(texto);
    this.correr(texto);
  }

  correr(texto: string): void {
    clearTimeout(this.temporizador);
    if (!texto.trim()) {
      this.analise.set(null); this.erro.set(null); this.ocupado.set(false);
      return;
    }
    this.ocupado.set(true);
    const minha = ++this.geracao;
    this.temporizador = setTimeout(async () => {
      try {
        const a = await this.lupa.analisar(texto, 'cos', this.filtroId());
        if (minha !== this.geracao) return;
        this.analise.set(a); this.erro.set(null);
      } catch {
        if (minha !== this.geracao) return;
        this.erro.set('Não foi possível analisar. A API está a correr?');
      } finally {
        if (minha === this.geracao) this.ocupado.set(false);
      }
    }, 260);
  }
}
