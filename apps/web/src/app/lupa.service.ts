import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import type { Analise } from './modelos';
import type { ResultadoFiltro } from '../../../../packages/core/src/filtros';
import type { CoreBundle } from '../../../../packages/core/src/types';

export type { ResultadoFiltro };
export interface AnaliseComFiltro extends Analise { filtro?: ResultadoFiltro }

export interface Saude {
  nucleo: { construido_em: string; substancias: number; afirmacoes: number; chaves: number };
  fontes: string;
}

@Injectable({ providedIn: 'root' })
export class LupaService {
  private readonly http = inject(HttpClient);

  /** Verdadeiro enquanto o núcleo está a ser descarregado, no modo estático.
   *  São ~2 MB comprimidos: a interface tem de o dizer em vez de parecer
   *  bloqueada. */
  readonly aCarregarNucleo = signal(false);
  readonly modoEstatico = environment.estatico;

  private nucleo: CoreBundle | null = null;
  private motor: {
    analisar: typeof import('../../../../packages/core/src/analisar').analisar;
    aplicarFiltro: typeof import('../../../../packages/core/src/filtros').aplicarFiltro;
    matcher: InstanceType<typeof import('../../../../packages/core/src/match').Matcher>;
  } | null = null;
  private aPreparar: Promise<void> | null = null;

  constructor() {
    // Em modo estático o núcleo (14 MB) começa a descarregar no arranque, não
    // depois do debounce da primeira análise: são ~300 ms a menos numa ligação
    // lenta, e o sinal de carregamento aparece logo em vez de a app mostrar
    // "cola um rótulo" durante um instante mudo.
    if (environment.estatico) void this.prepararMotor().catch(() => { this.aCarregarNucleo.set(false); });
  }

  async analisar(texto: string, modo: 'cos' | 'food' = 'cos', filtro: string | null = null): Promise<AnaliseComFiltro> {
    if (!environment.estatico) {
      return firstValueFrom(this.http.post<AnaliseComFiltro>('/api/analisar', { texto, modo, filtro }));
    }
    await this.prepararMotor();
    const a = this.motor!.analisar(this.nucleo!, this.motor!.matcher, texto, modo) as AnaliseComFiltro;
    if (filtro) a.filtro = this.motor!.aplicarFiltro(texto);
    return a;
  }

  async saude(): Promise<Saude> {
    if (!environment.estatico) return firstValueFrom(this.http.get<Saude>('/api/saude'));
    await this.prepararMotor();
    const n = this.nucleo!;
    return {
      nucleo: {
        construido_em: n.built_at,
        substancias: n.substances.length,
        afirmacoes: n.claims.length,
        chaves: Object.keys(n.index).length,
      },
      fontes: 'Anexos II a VI do Reg. (CE) 1223/2009 via CosIng · CC BY 4.0 · Comissão Europeia',
    };
  }

  /** Carrega o núcleo e o motor uma única vez. Chamadas concorrentes esperam
   *  na mesma promessa em vez de descarregarem 14 MB duas vezes. */
  private prepararMotor(): Promise<void> {
    if (this.motor) return Promise.resolve();
    if (this.aPreparar) return this.aPreparar;

    this.aCarregarNucleo.set(true);
    this.aPreparar = (async () => {
      const [nucleo, { Matcher }, { analisar }, { aplicarFiltro }] = await Promise.all([
        firstValueFrom(this.http.get<CoreBundle>(environment.nucleoUrl)),
        import('../../../../packages/core/src/match'),
        import('../../../../packages/core/src/analisar'),
        import('../../../../packages/core/src/filtros'),
      ]);
      this.nucleo = nucleo;
      this.motor = { analisar, aplicarFiltro, matcher: new Matcher(nucleo.index, nucleo.fuzzy_keys) };
      this.aCarregarNucleo.set(false);
    })();
    return this.aPreparar;
  }
}
