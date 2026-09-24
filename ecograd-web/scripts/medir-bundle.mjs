// Mede o bundle de produção a partir do que o navegador realmente baixa.
//
// O JS inicial é o fecho dos imports estáticos a partir do <script> de entrada
// do `dist/index.html` — o mesmo conjunto que o Vite anuncia com modulepreload.
// Chunks alcançados só por `import()` são adiados; workers ficam à parte.
// Com `ANALYZE=1 npm run build`, o `bundle-report/stats.json` do visualizer
// permite ainda decompor o chunk de entrada por pacote e por pasta de `src/`.
//
// Uso: node scripts/medir-bundle.mjs [--json saida.json]
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(raiz, 'dist');
const assets = resolve(dist, 'assets');
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const html = await readFile(resolve(dist, 'index.html'), 'utf8');
const entradas = [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
const cssInicial = [...html.matchAll(/<link[^>]+href="\/assets\/([^"]+\.css)"/g)].map((m) => m[1]);

const arquivos = (await readdir(assets)).filter((n) => n.endsWith('.js') || n.endsWith('.css'));
const info = new Map();
for (const nome of arquivos) {
  const bytes = await readFile(resolve(assets, nome));
  const texto = bytes.toString('utf8');
  const estaticos = new Set();
  const dinamicos = new Set();
  if (nome.endsWith('.js')) {
    for (const m of texto.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) estaticos.add(m[1]);
    for (const m of texto.matchAll(/import\(\s*"\.\/([^"]+\.js)"\s*\)/g)) dinamicos.add(m[1]);
    // O Vite resolve os chunks dinâmicos via __vite__mapDeps(["assets/x.js", ...]).
    for (const m of texto.matchAll(/"assets\/([^"]+\.js)"/g)) dinamicos.add(m[1]);
  }
  info.set(nome, {
    bytes: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    estaticos: [...estaticos].filter((n) => n !== nome),
    dinamicos: [...dinamicos].filter((n) => n !== nome),
  });
}

// Fecho estático a partir da entrada.
const inicial = new Set();
const pilha = [...entradas];
while (pilha.length) {
  const n = pilha.pop();
  if (inicial.has(n) || !info.has(n)) continue;
  inicial.add(n);
  pilha.push(...info.get(n).estaticos);
}
const ehWorker = (n) => /\.worker-/.test(n);
const js = [...info.keys()].filter((n) => n.endsWith('.js'));
const adiados = js.filter((n) => !inicial.has(n) && !ehWorker(n));
const workers = js.filter(ehWorker);
const soma = (lista) => lista.reduce((a, n) => ({ bytes: a.bytes + info.get(n).bytes, gzip: a.gzip + info.get(n).gzip, brotli: a.brotli + info.get(n).brotli }), { bytes: 0, gzip: 0, brotli: 0 });

const resumo = {
  entrada: entradas,
  jsInicial: { arquivos: [...inicial], ...soma([...inicial]) },
  cssInicial: { arquivos: cssInicial, ...soma(cssInicial.filter((n) => info.has(n))) },
  jsAdiado: { arquivos: adiados.length, ...soma(adiados) },
  workers: { arquivos: workers.length, ...soma(workers) },
  jsTotal: { arquivos: js.length, ...soma(js) },
  chunks: js.map((n) => ({ arquivo: n, tipo: inicial.has(n) ? 'inicial' : ehWorker(n) ? 'worker' : 'adiado', bytes: info.get(n).bytes, gzip: info.get(n).gzip, brotli: info.get(n).brotli }))
    .sort((a, b) => b.bytes - a.bytes),
};

// Decomposição do chunk de entrada pelo relatório do visualizer, quando existe.
const stats = resolve(raiz, 'bundle-report', 'stats.json');
if (existsSync(stats)) {
  const dados = JSON.parse(await readFile(stats, 'utf8'));
  const porChunk = {};
  for (const meta of Object.values(dados.nodeMetas)) {
    for (const [chunk, parte] of Object.entries(meta.moduleParts)) {
      const p = dados.nodeParts[parte];
      const nome = chunk.replace(/^assets\//, '');
      const id = meta.id.replace(/\\/g, '/');
      const pacote = id.includes('/node_modules/')
        ? id.split('/node_modules/').pop().split('/').slice(0, id.split('/node_modules/').pop().startsWith('@') ? 2 : 1).join('/')
        : id.startsWith('/src/') || id.includes('/src/') ? `src/${id.split('/src/').pop().split('/').slice(0, -1).join('/') || '.'}` : id;
      porChunk[nome] ??= {};
      porChunk[nome][pacote] = (porChunk[nome][pacote] ?? 0) + p.renderedLength;
    }
  }
  resumo.composicao = Object.fromEntries(Object.entries(porChunk)
    .filter(([n]) => inicial.has(n) || info.get(n)?.bytes > 100 * 1024)
    .map(([n, grupos]) => [n, Object.entries(grupos).sort((a, b) => b[1] - a[1]).slice(0, 25)]));
}

const i = process.argv.indexOf('--json');
if (i > 0) {
  const destino = resolve(process.cwd(), process.argv[i + 1]);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, JSON.stringify(resumo, null, 2));
}

console.log('\nBundle de produção (dist/)');
console.log(`  JS inicial   ${String(resumo.jsInicial.arquivos.length).padStart(3)} arq.  ${kb(resumo.jsInicial.bytes).padStart(11)}  gzip ${kb(resumo.jsInicial.gzip).padStart(10)}  brotli ${kb(resumo.jsInicial.brotli).padStart(10)}`);
console.log(`  CSS inicial  ${String(resumo.cssInicial.arquivos.length).padStart(3)} arq.  ${kb(resumo.cssInicial.bytes).padStart(11)}  gzip ${kb(resumo.cssInicial.gzip).padStart(10)}  brotli ${kb(resumo.cssInicial.brotli).padStart(10)}`);
console.log(`  JS adiado    ${String(resumo.jsAdiado.arquivos).padStart(3)} arq.  ${kb(resumo.jsAdiado.bytes).padStart(11)}  gzip ${kb(resumo.jsAdiado.gzip).padStart(10)}  brotli ${kb(resumo.jsAdiado.brotli).padStart(10)}`);
console.log(`  Workers      ${String(resumo.workers.arquivos).padStart(3)} arq.  ${kb(resumo.workers.bytes).padStart(11)}  gzip ${kb(resumo.workers.gzip).padStart(10)}  brotli ${kb(resumo.workers.brotli).padStart(10)}`);
console.log(`  JS total     ${String(resumo.jsTotal.arquivos).padStart(3)} arq.  ${kb(resumo.jsTotal.bytes).padStart(11)}  gzip ${kb(resumo.jsTotal.gzip).padStart(10)}  brotli ${kb(resumo.jsTotal.brotli).padStart(10)}`);
console.log('\n  Chunks:');
for (const c of resumo.chunks) console.log(`    ${c.tipo.padEnd(8)} ${c.arquivo.padEnd(44)} ${kb(c.bytes).padStart(10)}  gzip ${kb(c.gzip).padStart(9)}`);
if (resumo.composicao) {
  for (const [chunk, grupos] of Object.entries(resumo.composicao)) {
    if (!inicial.has(chunk)) continue;
    console.log(`\n  Composição de ${chunk} (renderizado, antes da minificação final):`);
    for (const [g, n] of grupos) console.log(`    ${kb(n).padStart(10)}  ${g}`);
  }
}
