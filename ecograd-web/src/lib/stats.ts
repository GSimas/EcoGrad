/**
 * Primitivas estatísticas equivalentes às usadas pelo backend Python
 * (numpy / pandas / scipy.stats / sklearn), transcritas para TypeScript.
 */

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Desvio-padrão populacional — equivalente a `numpy.std` (ddof=0). */
export function std(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / xs.length);
}

/**
 * Quantil com interpolação linear — equivalente a `pandas.Series.quantile(q)`
 * e a `numpy.percentile(a, q*100)` com o método padrão.
 */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5);
}

/** Ranks médios para empates — base do coeficiente de Spearman. */
function rankdata(xs: readonly number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(xs.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j += 1;
    // Rank médio (1-based) do bloco de empates
    const rankMedio = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[idx[k].i] = rankMedio;
    i = j + 1;
  }
  return ranks;
}

export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/** Equivalente a `scipy.stats.spearmanr(x, y)[0]`. */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  return pearson(rankdata(xs.slice(0, n)), rankdata(ys.slice(0, n)));
}

export interface LinRegress {
  slope: number;
  intercept: number;
  rvalue: number;
}

/** Equivalente a `scipy.stats.linregress(x, y)` (apenas os campos usados). */
export function linregress(xs: readonly number[], ys: readonly number[]): LinRegress {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: 0, rvalue: 0 };
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { slope, intercept: my - slope * mx, rvalue: pearson(xs.slice(0, n), ys.slice(0, n)) };
}

/**
 * Gerador congruente linear determinístico.
 * Substitui `random.Random(42)` / `seed=42` do NetworkX para garantir que o
 * bootstrap e a amostragem de pivôs sejam reprodutíveis entre execuções.
 */
export class SeededRandom {
  private state: number;

  constructor(seed = 42) {
    // Evita estado 0, que travaria o LCG
    this.state = (seed >>> 0) || 0x2545f491;
  }

  /** Float uniforme em [0, 1). */
  next(): number {
    // Numerical Recipes LCG (32 bits)
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /** Inteiro uniforme em [0, n) — equivalente a `random.randrange(n)`. */
  randrange(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Embaralhamento Fisher-Yates in-place. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = this.randrange(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export interface KMeansResult {
  labels: number[];
  centroids: number[][];
  inertia: number;
}

/**
 * K-Means (Lloyd) com inicialização k-means++ e múltiplos restarts.
 * Equivalente funcional a `sklearn.cluster.KMeans(n_clusters, random_state=42, n_init=10)`
 * usado no Radar (pages/1_Avançado.py:1058).
 */
export function kmeans(
  data: readonly number[][],
  k: number,
  { nInit = 10, maxIter = 300, seed = 42, tol = 1e-4 } = {},
): KMeansResult {
  const n = data.length;
  const dim = data[0]?.length ?? 0;
  if (n === 0 || dim === 0) return { labels: [], centroids: [], inertia: 0 };
  const kEff = Math.min(k, n);

  const rng = new SeededRandom(seed);
  const dist2 = (a: readonly number[], b: readonly number[]) => {
    let s = 0;
    for (let i = 0; i < dim; i += 1) s += (a[i] - b[i]) ** 2;
    return s;
  };

  let best: KMeansResult = { labels: [], centroids: [], inertia: Infinity };

  for (let init = 0; init < nInit; init += 1) {
    // --- k-means++ ---
    const centroids: number[][] = [[...data[rng.randrange(n)]]];
    while (centroids.length < kEff) {
      const d = data.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
      const total = d.reduce((a, b) => a + b, 0);
      let alvo = rng.next() * total;
      let escolhido = n - 1;
      for (let i = 0; i < n; i += 1) {
        alvo -= d[i];
        if (alvo <= 0) {
          escolhido = i;
          break;
        }
      }
      centroids.push([...data[escolhido]]);
    }

    // --- Lloyd ---
    const labels = new Array<number>(n).fill(0);
    let inertia = 0;
    for (let iter = 0; iter < maxIter; iter += 1) {
      inertia = 0;
      for (let i = 0; i < n; i += 1) {
        let melhor = 0;
        let melhorD = Infinity;
        for (let c = 0; c < centroids.length; c += 1) {
          const dd = dist2(data[i], centroids[c]);
          if (dd < melhorD) {
            melhorD = dd;
            melhor = c;
          }
        }
        labels[i] = melhor;
        inertia += melhorD;
      }

      const somas = Array.from({ length: centroids.length }, () => new Array<number>(dim).fill(0));
      const contagens = new Array<number>(centroids.length).fill(0);
      for (let i = 0; i < n; i += 1) {
        contagens[labels[i]] += 1;
        for (let j = 0; j < dim; j += 1) somas[labels[i]][j] += data[i][j];
      }

      let deslocamento = 0;
      for (let c = 0; c < centroids.length; c += 1) {
        if (contagens[c] === 0) continue;
        for (let j = 0; j < dim; j += 1) {
          const novo = somas[c][j] / contagens[c];
          deslocamento += (novo - centroids[c][j]) ** 2;
          centroids[c][j] = novo;
        }
      }
      if (deslocamento <= tol) break;
    }

    if (inertia < best.inertia) {
      best = { labels: [...labels], centroids: centroids.map((c) => [...c]), inertia };
    }
  }

  return best;
}

/** Equivalente a `sklearn.preprocessing.StandardScaler().fit_transform(X)`. */
export function standardScale(data: readonly number[][]): number[][] {
  const n = data.length;
  const dim = data[0]?.length ?? 0;
  if (n === 0) return [];
  const medias = new Array<number>(dim).fill(0);
  const desvios = new Array<number>(dim).fill(0);
  for (let j = 0; j < dim; j += 1) {
    const coluna = data.map((r) => r[j]);
    medias[j] = mean(coluna);
    const s = std(coluna);
    desvios[j] = s === 0 ? 1 : s; // StandardScaler trata variância nula como 1
  }
  return data.map((r) => r.map((v, j) => (v - medias[j]) / desvios[j]));
}
