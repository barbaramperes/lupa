import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Analise } from './modelos';

export interface Saude {
  nucleo: { construido_em: string; substancias: number; afirmacoes: number; chaves: number };
  fontes: string;
}

@Injectable({ providedIn: 'root' })
export class LupaService {
  private readonly http = inject(HttpClient);

  analisar(texto: string, modo: 'cos' | 'food' = 'cos'): Promise<Analise> {
    return firstValueFrom(this.http.post<Analise>('/api/analisar', { texto, modo }));
  }

  saude(): Promise<Saude> {
    return firstValueFrom(this.http.get<Saude>('/api/saude'));
  }
}
