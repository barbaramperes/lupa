import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { EntradaComponent } from './entrada.component';
import { LupaService } from './lupa.service';
import type { Analise } from './modelos';

export interface Ficha { id: number; nome: string; texto: string }

@Component({
  selector: 'lupa-coluna',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EntradaComponent],
  template: `
    <div class="painel">
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
          @if (ocupado()) { a analisar… } @else if (analise(); as a) { {{ a.resumo.total }} entradas }
        </span>
      </div>

      @if (erro(); as msg) { <p class="erro">{{ msg }}</p> }

      @if (analise(); as a) {
        <p class="veredicto-factual" [class.incerto]="!a.resumo.avaliavel">{{ a.resumo.veredicto }}</p>

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

        <div class="entradas">
          @for (e of a.entradas; track e.pos) {
            <lupa-entrada [e]="e" [realcarRepr]="realcarRepr()" />
          }
        </div>

        @if (a.resumo.por_identificar > 0) {
          <p class="nota-rodape">
            <b>{{ a.resumo.por_identificar }}</b>
            {{ a.resumo.por_identificar === 1 ? 'entrada não consta' : 'entradas não constam' }} dos Anexos II a VI.
            Isso não quer dizer que {{ a.resumo.por_identificar === 1 ? 'seja segura' : 'sejam seguras' }} — quer dizer que
            não {{ a.resumo.por_identificar === 1 ? 'é regulada' : 'são reguladas' }} por eles. A maioria dos ingredientes
            de um rótulo é autorizada sem restrição e por isso não aparece em anexo nenhum.
          </p>
        }
      }
    </div>

    @if (analise(); as a) {
      <div class="editorial">
        <span class="sobrancelha">Leitura editorial — não é um facto regulamentar</span>
        <div class="cabeca">
          <span class="indice">
            {{ a.editorial.indice ?? '—' }}@if (a.editorial.indice !== null) { <span class="den">/100</span> }
          </span>
        </div>
        @if (a.editorial.indice === null) {
          <p class="aviso">
            Sem índice: reconheci entradas a menos para que um número significasse alguma coisa. Preferir um traço a
            um número inventado é o ponto.
          </p>
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
    }
  `,
})
export class ColunaComponent {
  private readonly lupa = inject(LupaService);

  readonly ficha = input.required<Ficha>();
  readonly unica = input(true);
  readonly exemplos = input<Array<[string, string]>>([]);
  readonly realcarRepr = input(false);

  readonly nomeAlterado = output<string>();
  readonly textoAlterado = output<string>();
  readonly exemploEscolhido = output<[string, string]>();
  readonly remover = output<void>();

  protected readonly analise = signal<Analise | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly ocupado = signal(false);

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
      this.analise.set(null);
      this.erro.set(null);
      this.ocupado.set(false);
      return;
    }
    this.ocupado.set(true);
    const minha = ++this.geracao;
    this.temporizador = setTimeout(async () => {
      try {
        const a = await this.lupa.analisar(texto);
        if (minha !== this.geracao) return;
        this.analise.set(a);
        this.erro.set(null);
      } catch {
        if (minha !== this.geracao) return;
        this.erro.set('Não foi possível analisar. A API está a correr?');
      } finally {
        if (minha === this.geracao) this.ocupado.set(false);
      }
    }, 260);
  }
}
