// Mede o EcoGrad num Chrome real, nos fluxos que um usuário percorre.
//
// Serve o `dist/` como a Netlify serve (Brotli/gzip nos textos, `.json.gz` sem
// recodificar, fallback de SPA) e dirige o Chrome instalado pelo
// `puppeteer-core`. Os números vêm das APIs de desempenho do próprio navegador:
// Long Tasks, Long Animation Frames, Event Timing (INP), Layout Shift (CLS),
// LCP/FCP e as métricas de CPU e heap do DevTools. A acessibilidade é auditada
// com o axe-core (WCAG 2.1 A/AA) em cada estado visitado.
//
// Uso:
//   npm run build && node scripts/medir-desempenho.mjs [opções]
//   --cpu 4                   desaceleração de CPU (padrão 4, o celular médio do Lighthouse)
//   --rodadas 3               repetições da carga fria (mediana)
//   --cenarios carga,busca,colecao,abas,dossie,memoria,a11y
//   --base http://host:porta  mede um servidor já rodando em vez do dist/
//   --saida perf-report/x.json
//   --dist caminho/dist       serve outro build (ex.: o da versão anterior, para A/B)
//   --ciclos 5                ciclos de abrir/fechar janela no teste de memória
//   --perfil                  perfil de CPU da main thread em cada janela medida
//   --heap                    resumo do heap da página (por tipo, construtor e maiores strings)
//   --visivel                 abre a janela do Chrome
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { resolve, extname, dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opcao = (nome, padrao) => { const i = argv.indexOf(`--${nome}`); return i >= 0 ? argv[i + 1] : padrao; };
const CPU = Number(opcao('cpu', '4'));
const RODADAS = Number(opcao('rodadas', '3'));
const SAIDA = resolve(raiz, opcao('saida', 'perf-report/desempenho.json'));
const BASE_EXTERNA = opcao('base', null);
const CENARIOS = new Set(opcao('cenarios', 'carga,busca,colecao,abas,dossie,memoria,a11y').split(','));
const VISIVEL = argv.includes('--visivel');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIST = resolve(raiz, opcao('dist', 'dist'));
const CICLOS = Number(opcao('ciclos', '5'));
const COLECAO = opcao('colecao', 'Programa de Pós-Graduação em Engenharia de Produção');
const CONSULTA = opcao('consulta', 'engenharia de producao');

// --- Servidor estático com o comportamento da Netlify ---------------------
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.gz': 'application/gzip', '.ico': 'image/x-icon',
};
const COMPRIMIVEL = new Set(['.html', '.js', '.css', '.json', '.svg']);

function servirDist() {
  const dist = DIST;
  if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ ausente: rode `npm run build` antes.');
  const cache = new Map();
  const servidor = http.createServer((req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho.startsWith('/api/') || caminho.startsWith('/.netlify/')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"erro":"sem funções no harness"}');
      return;
    }
    let arquivo = normalize(join(dist, caminho));
    if (!arquivo.startsWith(dist) || !existsSync(arquivo) || statSync(arquivo).isDirectory()) arquivo = join(dist, 'index.html');
    const ext = extname(arquivo);
    const cabecalhos = {
      'content-type': TIPOS[ext] ?? 'application/octet-stream',
      'cache-control': arquivo.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    let entrada = cache.get(arquivo);
    if (!entrada) { entrada = { bruto: readFileSync(arquivo) }; cache.set(arquivo, entrada); }
    let corpo = entrada.bruto;
    const aceita = String(req.headers['accept-encoding'] ?? '');
    if (COMPRIMIVEL.has(ext)) {
      cabecalhos.vary = 'Accept-Encoding';
      if (aceita.includes('br')) {
        entrada.br ??= brotliCompressSync(corpo, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
        corpo = entrada.br; cabecalhos['content-encoding'] = 'br';
      } else if (aceita.includes('gzip')) {
        entrada.gz ??= gzipSync(corpo, { level: 9 });
        corpo = entrada.gz; cabecalhos['content-encoding'] = 'gzip';
      }
    }
    cabecalhos['content-length'] = corpo.length;
    res.writeHead(200, cabecalhos);
    res.end(req.method === 'HEAD' ? undefined : corpo);
  });
  // A Netlify entrega os textos já comprimidos; comprimir sob demanda aqui
  // penalizaria só a primeira rodada e distorceria a mediana.
  const aquecer = (pasta) => {
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) { if (nome !== 'data') aquecer(caminho); continue; }
      if (!COMPRIMIVEL.has(extname(caminho))) continue;
      const bruto = readFileSync(caminho);
      cache.set(caminho, { bruto, br: brotliCompressSync(bruto, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }), gz: gzipSync(bruto, { level: 9 }) });
    }
  };
  aquecer(dist);
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok({ servidor, base: `http://127.0.0.1:${servidor.address().port}` })));
}

