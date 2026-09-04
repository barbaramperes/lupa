import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { ANEXOS, descarregarAnexo, lerAnexo, construirNucleo, type AnexoLido } from './cosing';

const RAIZ = new URL('../../../', import.meta.url).pathname;
const DIR_BRUTO = `${RAIZ}data/raw`;
const DIR_BUILD = `${RAIZ}data/build`;
const DELTA_MAXIMO = 0.05;

const hoje = process.env.LUPA_DATA ?? new Date().toISOString().slice(0, 10);

mkdirSync(DIR_BRUTO, { recursive: true });
mkdirSync(DIR_BUILD, { recursive: true });

const lidos: AnexoLido[] = [];
for (const esp of ANEXOS) {
  process.stdout.write(`  Anexo ${esp.anexo.padEnd(3)} `);
  const { texto, url } = await descarregarAnexo(esp);
  writeFileSync(`${DIR_BRUTO}/cosing_${esp.anexo}.csv`, texto);
  const lido = lerAnexo(esp, texto, url);
  lidos.push(lido);
  console.log(`${String(lido.dados.length).padStart(5)} registos · atualizado ${lido.ultimaAtualizacao} · hash ${lido.hashDados}`);
}

// Assert 5 — delta máximo. Mais de 5% de linhas alteradas numa semana exige
// revisão humana: ou a UE publicou um omnibus, ou o parser partiu.
const caminhoAnterior = `${DIR_BUILD}/hashes.json`;
if (existsSync(caminhoAnterior)) {
  const anterior: Record<string, number> = JSON.parse(readFileSync(caminhoAnterior, 'utf8')).contagens;
  for (const l of lidos) {
    const antes = anterior[l.esp.anexo];
    if (antes === undefined) continue;
    const delta = Math.abs(l.dados.length - antes) / antes;
    if (delta > DELTA_MAXIMO) {
      console.error(`\n  PARADO: Anexo ${l.esp.anexo} passou de ${antes} para ${l.dados.length} registos (${(delta * 100).toFixed(1)}%).`);
      console.error(`  Acima do limite de ${DELTA_MAXIMO * 100}%. Isto exige olhos humanos antes de entrar no núcleo.`);
      process.exit(1);
    }
  }
}

const nucleo = construirNucleo(lidos, hoje);
const json = JSON.stringify(nucleo);
writeFileSync(`${DIR_BUILD}/core.json`, json);
writeFileSync(caminhoAnterior, JSON.stringify({
  data: hoje,
  contagens: Object.fromEntries(lidos.map((l) => [l.esp.anexo, l.dados.length])),
  hashes: Object.fromEntries(lidos.map((l) => [l.esp.anexo, l.hashDados])),
}, null, 2));

const br = brotliCompressSync(Buffer.from(json), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
const gz = gzipSync(Buffer.from(json), { level: 9 });

console.log(`\n  ── núcleo construído ──`);
for (const [k, v] of Object.entries(nucleo.stats)) console.log(`  ${k.padEnd(28)} ${String(v).padStart(7)}`);
console.log(`  ${'core.json (bruto)'.padEnd(28)} ${(json.length / 1024).toFixed(0).padStart(7)} KB`);
console.log(`  ${'core.json (gzip)'.padEnd(28)} ${(gz.length / 1024).toFixed(0).padStart(7)} KB`);
console.log(`  ${'core.json (brotli)'.padEnd(28)} ${(br.length / 1024).toFixed(0).padStart(7)} KB`);
