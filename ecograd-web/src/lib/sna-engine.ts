/**
 * Motor de Redes Complexas — transcrição de `calcular_sna_global` (backend.py:1993),
 * `calcular_maturidade_rede` (backend.py:1423) e `calcular_metricas_complexas`
 * (backend.py:1255) usando graphology + os kernels de `graph-core.ts`.
 */
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import type {
  Documento,
  MaturidadeRede,
  MetricasComplexas,
  SnaGlobal,
  TipoNo,
} from '@/types';
import {
  betweennessCentrality,
  burtConstraint,
  clusteringCoefficient,
  closenessCentrality,
  compactar,
  degreeAssortativity,
  degreeCentrality,
  degreeHistogram,
  eigenvectorCentrality,
  globalEfficiency,
  grauDe,
  pagerank,
  richClubCoefficient,
} from './graph-core';
import { linregress, mean, spearman, std } from './stats';
import { extrairTermosForesight } from './foresight-math';

/**
 * Limiares de aproximação. O backend Python já aproximava o betweenness acima de
 * 1500 nós; aqui o mesmo princípio é estendido às métricas O(n·m) (closeness e
 * eficiência global) para que a rede completa da UFSC (>100k nós) seja viável no
 * browser. Abaixo dos limiares o cálculo é exato e idêntico ao NetworkX.
 */
export const LIMIAR_BETWEENNESS_EXATO = 1500;
export const LIMIAR_CLOSENESS_EXATO = 4000;
export const PIVOS_CLOSENESS = 256;
export const LIMIAR_CONSTRAINT_EXATO = 5000;

export type ProgressCallback = (valor: number, texto: string) => void;

/**
 * Constrói o multigrafo global: Documento ↔ Autor / Orientador / Palavra-chave /
 * Macrotema / Artefatos (Ontologia IA). Fiel ao laço de `calcular_sna_global`.
 */
export function construirGrafoGlobal(docs: readonly Documento[], onProgress?: ProgressCallback): Graph {
  const g = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  const total = docs.length || 1;

  const garantirNo = (id: string, tipo: TipoNo) => {
    if (!g.hasNode(id)) g.addNode(id, { tipo });
  };
  const garantirAresta = (a: string, b: string) => {
    if (a !== b && !g.hasEdge(a, b)) g.addEdge(a, b, { weight: 1 });
  };

  for (let i = 0; i < docs.length; i += 1) {
    const d = docs[i];
    const doc = d.titulo;
    if (!doc) continue;
    garantirNo(doc, 'Documento');

    for (const a of d.autores) {
      if (!a) continue;
      garantirNo(a, 'Autor');
      garantirAresta(doc, a);
    }

    if (d.orientador) {
      garantirNo(d.orientador, 'Orientador');
      garantirAresta(doc, d.orientador);
    }

    for (const pk of d.palavras_chave) {
      if (!pk) continue;
      garantirNo(pk, 'Palavra-chave');
      garantirAresta(doc, pk);
    }

    if (d.macrotema) {
      garantirNo(d.macrotema, 'Macrotema');
      garantirAresta(doc, d.macrotema);
    }

    // Artefatos da Ontologia IA entram como nós próprios, mas sem sobrescrever
    // o tipo de um termo que já exista (ex.: também é Palavra-chave).
    for (const art of extrairTermosForesight(d, 'Artefatos (Ontologia IA)')) {
      garantirNo(art, 'Artefato (Ontologia IA)');
      garantirAresta(doc, art);
    }

    if (onProgress && i % 500 === 0) {
      onProgress(
        Math.round((i / total) * 20),
        `Mapeando Ecossistema: ${i}/${docs.length} documentos processados...`,
      );
    }
  }

  return g;
}

