import { readFileSync } from 'node:fs';
import { parseCsv } from './csv';

for (const anexo of ['II', 'III', 'IV', 'V', 'VI']) {
  const linhas = parseCsv(readFileSync(`/tmp/cosing_${anexo}.csv`, 'utf8'));
  const cabecalho = linhas[4] ?? [];
  const dados = linhas.slice(5).filter((l) => l.some((c) => c.trim() !== ''));
  console.log(`\n── ANEXO ${anexo} ── ${dados.length} registos, ${cabecalho.length} colunas · ${JSON.stringify(linhas[1])}`);
  cabecalho.forEach((c, i) => {
    const p = dados.filter((l) => (l[i] ?? '').trim() !== '').length;
    console.log(`   [${String(i).padStart(2)}] ${c.slice(0, 44).padEnd(44)} ${String(p).padStart(5)}/${dados.length} (${((p / dados.length) * 100).toFixed(0)}%)`);
  });
}
