/**
 * Análise Temática Estrutural: tabela geral de macrotemas e os dois mapas de
 * quadrantes. Transcrição do bloco `tab_tm1..tab_tm3` de `pages/1_Avançado.py`
 * (283-400) e de `plotar_mapa_tematico` (backend.py:2486).
 *
 * O mapa é chamado de "Mapa Temático (Callon)" pela tradição bibliométrica, mas
 * os eixos do modelo original não são os de Callon: aqui X é o betweenness do
 * termo no grafo global e Y é o grau absoluto. São medidas de posição na rede
 * de coautoria/indexação desta seleção, não centralidade e densidade calculadas
 * dentro de clusters temáticos. Os nomes dos quadrantes vêm do modelo original e
 * ficam preservados; a leitura correta está em `LEITURA_QUADRANTE_TEMATICO`.
 */
import type { Documento, SnaGlobal } from '@/types';
import { normalizarNivel } from './entities';

export const MACROTEMA_PADRAO = 'Multidisciplinar / Transversal';

export type QuadranteTematico =
  | 'Temas Motores'
  | 'Temas de Nicho'
  | 'Temas Básicos'
  | 'Temas Emergentes / Declínio';

export const QUADRANTES_TEMATICOS: readonly QuadranteTematico[] = [
  'Temas Motores',
  'Temas de Nicho',
  'Temas Básicos',
  'Temas Emergentes / Declínio',
];

/** O que cada nome do modelo original de fato descreve nesta implementação. */
export const LEITURA_QUADRANTE_TEMATICO: Record<QuadranteTematico, string> = {
  'Temas Motores': 'Betweenness e grau acima da média da dimensão',
  'Temas de Nicho': 'Grau acima da média, betweenness abaixo',
  'Temas Básicos': 'Betweenness acima da média, grau abaixo',
  'Temas Emergentes / Declínio': 'Betweenness e grau abaixo da média',
};

export const CORES_QUADRANTE_TEMATICO: Record<QuadranteTematico, string> = {
  'Temas Motores': '#2ECC71',
  'Temas de Nicho': '#F1C40F',
  'Temas Básicos': '#3498DB',
  'Temas Emergentes / Declínio': '#E74C3C',
};

export interface LinhaMacrotema extends Record<string, unknown> {
  Macrotema: string;
  Docs: number;
  Teses: number;
  Dissertações: number;
  Grau: number;
  Betweenness: number;
  Closeness: number;
  'Especialista (Orientador)': string;
  'QL do orientador': number | null;
  'Especialista (Co-orientador)': string;
  'QL do co-orientador': number | null;
  Início: number | null;
  'Pico Modal': number | null;
  Recente: number | null;
}

export interface LinhaPalavraChave extends Record<string, unknown> {
  'Palavra-chave': string;
  Frequência: number;
  Betweenness: number;
  Grau: number;
}

function contar(valores: Iterable<string>): Map<string, number> {
  const c = new Map<string, number>();
  for (const v of valores) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  return c;
}

/**
 * Entidade de maior Quociente Locacional dentro do macrotema.
 * Transcrição de `top_ql` (pages/1_Avançado.py:295): QL = (O_ik / O_i) ÷ (O_k / O_total).
 * Empate em QL é desfeito pela contagem local, como no original.
 */
function topQL(
  entidadesNoTema: readonly string[],
  contagemGlobal: Map<string, number>,
  oK: number,
  oTotal: number,
): { nome: string; ql: number | null } {
  const local = contar(entidadesNoTema);
  let melhorQl = -1;
  let melhor = '-';
  for (const [ent, oIk] of local) {
    const oI = contagemGlobal.get(ent) ?? 0;
    if (oI <= 0 || oK <= 0) continue;
    const ql = (oIk / oI) / (oK / oTotal);
    if (ql > melhorQl) {
      melhorQl = ql;
      melhor = ent;
    } else if (ql === melhorQl && oIk > (local.get(melhor) ?? 0)) {
      melhor = ent;
    }
  }
  return melhor === '-' ? { nome: '-', ql: null } : { nome: melhor, ql: melhorQl };
}

const anoValido = (d: Documento): number | null =>
  typeof d.ano === 'number' && Number.isFinite(d.ano) ? d.ano : null;

