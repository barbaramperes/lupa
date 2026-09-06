import type { Analise } from '../../../packages/core/src/analisar';

export type { Analise };

export async function analisar(texto: string, modo: 'cos' | 'food' = 'cos'): Promise<Analise> {
  const r = await fetch('/api/analisar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto, modo }),
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
    throw new Error(corpo?.erro ?? `Erro ${r.status}`);
  }
  return (await r.json()) as Analise;
}

export async function saude(): Promise<{ nucleo: { construido_em: string; substancias: number; afirmacoes: number } }> {
  const r = await fetch('/api/saude');
  if (!r.ok) throw new Error('API indisponível');
  return (await r.json()) as { nucleo: { construido_em: string; substancias: number; afirmacoes: number } };
}
