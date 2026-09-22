/**
 * Espaço Topológico 3D: Grau × Betweenness × Closeness.
 * Transcrição de `plotar_grafico_3d_sna` (backend.py:1498), que usava o
 * `scatter_3d` do Plotly (WebGL).
 *
 * Aqui a projeção é feita no próprio EcoGrad e desenhada como um dispersograma
 * comum. A escolha não é estética: mantém o gráfico dentro do invólucro
 * acessível do projeto — vista em tabela, exportação de imagem, tema claro e
 * escuro, e respeito a "reduzir movimento" — coisas que uma tela WebGL externa
 * não herdaria. O preço é que a órbita é controlada por azimute e elevação, em
 * vez de arrasto livre em três eixos.
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

export interface Camera3D {
  /** Giro em torno do eixo vertical, em graus. */
  azimute: number;
  /** Inclinação acima do plano Grau × Betweenness, em graus. */
  elevacao: number;
}

export const CAMERA_PADRAO: Camera3D = { azimute: 35, elevacao: 22 };

/**
 * Como os três eixos são comprimidos no cubo.
 *
 * O `scatter_3d` original usava escala linear, e ela continua aqui como opção —
 * é a leitura fiel. Mas grau, betweenness e closeness têm cauda longa: numa
 * seleção típica, a maioria dos termos aparece uma vez só, e o linear empilha
 * tudo num canto atrás de meia dúzia de pontos extremos. A escala logarítmica
 * (log(1 + x)) separa essa massa sem mexer em nenhum valor: muda só a posição
 * no desenho, e os números seguem inteiros no tooltip e na tabela.
 */
export const ESCALAS_3D = ['Logarítmica', 'Linear (modelo original)'] as const;
export type Escala3D = typeof ESCALAS_3D[number];

export interface PontoProjetado {
  ponto: PontoTopologico;
  x: number;
  y: number;
  /** Distância ao observador, normalizada em 0–1. Maior = mais perto. */
  profundidade: number;
}

/** Normaliza para 0–1; um eixo constante colapsa no meio, sem dividir por zero. */
function normalizador(valores: readonly number[], escala: Escala3D): (v: number) => number {
  // `log1p` aceita zero e é monótona, então a ordem dos nós nunca muda.
  const comprimir = escala === 'Logarítmica' ? (v: number) => Math.log1p(Math.max(v, 0)) : (v: number) => v;
  const comprimidos = valores.map(comprimir);
  const min = Math.min(...comprimidos);
  const max = Math.max(...comprimidos);
  const amplitude = max - min;
  return amplitude > 0 ? (v: number) => (comprimir(v) - min) / amplitude : () => 0.5;
}

/**
 * Projeção ortográfica: gira o cubo unitário em torno do eixo vertical
 * (azimute), inclina o resultado (elevação) e descarta a profundidade.
 * Sem perspectiva — como no `scatter_3d`, distância não altera escala, só a
 * ordem de desenho e a opacidade.
 */
export function projetarEspaco(
  pontos: readonly PontoTopologico[],
  camera: Camera3D = CAMERA_PADRAO,
  escala: Escala3D = 'Logarítmica',
): { projetados: PontoProjetado[]; cubo: Array<[number, number]> } {
  const az = (camera.azimute * Math.PI) / 180;
  const el = (camera.elevacao * Math.PI) / 180;
  const cosA = Math.cos(az);
  const senA = Math.sin(az);
  const cosE = Math.cos(el);
  const senE = Math.sin(el);

  const projetar = (x: number, y: number, z: number): { x: number; y: number; z: number } => {
    // Centraliza em 0 para girar em torno do centro do cubo, não de um canto.
    const cx = x - 0.5;
    const cy = y - 0.5;
    const cz = z - 0.5;
    const rx = cx * cosA - cy * senA;
    const ry = cx * senA + cy * cosA;
    return { x: rx, y: cz * cosE - ry * senE, z: ry * cosE + cz * senE };
  };

  if (pontos.length === 0) return { projetados: [], cubo: [] };

  const nx = normalizador(pontos.map((p) => p.Grau), escala);
  const ny = normalizador(pontos.map((p) => p.Betweenness), escala);
  const nz = normalizador(pontos.map((p) => p.Closeness), escala);

  const brutos = pontos.map((ponto) => {
    const p = projetar(nx(ponto.Grau), ny(ponto.Betweenness), nz(ponto.Closeness));
    return { ponto, x: p.x, y: p.y, z: p.z };
  });
  const zs = brutos.map((b) => b.z);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const faixa = zMax - zMin;

  const projetados = brutos
    .map((b) => ({
      ponto: b.ponto,
      x: b.x,
      y: b.y,
      profundidade: faixa > 0 ? (b.z - zMin) / faixa : 0.5,
    }))
    // Quem está atrás é desenhado primeiro; a ordem é o que cria a sensação de
    // volume num dispersograma plano.
    .sort((a, b) => a.profundidade - b.profundidade);

  // Arestas do cubo unitário, para ancorar a leitura dos três eixos.
  const cantos: Array<[number, number, number]> = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];
  const cubo = cantos.map((c) => {
    const p = projetar(c[0], c[1], c[2]);
    return [p.x, p.y] as [number, number];
  });

  return { projetados, cubo };
}

/** Pares de índices em `cubo` que formam as 12 arestas. */
export const ARESTAS_CUBO: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/**
 * Agrupa por comunidade mantendo a legenda legível: as maiores ficam nomeadas e
 * o resto vai para um grupo único. Uma legenda com centenas de comunidades não
 * ajuda ninguém a ler o desenho.
 */
export function agruparPorComunidade(
  projetados: readonly PontoProjetado[],
  maximoGrupos = 8,
): Array<{ nome: string; pontos: PontoProjetado[] }> {
  const contagem = new Map<string, number>();
  for (const p of projetados) {
    contagem.set(p.ponto.Comunidade, (contagem.get(p.ponto.Comunidade) ?? 0) + 1);
  }
  const maiores = new Set(
    [...contagem.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, maximoGrupos)
      .map(([nome]) => nome),
  );
  const grupos = new Map<string, PontoProjetado[]>();
  for (const p of projetados) {
    const chave = maiores.has(p.ponto.Comunidade) ? `Comunidade ${p.ponto.Comunidade}` : 'Demais comunidades';
    const lista = grupos.get(chave);
    if (lista) lista.push(p);
    else grupos.set(chave, [p]);
  }
  return [...grupos.entries()].map(([nome, pontos]) => ({ nome, pontos }));
}
