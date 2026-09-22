/**
 * Furos Estruturais de Burt — transcrição de `calcular_burt` (backend.py:964).
 *
 * A rede é bipartida por construção: um nó por orientador, um nó por
 * palavra-chave, uma aresta quando o orientador assina um trabalho com aquela
 * palavra. Só as linhas dos orientadores voltam; as palavras-chave existem
 * apenas como caminho entre eles.
 *
 * Restrição (constraint) baixa significa vizinhança pouco redundante — o termo
 * "broker" do modelo original. Não é medida de qualidade, de interdisciplinaridade
 * declarada nem de colaboração real: depende inteiramente das palavras-chave
 * registradas nos metadados desta seleção.
 */
import Graph from 'graphology';
import type { Documento } from '@/types';
import {
  betweennessCentrality,
  burtConstraint,
  compactar,
  grauDe,
  type CompactGraph,
} from './graph-core';
import { LIMIAR_BETWEENNESS_EXATO, type ProgressCallback } from './sna-engine';

/**
 * Acima deste tamanho o constraint — O(Σ d²) — é calculado só para os
 * orientadores, nunca para as palavras-chave. Como só as linhas de orientador
 * voltam, isso não muda nenhum valor publicado: apenas deixa de calcular o que
 * seria descartado.
 */
export const LIMIAR_FUROS_APROXIMADO = 1500;

export interface LinhaFuroEstrutural extends Record<string, unknown> {
  Orientador: string;
  'Restrição (Constraint)': number;
  'Intermediação (Betweenness)': number;
  Diversidade: number;
}

export interface FurosEstruturais {
  linhas: LinhaFuroEstrutural[];
  /** Nós e arestas da rede bipartida completa, para contextualizar a leitura. */
  totalNos: number;
  totalArestas: number;
  totalPalavrasChave: number;
  /** Betweenness amostrado por pivôs quando a rede é grande (como no Python). */
  betweennessAproximado: boolean;
}

export const furosVazios: FurosEstruturais = {
  linhas: [],
  totalNos: 0,
  totalArestas: 0,
  totalPalavrasChave: 0,
  betweennessAproximado: false,
};

/** Rede orientador ↔ palavra-chave, idêntica ao laço de `calcular_burt`. */
export function construirGrafoFuros(docs: readonly Documento[]): {
  grafo: Graph;
  orientadores: Set<string>;
} {
  const grafo = new Graph({ type: 'undirected', allowSelfLoops: false, multi: false });
  const orientadores = new Set<string>();
  for (const d of docs) {
    const ori = d.orientador;
    if (!ori) continue;
    if (!grafo.hasNode(ori)) grafo.addNode(ori, { tipo: 'Orientador' });
    orientadores.add(ori);
    for (const pk of d.palavras_chave) {
      // Uma palavra-chave homônima do orientador viraria laço; o NetworkX
      // aceitaria a aresta, mas ela não descreve ponte alguma.
      if (!pk || pk === ori) continue;
      if (!grafo.hasNode(pk)) grafo.addNode(pk, { tipo: 'Conceito' });
      if (!grafo.hasEdge(ori, pk)) grafo.addEdge(ori, pk);
    }
  }
  return { grafo, orientadores };
}

export function calcularFurosEstruturais(
  docs: readonly Documento[],
  onProgress?: ProgressCallback,
): FurosEstruturais {
  onProgress?.(5, 'Montando a rede de orientadores e palavras-chave...');
  const { grafo, orientadores } = construirGrafoFuros(docs);
  if (grafo.order === 0) return furosVazios;

  const cg: CompactGraph = compactar(grafo);
  const indicesOrientadores: number[] = [];
  for (const nome of orientadores) {
    const i = cg.index.get(nome);
    if (i !== undefined) indicesOrientadores.push(i);
  }
  if (indicesOrientadores.length === 0) return furosVazios;

  onProgress?.(25, 'Calculando a restrição de Burt para cada orientador...');
  const constraint = burtConstraint(cg, indicesOrientadores);

  onProgress?.(55, 'Calculando a intermediação na rede de conceitos...');
  // Mesma regra do resto do EcoGrad: acima de 1500 nós o betweenness é
  // amostrado por pivôs, como `nx.betweenness_centrality(G, k=...)` fazia.
  const aproximado = cg.n > LIMIAR_BETWEENNESS_EXATO;
  const bet = betweennessCentrality(cg, {
    k: aproximado ? Math.min(250, Math.max(50, Math.floor(Math.sqrt(cg.n) * 4))) : null,
    seed: 42,
    onProgress: (feito, total) =>
      onProgress?.(55 + Math.round((feito / Math.max(total, 1)) * 40), 'Calculando a intermediação na rede de conceitos...'),
  });

  const linhas = indicesOrientadores.map((i) => {
    const restricao = constraint.get(i);
    return {
      Orientador: cg.labels[i],
      // `nx.constraint` devolve NaN para nó isolado; o resumo original o lia
      // como 0 ao montar o DataFrame. Um orientador sem palavra-chave não tem
      // vizinhança a restringir, e 0 é o valor que o gráfico recebia.
      'Restrição (Constraint)': Number.isFinite(restricao) ? (restricao as number) : 0,
      'Intermediação (Betweenness)': bet[i],
      Diversidade: grauDe(cg, i),
    };
  });

  onProgress?.(100, 'Furos estruturais consolidados.');
  return {
    linhas: linhas.sort(
      (a, b) =>
        a['Restrição (Constraint)'] - b['Restrição (Constraint)'] ||
        b.Diversidade - a.Diversidade ||
        a.Orientador.localeCompare(b.Orientador, 'pt-BR'),
    ),
    totalNos: cg.n,
    totalArestas: cg.m,
    totalPalavrasChave: cg.n - indicesOrientadores.length,
    betweennessAproximado: aproximado,
  };
}
