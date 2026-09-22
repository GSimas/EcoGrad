/**
 * Espaço Topológico 3D: Grau × Betweenness × Closeness.
 * Transcrição de `plotar_grafico_3d_sna` (backend.py:1498), que usava o
 * `scatter_3d` do Plotly.
 *
 * O desenho é WebGL, pelo `echarts-gl`, e a órbita vem dele: este módulo cuida
 * só de escolher os pontos, decidir a compressão dos eixos e agrupar as
 * comunidades. A matemática de projeção que existia aqui antes saiu junto com
 * os deslizadores de ângulo que ela alimentava.
 */
import type { SnaGlobal, TipoNo } from '@/types';

/** Dimensões oferecidas no seletor, iguais às do `radio` original. */
export const DIMENSOES_3D = ['Documento', 'Autor', 'Orientador', 'Palavra-chave', 'Macrotema'] as const;
export type Dimensao3D = typeof DIMENSOES_3D[number];

/** Teto de pontos do original ("limite para fluidez WebGL"). */
export const LIMITE_PONTOS_3D = 2000;

export interface PontoTopologico extends Record<string, unknown> {
  Item: string;
  Grau: number;
  Betweenness: number;
  Closeness: number;
  Comunidade: string;
}

/**
 * Pontos da dimensão escolhida, cortados nos 2000 de maior grau.
 * Como no Python, "Orientador" recolhe também os coorientadores: os dois papéis
 * compartilham o mesmo espaço topológico na rede global.
 */
export function pontosTopologicos(
  sna: SnaGlobal | null,
  dimensao: Dimensao3D,
  limite = LIMITE_PONTOS_3D,
): { pontos: PontoTopologico[]; total: number } {
  if (!sna) return { pontos: [], total: 0 };
  const aceita = (tipo: TipoNo) =>
    dimensao === 'Orientador'
      ? tipo === 'Orientador' || tipo === 'Co-orientador'
      : tipo === dimensao;

  const pontos: PontoTopologico[] = [];
  for (const [item, m] of Object.entries(sna)) {
    if (!aceita(m.Tipo)) continue;
    pontos.push({
      Item: item,
      Grau: m['Grau Absoluto'],
      Betweenness: m.Betweenness,
      Closeness: m.Closeness,
      Comunidade: String(m.Comunidade),
    });
  }
  const total = pontos.length;
  pontos.sort((a, b) => b.Grau - a.Grau || a.Item.localeCompare(b.Item, 'pt-BR'));
  return { pontos: pontos.slice(0, limite), total };
}

/**
 * Como os três eixos são comprimidos.
 *
 * O `scatter_3d` original usava escala linear, e ela continua aqui como opção —
 * é a leitura fiel. Mas grau, betweenness e closeness têm cauda longa: numa
 * seleção típica, a maioria dos termos aparece uma vez só, e o linear empilha
 * tudo num canto atrás de meia dúzia de pontos extremos. A logarítmica
 * (log(1 + x)) separa essa massa sem mexer em nenhum valor: muda só a posição
 * no desenho — e o nome do eixo declara isso —, e os números seguem inteiros no
 * passar do mouse e na tabela.
 */
export const ESCALAS_3D = ['Logarítmica', 'Linear (modelo original)'] as const;
export type Escala3D = typeof ESCALAS_3D[number];

/** Posição no eixo a partir do valor da métrica. Monótona: não troca a ordem. */
export const posicaoNoEixo = (valor: number, escala: Escala3D): number =>
  escala === 'Logarítmica' ? Math.log1p(Math.max(valor, 0)) : valor;

/**
 * Agrupa por comunidade mantendo a legenda legível: as maiores ficam nomeadas e
 * o resto vai para um grupo único. Uma legenda com centenas de comunidades não
 * ajuda ninguém a ler o desenho.
 */
export function agruparPorComunidade(
  pontos: readonly PontoTopologico[],
  maximoGrupos = 8,
): Array<{ nome: string; pontos: PontoTopologico[] }> {
  const contagem = new Map<string, number>();
  for (const p of pontos) contagem.set(p.Comunidade, (contagem.get(p.Comunidade) ?? 0) + 1);
  const maiores = new Set(
    [...contagem.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, maximoGrupos)
      .map(([nome]) => nome),
  );
  const grupos = new Map<string, PontoTopologico[]>();
  for (const p of pontos) {
    const chave = maiores.has(p.Comunidade) ? `Comunidade ${p.Comunidade}` : 'Demais comunidades';
    const lista = grupos.get(chave);
    if (lista) lista.push(p);
    else grupos.set(chave, [p]);
  }
  return [...grupos.entries()].map(([nome, pontos]) => ({ nome, pontos }));
}
