import { ChangeDetectionStrategy, Component, ViewChildren, QueryList, effect, inject, signal, AfterViewInit } from '@angular/core';
import { ColunaComponent, type Ficha } from './coluna.component';
import { LupaService, type Saude } from './lupa.service';

const EXEMPLOS: Array<[string, string]> = [
  ['Esfoliante orgânico', 'Sucrose*, Coco Glucoside*, Guava Seed Oil*, Mango Seed Oil*, Glycerine*, Benzyl Alcohol*, Salicylic Acid*, Glycerin, and Sorbic Acid*, Orange Sweet Essential Oil*, Tocopherol*'],
  ['Protetor solar', 'Aqua, Homosalate, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Octocrylene, Benzophenone-3, Glycerin, Alcohol Denat., Dimethicone, Phenoxyethanol, Parfum, Tocopheryl Acetate, Limonene, Linalool'],
  ['Coloração capilar', 'Aqua, Cetearyl Alcohol, Propylene Glycol, Ammonium Hydroxide, p-Phenylenediamine, Resorcinol, m-Aminophenol, Sodium Sulfite, Parfum, Toluene-2,5-Diamine'],
  ['Rótulo traduzido', 'Água, manteiga de Butyrospermum Parkii, extrato da folha de Aloe Barbadensis, óleo da fruta Olea Europaea, glicerina, amido de Zea Mays, estearato de glicerila SE, álcool cetílico, esqualeno, goma xantana, tocoferol'],
];

let proximoId = 1;

@Component({
  selector: 'lupa-app',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColunaComponent],
  template: `
    <div class="casca">
      <header class="topo">
        <div class="marca">
          <span class="sobrancelha">Anexos II a VI do Reg. (CE) 1223/2009</span>
          <h1>Lupa de Rótulos</h1>
          <p class="sub">O que a lei diz sobre cada ingrediente do rótulo, com a fonte de cada afirmação.</p>
        </div>
        <div class="comandos">
          <button class="alternar filtro" [attr.aria-pressed]="filtroLigado()" (click)="alternarFiltro()"
                  title="Aplica a tua lista de exclusão. É uma preferência, não um facto regulamentar — aparece em bloco separado e não entra nas contagens dos anexos.">
            <span class="ponto"></span>O meu filtro
          </button>
          <button class="alternar" [attr.aria-pressed]="realcarRepr()" (click)="alternarRepr()"
                  title="Realça as substâncias com classificação harmonizada de toxicidade reprodutiva (Repr. 1A, 1B ou 2). É um critério público e fixo, igual para toda a gente.">
            <span class="ponto"></span>Realçar reprotóxicos
          </button>
          @if (fichas().length < 3) {
            <button class="fantasma" (click)="acrescentar()">+ Comparar outro</button>
          }
          <button class="fantasma" (click)="alternarTema()">Tema: {{ tema() }}</button>
        </div>
      </header>

      <div class="colunas" [attr.data-n]="fichas().length">
        @for (f of fichas(); track f.id; let i = $index) {
          <section>
            <lupa-coluna
              [ficha]="f"
              [unica]="fichas().length === 1"
              [exemplos]="i === 0 ? exemplos : []"
              [realcarRepr]="realcarRepr()"
              [filtroId]="filtroLigado() ? FILTRO_ID : null"
              (nomeAlterado)="alterar(f.id, 'nome', $event)"
              (textoAlterado)="alterar(f.id, 'texto', $event)"
              (exemploEscolhido)="carregarExemplo(f.id, $event)"
              (remover)="remover(f.id)" />
          </section>
        }
      </div>

      <footer class="rodape">
        <p>
          <b>O que isto faz.</b> Procura cada entrada do rótulo nos Anexos II a VI do Regulamento (CE) 1223/2009 e
          mostra o que lá está escrito, com o anexo, o número de referência e a data de extração. Não interpreta, não
          aconselha e não substitui um médico ou farmacêutico.
        </p>
        <p>
          <b>Três estados, nunca dois.</b> Reconhecido, sugestão e por identificar. Uma entrada por identificar não é
          uma entrada segura — é uma que não consta das listas usadas. A ausência de alertas não é prova de segurança.
        </p>
        <p>
          <b>Fonte.</b> CosIng, base de dados de ingredientes cosméticos da Comissão Europeia, sob CC BY 4.0 nos termos
          da Decisão 2011/833/UE.
          @if (info(); as n) {
            <span class="mono">
              Núcleo de {{ n.nucleo.construido_em }} · {{ n.nucleo.substancias.toLocaleString('pt-PT') }} substâncias ·
              {{ n.nucleo.afirmacoes.toLocaleString('pt-PT') }} afirmações.
            </span>
          }
          O CosIng tem valor informativo e não valor legal, e esta aplicação não é oficial nem tem aval da Comissão.
        </p>
      </footer>
    </div>
  `,
})
export class AppComponent implements AfterViewInit {
  private readonly lupa = inject(LupaService);
  @ViewChildren(ColunaComponent) private colunas!: QueryList<ColunaComponent>;

  protected readonly exemplos = EXEMPLOS;
  protected readonly fichas = signal<Ficha[]>([
    { id: proximoId++, nome: 'Esfoliante orgânico', texto: EXEMPLOS[0]![1] },
  ]);
  protected readonly realcarRepr = signal(false);
  protected readonly FILTRO_ID = 'lowtox-morganlkeen';
  protected readonly filtroLigado = signal(false);
  protected readonly tema = signal<'auto' | 'claro' | 'escuro'>('auto');
  protected readonly info = signal<Saude | null>(null);

  constructor() {
    this.lupa.saude().then((s) => this.info.set(s)).catch(() => {});
    effect(() => {
      const t = this.tema();
      if (t === 'auto') document.documentElement.removeAttribute('data-tema');
      else document.documentElement.setAttribute('data-tema', t);
    });
  }

  /** A app abre com um rótulo real já analisado: um ecrã vazio à espera de
   *  input não mostra o que a aplicação faz. */
  ngAfterViewInit(): void {
    this.colunas.first?.correr(this.fichas()[0]!.texto);
  }

  protected alternarRepr(): void { this.realcarRepr.update((v) => !v); }

  /** Ligar o filtro muda o pedido à API, por isso todas as colunas recorrem. */
  protected alternarFiltro(): void {
    this.filtroLigado.update((v) => !v);
    const fs = this.fichas();
    this.colunas.forEach((c, i) => { const f = fs[i]; if (f?.texto) c.correr(f.texto); });
  }

  protected alternarTema(): void {
    this.tema.update((t) => (t === 'auto' ? 'claro' : t === 'claro' ? 'escuro' : 'auto'));
  }

  protected alterar(id: number, campo: 'nome' | 'texto', valor: string): void {
    this.fichas.update((fs) => fs.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  }

  protected carregarExemplo(id: number, [nome, texto]: [string, string]): void {
    this.fichas.update((fs) => fs.map((f) => (f.id === id ? { ...f, nome, texto } : f)));
    const i = this.fichas().findIndex((f) => f.id === id);
    this.colunas.get(i)?.correr(texto);
  }

  protected acrescentar(): void {
    this.fichas.update((fs) => (fs.length >= 3 ? fs : [...fs, { id: proximoId++, nome: '', texto: '' }]));
  }

  protected remover(id: number): void {
    this.fichas.update((fs) => (fs.length <= 1 ? fs : fs.filter((f) => f.id !== id)));
  }
}