/** Transcrição de `calcular_sna_global` (backend.py:1993). */
export function calcularSnaGlobal(docs: readonly Documento[], onProgress?: ProgressCallback): SnaGlobal {
  onProgress?.(1, 'Iniciando análise de rede complexa...');
  const g = construirGrafoGlobal(docs, onProgress);
  const cg = compactar(g);
  const { n } = cg;

  onProgress?.(30, 'Calculando Centralidade de Grau (Conexões diretas)...');
  const deg = degreeCentrality(cg);

  onProgress?.(45, 'Calculando Betweenness (Intermediação)... Isso pode levar alguns segundos...');
  // Idêntico ao Python: k = min(250, max(50, sqrt(n)*4)) acima de 1500 nós.
  const kAprox = n > LIMIAR_BETWEENNESS_EXATO
    ? Math.min(250, Math.max(50, Math.floor(Math.sqrt(n) * 4)))
    : null;
  const bet = betweennessCentrality(cg, {
    k: kAprox,
    seed: 42,
    onProgress: (feito, tot) =>
      onProgress?.(45 + Math.round((feito / Math.max(tot, 1)) * 30), 'Calculando Betweenness (Intermediação)...'),
  });

  onProgress?.(75, 'Calculando Closeness (Proximidade Central)...');
  const close = closenessCentrality(cg, {
    pivots: n > LIMIAR_CLOSENESS_EXATO ? PIVOS_CLOSENESS : null,
    seed: 42,
  });

  onProgress?.(80, 'Calculando Densidade Local (Clustering)...');
  const clust = clusteringCoefficient(cg);

  onProgress?.(85, 'Detectando Clusters e Comunidades (Algoritmo de Louvain)...');
  let comunidades: Record<string, number> = {};
  try {
    comunidades = louvain(g, { rng: criarRng(42) }) as Record<string, number>;
  } catch {
    comunidades = {};
  }

  onProgress?.(95, 'Gerando rankings e consolidando métricas SNA...');
  // Ranking global por betweenness decrescente (1 = maior ponte da rede)
  const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => bet[b] - bet[a]);
  const rank = new Int32Array(n);
  for (let r = 0; r < ordem.length; r += 1) rank[ordem[r]] = r + 1;

  const resultado: SnaGlobal = {};
  for (let i = 0; i < n; i += 1) {
    const label = cg.labels[i];
    const comunidade = comunidades[label];
    resultado[label] = {
      Tipo: (g.getNodeAttribute(label, 'tipo') as TipoNo) ?? 'Desconhecido',
      'Grau Absoluto': grauDe(cg, i),
      'Degree Centrality': deg[i],
      Betweenness: bet[i],
      Closeness: close[i],
      Clustering: clust[i],
      // Louvain do graphology é 0-based; o Python é 1-based (enumerate + 1)
      Comunidade: comunidade === undefined ? 'N/A' : comunidade + 1,
      'Ranking Global': rank[i] || 'N/A',
    };
  }

  onProgress?.(100, 'Rede complexa consolidada.');
  return resultado;
}

/** RNG determinístico no formato esperado pelo graphology-communities-louvain. */
function criarRng(seed: number): () => number {
  let estado = seed >>> 0 || 1;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

/**
 * Estimador MLE do expoente γ da lei de potência.
 * Transcrição de `_estimar_gamma_lei_potencia` (backend.py:80).
 * γ = 1 + n / Σ ln(xi / x_min)   — Clauset, Shalizi & Newman (2009).
 */
export function estimarGammaLeiPotencia(degrees: readonly number[]): number {
  const validos = degrees.filter((d) => Number.isFinite(d) && d > 0);
  if (validos.length < 10) return 0;

  const dMin = Math.min(...validos);
  if (dMin < 1) return 0;

  let logSum = 0;
  for (const d of validos) logSum += Math.log(d / dMin);
  if (!(logSum > 0)) return 0;
  return 1 + validos.length / logSum;
}

/**
 * Grafo "estrutural" (sem atributos) usado por `calcular_maturidade_rede`:
 * Documento ↔ Autor / Orientador / Palavra-chave / Macrotema. Sem ontologia IA.
 */
function construirGrafoEstrutural(docs: readonly Documento[]): Graph {
  const g = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  const ligar = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    if (!g.hasNode(a)) g.addNode(a);
    if (!g.hasNode(b)) g.addNode(b);
    if (!g.hasEdge(a, b)) g.addEdge(a, b);
  };
  for (const d of docs) {
    const doc = d.titulo;
    if (!doc) continue;
    if (!g.hasNode(doc)) g.addNode(doc);
    for (const a of d.autores) ligar(doc, a);
    if (d.orientador) ligar(doc, d.orientador);
    for (const pk of d.palavras_chave) ligar(doc, pk);
    if (d.macrotema) ligar(doc, d.macrotema);
  }
  return g;
}

