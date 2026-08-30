/**
 * Representação compacta (CSR) de um grafo não-dirigido, derivada de um
 * `graphology.Graph`. Os algoritmos de centralidade rodam sobre índices
 * inteiros e arrays tipados — indispensável para redes com >100k nós no browser.
 */
import type Graph from 'graphology';
import { SeededRandom } from './stats';

export interface CompactGraph {
  /** Rótulo de cada nó, na ordem dos índices. */
  labels: string[];
  index: Map<string, number>;
  /** Offsets CSR: vizinhos de `i` ocupam adj[offsets[i] .. offsets[i+1]). */
  offsets: Int32Array;
  adj: Int32Array;
  /** Peso paralelo a `adj` (1 quando o grafo é não-ponderado). */
  pesos: Float64Array;
  n: number;
  m: number;
}

export function compactar(g: Graph, atributoPeso?: string): CompactGraph {
  const labels = g.nodes();
  const n = labels.length;
  const index = new Map<string, number>();
  for (let i = 0; i < n; i += 1) index.set(labels[i], i);

  const graus = new Int32Array(n);
  g.forEachUndirectedEdge((_e, _attrs, source, target) => {
    if (source === target) return; // self-loops não entram nas centralidades
    graus[index.get(source)!] += 1;
    graus[index.get(target)!] += 1;
  });

  const offsets = new Int32Array(n + 1);
  for (let i = 0; i < n; i += 1) offsets[i + 1] = offsets[i] + graus[i];
  const total = offsets[n];

  const adj = new Int32Array(total);
  const pesos = new Float64Array(total);
  const cursor = Int32Array.from(offsets.subarray(0, n));

  g.forEachUndirectedEdge((_e, attrs, source, target) => {
    if (source === target) return;
    const u = index.get(source)!;
    const v = index.get(target)!;
    const w = atributoPeso ? Number((attrs as Record<string, unknown>)[atributoPeso] ?? 1) : 1;
    adj[cursor[u]] = v;
    pesos[cursor[u]] = w;
    cursor[u] += 1;
    adj[cursor[v]] = u;
    pesos[cursor[v]] = w;
    cursor[v] += 1;
  });

  return { labels, index, offsets, adj, pesos, n, m: total / 2 };
}

export function grauDe(cg: CompactGraph, i: number): number {
  return cg.offsets[i + 1] - cg.offsets[i];
}

/** Fila de prioridade binária mínima usada pelo Dijkstra do Brandes ponderado. */
class MinHeap {
  private dist: number[] = [];
  private node: number[] = [];

  get size(): number {
    return this.node.length;
  }

  push(d: number, v: number): void {
    this.dist.push(d);
    this.node.push(v);
    let i = this.node.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.dist[p] <= this.dist[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): [number, number] {
    const topD = this.dist[0];
    const topN = this.node[0];
    const lastD = this.dist.pop()!;
    const lastN = this.node.pop()!;
    if (this.node.length > 0) {
      this.dist[0] = lastD;
      this.node[0] = lastN;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let menor = i;
        if (l < this.node.length && this.dist[l] < this.dist[menor]) menor = l;
        if (r < this.node.length && this.dist[r] < this.dist[menor]) menor = r;
        if (menor === i) break;
        this.swap(i, menor);
        i = menor;
      }
    }
    return [topD, topN];
  }

  private swap(a: number, b: number): void {
    [this.dist[a], this.dist[b]] = [this.dist[b], this.dist[a]];
    [this.node[a], this.node[b]] = [this.node[b], this.node[a]];
  }
}

export interface BetweennessOptions {
  /**
   * Amostragem de pivôs (`k` do `nx.betweenness_centrality`). `null` = exato.
   * O rescale multiplica por `n / k`, exatamente como o NetworkX faz.
   */
  k?: number | null;
  /** Usa Dijkstra tratando o peso da aresta como distância (idem NetworkX). */
  ponderado?: boolean;
  seed?: number;
  normalizado?: boolean;
  onProgress?: (feito: number, total: number) => void;
}