// --- Instrumentação injetada antes de qualquer script da página -----------
const INSTRUMENTACAO = `(() => {
  const p = window.__perf = { lt: [], loaf: [], ev: [], ls: [], lcp: [], fcp: null };
  const obs = (type, cb, extra) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe(Object.assign({ type, buffered: true }, extra || {})); } catch (e) {} };
  const nome = (n) => !n ? '' : (n.getAttribute && n.getAttribute('aria-label')) || (n.textContent || '').trim().slice(0, 40) || n.nodeName;
  const seletor = (n) => !n ? '?' : n.nodeName + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.') : '');
  obs('longtask', (e) => p.lt.push({ s: e.startTime, d: e.duration }));
  obs('long-animation-frame', (e) => p.loaf.push({ s: e.startTime, d: e.duration, b: e.blockingDuration,
    sc: e.scripts.map((x) => ({ d: Math.round(x.duration), f: x.sourceFunctionName, u: (x.sourceURL || '').split('/').pop(), c: x.sourceCharPosition, i: x.invoker, t: x.invokerType, fl: Math.round(x.forcedStyleAndLayoutDuration) })) }));
  obs('event', (e) => { if (e.interactionId) p.ev.push({ n: e.name, s: e.startTime, d: e.duration, id: e.interactionId, ps: e.processingStart, pe: e.processingEnd, alvo: nome(e.target) }); }, { durationThreshold: 16 });
  obs('layout-shift', (e) => { if (!e.hadRecentInput) p.ls.push({ s: e.startTime, v: e.value, fontes: (e.sources || []).map((f) => seletor(f.node)).slice(0, 4) }); });
  obs('largest-contentful-paint', (e) => p.lcp.push({ s: e.startTime, tam: e.size, el: seletor(e.element) }));
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') p.fcp = e.startTime; });
  // Quadros efetivamente entregues: a fluidez que o usuário vê enquanto algo roda.
  p.quadros = [];
  const amostrar = (t) => { p.quadros.push(t); if (p.quadros.length > 400000) p.quadros.splice(0, 200000); requestAnimationFrame(amostrar); };
  requestAnimationFrame(amostrar);
})();`;

const agora = (page) => page.evaluate(() => performance.now());
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

// --- Perfil de CPU da main thread (--perfil) --------------------------------
// Contra o servidor de dev os nomes de função chegam legíveis; é a atribuição
// de cada tarefa longa à função que a causou.
const PERFIL = argv.includes('--perfil');
const perfis = {};
let perfilAtivo = null;
async function iniciarPerfil(page) {
  if (!PERFIL) return;
  perfilAtivo = await page.createCDPSession();
  await perfilAtivo.send('Profiler.enable');
  await perfilAtivo.send('Profiler.setSamplingInterval', { interval: 250 });
  await perfilAtivo.send('Profiler.start');
}
async function encerrarPerfil(rotulo) {
  if (!PERFIL || !perfilAtivo) return;
  const { profile } = await perfilAtivo.send('Profiler.stop');
  await perfilAtivo.detach();
  perfilAtivo = null;
  const nos = new Map(profile.nodes.map((n) => [n.id, n]));
  const pai = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) pai.set(c, n.id);
  const chave = (n) => `${n.callFrame.functionName || '(anônima)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`;
  const proprio = new Map();
  const inclusivo = new Map();
  profile.samples.forEach((id, i) => {
    const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000;
    const n = nos.get(id);
    if (!n || ['(idle)', '(program)', '(garbage collector)'].includes(n.callFrame.functionName)) {
      if (n?.callFrame.functionName === '(garbage collector)') proprio.set('(coleta de lixo)', (proprio.get('(coleta de lixo)') ?? 0) + dt);
      return;
    }
    proprio.set(chave(n), (proprio.get(chave(n)) ?? 0) + dt);
    const vistos = new Set();
    for (let atual = id; atual !== undefined; atual = pai.get(atual)) {
      const k = chave(nos.get(atual));
      if (vistos.has(k)) continue;
      vistos.add(k);
      inclusivo.set(k, (inclusivo.get(k) ?? 0) + dt);
    }
  });
  const topo = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([f, ms]) => ({ f, ms: Math.round(ms) }));
  perfis[rotulo] = { proprio: topo(proprio, 15), inclusivo: topo(inclusivo, 25).filter((x) => !/^\(anônima\) :0|^\(root\)/.test(x.f)) };
  console.log(`      perfil [${rotulo}] (próprio): ${perfis[rotulo].proprio.slice(0, 6).map((x) => `${x.f} ${x.ms}ms`).join(' | ')}`);
}

