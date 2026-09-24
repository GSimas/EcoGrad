/**
 * Matemática do Radar de Foresight.
 * Transcrição fiel de backend.py:
 *   _extrair_termos_foresight (121) · classificar_por_percentil (107)
 *   calcular_betweenness_bootstrap (169) · preparar_radar_foresight (460)
 *   validar_foresight_historico (328) · otimizar_parametros_foresight (248)
 *
 * O que monta grafo (bootstrap, backtest e Grid Search) mora em
 * `foresight-grafo`, que só o worker de SNA carrega: este módulo é usado pela
 * página inteira e não pode arrastar o `graphology` para o bundle inicial.
 */
import type {
  BootstrapMap,
  Documento,
  ForesightRow,
  OntologiaIA,
  Quadrante,
  SnaGlobal,
  TipoForesight,
} from '@/types';
import { kmeans, median, quantile, standardScale } from './stats';

/** Contador equivalente a `collections.Counter`. */
export function contar(itens: Iterable<string>): Map<string, number> {
  const c = new Map<string, number>();
  for (const i of itens) c.set(i, (c.get(i) ?? 0) + 1);
  return c;
}

export function somarContadores(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

/** Normaliza `ontologia_ia`, que pode chegar como dict ou string JSON. */
export function parseOntologia(valor: unknown): OntologiaIA | null {
  let onto = valor;
  if (typeof onto === 'string') {
    try {
      onto = JSON.parse(onto);
    } catch {
      return null;
    }
  }
  if (!onto || typeof onto !== 'object' || Array.isArray(onto)) return null;
  const o = onto as Record<string, unknown>;
  const lista = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).map(String) : []);
  return {
    teorias_e_modelos: lista('teorias_e_modelos'),
    ferramentas_e_artefatos: lista('ferramentas_e_artefatos'),
    metodos_e_tecnicas: lista('metodos_e_tecnicas'),
  };
}

/** Transcrição de `_extrair_termos_foresight` (backend.py:121). */
export function extrairTermosForesight(d: Documento, tipo: TipoForesight): string[] {
  if (tipo === 'Palavra-chave') {
    const termos = Array.isArray(d.palavras_chave) ? d.palavras_chave : [];
    return termos.map((t) => String(t).trim()).filter((t) => t.length > 0);
  }

  if (tipo === 'Macrotema') {
    const mt = d.macrotema;
    return mt && String(mt).trim() ? [String(mt).trim()] : [];
  }

  if (tipo === 'Artefatos (Ontologia IA)') {
    const onto = parseOntologia(d.ontologia_ia);
    if (!onto) return [];
    return [...onto.teorias_e_modelos, ...onto.ferramentas_e_artefatos, ...onto.metodos_e_tecnicas]
      .map((x) => String(x).trim())
      .filter((x) => x.length > 0);
  }

  return [];
}

/** Transcrição de `classificar_por_percentil` (backend.py:107). */
export function classificarPorPercentil(mom: number, nov: number, xMid: number, yMid: number): Quadrante {
  if (mom > xMid && nov > yMid) return '↗ Tendência';
  if (mom <= xMid && nov > yMid) return '↖ Sinal Fraco';
  if (mom > xMid && nov <= yMid) return '↘ Mainstream';
  return '↙ Base/Declínio';
}

export const round = (v: number, casas: number): number => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

/**
 * Transcrição de `preparar_radar_foresight` (backend.py:460).
 *
 * Momentum  = ((taxa_recente − taxa_passado) / (taxa_passado + ε)) × log10(total + 1)
 *             com ε = 1 / max(n_docs_passado, 1)   [suavização de Laplace]
 * Novidade  = Betweenness × IDF,  IDF = log10(total_docs / total)
 */