/** Tabela geral por macrotema, com volumes, anos, métricas SNA e especialistas. */
export function linhasMacrotemas(
  docs: readonly Documento[],
  sna: SnaGlobal | null,
): LinhaMacrotema[] {
  if (docs.length === 0) return [];
  const oTotal = docs.length;

  const contagemOri = contar(docs.map((d) => d.orientador).filter(Boolean));
  const contagemCoori = contar(docs.flatMap((d) => d.co_orientadores).filter(Boolean));

  const porTema = new Map<string, Documento[]>();
  for (const d of docs) {
    const mt = d.macrotema || MACROTEMA_PADRAO;
    const lista = porTema.get(mt);
    if (lista) lista.push(d);
    else porTema.set(mt, [d]);
  }

  const linhas: LinhaMacrotema[] = [];
  for (const [mt, docsMt] of porTema) {
    const oK = docsMt.length;
    const anos = docsMt.map(anoValido).filter((a): a is number => a !== null);
    const modal = contar(anos.map(String));
    let anoModal: number | null = null;
    let maiorContagem = -1;
    // `Counter.most_common(1)` desempata pela ordem de inserção; percorrer os
    // anos na ordem em que aparecem reproduz isso sem depender de ordenação.
    for (const a of anos) {
      const c = modal.get(String(a)) ?? 0;
      if (c > maiorContagem) {
        maiorContagem = c;
        anoModal = a;
      }
    }

    const metricas = sna?.[mt];
    const ori = topQL(docsMt.map((d) => d.orientador).filter(Boolean), contagemOri, oK, oTotal);
    const coori = topQL(docsMt.flatMap((d) => d.co_orientadores).filter(Boolean), contagemCoori, oK, oTotal);

    linhas.push({
      Macrotema: mt,
      Docs: oK,
      Teses: docsMt.filter((d) => normalizarNivel(d.nivel_academico) === 'Teses').length,
      Dissertações: docsMt.filter((d) => normalizarNivel(d.nivel_academico) === 'Dissertações').length,
      Grau: metricas?.['Grau Absoluto'] ?? 0,
      Betweenness: metricas?.Betweenness ?? 0,
      Closeness: metricas?.Closeness ?? 0,
      'Especialista (Orientador)': ori.nome,
      'QL do orientador': ori.ql === null ? null : Math.round(ori.ql * 10) / 10,
      'Especialista (Co-orientador)': coori.nome,
      'QL do co-orientador': coori.ql === null ? null : Math.round(coori.ql * 10) / 10,
      Início: anos.length ? Math.min(...anos) : null,
      'Pico Modal': anoModal,
      Recente: anos.length ? Math.max(...anos) : null,
    });
  }

  return linhas.sort((a, b) => b.Docs - a.Docs || a.Macrotema.localeCompare(b.Macrotema, 'pt-BR'));
}

/** Top-N palavras-chave com frequência e posição no grafo global. */
/**
 * Todas as palavras-chave da seleção, da mais citada para a menos, com empate
 * resolvido em ordem alfabética — a mesma ordem de onde o mapa tira o seu topo.
 */
export function palavrasChavePorFrequencia(docs: readonly Documento[]): Array<[string, number]> {
  const contagem = contar(docs.flatMap((d) => d.palavras_chave).filter(Boolean));
  return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
}

/**
 * `excluir` funciona como lista de stopwords: os termos saem antes do corte,
 * então o topo continua com `topN` termos e o seguinte da fila entra no lugar.
 */
export function linhasPalavrasChave(
  docs: readonly Documento[],
  sna: SnaGlobal | null,
  topN = 40,
  excluir: ReadonlySet<string> = new Set(),
): LinhaPalavraChave[] {
  return palavrasChavePorFrequencia(docs)
    .filter(([pk]) => !excluir.has(pk))
    .slice(0, topN)
    .map(([pk, freq]) => ({
      'Palavra-chave': pk,
      Frequência: freq,
      Betweenness: sna?.[pk]?.Betweenness ?? 0,
      Grau: sna?.[pk]?.['Grau Absoluto'] ?? 0,
    }));
}

export interface Quadrantes<T> {
  linhas: Array<T & { Quadrante: QuadranteTematico }>;
  xMid: number;
  yMid: number;
}

/**
 * Divide os pontos pela média de cada eixo — a "cruz no centro de massa" que o
 * `plotar_mapa_tematico` desenhava. Média, e não mediana: é o que o original
 * usava, e a diferença muda a leitura de quem está na fronteira.
 *
 * Valor exatamente igual à média cai no lado baixo, para que a regra seja
 * "estritamente acima" nos dois eixos e nenhum ponto fique em dois quadrantes.
 */
export function quadrantesTematicos<T extends Record<string, unknown>>(
  linhas: readonly T[],
  chaveX: keyof T & string,
  chaveY: keyof T & string,
): Quadrantes<T> {
  if (linhas.length === 0) return { linhas: [], xMid: 0, yMid: 0 };
  const xs = linhas.map((l) => Number(l[chaveX]) || 0);
  const ys = linhas.map((l) => Number(l[chaveY]) || 0);
  const xMid = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMid = ys.reduce((a, b) => a + b, 0) / ys.length;
  return {
    xMid,
    yMid,
    linhas: linhas.map((l, i) => ({
      ...l,
      Quadrante: (xs[i] > xMid
        ? ys[i] > yMid ? 'Temas Motores' : 'Temas Básicos'
        : ys[i] > yMid ? 'Temas de Nicho' : 'Temas Emergentes / Declínio') as QuadranteTematico,
    })),
  };
}
