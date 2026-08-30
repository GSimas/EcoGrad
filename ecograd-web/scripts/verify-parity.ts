/**
 * Harness de paridade: roda os motores TypeScript sobre a mesma base que o
 * script Python de referência e imprime as métricas em JSON para diff numérico.
 * Uso: npm run verify:parity (ver package.json)
 */
import { readFileSync } from 'node:fs';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { normalizarDocumentos } from '../src/lib/data-loader';
import {
  betweennessCentrality,
  clusteringCoefficient,
  closenessCentrality,
  compactar,
  degreeAssortativity,
  degreeCentrality,
  degreeHistogram,
  eigenvectorCentrality,
  globalEfficiency,
  grauDe,
  burtConstraint,
  pagerank,
  richClubCoefficient,
} from '../src/lib/graph-core';
import { calcularMetricasComplexas, estimarGammaLeiPotencia } from '../src/lib/sna-engine';
import {
  extrairTermosForesight,
  prepararRadarForesight,
  validarForesightHistorico,
} from '../src/lib/foresight-math';
import { calcularMetricasMemeticas } from '../src/lib/memetics';
import { gerarTabelaQLCruzado } from '../src/lib/ql';
import { calcularSimilaresRede, construirPerfisSimilaridade } from '../src/lib/similarity';
import { linregress, mean, median, std } from '../src/lib/stats';
import type { Documento } from '../src/types';

const CAMINHO = process.argv[2] ?? '../base_ppgegc.json';
const docs = normalizarDocumentos(JSON.parse(readFileSync(CAMINHO, 'utf-8')));

const N_SUB = 150;
const sub = docs.slice(0, N_SUB);

// ---------- 1. Grafo global do subconjunto (cálculo exato) ----------
function grafoGlobal(lista: Documento[]): Graph {
  const g = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  const no = (id: string, tipo: string) => {
    if (!g.hasNode(id)) g.addNode(id, { tipo });
  };
  const aresta = (a: string, b: string) => {
    if (a !== b && !g.hasEdge(a, b)) g.addEdge(a, b);
  };
  for (const d of lista) {
    if (!d.titulo) continue;
    no(d.titulo, 'Documento');
    for (const a of d.autores) { no(a, 'Autor'); aresta(d.titulo, a); }
    if (d.orientador) { no(d.orientador, 'Orientador'); aresta(d.titulo, d.orientador); }
    for (const pk of d.palavras_chave) { no(pk, 'Palavra-chave'); aresta(d.titulo, pk); }
    if (d.macrotema) { no(d.macrotema, 'Macrotema'); aresta(d.titulo, d.macrotema); }
    for (const art of extrairTermosForesight(d, 'Artefatos (Ontologia IA)')) {
      no(art, 'Artefato (Ontologia IA)');
      aresta(d.titulo, art);
    }
  }
  return g;
}

const gSub = grafoGlobal(sub);
const cgSub = compactar(gSub);
const deg = degreeCentrality(cgSub);
const bet = betweennessCentrality(cgSub, { k: null });
const clo = closenessCentrality(cgSub, { pivots: null });
const clu = clusteringCoefficient(cgSub);

const porRotulo = (arr: Float64Array) => {
  const out: Record<string, number> = {};
  for (let i = 0; i < cgSub.n; i += 1) out[cgSub.labels[i]] = arr[i];
  return out;
};

// ---------- 2. Métricas complexas ----------
const complexasTs = calcularMetricasComplexas(sub)!;

// Grafo equivalente para conferir peças isoladas
const g2 = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
{
  const ligar = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    if (!g2.hasNode(a)) g2.addNode(a);
    if (!g2.hasNode(b)) g2.addNode(b);
    if (!g2.hasEdge(a, b)) g2.addEdge(a, b);
  };
  for (const d of sub) {
    if (!d.titulo) continue;
    if (!g2.hasNode(d.titulo)) g2.addNode(d.titulo);
    for (const a of d.autores) ligar(d.titulo, a);
    if (d.orientador) ligar(d.titulo, d.orientador);
    for (const pk of d.palavras_chave) ligar(d.titulo, pk);
  }
}
const cg2 = compactar(g2);
const graus2: number[] = [];
for (let i = 0; i < cg2.n; i += 1) graus2.push(grauDe(cg2, i));
const hist2 = degreeHistogram(cg2);
const total2 = hist2.reduce((a, b) => a + b, 0);
let entropia2 = 0;
for (const c of hist2) {
  if (c > 0) {
    const p = c / total2;
    entropia2 -= p * Math.log2(p);
  }
}