// --- Resumo do heap da página (--heap) -----------------------------------------
// Onde mora a memória da página no início do teste de memória: bytes por tipo e
// por construtor, e as maiores strings (JSON guardado, textos, índices).
const HEAP = argv.includes('--heap');
async function resumoDoHeap(page) {
  const cdp = await page.createCDPSession();
  const partes = [];
  cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => partes.push(e.chunk));
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await cdp.detach();
  const { snapshot: { meta }, nodes, strings } = JSON.parse(partes.join(''));
  const campos = meta.node_fields;
  const tipos = meta.node_types[0];
  const [iTipo, iNome, iTam] = ['type', 'name', 'self_size'].map((c) => campos.indexOf(c));
  const mb = (b) => Number((b / 1048576).toFixed(1));
  const porTipo = {};
  const porNome = {};
  const grandes = [];
  for (let i = 0; i < nodes.length; i += campos.length) {
    const tipo = tipos[nodes[i + iTipo]];
    const tam = nodes[i + iTam];
    porTipo[tipo] = (porTipo[tipo] ?? 0) + tam;
    if (/string/.test(tipo)) {
      if (tam >= 512 * 1024) grandes.push({ mb: mb(tam), tipo, inicio: String(strings[nodes[i + iNome]]).slice(0, 70) });
    } else {
      const nome = `${tipo}:${strings[nodes[i + iNome]]}`.slice(0, 60);
      porNome[nome] = (porNome[nome] ?? 0) + tam;
    }
  }
  const topo = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, b]) => [k, mb(b)]));
  const resumo = { porTipoMB: topo(porTipo, 20), porNomeMB: topo(porNome, 12), maioresStrings: grandes.sort((a, b) => b.mb - a.mb).slice(0, 12) };
  console.log(`   heap da página por tipo (MB): ${JSON.stringify(resumo.porTipoMB)}`);
  console.log(`   heap da página por construtor (MB): ${JSON.stringify(resumo.porNomeMB)}`);
  for (const s of resumo.maioresStrings) console.log(`      ${s.mb} MB ${s.tipo}: ${JSON.stringify(s.inicio)}`);
  return resumo;
}