/**
 * Betweenness de Brandes (1998).
 * Paridade com `networkx.betweenness_centrality(G, k=..., weight=..., seed=42)`:
 * fontes amostradas sem reposição, acumulação de dependências e rescale
 * `1 / ((n-1)(n-2))` (grafo não-dirigido conta cada par duas vezes).
 */
export function betweennessCentrality(
  cg: CompactGraph,
  { k = null, ponderado = false, seed = 42, normalizado = true, onProgress }: BetweennessOptions = {},
): Float64Array {
  const { n, offsets, adj, pesos } = cg;
  const bc = new Float64Array(n);
  if (n === 0) return bc;

  let fontes: number[];
  if (k !== null && k < n) {
    const todos = Array.from({ length: n }, (_, i) => i);
    new SeededRandom(seed).shuffle(todos);
    fontes = todos.slice(0, k);
  } else {
    fontes = Array.from({ length: n }, (_, i) => i);
  }

  const sigma = new Float64Array(n);
  const delta = new Float64Array(n);
  const dist = new Float64Array(n);
  const preds: number[][] = Array.from({ length: n }, () => []);
  const pilha = new Int32Array(n);
  const fila = new Int32Array(n);
  const visitado = new Uint8Array(n);

  for (let idxFonte = 0; idxFonte < fontes.length; idxFonte += 1) {
    const s = fontes[idxFonte];
    sigma.fill(0);
    delta.fill(0);
    dist.fill(Infinity);
    for (let i = 0; i < n; i += 1) if (preds[i].length) preds[i] = [];
    let topo = 0;

    sigma[s] = 1;
    dist[s] = 0;

    if (!ponderado) {
      // --- BFS (arestas de peso unitário) ---
      fila[0] = s;
      let tail = 1;
      let cursor = 0;
      while (cursor < tail) {
        const v = fila[cursor];
        cursor += 1;
        pilha[topo] = v;
        topo += 1;
        for (let p = offsets[v]; p < offsets[v + 1]; p += 1) {
          const w = adj[p];
          if (dist[w] === Infinity) {
            dist[w] = dist[v] + 1;
            fila[tail] = w;
            tail += 1;
          }
          if (dist[w] === dist[v] + 1) {
            sigma[w] += sigma[v];
            preds[w].push(v);
          }
        }
      }
    } else {
      // --- Dijkstra (peso da aresta tratado como distância) ---
      visitado.fill(0);
      const heap = new MinHeap();
      heap.push(0, s);
      while (heap.size > 0) {
        const [d, v] = heap.pop();
        if (visitado[v]) continue;
        visitado[v] = 1;
        pilha[topo] = v;
        topo += 1;
        for (let p = offsets[v]; p < offsets[v + 1]; p += 1) {
          const w = adj[p];
          const nd = d + pesos[p];
          if (nd < dist[w]) {
            dist[w] = nd;
            sigma[w] = sigma[v];
            preds[w] = [v];
            heap.push(nd, w);
          } else if (nd === dist[w] && !visitado[w]) {
            sigma[w] += sigma[v];
            preds[w].push(v);
          }
        }
      }
    }

    // --- Acumulação das dependências (ordem inversa de descoberta) ---
    for (let i = topo - 1; i >= 0; i -= 1) {
      const w = pilha[i];
      const coef = (1 + delta[w]) / sigma[w];
      for (const v of preds[w]) delta[v] += sigma[v] * coef;
      if (w !== s) bc[w] += delta[w];
    }

    if (onProgress && idxFonte % 64 === 0) onProgress(idxFonte, fontes.length);
  }

  // --- Rescale idêntico ao `networkx.algorithms.centrality.betweenness._rescale` ---
  let escala: number | null;
  if (normalizado) {
    escala = n <= 2 ? null : 1 / ((n - 1) * (n - 2));
  } else {
    escala = 0.5; // não-dirigido
  }
  if (escala !== null) {
    if (k !== null && k < n) escala *= n / k;
    for (let i = 0; i < n; i += 1) bc[i] *= escala;
  }
  return bc;
}

