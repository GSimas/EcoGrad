import { gunzipSync } from 'node:zlib';
import { COVERAGE_SCHEMA, summarizeCollections, catalogEntries } from './collection-metadata.mjs';
import { collectionShards, SHARD_SCHEMA } from './collection-shards.mjs';
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

const version = createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
const coveragePath = join(destino, 'colecoes-cobertura.json');
const entries = catalogEntries(JSON.parse(readFileSync(join(destino, ARQUIVOS[0]), 'utf8')), JSON.parse(readFileSync(join(destino, ARQUIVOS[1]), 'utf8')));
const colecoes = [];
const collections = { schema: SHARD_SCHEMA, ppg: [], tcc: [] };
const generated = new Set();
for (const [tipo, file] of [['ppg', ARQUIVOS[2]], ['tcc', ARQUIVOS[3]]]) {
  const records = JSON.parse(gunzipSync(readFileSync(join(destino, file))).toString('utf8'));
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
writeFileSync(coveragePath, JSON.stringify({ schema: COVERAGE_SCHEMA, version, bytes: { ppg: statSync(join(destino, ARQUIVOS[2])).size, tcc: statSync(join(destino, ARQUIVOS[3])).size }, colecoes }));
// Stable scientific version: delivery changes do not invalidate equivalent checkpoints.
writeFileSync(join(destino, 'manifest.json.tmp'), JSON.stringify({ version, files: hashes, collections }));
renameSync(join(destino, 'manifest.json.tmp'), join(destino, 'manifest.json'));
for (const filename of readdirSync(destino)) {
  if (/^colecao-[a-f0-9]{64}\.json\.gz$/.test(filename) && !generated.has(filename)) unlinkSync(join(destino, filename));
}
console.log(`[sync-data] Prévia de ${colecoes.length} coleções gerada.`);
