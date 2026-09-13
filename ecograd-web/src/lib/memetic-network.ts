/**
 * Ecologia Memética (SNA) — rede de coocorrência de memes.
 * Transcrição de `gerar_grafo_ecologia_memes_agraph` (backend.py:584).
 *
 * Diferente do grafo global (Documento ↔ entidade), aqui os próprios memes são
 * os nós e uma aresta liga dois memes que apareceram no mesmo documento; o peso
 * é o número de coocorrências.
 */
import Graph from 'graphology';
import type { Documento, GraphLink, GraphNode } from '@/types';
import { removerAcentos, STOPWORDS_NORMALIZADAS } from './stopwords';
import { parseOntologia } from './foresight-math';
import { estimarGammaLeiPotencia, LIMIAR_BETWEENNESS_EXATO, LIMIAR_CLOSENESS_EXATO, PIVOS_CLOSENESS } from './sna-engine';
import {
  betweennessCentrality,
  closenessCentrality,
  clusteringCoefficient,
  compactar,
  degreeAssortativity,
  degreeCentrality,
  eigenvectorCentrality,
  globalEfficiency,
  grauDe,
  burtConstraint,
  pagerank,
  richClubCoefficient,
} from './graph-core';
import { mean, spearman, std } from './stats';
import type { FonteMemes } from './memetics';

/**
 * Equivalente a `str.title()` do Python: a primeira letra de cada sequência de
 * letras vira maiúscula e o resto minúscula (inclusive após apóstrofos, como no
 * original — a chave de agrupamento precisa bater exatamente).
 */
export function tituloPython(texto: string): string {
  let anteriorEhLetra = false;
  let saida = '';
  for (const c of texto) {
    const ehLetra = /\p{L}/u.test(c);
    saida += ehLetra && !anteriorEhLetra ? c.toUpperCase() : c.toLowerCase();
    anteriorEhLetra = ehLetra;
  }
  return saida;
}

/** Memes de um documento, conforme a fonte escolhida. */
export function memesDoDocumento(d: Documento, fonte: FonteMemes): string[] {
  if (fonte === 'Artefatos Extraídos') {
    const onto = parseOntologia(d.ontologia_ia);
    if (!onto) return [];
    const limpar = (lista: string[]) =>
      lista.map((x) => tituloPython(String(x).trim())).filter((x) => x.length > 0);
    return [
      ...new Set([
        ...limpar(onto.teorias_e_modelos),
        ...limpar(onto.ferramentas_e_artefatos),
        ...limpar(onto.metodos_e_tecnicas),
      ]),
    ];
  }

  // Tradicional: palavras-chave + tokens do título sem stopwords
  const memes = new Set<string>();
  for (const p of d.palavras_chave) {
    const v = tituloPython(String(p).trim());
    if (v) memes.add(v);
  }
  const tituloNorm = removerAcentos(String(d.titulo ?? '').toLowerCase());
  for (const p of tituloNorm.match(/\b[a-z]{3,}\b/g) ?? []) {
    if (!STOPWORDS_NORMALIZADAS.has(p)) memes.add(tituloPython(p));
  }
  return [...memes];
}

export interface MetricasRedeMemetica {
  densidade: number;
  eficiencia: number;
  clustering: number;
  entropia: number;
  links_mean: number;
  links_std: number;
  links_min: number;
  links_max: number;
  pr_avg: number;
  ev_avg: number;
  constraint_avg: number;
  redundancia: number;
  n_nos: number;
  n_arestas: number;
}

export interface MaturidadeRedeMemetica {
  gamma: number;
  spearman: number;
  assortatividade: number;
  rich_club: number;
}

export interface LinhaCentralidade {
  Termo: string;
  'Grau Absoluto': number;
  'Grau (Degree)': number;
  Betweenness: number;
  Closeness: number;
  'Documentos Associados': string;
}

export interface EcologiaMemetica {
  nodes: GraphNode[];
  links: GraphLink[];
  centralidade: LinhaCentralidade[];
  metricas: MetricasRedeMemetica;
  maturidade: MaturidadeRedeMemetica;
  /** Rótulo da primeira coluna da tabela, conforme a fonte. */
  rotuloTermo: string;
  /** Nós/arestas do grafo completo, antes do filtro de coocorrência. */
  totalNos: number;
  totalArestas: number;
}