/**
 * Closeness com a correção Wasserman-Faust (padrão do NetworkX):
 *   C(v) = (|alcançáveis|-1) / Σd  ×  (|alcançáveis|-1)/(n-1)
 *
 * `pivots` ativa a aproximação de Eppstein-Wang: a distância média de cada nó é
 * estimada por BFS a partir de uma amostra de pivôs (válido porque o grafo é
 * não-dirigido, logo d(p,v) = d(v,p)). Sem `pivots`, o cálculo é exato.
 */
export function closenessCentrality(
  cg: CompactGraph,
  { pivots = null, seed = 42, onProgress }: {
    pivots?: number | null;
    seed?: number;
    onProgress?: (feito: number, total: number) => void;
  } = {},
): Float64Array {
  const { n, offsets, adj } = cg;
  const cc = new Float64Array(n);
  if (n <= 1) return cc;

  const dist = new Int32Array(n);
  const fila = new Int32Array(n);

  const bfs = (origem: number): number => {
    dist.fill(-1);
    dist[origem] = 0;
    fila[0] = origem;
    let tail = 1;
    let cursor = 0;
    while (cursor < tail) {
      const v = fila[cursor];
      cursor += 1;
      for (let p = offsets[v]; p < offsets[v + 1]; p += 1) {
        const w = adj[p];
        if (dist[w] === -1) {
          dist[w] = dist[v] + 1;
          fila[tail] = w;
          tail += 1;
        }
      }
    }
    return tail; // nós alcançados (inclui a origem)
  };

  if (pivots === null || pivots >= n) {
    for (let v = 0; v < n; v += 1) {
      const alcancados = bfs(v);
      let soma = 0;
      for (let i = 0; i < n; i += 1) if (dist[i] > 0) soma += dist[i];
      if (soma > 0) cc[v] = ((alcancados - 1) / soma) * ((alcancados - 1) / (n - 1));
      if (onProgress && v % 256 === 0) onProgress(v, n);
    }
    return cc;
  }

  // Aproximação por pivôs
  const todos = Array.from({ length: n }, (_, i) => i);
  new SeededRandom(seed).shuffle(todos);
  const amostra = todos.slice(0, pivots);

  const somaDist = new Float64Array(n);
  const contatos = new Int32Array(n);
  for (let i = 0; i < amostra.length; i += 1) {
    bfs(amostra[i]);
    for (let v = 0; v < n; v += 1) {
      if (dist[v] >= 0) {
        somaDist[v] += dist[v];
        contatos[v] += 1;
      }
    }
    if (onProgress) onProgress(i, amostra.length);
  }

  for (let v = 0; v < n; v += 1) {
    if (contatos[v] <= 1 || somaDist[v] <= 0) continue;
    // Distância média estimada → extrapolada para o componente inteiro
    const distMedia = somaDist[v] / (contatos[v] - 1);
    const fracaoAlcancada = contatos[v] / amostra.length;
    const alcancaveis = Math.max(1, Math.round(fracaoAlcancada * n));
    const somaEstimada = distMedia * (alcancaveis - 1);
    if (somaEstimada > 0) {
      cc[v] = ((alcancaveis - 1) / somaEstimada) * ((alcancaveis - 1) / (n - 1));
    }
  }
  return cc;
}

/**
 * Coeficiente de clustering local (`nx.clustering`).
 *
 * Triângulos contados por aresta com interseção do menor conjunto de vizinhos —
 * O(Σ min(d(u), d(v))), viável mesmo com hubs de grau muito alto (a varredura
 * por pares do NetworkX seria O(Σ d²)).
 *
 * Com `atributoPeso`, aplica a versão ponderada de Onnela et al. usada pelo
 * `nx.clustering(G, weight=...)`: cada triângulo contribui com a média
 * geométrica dos três pesos, normalizados pelo maior peso do grafo.
 */