/** Transcrição de `calcular_maturidade_rede` (backend.py:1423). */
export function calcularMaturidadeRede(docs: readonly Documento[], sna: SnaGlobal): MaturidadeRede {
  const g = construirGrafoEstrutural(docs);
  const cg = compactar(g);

  // 1. Assortatividade
  let assortatividade = 0;
  try {
    assortatividade = degreeAssortativity(cg);
  } catch {
    assortatividade = 0;
  }

  // 2. Rich-Club: probabilidade de conexão no "clube" dos 20% de maior grau
  let richClub = 0;
  try {
    const rc = richClubCoefficient(cg);
    if (rc.size > 0) {
      const chaves = [...rc.keys()].sort((a, b) => a - b);
      const kMax = chaves[chaves.length - 1];
      const kAlvo = Math.floor(kMax * 0.8);
      const validas = chaves.filter((k) => k >= kAlvo);
      richClub = validas.length > 0 ? rc.get(validas[0])! : rc.get(kMax)!;
    }
  } catch {
    richClub = 0;
  }

  // 3. Expoente Gamma: inclinação da reta log-log da distribuição de graus (k > 1)
  let gamma = 0;
  try {
    const graus: number[] = [];
    for (let i = 0; i < cg.n; i += 1) {
      const d = grauDe(cg, i);
      if (d > 0) graus.push(d);
    }
    const contagem = new Map<number, number>();
    for (const d of graus) contagem.set(d, (contagem.get(d) ?? 0) + 1);

    const logK: number[] = [];
    const logPk: number[] = [];
    for (const [k, c] of contagem) {
      if (k <= 1) continue; // foco na cauda longa
      logK.push(Math.log10(k));
      logPk.push(Math.log10(c / graus.length));
    }
    gamma = logK.length > 1 ? Math.abs(linregress(logK, logPk).slope) : 0;
  } catch {
    gamma = 0;
  }

  // 4. Spearman entre Grau e Betweenness (brokers vs. hubs)
  let spearmanRho = 0;
  try {
    const valores = Object.values(sna);
    spearmanRho = spearman(
      valores.map((v) => v['Grau Absoluto'] ?? 0),
      valores.map((v) => v.Betweenness ?? 0),
    );
  } catch {
    spearmanRho = 0;
  }

  return {
    Assortatividade: Number.isFinite(assortatividade) ? assortatividade : 0,
    Rich_Club: Number.isFinite(richClub) ? richClub : 0,
    Gamma: Number.isFinite(gamma) ? gamma : 0,
    Spearman: Number.isFinite(spearmanRho) ? spearmanRho : 0,
  };
}

/** Transcrição de `calcular_metricas_complexas` (backend.py:1255). */
export function calcularMetricasComplexas(docs: readonly Documento[]): MetricasComplexas | null {
  // O grafo desta métrica não inclui macrotema (fiel ao Python)
  const g = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  const ligar = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    if (!g.hasNode(a)) g.addNode(a);
    if (!g.hasNode(b)) g.addNode(b);
    if (!g.hasEdge(a, b)) g.addEdge(a, b);
  };
  for (const d of docs) {
    const doc = d.titulo;
    if (!doc) continue;
    if (!g.hasNode(doc)) g.addNode(doc);
    for (const a of d.autores) ligar(doc, a);
    if (d.orientador) ligar(doc, d.orientador);
    for (const pk of d.palavras_chave) ligar(doc, pk);
  }

  const cg = compactar(g);
  if (cg.n === 0) return null;

  const densidade = cg.n <= 1 ? 0 : (2 * cg.m) / (cg.n * (cg.n - 1));

  const graus: number[] = [];
  for (let i = 0; i < cg.n; i += 1) graus.push(grauDe(cg, i));

  const eficiencia = globalEfficiency(cg, cg.n > LIMIAR_CLOSENESS_EXATO ? PIVOS_CLOSENESS : null);
  const redundancia = 1 - eficiencia;

  const hist = degreeHistogram(cg);
  const totalHist = hist.reduce((a, b) => a + b, 0);
  let entropia = 0;
  for (const c of hist) {
    if (c <= 0) continue;
    const p = c / totalHist;
    entropia -= p * Math.log2(p);
  }

  const clust = clusteringCoefficient(cg);
  const clustering = mean(Array.from(clust));
  const pr = pagerank(cg);
  const eigen = eigenvectorCentrality(cg);

  // Constraint é O(Σ d²): em redes grandes usa amostra determinística de nós
  const indicesConstraint = cg.n > LIMIAR_CONSTRAINT_EXATO
    ? Array.from({ length: LIMIAR_CONSTRAINT_EXATO }, (_, i) => Math.floor((i * cg.n) / LIMIAR_CONSTRAINT_EXATO))
    : Array.from({ length: cg.n }, (_, i) => i);
  const constraints = [...burtConstraint(cg, indicesConstraint).values()].filter(Number.isFinite);

  return {
    densidade,
    links: {
      media: mean(graus),
      min: Math.min(...graus),
      max: Math.max(...graus),
      std: std(graus),
    },
    eficiencia,
    redundancia,
    entropia,
    clustering,
    pagerank_avg: mean(Array.from(pr)),
    eigen_avg: mean(Array.from(eigen)),
    constraint_avg: mean(constraints),
    n_nos: cg.n,
  };
}