const VAZIO: EcologiaMemetica = {
  nodes: [],
  links: [],
  centralidade: [],
  metricas: {
    densidade: 0, eficiencia: 0, clustering: 0, entropia: 0,
    links_mean: 0, links_std: 0, links_min: 0, links_max: 0,
    pr_avg: 0, ev_avg: 0, constraint_avg: 0, redundancia: 0, n_nos: 0, n_arestas: 0,
  },
  maturidade: { gamma: 0, spearman: 0, assortatividade: 0, rich_club: 0 },
  rotuloTermo: 'Termo',
  totalNos: 0,
  totalArestas: 0,
};

/** Trava de exibição: acima disso o canvas engasga, então só os maiores hubs entram. */
export const MAX_NOS_VISIVEIS = 400;

export type ProgressoEcologia = (valor: number, texto: string) => void;

export function gerarEcologiaMemes(
  docs: readonly Documento[],
  minCoocorrencia = 3,
  fonte: FonteMemes = 'Palavras-chave',
  onProgress?: ProgressoEcologia,
): EcologiaMemetica {
  onProgress?.(5, 'Extraindo memes dos documentos...');

  const g = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  const mapaDocs = new Map<string, Set<string>>();

  for (const d of docs) {
    const titulo = d.titulo || 'Sem Título';
    const memes = memesDoDocumento(d, fonte);

    for (const m of memes) {
      let s = mapaDocs.get(m);
      if (!s) {
        s = new Set();
        mapaDocs.set(m, s);
      }
      s.add(titulo);
    }

    if (memes.length > 1) {
      for (let i = 0; i < memes.length; i += 1) {
        for (let j = i + 1; j < memes.length; j += 1) {
          const a = memes[i];
          const b = memes[j];
          if (a === b) continue;
          if (!g.hasNode(a)) g.addNode(a);
          if (!g.hasNode(b)) g.addNode(b);
          if (g.hasEdge(a, b)) g.updateEdgeAttribute(a, b, 'weight', (w) => (Number(w) || 0) + 1);
          else g.addEdge(a, b, { weight: 1 });
        }
      }
    } else if (memes.length === 1 && !g.hasNode(memes[0])) {
      g.addNode(memes[0]);
    }
  }

  if (g.order === 0) return VAZIO;

  onProgress?.(25, `Calculando topologia de ${g.order} memes...`);
  const cg = compactar(g, 'weight');
  const { n } = cg;

  const grauAbs: number[] = [];
  for (let i = 0; i < n; i += 1) grauAbs.push(grauDe(cg, i));

  const deg = degreeCentrality(cg);

  onProgress?.(40, 'Calculando Betweenness (intermediação)...');
  // O Python calcula exato; acima do limiar usamos a mesma amostragem de pivôs
  // já adotada no resto do app, senão o Brandes ponderado é inviável no browser.
  const kBet = n > LIMIAR_BETWEENNESS_EXATO
    ? Math.min(250, Math.max(50, Math.floor(Math.sqrt(n) * 4)))
    : null;
  const bet = betweennessCentrality(cg, { k: kBet, ponderado: true, seed: 42 });

  onProgress?.(65, 'Calculando Closeness (proximidade)...');
  const clo = closenessCentrality(cg, {
    pivots: n > LIMIAR_CLOSENESS_EXATO ? PIVOS_CLOSENESS : null,
    seed: 42,
  });

  onProgress?.(80, 'Consolidando métricas de complexidade...');
  const eficiencia = globalEfficiency(cg, n > LIMIAR_CLOSENESS_EXATO ? PIVOS_CLOSENESS : null);
  const clust = clusteringCoefficient(cg, { atributoPeso: 'weight' });
  const pr = pagerank(cg);
  const ev = eigenvectorCentrality(cg);

  const indicesConstraint = n > 5000
    ? Array.from({ length: 5000 }, (_, i) => Math.floor((i * n) / 5000))
    : Array.from({ length: n }, (_, i) => i);
  const constraints = [...burtConstraint(cg, indicesConstraint).values()].filter(Number.isFinite);

  // Entropia de Shannon sobre a distribuição dos graus
  const contagemGraus = new Map<number, number>();
  for (const gr of grauAbs) contagemGraus.set(gr, (contagemGraus.get(gr) ?? 0) + 1);
  let entropia = 0;
  for (const c of contagemGraus.values()) {
    const p = c / grauAbs.length;
    entropia -= p * Math.log2(p);
  }

  const metricas: MetricasRedeMemetica = {
    densidade: n <= 1 ? 0 : (2 * cg.m) / (n * (n - 1)),
    eficiencia,
    clustering: mean(Array.from(clust)),
    entropia,
    links_mean: mean(grauAbs),
    links_std: std(grauAbs),
    links_min: Math.min(...grauAbs),
    links_max: Math.max(...grauAbs),
    pr_avg: mean(Array.from(pr)),
    // O Python fixava ev_avg/constraint_avg em 0; aqui são calculados de fato —
    // exibir zero constante daria a impressão de métrica quebrada.
    ev_avg: mean(Array.from(ev)),
    constraint_avg: mean(constraints),
    redundancia: 1 - eficiencia,
    n_nos: n,
    n_arestas: cg.m,
  };

  let richClub = 0;
  try {
    const rc = richClubCoefficient(cg);
    if (rc.size > 0) {
      const chaves = [...rc.keys()].sort((a, b) => a - b);
      const kMax = chaves[chaves.length - 1];
      const validas = chaves.filter((k) => k >= Math.floor(kMax * 0.8));
      richClub = validas.length > 0 ? rc.get(validas[0])! : rc.get(kMax)!;
    }
  } catch {
    richClub = 0;
  }

  const maturidade: MaturidadeRedeMemetica = {
    gamma: estimarGammaLeiPotencia(grauAbs),
    spearman: spearman(Array.from(deg), Array.from(bet)),
    assortatividade: degreeAssortativity(cg),
    // idem: o original devolvia 0 fixo
    rich_club: Number.isFinite(richClub) ? richClub : 0,
  };

  const rotuloTermo = fonte === 'Artefatos Extraídos' ? 'Artefato (IA)' : 'Termo/Conceito';

  const centralidade: LinhaCentralidade[] = [];
  for (let i = 0; i < n; i += 1) {
    const termo = cg.labels[i];
    centralidade.push({
      Termo: termo,
      'Grau Absoluto': grauAbs[i],
      'Grau (Degree)': deg[i],
      Betweenness: bet[i],
      Closeness: clo[i],
      'Documentos Associados': [...(mapaDocs.get(termo) ?? [])].join(', '),
    });
  }
  centralidade.sort((a, b) => b['Grau Absoluto'] - a['Grau Absoluto']);

  onProgress?.(92, 'Montando o grafo visual...');

  // --- Recorte visual: arestas fracas fora, nós isolados fora ---
  const indicePorRotulo = cg.index;
  const grauNoRecorte = new Map<string, number>();
  const arestasVisiveis: Array<{ u: string; v: string; peso: number }> = [];
  g.forEachUndirectedEdge((_e, attrs, source, target) => {
    const peso = Number((attrs as { weight?: number }).weight ?? 1);
    if (peso < minCoocorrencia) return;
    arestasVisiveis.push({ u: source, v: target, peso });
    grauNoRecorte.set(source, (grauNoRecorte.get(source) ?? 0) + 1);
    grauNoRecorte.set(target, (grauNoRecorte.get(target) ?? 0) + 1);
  });

  // Com muitos nós, mantém apenas os de maior grau absoluto — e só as arestas
  // entre eles, para o canvas continuar navegável.
  let visiveis = [...grauNoRecorte.keys()];
  if (visiveis.length > MAX_NOS_VISIVEIS) {
    visiveis = visiveis
      .sort((a, b) => grauAbs[indicePorRotulo.get(b)!] - grauAbs[indicePorRotulo.get(a)!])
      .slice(0, MAX_NOS_VISIVEIS);
  }
  const conjuntoVisivel = new Set(visiveis);

  const maxGrauAbs = Math.max(...grauAbs, 1);
  const ehIA = fonte === 'Artefatos Extraídos';
  const corBase = ehIA ? '#9B59B6' : '#2ECC71';

  const nodes: GraphNode[] = visiveis.map((termo) => {
    const i = indicePorRotulo.get(termo)!;
    return {
      id: termo,
      label: termo,
      tipo: ehIA ? 'Artefato (Ontologia IA)' : 'Palavra-chave',
      size: 15 + (grauAbs[i] / maxGrauAbs) * 25,
      color: corBase,
      shape: 'dot',
      title:
        `${termo} · Grau ${grauAbs[i]} · ` +
        `Betweenness ${bet[i].toFixed(4)} · Closeness ${clo[i].toFixed(4)}`,
    };
  });

  const links: GraphLink[] = arestasVisiveis
    .filter((a) => conjuntoVisivel.has(a.u) && conjuntoVisivel.has(a.v))
    .map((a) => ({
      source: a.u,
      target: a.v,
      color: 'rgba(127, 140, 141, 0.25)',
      width: Math.min(4, 0.5 + a.peso / 4),
    }));

  onProgress?.(100, 'Rede memética pronta.');

  return {
    nodes,
    links,
    centralidade,
    metricas,
    maturidade,
    rotuloTermo,
    totalNos: n,
    totalArestas: cg.m,
  };
}