export function clusteringCoefficient(
  cg: CompactGraph,
  { atributoPeso }: { atributoPeso?: string } = {},
): Float64Array {
  const { n, offsets, adj, pesos } = cg;
  const tri = new Float64Array(n);
  const ponderado = Boolean(atributoPeso);

  let pesoMaximo = 1;
  if (ponderado) {
    for (let p = 0; p < pesos.length; p += 1) if (pesos[p] > pesoMaximo) pesoMaximo = pesos[p];
  }

  // Vizinhança como mapa vizinho → peso normalizado (peso 1 no caso não-ponderado)
  const vizinhos: Array<Map<number, number>> = new Array(n);
  for (let v = 0; v < n; v += 1) {
    const m = new Map<number, number>();
    for (let p = offsets[v]; p < offsets[v + 1]; p += 1) {
      m.set(adj[p], ponderado ? pesos[p] / pesoMaximo : 1);
    }
    vizinhos[v] = m;
  }

  for (let u = 0; u < n; u += 1) {
    for (let p = offsets[u]; p < offsets[u + 1]; p += 1) {
      const v = adj[p];
      if (v <= u) continue;
      const [menor, maior] =
        vizinhos[u].size <= vizinhos[v].size ? [vizinhos[u], vizinhos[v]] : [vizinhos[v], vizinhos[u]];
      for (const [w, pesoMenor] of menor) {
        if (w <= v) continue;
        const pesoMaior = maior.get(w);
        if (pesoMaior === undefined) continue;
        // Média geométrica dos três lados; vale 1 quando não-ponderado
        const contrib = ponderado ? Math.cbrt(vizinhos[u].get(v)! * pesoMenor * pesoMaior) : 1;
        tri[u] += contrib;
        tri[v] += contrib;
        tri[w] += contrib;
      }
    }
  }

  const cc = new Float64Array(n);
  for (let v = 0; v < n; v += 1) {
    const d = vizinhos[v].size;
    cc[v] = d < 2 ? 0 : (2 * tri[v]) / (d * (d - 1));
  }
  return cc;
}

/** Degree centrality: grau / (n - 1) — `nx.degree_centrality`. */
export function degreeCentrality(cg: CompactGraph): Float64Array {
  const { n } = cg;
  const dc = new Float64Array(n);
  if (n <= 1) return dc;
  for (let i = 0; i < n; i += 1) dc[i] = grauDe(cg, i) / (n - 1);
  return dc;
}

/** PageRank por iteração de potência — `nx.pagerank` (alpha=0.85). */
export function pagerank(cg: CompactGraph, alpha = 0.85, maxIter = 100, tol = 1e-6): Float64Array {
  const { n, offsets, adj } = cg;
  let x = new Float64Array(n).fill(n === 0 ? 0 : 1 / n);
  const graus = new Float64Array(n);
  for (let i = 0; i < n; i += 1) graus[i] = grauDe(cg, i);

  for (let it = 0; it < maxIter; it += 1) {
    const prox = new Float64Array(n);
    let massaPendente = 0;
    for (let v = 0; v < n; v += 1) {
      if (graus[v] === 0) {
        massaPendente += x[v];
        continue;
      }
      const share = (alpha * x[v]) / graus[v];
      for (let p = offsets[v]; p < offsets[v + 1]; p += 1) prox[adj[p]] += share;
    }
    const base = (1 - alpha) / n + (alpha * massaPendente) / n;
    let erro = 0;
    for (let v = 0; v < n; v += 1) {
      prox[v] += base;
      erro += Math.abs(prox[v] - x[v]);
    }
    x = prox;
    if (erro < n * tol) break;
  }
  return x;
}

/**
 * Centralidade de autovetor — `nx.eigenvector_centrality`.
 *
 * O NetworkX itera `x_novo = x + A·x` (não `A·x` puro): parte de uma cópia do
 * vetor anterior e só então acumula os vizinhos. Esse deslocamento por `I` é o
 * que faz o método convergir em grafos bipartidos como este (onde `A` tem
 * autovalores ±λ empatados em módulo). Início em 1/n (normalizado em L1),
 * normalização L2 a cada passo e parada por `Σ|x - x_anterior| < n·tol`.
 */