export function prepararRadarForesight(
  docs: readonly Documento[],
  snaGlobal: SnaGlobal = {},
  janelaRecente = 3,
  tipo: TipoForesight = 'Palavra-chave',
  betBootstrap: BootstrapMap | null = null,
): ForesightRow[] {
  if (docs.length === 0) return [];

  const comAno = docs.filter((d) => d.ano !== null && Number.isFinite(d.ano));
  if (comAno.length === 0) return [];

  const totalDocs = comAno.length;
  const anoMaximo = Math.max(...comAno.map((d) => d.ano as number));
  const anoCorte = anoMaximo - janelaRecente;

  const dfPassado = comAno.filter((d) => (d.ano as number) <= anoCorte);
  const dfRecente = comAno.filter((d) => (d.ano as number) > anoCorte);
  if (dfPassado.length === 0 || dfRecente.length === 0) return [];

  const freqs = (subset: readonly Documento[]) =>
    contar(subset.flatMap((d) => extrairTermosForesight(d, tipo)));

  const freqPassado = freqs(dfPassado);
  const freqRecente = freqs(dfRecente);
  const freqTotal = somarContadores(freqPassado, freqRecente);

  const limiteSuperior = Math.max(10, totalDocs * 0.1);
  const nDocsPassado = dfPassado.length;
  const nDocsRecente = dfRecente.length;

  const resultados: ForesightRow[] = [];

  for (const [termo, total] of freqTotal) {
    const recente = freqRecente.get(termo) ?? 0;

    // Filtro anti-ruído: expressão recente mínima e volume total controlado
    if (total < 3 || recente < 2 || total > limiteSuperior) continue;

    const passado = freqPassado.get(termo) ?? 0;

    const taxaRecente = nDocsRecente > 0 ? recente / nDocsRecente : 0;
    const taxaPassado = nDocsPassado > 0 ? passado / nDocsPassado : 0;

    const epsilon = 1 / Math.max(nDocsPassado, 1);
    const momentumRelativo = (taxaRecente - taxaPassado) / (taxaPassado + epsilon);
    const momentum = momentumRelativo * Math.log10(total + 1);

    const tracaoPura = total > 0 ? recente / total : 0;

    const stat = betBootstrap?.[termo];
    const betEstavel = Boolean(stat);
    const betweenness = stat ? stat.median : (snaGlobal[termo]?.Betweenness ?? 0);

    const idf = total > 0 ? Math.log10(totalDocs / total) : 0;
    const novidadeReal = betweenness * idf;

    resultados.push({
      Termo: termo,
      Total: total,
      'Aparições Recentes': recente,
      'Tração (%)': round(tracaoPura * 100, 1),
      'Momentum (Burst)': round(momentum, 4),
      'Novidade (Estrutural * IDF)': round(novidadeReal, 6),
      'Bet. Robusto?': betEstavel,
      'Bet. IQR': stat ? round(stat.p75 - stat.p25, 6) : null,
    });
  }

  return resultados;
}

export interface SegmentacaoResultado {
  linhas: ForesightRow[];
  xMid: number;
  yMid: number;
}

/** Segmentação por percentil fixo (pages/1_Avançado.py:1026). */
export function segmentarPorPercentil(linhas: ForesightRow[], percentil: number): SegmentacaoResultado {
  const xMid = quantile(linhas.map((r) => r['Momentum (Burst)']), percentil);
  const yMid = quantile(linhas.map((r) => r['Novidade (Estrutural * IDF)']), percentil);
  return {
    linhas: linhas.map((r) => ({
      ...r,
      Quadrante: classificarPorPercentil(r['Momentum (Burst)'], r['Novidade (Estrutural * IDF)'], xMid, yMid),
    })),
    xMid,
    yMid,
  };
}

/**
 * Segmentação K-Means adaptativa de 4 clusters (pages/1_Avançado.py:1048).
 * Padroniza (Momentum, Novidade), roda K-Means com seed fixa e mapeia cada
 * cluster ao quadrante semântico comparando as médias com a mediana dos clusters.
 */
export function segmentarPorKMeans(linhas: ForesightRow[]): SegmentacaoResultado {
  if (linhas.length < 4) return segmentarPorPercentil(linhas, 0.65);

  const X = linhas.map((r) => [r['Momentum (Burst)'], r['Novidade (Estrutural * IDF)']]);
  const { labels } = kmeans(standardScale(X), 4, { nInit: 10, seed: 42 });

  const info = Array.from({ length: 4 }, (_, cid) => {
    const pts = linhas.filter((_, i) => labels[i] === cid);
    const momMedio = pts.length ? pts.reduce((a, r) => a + r['Momentum (Burst)'], 0) / pts.length : 0;
    const novMedia = pts.length
      ? pts.reduce((a, r) => a + r['Novidade (Estrutural * IDF)'], 0) / pts.length
      : 0;
    return { id: cid, momMedio, novMedia };
  });

  const momMediano = median(info.map((c) => c.momMedio));
  const novMediana = median(info.map((c) => c.novMedia));

  const mapa = new Map<number, Quadrante>();
  for (const c of info) {
    const altoMom = c.momMedio >= momMediano;
    const altaNov = c.novMedia >= novMediana;
    if (altoMom && altaNov) mapa.set(c.id, '↗ Tendência');
    else if (!altoMom && altaNov) mapa.set(c.id, '↖ Sinal Fraco');
    else if (altoMom && !altaNov) mapa.set(c.id, '↘ Mainstream');
    else mapa.set(c.id, '↙ Base/Declínio');
  }

  return {
    linhas: linhas.map((r, i) => ({ ...r, cluster_id: labels[i], Quadrante: mapa.get(labels[i]) })),
    // As medianas dos centroides aproximam as fronteiras visuais
    xMid: momMediano,
    yMid: novMediana,
  };
}

export const GRID_ANOS_CORTE = [2017, 2018, 2019, 2020];
export const GRID_JANELAS_BURST = [2, 3, 4];
export const GRID_JANELAS_FUTURO = [3, 4, 5];
export const GRID_PERCENTIS = [0.5, 0.65, 0.8];

