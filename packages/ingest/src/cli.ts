import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { ANEXOS, descarregarAnexo, lerAnexo, construirNucleo, type AnexoLido } from './cosing';
import { construirPonte } from './pubchem';
import { enriquecerComPonte } from './enriquecer';

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

// ── ponte CAS → nomes de rótulo ──────────────────────────────────────────
// Opcional por desenho: sem o ficheiro do PubChem o núcleo continua correto,
// apenas com menos alcance. Nunca é um erro fatal.
const CAMINHO_PUBCHEM = `${DIR_BRUTO}/CID-Synonym-filtered.gz`;
if (existsSync(CAMINHO_PUBCHEM)) {
  const casDoNucleo = new Set(nucleo.substances.flatMap((s) => s.cas));
  console.log(`\n  Ponte CAS→INCI: ${casDoNucleo.size} números CAS no núcleo a procurar no PubChem`);
  const t0 = Date.now();
  const ponte = await construirPonte(CAMINHO_PUBCHEM, casDoNucleo, (n) =>
    process.stdout.write(`\r  ${(n / 1e6).toFixed(0)}M linhas lidas…`));
  process.stdout.write('\r' + ' '.repeat(40) + '\r');
  console.log(`  ${(ponte.linhasLidas / 1e6).toFixed(1)}M linhas · ${(ponte.blocosLidos / 1e6).toFixed(2)}M compostos · ${ponte.blocosCasados} casados por CAS · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  nomes candidatos: ${ponte.nomesAceites} aceites pelo filtro, ${ponte.nomesRejeitados} rejeitados como identificadores de registo`);

  const rel = enriquecerComPonte(nucleo, ponte.porCas, hoje);
  console.log(`\n  ${rel.nomes_adicionados} nomes novos em ${rel.substancias_enriquecidas} substâncias (de ${rel.substancias_com_cas} com CAS)`);
  console.log(`  índice: ${rel.chaves_antes} → ${rel.chaves_depois} chaves`);
  console.log(`  rejeitados: ${rel.rejeitados_por_colisao} por colisão com chave existente, ${rel.rejeitados_por_duplicado} por já existirem`);
  if (rel.exemplos_novos.length) {
    console.log('  exemplos de nomes novos:');
    for (const e of rel.exemplos_novos.slice(0, 5)) console.log(`    ${e}`);
  }
} else {
  console.log('\n  (sem CID-Synonym-filtered.gz — núcleo sem ponte CAS→INCI)');
}

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
