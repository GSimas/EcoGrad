import { gunzipSync } from 'node:zlib';
import { COVERAGE_SCHEMA, summarizeCollections, catalogEntries, panoramaAcervo } from './collection-metadata.mjs';
import { collectionShards, SHARD_SCHEMA } from './collection-shards.mjs';
import { aplicarColetas, BATCH_FILE } from './collection-batches.mjs';
import { orientacoesShard } from './orientacoes-index.mjs';
import { buscaShard } from './busca-index.mjs';
import { createHash } from 'node:crypto';
/**
 * Copia as bases do repositório Python (raiz do projeto) para `public/data/`,
 * que é o diretório estático servido pelo Vite/Netlify.
 *
 * Os `.json.gz` somam ~62 MB e já são versionados na raiz — duplicá-los no
 * controle de versão seria desperdício, então `public/data/.gitignore` os ignora
 * e este script os sincroniza antes de `dev` e `build`.
 */
import { copyFileSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');
const destino = join(raizApp, 'public', 'data');

const ARQUIVOS = [
  'programas_ufsc.json',
  'mapa_colecoes_tcc.json',
  'base_consolidada_ufsc.json.gz',
  'base_tcc_ufsc.json.gz',
];

mkdirSync(destino, { recursive: true });
// Fail before touching published metadata; never build a stale/partial data release.
for (const nome of ARQUIVOS) {
  if (!existsSync(join(raizRepo, nome))) throw new Error(`Base obrigatória ausente: ${nome}. Build interrompido.`);
}

const hashes = {};
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
let copiados = 0;

for (const nome of ARQUIVOS) {
  const origem = join(raizRepo, nome);
  const alvo = join(destino, nome);
  hashes[nome] = hash(origem);
  if (existsSync(alvo) && hash(alvo) === hashes[nome]) continue;
  copyFileSync(origem, alvo);
  copiados += 1;
  const mb = (statSync(alvo).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓ ${nome} (${mb} MB)`);
}

if (copiados === 0) console.log('[sync-data] Bases já sincronizadas.');

// Lotes da coleta semanal (raiz/coletas) entram em ordem sobre as bases, sem reescrevê-las,
// e fazem parte da versão: um lote novo é uma nova versão científica.
const pastaColetas = join(raizRepo, 'coletas');
const nomesLotes = existsSync(pastaColetas) ? readdirSync(pastaColetas).filter((n) => BATCH_FILE.test(n)).sort() : [];
for (const n of nomesLotes) hashes[`coletas/${n}`] = hash(join(pastaColetas, n));
const lerGz = (path) => JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
const bases = aplicarColetas(
  { ppg: lerGz(join(destino, ARQUIVOS[2])), tcc: lerGz(join(destino, ARQUIVOS[3])) },
  nomesLotes.map((n) => lerGz(join(pastaColetas, n))),
);
if (nomesLotes.length) console.log(`[sync-data] ${nomesLotes.length} lote(s) da coleta semanal aplicados.`);

const version = createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
const coveragePath = join(destino, 'colecoes-cobertura.json');
const entries = catalogEntries(JSON.parse(readFileSync(join(destino, ARQUIVOS[0]), 'utf8')), JSON.parse(readFileSync(join(destino, ARQUIVOS[1]), 'utf8')));
const colecoes = [];
const collections = { schema: SHARD_SCHEMA, ppg: [], tcc: [] };
const generated = new Set();
for (const tipo of ['ppg', 'tcc']) {
  const records = bases[tipo];
  const catalog = entries.filter((e) => e.tipo === tipo);
  const shards = collectionShards(records, catalog.map(e => e.nome));
  collections[tipo] = shards.map(s => s.descriptor);
  for (const { descriptor, compressed } of shards) {
    const filename = descriptor.path.split('/').pop();
    generated.add(filename);
    const path = join(destino, filename);
    if (!existsSync(path) || !readFileSync(path).equals(compressed)) writeFileSync(path, compressed);
  }
  const sizes = new Map(shards.map(s => [s.descriptor.nome, s.descriptor.bytes]));
  colecoes.push(...summarizeCollections(catalog, records).map(c => ({ ...c, downloadBytes: sizes.get(c.nome) })));
}
/** Grava um índice derivado endereçado pelo conteúdo e devolve o descritor para o manifest. */
const publicar = ({ descriptor, compressed }) => {
  const arquivo = descriptor.path.split('/').pop();
  generated.add(arquivo);
  const caminho = join(destino, arquivo);
  if (!existsSync(caminho) || !readFileSync(caminho).equals(compressed)) writeFileSync(caminho, compressed);
  return descriptor;
};
// Orientações de todo o acervo, para o perfil de pessoa mostrar quem ela orientou
// também nas coleções que não foram carregadas.
const orientacoes = publicar(orientacoesShard([...bases.ppg, ...bases.tcc]));
// Catálogo só de nomes para a busca da apresentação, sem carregar coleções.
const busca = publicar(buscaShard(bases));
// O acervo inteiro em números: o navegador carrega só as coleções escolhidas e
// nunca teria como contar pessoas ou trabalhos distintos do conjunto todo.
const panorama = panoramaAcervo(bases);
writeFileSync(coveragePath, JSON.stringify({ schema: COVERAGE_SCHEMA, version, bytes: { ppg: statSync(join(destino, ARQUIVOS[2])).size, tcc: statSync(join(destino, ARQUIVOS[3])).size }, colecoes, panorama }));
// Stable scientific version: delivery changes do not invalidate equivalent checkpoints.
writeFileSync(join(destino, 'manifest.json.tmp'), JSON.stringify({ version, files: hashes, collections, orientacoes, busca }));
renameSync(join(destino, 'manifest.json.tmp'), join(destino, 'manifest.json'));
for (const filename of readdirSync(destino)) {
  if (/^(colecao|orientacoes|busca)-[a-f0-9]{64}\.json\.gz$/.test(filename) && !generated.has(filename)) unlinkSync(join(destino, filename));
}
console.log(`[sync-data] Prévia de ${colecoes.length} coleções e panorama de ${panorama.registros} registros gerados.`);
