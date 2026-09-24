import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Analise } from './modelos';
import type { ResultadoFiltro } from '../../../../packages/core/src/filtros';

export type { ResultadoFiltro };
export interface AnaliseComFiltro extends Analise { filtro?: ResultadoFiltro }

export interface Saude {
  nucleo: { construido_em: string; substancias: number; afirmacoes: number; chaves: number };
  fontes: string;
}

@Injectable({ providedIn: 'root' })
export class LupaService {
  private readonly http = inject(HttpClient);

  analisar(texto: string, modo: 'cos' | 'food' = 'cos', filtro: string | null = null): Promise<AnaliseComFiltro> {
    return firstValueFrom(this.http.post<AnaliseComFiltro>('/api/analisar', { texto, modo, filtro }));
  }

  saude(): Promise<Saude> {
    return firstValueFrom(this.http.get<Saude>('/api/saude'));
  }
}