export function eigenvectorCentrality(cg: CompactGraph, maxIter = 1000, tol = 1e-6): Float64Array {
  const { n, offsets, adj } = cg;
  if (n === 0) return new Float64Array(0);
  let x = new Float64Array(n).fill(1 / n);

  for (let it = 0; it < maxIter; it += 1) {
    const anterior = x;
    const prox = Float64Array.from(anterior);
    for (let v = 0; v < n; v += 1) {
      const xv = anterior[v];
      if (xv === 0) continue;
      for (let p = offsets[v]; p < offsets[v + 1]; p += 1) prox[adj[p]] += xv;
    }

    let norma = 0;
    for (let v = 0; v < n; v += 1) norma += prox[v] * prox[v];
    norma = Math.sqrt(norma) || 1;

    let erro = 0;
    for (let v = 0; v < n; v += 1) {
      prox[v] /= norma;
      erro += Math.abs(prox[v] - anterior[v]);
    }
    x = prox;
    if (erro < n * tol) break;
  }
  return x;
}

/**
 * Constraint de Burt (`nx.constraint`) para um subconjunto de nós.
 * Como o custo é O(Σ d²), redes grandes usam uma amostra de nós (a função
 * devolve apenas os índices calculados, e quem chama tira a média).
 */
export function burtConstraint(cg: CompactGraph, indices: readonly number[]): Map<number, number> {
  const { offsets, adj } = cg;
  const resultado = new Map<number, number>();

  const proporcao = (i: number, j: number): number => {
    // p_ij = (a_ij + a_ji) / Σ_q (a_iq + a_qi); grafo não-ponderado e simétrico
    const grau = offsets[i + 1] - offsets[i];
    if (grau === 0) return 0;
    for (let p = offsets[i]; p < offsets[i + 1]; p += 1) {
      if (adj[p] === j) return 1 / grau;
    }
    return 0;
  };

  for (const v of indices) {
    const viz: number[] = [];
    for (let p = offsets[v]; p < offsets[v + 1]; p += 1) viz.push(adj[p]);
    if (viz.length === 0) {
      resultado.set(v, NaN);
      continue;
    }
    let total = 0;
    for (const j of viz) {
      let indireto = 0;
      for (const q of viz) {
        if (q === j || q === v) continue;
        indireto += proporcao(v, q) * proporcao(q, j);
      }
      total += (proporcao(v, j) + indireto) ** 2;
    }
    resultado.set(v, total);
  }
  return resultado;
}

/**
 * Eficiência global (`nx.global_efficiency`): média de 1/d(u,v) sobre pares
 * ordenados distintos. `pivots` amostra as origens quando a rede é grande.
 */
export function globalEfficiency(cg: CompactGraph, pivots: number | null = null, seed = 42): number {
  const { n, offsets, adj } = cg;
  if (n < 2) return 0;

  let origens: number[];
  if (pivots !== null && pivots < n) {
    const todos = Array.from({ length: n }, (_, i) => i);
    new SeededRandom(seed).shuffle(todos);
    origens = todos.slice(0, pivots);
  } else {
    origens = Array.from({ length: n }, (_, i) => i);
  }

  const dist = new Int32Array(n);
  const fila = new Int32Array(n);
  let soma = 0;

  for (const origem of origens) {
    dist.fill(-1);
    dist[origem] = 0;
    fila[0] = origem;
    let tail = 1;
    let cursor = 0;
    while (cursor < tail) {
      const v = fila[cursor];
      cursor += 1;
      for (let p = offsets[v]; p < offsets[v + 1]; p += 1) {
        const w = adj[p];
        if (dist[w] === -1) {
          dist[w] = dist[v] + 1;
          fila[tail] = w;
          tail += 1;
        }
      }
    }
    for (let i = 0; i < n; i += 1) if (dist[i] > 0) soma += 1 / dist[i];
  }

  return soma / (origens.length * (n - 1));
}