const complexas = {
  densidade: (2 * cg2.m) / (cg2.n * (cg2.n - 1)),
  eficiencia: globalEfficiency(cg2, null),
  entropia: entropia2,
  clustering: mean(Array.from(clusteringCoefficient(cg2))),
  pagerank_avg: mean(Array.from(pagerank(cg2))),
  eigen_avg: mean(Array.from(eigenvectorCentrality(cg2))),
  constraint_avg: mean(
    [...burtConstraint(cg2, Array.from({ length: cg2.n }, (_, i) => i)).values()].filter(Number.isFinite),
  ),
  n_nos: cg2.n,
  grau_medio: mean(graus2),
  grau_std: std(graus2),
  // Confirma que o caminho público bate com os kernels isolados
  via_api: {
    densidade: complexasTs.densidade,
    entropia: complexasTs.entropia,
    n_nos: complexasTs.n_nos,
    grau_medio: complexasTs.links.media,
  },
};

// ---------- 3. Maturidade (grafo estrutural completo) ----------
const g3 = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
{
  const ligar = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    if (!g3.hasNode(a)) g3.addNode(a);
    if (!g3.hasNode(b)) g3.addNode(b);
    if (!g3.hasEdge(a, b)) g3.addEdge(a, b);
  };
  for (const d of docs) {
    if (!d.titulo) continue;
    if (!g3.hasNode(d.titulo)) g3.addNode(d.titulo);
    for (const a of d.autores) ligar(d.titulo, a);
    if (d.orientador) ligar(d.titulo, d.orientador);
    for (const pk of d.palavras_chave) ligar(d.titulo, pk);
    if (d.macrotema) ligar(d.titulo, d.macrotema);
  }
}
const cg3 = compactar(g3);
const graus3: number[] = [];
for (let i = 0; i < cg3.n; i += 1) {
  const gr = grauDe(cg3, i);
  if (gr > 0) graus3.push(gr);
}
const cont3 = new Map<number, number>();
for (const gr of graus3) cont3.set(gr, (cont3.get(gr) ?? 0) + 1);
const logK: number[] = [];
const logPk: number[] = [];
for (const [k, c] of cont3) {
  if (k <= 1) continue;
  logK.push(Math.log10(k));
  logPk.push(Math.log10(c / graus3.length));
}

const rc = richClubCoefficient(cg3);
const chavesRc = [...rc.keys()].sort((a, b) => a - b);
const kMax = chavesRc[chavesRc.length - 1];
const kAlvo = Math.floor(kMax * 0.8);
const validasRc = chavesRc.filter((k) => k >= kAlvo);

const comunidades = louvain(g3, { rng: (() => { let s = 42; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; })() }) as Record<string, number>;
const nComunidades = new Set(Object.values(comunidades)).size;
const modularidade = louvain.detailed(g3).modularity;

const maturidade = {
  assortatividade: degreeAssortativity(cg3),
  rich_club: validasRc.length > 0 ? rc.get(validasRc[0])! : rc.get(kMax)!,
  gamma_linregress: Math.abs(linregress(logK, logPk).slope),
  gamma_mle: estimarGammaLeiPotencia(graus3),
  n_nos_G3: cg3.n,
  modularidade_louvain: modularidade,
  n_comunidades: nComunidades,
};

// ---------- 4. Radar com betweenness exato do grafo completo ----------
const gf = grafoGlobalSemOntologia(docs);
const cgf = compactar(gf);
const betF = betweennessCentrality(cgf, { k: null });
const snaFake: Record<string, { Betweenness: number }> = {};
for (let i = 0; i < cgf.n; i += 1) snaFake[cgf.labels[i]] = { Betweenness: betF[i] };