/** Métricas da main thread entre dois instantes (ms do relógio da página). */
function janela(page, t0, t1) {
  return page.evaluate((t0, t1) => {
    const p = window.__perf;
    const dentro = (x) => x.s >= t0 && x.s <= t1;
    const lt = p.lt.filter(dentro);
    const porInteracao = new Map();
    for (const e of p.ev.filter(dentro)) { const a = porInteracao.get(e.id); if (!a || e.d > a.d) porInteracao.set(e.id, e); }
    const inter = [...porInteracao.values()].sort((a, b) => b.d - a.d);
    const loaf = p.loaf.filter(dentro).sort((a, b) => b.d - a.d);
    const q = p.quadros.filter((x) => x >= t0 && x <= t1);
    let lentos = 0; let maiorIntervalo = 0;
    for (let i = 1; i < q.length; i++) { const g = q[i] - q[i - 1]; if (g > 50) lentos++; if (g > maiorIntervalo) maiorIntervalo = g; }
    return {
      duracao: Math.round(t1 - t0),
      fps: q.length > 1 ? Number(((q.length - 1) / ((q[q.length - 1] - q[0]) / 1000)).toFixed(1)) : 0,
      quadrosLentos: lentos,
      maiorIntervaloQuadros: Math.round(maiorIntervalo),
      tarefasLongas: lt.length,
      tbt: Math.round(lt.reduce((a, x) => a + Math.max(0, x.d - 50), 0)),
      maiorTarefa: Math.round(lt.reduce((m, x) => Math.max(m, x.d), 0)),
      inp: Math.round(inter[0]?.d ?? 0),
      interacoes: inter.length,
      piores: inter.slice(0, 5).map((e) => ({ evento: e.n, dur: Math.round(e.d), atraso: Math.round(e.ps - e.s), processamento: Math.round(e.pe - e.ps), apresentacao: Math.round(e.s + e.d - e.pe), alvo: e.alvo })),
      cls: Number(p.ls.filter(dentro).reduce((a, x) => a + x.v, 0).toFixed(4)),
      deslocamentos: p.ls.filter(dentro).sort((a, b) => b.v - a.v).slice(0, 5),
      quadrosLongos: loaf.slice(0, 6).map((f) => ({ dur: Math.round(f.d), bloqueio: Math.round(f.b), scripts: f.sc.filter((s) => s.d > 5).sort((a, b) => b.d - a.d).slice(0, 4) })),
    };
  }, t0, t1);
}

async function cpuPrincipal(page) {
  const m = await page.metrics();
  return { tarefas: m.TaskDuration, script: m.ScriptDuration, heap: m.JSHeapUsedSize };
}

/**
 * Heap usado pelos workers da página — onde o índice de busca e os cálculos
 * moram —, depois de uma coleta de lixo em cada um (um worker ocioso quase não
 * coleta sozinho, e o lixo de uma gravação passaria por memória retida).
 */
async function heapDosWorkers(page) {
  let total = 0;
  const porWorker = {};
  for (const w of page.workers()) {
    try {
      for (let i = 0; i < 2; i++) await w.client.send('HeapProfiler.collectGarbage');
      const usado = (await w.client.send('Runtime.getHeapUsage')).usedSize;
      const nome = (w.url().split(/[?#]/)[0].split('/').pop() || 'worker').replace(/-[\w-]{8}\.js$/, '').replace(/\.(ts|js)$/, '');
      porWorker[nome] = (porWorker[nome] ?? 0) + usado;
      total += usado;
    } catch { /* worker encerrado no meio da leitura */ }
  }
  return { total, porWorker };
}

async function coletarLixo(page) {
  const cdp = await page.createCDPSession();
  for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await pausa(150); }
  await cdp.detach();
}

async function esperarAte(page, fn, { timeout = 60000, intervalo = 100, args = [] } = {}) {
  const fim = Date.now() + timeout;
  while (Date.now() < fim) {
    if (await page.evaluate(fn, ...args).catch(() => false)) return true;
    await pausa(intervalo);
  }
  throw new Error(`Tempo esgotado esperando: ${fn.toString().slice(0, 120)}`);
}

/** Espera a main thread ficar sem tarefas longas por `quieto` ms. */
async function esperarOcioso(page, quieto = 1500, timeout = 120000) {
  const fim = Date.now() + timeout;
  while (Date.now() < fim) {
    const ultima = await page.evaluate(() => { const lt = window.__perf.lt; return lt.length ? lt[lt.length - 1].s + lt[lt.length - 1].d : 0; });
    const t = await agora(page);
    if (t - ultima >= quieto) return;
    await pausa(200);
  }
}

// --- axe-core ----------------------------------------------------------------
const AXE = readFileSync(resolve(raiz, 'node_modules/axe-core/axe.min.js'), 'utf8');
const auditorias = [];
async function auditar(page, estado) {
  if (!CENARIOS.has('a11y')) return;
  const tem = await page.evaluate(() => typeof window.axe !== 'undefined');
  if (!tem) await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const wcag = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
    const bp = await window.axe.run(document, { runOnly: { type: 'tag', values: ['best-practice'] }, resultTypes: ['violations'] });
    const resumo = (v) => ({ id: v.id, impacto: v.impact, ajuda: v.help, nos: v.nodes.length,
      exemplos: v.nodes.slice(0, 4).map((n) => ({ alvo: n.target.join(' '), html: n.html.slice(0, 160), falha: (n.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 200) })) });
    return { wcag: wcag.violations.map(resumo), boasPraticas: bp.violations.map(resumo) };
  });
  auditorias.push({ estado, ...r });
  const nos = r.wcag.reduce((a, v) => a + v.nos, 0);
  console.log(`   a11y [${estado}]: ${r.wcag.length} regras WCAG violadas (${nos} nós) · ${r.boasPraticas.length} boas práticas`);
}