/** Histograma de graus — `nx.degree_histogram`. */
export function degreeHistogram(cg: CompactGraph): number[] {
  const { n } = cg;
  let maxGrau = 0;
  const graus = new Int32Array(n);
  for (let i = 0; i < n; i += 1) {
    graus[i] = grauDe(cg, i);
    if (graus[i] > maxGrau) maxGrau = graus[i];
  }
  const hist = new Array<number>(maxGrau + 1).fill(0);
  for (let i = 0; i < n; i += 1) hist[graus[i]] += 1;
  return hist;
}

/**
 * Rich-club não normalizado — `nx.rich_club_coefficient(G, normalized=False)`.
 * Reproduz a varredura por grau do `_compute_rc` do NetworkX.
 */
export function richClubCoefficient(cg: CompactGraph): Map<number, number> {
  const { n, offsets, adj } = cg;
  const rc = new Map<number, number>();
  if (n === 0) return rc;

  const graus = new Int32Array(n);
  for (let i = 0; i < n; i += 1) graus[i] = grauDe(cg, i);

  const hist = degreeHistogram(cg);
  const total = n;
  const nks: number[] = [];
  let acumulado = 0;
  for (const c of hist) {
    acumulado += c;
    const restante = total - acumulado;
    if (restante > 1) nks.push(restante);
    else break;
  }
  if (nks.length === 0) return rc;

  // Pares [menor grau, maior grau] das pontas de cada aresta, em ordem
  // lexicográfica crescente. A ordem por MENOR grau é o que torna a varredura
  // abaixo correta: em cada passo `d`, ela retira exatamente as arestas com
  // alguma ponta de grau ≤ d, deixando em `ek` só as arestas internas ao clube.
  // Ordenar pelo maior grau deixaria arestas de fora e o coeficiente estouraria 1.
  const arestas: Array<[number, number]> = [];
  for (let u = 0; u < n; u += 1) {
    for (let p = offsets[u]; p < offsets[u + 1]; p += 1) {
      const v = adj[p];
      if (v <= u) continue;
      const a = Math.min(graus[u], graus[v]);
      const b = Math.max(graus[u], graus[v]);
      arestas.push([a, b]);
    }
  }
  arestas.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

  let ek = arestas.length;
  let cursor = 0;
  let k1 = arestas.length > 0 ? arestas[0][0] : Infinity;

  for (let d = 0; d < nks.length; d += 1) {
    while (k1 <= d) {
      cursor += 1;
      if (cursor >= arestas.length) {
        ek = 0;
        k1 = Infinity;
        break;
      }
      ek -= 1;
      k1 = arestas[cursor][0];
    }
    const nk = nks[d];
    rc.set(d, (2 * ek) / (nk * (nk - 1)));
  }
  return rc;
}

/** Assortatividade de grau — Pearson dos graus nas pontas de cada aresta. */
export function degreeAssortativity(cg: CompactGraph): number {
  const { n, offsets, adj } = cg;
  const graus = new Int32Array(n);
  for (let i = 0; i < n; i += 1) graus[i] = grauDe(cg, i);

  // Cada aresta entra nas duas orientações, como na matriz de mistura do NetworkX
  let soma1 = 0;
  let soma2 = 0;
  let soma3 = 0;
  let m = 0;
  for (let u = 0; u < n; u += 1) {
    for (let p = offsets[u]; p < offsets[u + 1]; p += 1) {
      const v = adj[p];
      const du = graus[u];
      const dv = graus[v];
      soma1 += du * dv;
      soma2 += du + dv;
      soma3 += du * du + dv * dv;
      m += 1;
    }
  }
  if (m === 0) return 0;
  const media = soma2 / (2 * m);
  const num = soma1 / m - media * media;
  const den = soma3 / (2 * m) - media * media;
  return den === 0 ? 0 : num / den;
}