function grafoGlobalSemOntologia(lista: Documento[]): Graph {
  const g = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  const no = (id: string) => {
    if (!g.hasNode(id)) g.addNode(id);
  };
  const aresta = (a: string, b: string) => {
    if (a !== b && !g.hasEdge(a, b)) g.addEdge(a, b);
  };
  for (const d of lista) {
    if (!d.titulo) continue;
    no(d.titulo);
    for (const a of d.autores) { no(a); aresta(d.titulo, a); }
    if (d.orientador) { no(d.orientador); aresta(d.titulo, d.orientador); }
    for (const pk of d.palavras_chave) { no(pk); aresta(d.titulo, pk); }
    if (d.macrotema) { no(d.macrotema); aresta(d.titulo, d.macrotema); }
  }
  return g;
}

const radar = prepararRadarForesight(
  docs,
  snaFake as never,
  3,
  'Palavra-chave',
  null,
).sort((a, b) => a.Termo.localeCompare(b.Termo));

// ---------- 5. Backtest ----------
// k = null força betweenness exato: com amostragem, Python e TS usam RNGs
// diferentes e a comparação perderia o sentido.
const bt = validarForesightHistorico(docs, 2018, 3, 4, 0.65, 'Palavra-chave', null);
const quadrantes: Record<string, number> = {};
const vereditos: Record<string, number> = {};
for (const r of bt) {
  quadrantes[r['Previsão Passada (T1)']] = (quadrantes[r['Previsão Passada (T1)']] ?? 0) + 1;
  vereditos[r['Veredito do Modelo']] = (vereditos[r['Veredito do Modelo']] ?? 0) + 1;
}

// ---------- 6. Memética ----------
const mem = calcularMetricasMemeticas(
  docs.filter((d) => d.ano !== null),
  'Palavras-chave',
);

// ---------- 7. QL do orientador com mais orientações ----------
const contOri = new Map<string, number>();
for (const d of docs) if (d.orientador) contOri.set(d.orientador, (contOri.get(d.orientador) ?? 0) + 1);
const oriAlvo = [...contOri.entries()].sort((a, b) => b[1] - a[1])[0][0];
const docsOri = docs.filter((d) => d.orientador === oriAlvo);
const ql = gerarTabelaQLCruzado(docsOri, docs, ['Macrotema', 'Palavra-chave']);

// ---------- 8. Similares ----------
const perfis = construirPerfisSimilaridade(docs);
const similares = calcularSimilaresRede(oriAlvo, 'Orientador', perfis);

console.log(
  JSON.stringify(
    {
      n_docs: docs.length,
      sub: {
        n_nos: cgSub.n,
        n_arestas: cgSub.m,
        deg: porRotulo(deg),
        bet: porRotulo(bet),
        clo: porRotulo(clo),
        clu: porRotulo(clu),
      },
      complexas,
      maturidade,
      radar,
      backtest: { n: bt.length, quadrantes, vereditos },
      memetica: {
        n_memes: mem.fecundidade.length,
        mortos: mem.mortalidade,
        vivos: mem.sobreviventes,
        top_fecundidade: mem.fecundidade.slice(0, 20),
        n_longevidade: mem.longevidade.length,
        meia_vida_mediana: median(mem.longevidade.map((l) => l.tempo_vida_anos)),
      },
      ql: {
        orientador: oriAlvo,
        n_docs: docsOri.length,
        linhas: ql.slice(0, 40).map((l) => ({
          Entidade: l.Entidade,
          Tipo: l.Tipo,
          Total: l.Total,
          QL: l['Valor QL'],
        })),
      },
      similares: Object.fromEntries(
        Object.entries(similares).map(([k, v]) => [
          k,
          v.map((i) => ({ Item: i.Item, Sim: i['Similaridade (%)'], Tracos: i['Qtd. Traços'] })),
        ]),
      ),
    },
    null,
    0,
  ),
);