// --- Cenários ------------------------------------------------------------------
async function novaPagina(browser, { rede = null } = {}) {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(INSTRUMENTACAO);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  if (rede) {
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', rede);
  }
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const bytes = { Script: 0, Stylesheet: 0, Font: 0, Document: 0, Fetch: 0, Image: 0, Outro: 0, requisicoesJs: 0 };
  const tipos = new Map();
  cdp.on('Network.responseReceived', (e) => tipos.set(e.requestId, e.type));
  cdp.on('Network.loadingFinished', (e) => {
    const t = tipos.get(e.requestId) ?? 'Outro';
    bytes[t in bytes ? t : 'Outro'] += e.encodedDataLength;
    if (t === 'Script') bytes.requisicoesJs += 1;
  });
  return { contexto, page, cdp, bytes };
}

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };

/** Carga fria da apresentação em 4G lento e CPU desacelerada (condições do Lighthouse). */
async function cenarioCarga(browser, base) {
  const rodadas = [];
  for (let i = 0; i < RODADAS; i++) {
    const { contexto, page, bytes } = await novaPagina(browser, {
      rede: { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 },
    });
    await page.goto(base, { waitUntil: 'load', timeout: 180000 });
    await esperarAte(page, () => !!document.querySelector('[role="search"] input'), { timeout: 60000 });
    await pausa(5000);
    const fim = await agora(page);
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
    const perf = await page.evaluate(() => ({ fcp: window.__perf.fcp, lcp: window.__perf.lcp.at(-1), cls: window.__perf.ls.reduce((a, x) => a + x.v, 0) }));
    const j = await janela(page, perf.fcp ?? 0, fim);
    // Desde o início da navegação: inclui a avaliação do JS inicial, que o TBT
    // canônico (FCP → TTI) deixa de fora quando acontece antes da primeira pintura.
    const tudo = await janela(page, 0, fim);
    // Custo ocioso: o que a main thread gasta por segundo com a tela parada.
    const c0 = await cpuPrincipal(page); await pausa(5000); const c1 = await cpuPrincipal(page);
    rodadas.push({ fcp: Math.round(perf.fcp), lcp: Math.round(perf.lcp?.s ?? 0), lcpElemento: perf.lcp?.el, cls: Number(perf.cls.toFixed(4)), tbt: j.tbt,
      tbtDesdeInicio: tudo.tbt, tarefasLongasDesdeInicio: tudo.tarefasLongas, maiorTarefaDesdeInicio: tudo.maiorTarefa,
      maiorTarefa: j.maiorTarefa, dcl: Math.round(nav.dcl), load: Math.round(nav.load), jsTransferido: bytes.Script, requisicoesJs: bytes.requisicoesJs,
      cssTransferido: bytes.Stylesheet, fontesTransferidas: bytes.Font, cpuOciosoPct: Number((((c1.tarefas - c0.tarefas) / 5) * 100).toFixed(1)), quadrosLongos: j.quadrosLongos.slice(0, 3) });
    await contexto.close();
    console.log(`   carga #${i + 1}: FCP ${rodadas.at(-1).fcp} ms · LCP ${rodadas.at(-1).lcp} ms · TBT ${rodadas.at(-1).tbt} ms · CLS ${rodadas.at(-1).cls} · JS ${(bytes.Script / 1024).toFixed(1)} KB`);
  }
  const campos = ['fcp', 'lcp', 'cls', 'tbt', 'tbtDesdeInicio', 'tarefasLongasDesdeInicio', 'maiorTarefaDesdeInicio', 'maiorTarefa', 'dcl', 'load', 'jsTransferido', 'requisicoesJs', 'cssTransferido', 'fontesTransferidas', 'cpuOciosoPct'];
  return { rodadas, mediana: Object.fromEntries(campos.map((c) => [c, mediana(rodadas.map((r) => r[c]))])), lcpElemento: rodadas[0]?.lcpElemento };
}

