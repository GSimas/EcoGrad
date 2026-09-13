/**
 * Matemática do Radar de Foresight.
 * Transcrição fiel de backend.py:
 *   _extrair_termos_foresight (121) · classificar_por_percentil (107)
 *   calcular_betweenness_bootstrap (169) · preparar_radar_foresight (460)
 *   validar_foresight_historico (328) · otimizar_parametros_foresight (248)
 */
import Graph from 'graphology';
import type {
  BacktestRow,
  BootstrapMap,
  Documento,
  ForesightRow,
  GridSearchRow,
  OntologiaIA,
  Quadrante,
  SnaGlobal,
  TipoForesight,
} from '@/types';
import { betweennessCentrality, compactar } from './graph-core';
import { kmeans, median, quantile, SeededRandom, standardScale, std } from './stats';

/** Contador equivalente a `collections.Counter`. */
export function contar(itens: Iterable<string>): Map<string, number> {
  const c = new Map<string, number>();
  for (const i of itens) c.set(i, (c.get(i) ?? 0) + 1);
  return c;
}

function somarContadores(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
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

/** Grafo de coocorrência de termos: aresta por par, peso = nº de coocorrências. */
function construirGrafoCoocorrencia(docs: readonly Documento[], tipo: TipoForesight): Graph {
  const g = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  for (const d of docs) {
    const termos = extrairTermosForesight(d, tipo);
    for (let i = 0; i < termos.length; i += 1) {
      for (let j = i + 1; j < termos.length; j += 1) {
        const u = termos[i];
        const v = termos[j];
        if (u === v) continue;
        if (!g.hasNode(u)) g.addNode(u);
        if (!g.hasNode(v)) g.addNode(v);
        if (g.hasEdge(u, v)) {
          g.updateEdgeAttribute(u, v, 'weight', (w) => (Number(w) || 0) + 1);
        } else {
          g.addEdge(u, v, { weight: 1 });
        }
      }
    }
  }
  return g;
}

/**
 * Transcrição de `calcular_betweenness_bootstrap` (backend.py:169).
 * 100 reamostragens com reposição (85% da base), betweenness aproximado
 * (k = min(50, |V|), peso como distância, seed 42) e consolidação por mediana.
 * Termos presentes em menos de 5 reamostragens são descartados (instáveis).
 */
export function calcularBetweennessBootstrap(
  docs: readonly Documento[],
  tipo: TipoForesight = 'Palavra-chave',
  nBootstrap = 100,
  fracaoAmostra = 0.85,
  onProgress?: (feito: number, total: number) => void,
): BootstrapMap {
  if (docs.length === 0) return {};

  const nDocs = docs.length;
  const tamanhoAmostra = Math.max(10, Math.floor(nDocs * fracaoAmostra));
  const acumulador = new Map<string, number[]>();
  const rng = new SeededRandom(42);

  for (let it = 0; it < nBootstrap; it += 1) {
    const amostra: Documento[] = new Array(tamanhoAmostra);
    for (let i = 0; i < tamanhoAmostra; i += 1) amostra[i] = docs[rng.randrange(nDocs)];

    const g = construirGrafoCoocorrencia(amostra, tipo);
    if (g.order === 0) continue;

    const cg = compactar(g, 'weight');
    const kSamples = Math.min(50, cg.n);
    const bet = betweennessCentrality(cg, { k: kSamples, ponderado: true, seed: 42 });

    for (let i = 0; i < cg.n; i += 1) {
      const termo = cg.labels[i];
      const lista = acumulador.get(termo);
      if (lista) lista.push(bet[i]);
      else acumulador.set(termo, [bet[i]]);
    }

    onProgress?.(it + 1, nBootstrap);
  }

  const resultado: BootstrapMap = {};
  for (const [termo, valores] of acumulador) {
    if (valores.length < 5) continue;
    resultado[termo] = {
      median: median(valores),
      p25: quantile(valores, 0.25),
      p75: quantile(valores, 0.75),
      std: std(valores),
      n_obs: valores.length,
    };
  }
  return resultado;
}

const round = (v: number, casas: number): number => {
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

/**
 * Transcrição de `validar_foresight_historico` (backend.py:328).
 * Treina o modelo até `anoCorteTeste` (T1) e confere o que aconteceu na
 * janela futura (T2), devolvendo o veredito por termo.
 */
export function validarForesightHistorico(
  docs: readonly Documento[],
  anoCorteTeste = 2018,
  janelaBurst = 3,
  janelaFuturo = 4,
  percentilCorte = 0.65,
  tipo: TipoForesight = 'Palavra-chave',
  /**
   * Pivôs do betweenness. `'auto'` reproduz o Python (`k = min(100, |V|)`),
   * que mantém o Grid Search ágil ao custo de ser estocástico. `null` força o
   * cálculo exato — usado pelo harness de paridade, onde a amostragem tornaria
   * a comparação com o NetworkX impossível (RNGs distintos).
   */
  kBetweenness: number | null | 'auto' = 'auto',
): BacktestRow[] {
  const comAno = docs.filter((d) => d.ano !== null && Number.isFinite(d.ano));
  if (comAno.length === 0) return [];

  const dfT1 = comAno.filter((d) => (d.ano as number) <= anoCorteTeste);
  const dfT1Passado = dfT1.filter((d) => (d.ano as number) <= anoCorteTeste - janelaBurst);
  const dfT1Recente = dfT1.filter((d) => (d.ano as number) > anoCorteTeste - janelaBurst);
  const dfT2 = comAno.filter(
    (d) => (d.ano as number) > anoCorteTeste && (d.ano as number) <= anoCorteTeste + janelaFuturo,
  );

  if (dfT1Passado.length === 0 || dfT1Recente.length === 0 || dfT2.length === 0) return [];

  const freqs = (subset: readonly Documento[]) =>
    contar(subset.flatMap((d) => extrairTermosForesight(d, tipo)));

  const freqT1Pass = freqs(dfT1Passado);
  const freqT1Rec = freqs(dfT1Recente);
  const freqT1Total = somarContadores(freqT1Pass, freqT1Rec);
  const freqT2 = freqs(dfT2);

  const gT1 = construirGrafoCoocorrencia(dfT1, tipo);
  const cgT1 = compactar(gT1, 'weight');
  // k = 100 para manter o Grid Search ágil sem perder fidelidade de ranking
  const kSamples = kBetweenness === 'auto'
    ? (cgT1.n > 0 ? Math.min(100, cgT1.n) : null)
    : kBetweenness;
  const betArr = betweennessCentrality(cgT1, { k: kSamples, ponderado: true, seed: 42 });
  const betT1 = new Map<string, number>();
  for (let i = 0; i < cgT1.n; i += 1) betT1.set(cgT1.labels[i], betArr[i]);

  const totalDocsT1 = dfT1.length;
  const limiteSup = Math.max(10, totalDocsT1 * 0.1);
  const maxIdf = totalDocsT1 > 1 ? Math.log10(totalDocsT1) : 1;
  const nDocsPassT1 = dfT1Passado.length;
  const nDocsRecT1 = dfT1Recente.length;

  interface LinhaT1 {
    Termo: string;
    Momentum: number;
    Novidade: number;
    VolT1: number;
  }
  const resultadosT1: LinhaT1[] = [];

  for (const [termo, totalT1] of freqT1Total) {
    const recT1 = freqT1Rec.get(termo) ?? 0;
    if (totalT1 < 3 || recT1 < 1 || totalT1 > limiteSup) continue;

    const taxaRecT1 = nDocsRecT1 > 0 ? recT1 / nDocsRecT1 : 0;
    const taxaPassT1 = nDocsPassT1 > 0 ? (freqT1Pass.get(termo) ?? 0) / nDocsPassT1 : 0;
    const epsilonT1 = 1 / Math.max(nDocsPassT1, 1);
    const momentumRelT1 = (taxaRecT1 - taxaPassT1) / (taxaPassT1 + epsilonT1);
    const momentumT1 = momentumRelT1 * Math.log10(totalT1 + 1);

    const bet = betT1.get(termo) ?? 0;
    const idf = totalT1 > 0 ? Math.log10(totalDocsT1 / totalT1) : 0;
    const novidadeT1 = bet * (idf / maxIdf); // IDF normalizado [0,1]

    resultadosT1.push({ Termo: termo, Momentum: momentumT1, Novidade: novidadeT1, VolT1: totalT1 });
  }

  if (resultadosT1.length === 0) return [];

  const limiarMom = quantile(resultadosT1.map((r) => r.Momentum), percentilCorte);
  const limiarNov = quantile(resultadosT1.map((r) => r.Novidade), percentilCorte);

  const totalDocsT2 = dfT2.length;
  const analiseFinal: BacktestRow[] = [];

  for (const row of resultadosT1) {
    const quad = classificarPorPercentil(row.Momentum, row.Novidade, limiarMom, limiarNov);
    const volT2 = freqT2.get(row.Termo) ?? 0;

    const taxaT1 = (row.VolT1 / totalDocsT1) * 100;
    const taxaT2 = totalDocsT2 > 0 ? (volT2 / totalDocsT2) * 100 : 0;
    const crescimentoReal = taxaT1 > 0 ? ((taxaT2 - taxaT1) / taxaT1) * 100 : 0;

    let status = '';
    if (quad === '↖ Sinal Fraco') {
      status = crescimentoReal >= 25 && volT2 >= 3
        ? '✓ Sucesso (Emergiu/Explodiu)'
        : '✗ Falso Positivo (Ruído)';
    } else if (quad === '↗ Tendência') {
      status = crescimentoReal >= 10 && volT2 >= 3
        ? '✓ Confirmado (Continuou Fogo)'
        : '✗ Falso Positivo (Esfriou)';
    } else if (quad === '↙ Base/Declínio') {
      status = crescimentoReal <= 0 || volT2 < 3
        ? '✓ Confirmado (Caiu/Morreu)'
        : '✗ Falso Negativo (Ressurgiu)';
    } else {
      status = crescimentoReal <= 5
        ? '✓ Confirmado (Platô/Caiu)'
        : '✗ Falso Negativo (Voltou a Crescer)';
    }

    analiseFinal.push({
      Termo: row.Termo,
      'Previsão Passada (T1)': quad,
      'Vol. T1': row.VolT1,
      'Vol. T2 (Futuro)': volT2,
      'Variação Real Uso (%)': round(crescimentoReal, 1),
      'Veredito do Modelo': status,
    });
  }

  return analiseFinal.sort((a, b) => b['Variação Real Uso (%)'] - a['Variação Real Uso (%)']);
}

export const GRID_ANOS_CORTE = [2017, 2018, 2019, 2020];
export const GRID_JANELAS_BURST = [2, 3, 4];
export const GRID_JANELAS_FUTURO = [3, 4, 5];
export const GRID_PERCENTIS = [0.5, 0.65, 0.8];

/**
 * Transcrição de `otimizar_parametros_foresight` (backend.py:248).
 * Varre 108 combinações e ranqueia por MCC (coeficiente de Matthews), que é
 * robusto a classes desbalanceadas. Combinações degeneradas (denominador 0 ou
 * sem predições positivas) são descartadas, como no original.
 */
export function otimizarParametrosForesight(
  docs: readonly Documento[],
  tipo: TipoForesight = 'Palavra-chave',
  onProgress?: (feito: number, total: number) => void,
): GridSearchRow[] {
  const combinacoes: Array<[number, number, number, number]> = [];
  for (const ano of GRID_ANOS_CORTE) {
    for (const jb of GRID_JANELAS_BURST) {
      for (const jf of GRID_JANELAS_FUTURO) {
        for (const pc of GRID_PERCENTIS) combinacoes.push([ano, jb, jf, pc]);
      }
    }
  }

  const resultados: GridSearchRow[] = [];

  combinacoes.forEach(([anoCorte, jBurst, jFuturo, pCorte], idx) => {
    const dfBt = validarForesightHistorico(docs, anoCorte, jBurst, jFuturo, pCorte, tipo);
    onProgress?.(idx + 1, combinacoes.length);
    if (dfBt.length === 0) return;

    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    for (const row of dfBt) {
      const prev = row['Previsão Passada (T1)'];
      const ver = row['Veredito do Modelo'];
      const predicaoPositiva = prev.includes('Sinal Fraco') || prev.includes('Tendência');
      if (predicaoPositiva) {
        if (ver.includes('✓')) tp += 1;
        else fp += 1;
      } else if (ver.includes('✓')) tn += 1;
      else fn += 1;
    }

    const numerador = tp * tn - fp * fn;
    const denominador = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    // Impede a entrada silenciosa de modelos colapsados (divisão por zero)
    if (denominador === 0) return;
    if (tp + fp === 0) return;

    const mcc = numerador / denominador;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

    resultados.push({
      'Ano Corte': anoCorte,
      'Passado (Burst)': jBurst,
      'Futuro (Previsão)': jFuturo,
      'Corte (%)': Math.round(pCorte * 100),
      'MCC (Robusto)': round(mcc, 3),
      'F1-Score': round(f1, 3),
      Precisão: round(precision, 3),
      Recall: round(recall, 3),
      'N Total': tp + fp + tn + fn,
      'Verdadeiros (+)': tp,
      'Falsos (+)': fp,
      'Verdadeiros (-)': tn,
      'Falsos (-)': fn,
    });
  });

  return resultados.sort((a, b) => b['MCC (Robusto)'] - a['MCC (Robusto)']);
}
