/**
 * Boxplot de Especialização (Quociente Locacional por nível acadêmico).
 * Transcrição de `gerar_base_boxplot_ql` (backend.py:1862).
 *
 * Para cada entidade há exatamente um valor por nível — Teses, Dissertações e
 * Outros —, ou seja três pontos por caixa. O desenho é o do modelo original, mas
 * três observações não descrevem distribuição: a caixa aqui é uma forma compacta
 * de comparar os três níveis lado a lado, não um resumo estatístico de amostra.
 */
import type { Documento, NivelCanonico } from '@/types';
import { extrairEntidadesPorTipo, normalizarNivel } from './entities';

/** Os três níveis do modelo original; TCC e demais caem em "Outros". */
export const NIVEIS_QL = ['Teses', 'Dissertações', 'Outros'] as const;
export type NivelQL = typeof NIVEIS_QL[number];

/** Tipos de entidade aceitos no eixo X, no vocabulário de `extrairEntidadesPorTipo`. */
export const TIPOS_BOXPLOT = ['Orientador', 'Co-orientador', 'Palavra-chave', 'Macrotema'] as const;
export type TipoBoxplot = typeof TIPOS_BOXPLOT[number];

const colunaDoNivel = (nivel: NivelCanonico): NivelQL =>
  nivel === 'Teses' || nivel === 'Dissertações' ? nivel : 'Outros';

export interface LinhaBoxplotQL extends Record<string, unknown> {
  Entidade: string;
  Nível: NivelQL;
  'Valor QL': number;
  /** Documentos da entidade naquele nível; o QL sozinho esconde o volume. */
  Documentos: number;
  /** Documentos da entidade em toda a seleção, o denominador do QL. */
  'Total da entidade': number;
}

/**
 * QL por nível = (docs da entidade no nível / docs da entidade) ÷
 * (docs do nível na seleção / docs da seleção).
 */
export function gerarBaseBoxplotQL(
  docs: readonly Documento[],
  tipo: TipoBoxplot,
  entidades: readonly string[],
): LinhaBoxplotQL[] {
  if (docs.length === 0 || entidades.length === 0) return [];
  const validos = docs.filter((d) => d.titulo);
  if (validos.length === 0) return [];

  const totalDocs = validos.length;
  const docsPorNivel: Record<NivelQL, number> = { Teses: 0, Dissertações: 0, Outros: 0 };
  for (const d of validos) docsPorNivel[colunaDoNivel(normalizarNivel(d.nivel_academico))] += 1;

  const linhas: LinhaBoxplotQL[] = [];
  for (const entidade of entidades) {
    const docsEntidade = validos.filter((d) => extrairEntidadesPorTipo(d, tipo).includes(entidade));
    const totalEntidade = docsEntidade.length;
    if (totalEntidade === 0) continue;

    const localPorNivel: Record<NivelQL, number> = { Teses: 0, Dissertações: 0, Outros: 0 };
    for (const d of docsEntidade) localPorNivel[colunaDoNivel(normalizarNivel(d.nivel_academico))] += 1;

    for (const nivel of NIVEIS_QL) {
      const baseGlobal = docsPorNivel[nivel];
      const ql = baseGlobal === 0
        ? 0
        : (localPorNivel[nivel] / totalEntidade) / (baseGlobal / totalDocs);
      linhas.push({
        Entidade: entidade,
        Nível: nivel,
        'Valor QL': Math.round(ql * 10000) / 10000,
        Documentos: localPorNivel[nivel],
        'Total da entidade': totalEntidade,
      });
    }
  }
  return linhas;
}

/** Entidades distintas do tipo escolhido, ordenadas por volume e depois por nome. */
export function entidadesDisponiveis(docs: readonly Documento[], tipo: TipoBoxplot): string[] {
  const contagem = new Map<string, number>();
  for (const d of docs) {
    for (const ent of new Set(extrairEntidadesPorTipo(d, tipo))) {
      if (ent) contagem.set(ent, (contagem.get(ent) ?? 0) + 1);
    }
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([nome]) => nome);
}

export interface CaixaQL {
  entidade: string;
  /** [min, Q1, mediana, Q3, max] — a ordem que o boxplot do ECharts espera. */
  resumo: [number, number, number, number, number];
  valores: LinhaBoxplotQL[];
}

/**
 * Quartis pelo método linear (o mesmo `numpy`/`plotly` usam por omissão).
 * Com três pontos, Q1 e Q3 caem entre o mínimo e a mediana e entre a mediana e o
 * máximo — a caixa é interpolação, não contagem de observações.
 */
function quartil(ordenados: readonly number[], q: number): number {
  if (ordenados.length === 0) return 0;
  const pos = (ordenados.length - 1) * q;
  const baixo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (baixo === alto) return ordenados[baixo];
  return ordenados[baixo] + (ordenados[alto] - ordenados[baixo]) * (pos - baixo);
}

export function caixasQL(linhas: readonly LinhaBoxplotQL[]): CaixaQL[] {
  const porEntidade = new Map<string, LinhaBoxplotQL[]>();
  for (const l of linhas) {
    const lista = porEntidade.get(l.Entidade);
    if (lista) lista.push(l);
    else porEntidade.set(l.Entidade, [l]);
  }
  return [...porEntidade.entries()].map(([entidade, valores]) => {
    const ordenados = valores.map((v) => v['Valor QL']).sort((a, b) => a - b);
    return {
      entidade,
      resumo: [
        ordenados[0],
        quartil(ordenados, 0.25),
        quartil(ordenados, 0.5),
        quartil(ordenados, 0.75),
        ordenados[ordenados.length - 1],
      ] as [number, number, number, number, number],
      valores,
    };
  });
}