async function clicarPorNome(page, nome, papel = 'button') {
  const el = await page.waitForSelector(`::-p-aria([name="${nome}"][role="${papel}"])`, { timeout: 60000 });
  await el.click();
}

/** Clique medido: devolve a janela da interação (INP do clique e o trabalho que ele disparou). */
async function interacao(page, rotulo, acao, esperaMs = 1500) {
  await iniciarPerfil(page);
  const t0 = await agora(page);
  await acao();
  await pausa(esperaMs);
  await esperarOcioso(page, 800, 60000);
  const j = await janela(page, t0, await agora(page));
  console.log(`   ${rotulo}: INP ${j.inp} ms · TBT ${j.tbt} ms · maior tarefa ${j.maiorTarefa} ms · CLS ${j.cls}`);
  await encerrarPerfil(rotulo);
  return { rotulo, ...j };
}

async function fluxoPrincipal(browser, base) {
  const r = {};
  const { contexto, page } = await novaPagina(browser);
  await page.goto(base, { waitUntil: 'load', timeout: 120000 });
  const campo = '[role="search"][aria-label="Busca no acervo"] input[role="combobox"]';
  await page.waitForSelector(campo, { timeout: 60000 });
  await esperarOcioso(page, 1500);
  await auditar(page, 'apresentacao');

  // Busca global: o catálogo de ~5 MB é baixado e preparado ao focar o campo.
  await iniciarPerfil(page);
  const t0 = await agora(page);
  await page.click(campo);
  // O status do campo (o `aria-describedby` dele) diz "Preparando…" até o
  // catálogo ficar pronto — seja ele preparado na página ou num worker, cuja
  // linha do tempo de recursos a página não enxerga.
  const statusDaBusca = (trecho) => {
    const c = document.querySelector('[role="search"][aria-label="Busca no acervo"] input[role="combobox"]');
    const s = c && document.getElementById(c.getAttribute('aria-describedby'));
    return !!s && (trecho === null ? !s.textContent.includes('Preparando') : s.textContent.includes(trecho));
  };
  await esperarAte(page, statusDaBusca, { timeout: 15000, args: ['Preparando'] }).catch(() => {});
  await esperarAte(page, statusDaBusca, { timeout: 180000, args: [null] });
  await esperarOcioso(page, 1000);
  const t1 = await agora(page);
  r.preparoBusca = await janela(page, t0, t1);
  console.log(`   preparo da busca global: ${r.preparoBusca.duracao} ms · TBT ${r.preparoBusca.tbt} ms · maior tarefa ${r.preparoBusca.maiorTarefa} ms`);
  await encerrarPerfil('preparo da busca global');

  await iniciarPerfil(page);
  const t2 = await agora(page);
  await page.type(campo, CONSULTA, { delay: 120 });
  await pausa(1500);
  await esperarOcioso(page, 800);
  r.digitacaoBusca = await janela(page, t2, await agora(page));
  console.log(`   digitação na busca global: INP ${r.digitacaoBusca.inp} ms · TBT ${r.digitacaoBusca.tbt} ms · maior tarefa ${r.digitacaoBusca.maiorTarefa} ms`);
  await encerrarPerfil('digitação na busca global');
  await auditar(page, 'apresentacao-resultados');

  if (!CENARIOS.has('colecao')) { await contexto.close(); return r; }

  // Carrega a coleção grande.
  const opcaoColecao = await page.waitForFunction((nome) => [...document.querySelectorAll('li[role="option"]')]
    .find((li) => li.textContent.includes(nome) && li.textContent.includes('Coleção')), { timeout: 60000 }, COLECAO);
  await opcaoColecao.asElement().click();
  await pausa(300);
  const t3 = await agora(page);
  const heap0 = (await cpuPrincipal(page)).heap;
  await iniciarPerfil(page);
  await page.click('button[aria-label^="Carregar "]');
  await page.waitForSelector('main#conteudo-principal h1', { timeout: 600000 });
  const t4 = await agora(page);
  await esperarOcioso(page, 1000);
  r.carregamento = { ...(await janela(page, t3, await agora(page))), ateDashboard: Math.round(t4 - t3) };
  console.log(`   carregamento da coleção: dashboard em ${r.carregamento.ateDashboard} ms · TBT ${r.carregamento.tbt} ms · maior tarefa ${r.carregamento.maiorTarefa} ms`);
  await encerrarPerfil('carregamento da coleção');
  const docs = await page.evaluate(() => (document.querySelector('.eco-analise-ativa')?.textContent.match(/([\d.]+) documentos/) ?? [])[1]);
  r.documentos = docs;

  // SNA no worker: a main thread deve seguir livre enquanto ele calcula.
  await iniciarPerfil(page);
  const t5 = await agora(page);
  await esperarAte(page, () => ![...document.querySelectorAll('summary')].some((s) => s.textContent.includes('Atividades da sessão')), { timeout: 900000, intervalo: 500 });
  await pausa(1500);
  await esperarOcioso(page, 1000);
  const t6 = await agora(page);
  r.sna = { ...(await janela(page, t5, t6)), ateConcluir: Math.round(t6 - t3) };
  await encerrarPerfil('SNA (main thread durante o worker)');
  await coletarLixo(page);
  r.heapAposCarga = Math.round(((await cpuPrincipal(page)).heap - heap0) / 1048576);
  console.log(`   SNA (worker): ${r.sna.duracao} ms de cálculo · TBT na main thread ${r.sna.tbt} ms · maior tarefa ${r.sna.maiorTarefa} ms · ${r.sna.fps} FPS (${r.sna.quadrosLentos} quadros >50 ms) · heap +${r.heapAposCarga} MB`);
  await auditar(page, 'dashboard');

  if (CENARIOS.has('abas')) {
    r.abas = [];
    r.abas.push(await interacao(page, 'Sidebar → Motor de Busca', () => clicarPorNome(page, 'Motor de Busca')));
    r.abas.push(await interacao(page, 'Sidebar → Análise Avançada', () => clicarPorNome(page, 'Análise Avançada')));
    await auditar(page, 'analise-avancada');
    for (const aba of ['Tempo e tendências', 'Estrutura da rede', 'Especialização e dados', 'Temas e conceitos']) {
      r.abas.push(await interacao(page, `Aba → ${aba}`, () => clicarPorNome(page, aba, 'tab')));
    }
    r.abas.push(await interacao(page, 'Sidebar → Dashboard', () => clicarPorNome(page, 'Dashboard')));
  }

  if (CENARIOS.has('dossie')) {
    await clicarPorNome(page, 'Motor de Busca');
    await esperarOcioso(page, 1000);
    await clicarPorNome(page, 'Pessoas');
    await esperarOcioso(page, 1000);
    const combo = '[role="search"][aria-label="Escolha do item"] input[role="combobox"]';
    await page.click(combo);
    await iniciarPerfil(page);
    const t7 = await agora(page);
    await page.type(combo, 'silva', { delay: 150 });
    await pausa(1500);
    await esperarOcioso(page, 800);
    r.digitacaoMotor = await janela(page, t7, await agora(page));
    console.log(`   digitação no Motor de Busca: INP ${r.digitacaoMotor.inp} ms · TBT ${r.digitacaoMotor.tbt} ms · maior tarefa ${r.digitacaoMotor.maiorTarefa} ms`);
    await encerrarPerfil('digitação no Motor de Busca');
    const primeira = await page.waitForSelector('ul[role="listbox"] li[role="option"]', { timeout: 30000 });
    r.abrirDossie = await interacao(page, 'Abrir dossiê de pessoa', async () => {
      await primeira.click();
      await page.waitForFunction(() => [...document.querySelectorAll('h2')].some((h) => h.textContent.startsWith('Pessoa:')), { timeout: 120000 });
    }, 2500);
    await auditar(page, 'dossie');
  }

  if (CENARIOS.has('memoria')) {
    r.memoria = {};
    await clicarPorNome(page, 'Dashboard');
    await esperarOcioso(page, 1000);
    if (HEAP) r.heap = await resumoDoHeap(page);
    const ciclo = async (bloco, rotulo) => {
      await coletarLixo(page);
      const antes = (await cpuPrincipal(page)).heap;
      const workersAntes = await heapDosWorkers(page);
      const inps = [];
      const heapPorCiclo = [];
      for (let i = 0; i < CICLOS; i++) {
        const t = await agora(page);
        await clicarPorNome(page, bloco);
        await page.waitForSelector('[role="dialog"] canvas', { timeout: 120000 });
        await pausa(1500);
        await esperarOcioso(page, 800);
        if (i === 0) await auditar(page, `janela-${rotulo}`);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 30000 });
        await pausa(500);
        inps.push((await janela(page, t, await agora(page))).inp);
        if (CICLOS > 5) { await coletarLixo(page); heapPorCiclo.push(Number((((await cpuPrincipal(page)).heap - antes) / 1048576).toFixed(2))); }
      }
      await coletarLixo(page);
      const depois = (await cpuPrincipal(page)).heap;
      const canvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].filter((c) => !c.closest('.eco-fundo')).length);
      const mb = (b) => Number((b / 1048576).toFixed(1));
      const workersDepois = await heapDosWorkers(page);
      const res = { heapWorkersMB: mb(workersAntes.total), workersMB: Object.fromEntries(Object.entries(workersAntes.porWorker).map(([k, v]) => [k, mb(v)])),
        heapWorkersDepoisMB: mb(workersDepois.total), totalAntesMB: mb(antes + workersAntes.total), totalDepoisMB: mb(depois + workersDepois.total), heapAntesMB: Number((antes / 1048576).toFixed(1)), heapDepoisMB: Number((depois / 1048576).toFixed(1)), crescimentoMB: Number(((depois - antes) / 1048576).toFixed(2)), canvasesOrfaos: canvases, inpAbrirFecharMax: Math.max(...inps), heapPorCiclo };
      if (heapPorCiclo.length) console.log(`   memória [${rotulo}] heap acumulado por ciclo (MB): ${heapPorCiclo.join(' · ')}`);
      console.log(`   memória [${rotulo}] workers (pós-coleta): ${res.heapWorkersMB} MB ${JSON.stringify(res.workersMB)} → ${res.heapWorkersDepoisMB} MB · total página + workers ${res.totalAntesMB} → ${res.totalDepoisMB} MB`);
      console.log(`   memória [${rotulo}] ${CICLOS} ciclos abrir/fechar: heap ${res.heapAntesMB} → ${res.heapDepoisMB} MB (${res.crescimentoMB >= 0 ? '+' : ''}${res.crescimentoMB}) · canvases órfãos ${canvases}`);
      return res;
    };
    r.memoria.destaques = await ciclo('Destaques do Ecossistema', 'destaques');
    await clicarPorNome(page, 'Análise Avançada');
    await esperarOcioso(page, 1000);
    await clicarPorNome(page, 'Estrutura da rede', 'tab');
    await esperarOcioso(page, 1000);
    r.memoria.espaco3d = await ciclo('Espaço Topológico 3D', 'espaco-3d');
  }
  await contexto.close();
  return r;
}

// --- Execução ------------------------------------------------------------------
const { servidor, base } = BASE_EXTERNA ? { servidor: null, base: BASE_EXTERNA } : await servirDist();
console.log(`Medindo ${base} · CPU ${CPU}x · Chrome ${CHROME}`);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: !VISIVEL, protocolTimeout: 900000,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--window-size=1440,900', '--enable-precise-memory-info'],
});
const resultado = { quando: new Date().toISOString(), cpu: CPU, versaoChrome: await browser.version(), base };
try {
  if (CENARIOS.has('carga')) { console.log('\n[carga fria]'); resultado.carga = await cenarioCarga(browser, base); }
  if (CENARIOS.has('busca') || CENARIOS.has('colecao')) { console.log('\n[fluxo principal]'); resultado.fluxo = await fluxoPrincipal(browser, base); }
} finally {
  resultado.a11y = auditorias;
  if (PERFIL) resultado.perfis = perfis;
  await mkdir(dirname(SAIDA), { recursive: true });
  await writeFile(SAIDA, JSON.stringify(resultado, null, 2));
  await browser.close();
  servidor?.close();
  console.log(`\nResultado completo: ${SAIDA}`);
}
