/**
 * Órbita de Relacionamentos (ego-graph com recorte temporal).
 * Transcrição de `_construir_grafo_historico` (backend.py:2095) e
 * `gerar_orbita_local` (backend.py:2143).
 */
import type { Documento, GraphLink, GraphNode, GraphPayload, SnaGlobal, TipoNo } from '@/types';

interface ArestaHistorica {
  u: string;
  v: string;
  ano: number;
}

export interface GrafoHistorico {
  tipos: Map<string, TipoNo>;
  arestas: ArestaHistorica[];
  /** Anos distintos presentes na base, para o player temporal. */
  anos: number[];
}

/**
 * Constrói a representação com o ano em cada aresta, reutilizável entre os
 * frames do player temporal (o Python cacheava esta etapa separadamente).
 */
export function construirGrafoHistorico(docs: readonly Documento[]): GrafoHistorico {
  const tipos = new Map<string, TipoNo>();
  const arestas: ArestaHistorica[] = [];
  const anosSet = new Set<number>();

  const registrar = (id: string, tipo: TipoNo) => {
    if (id && !tipos.has(id)) tipos.set(id, tipo);
  };

  for (const d of docs) {
    const titulo = d.titulo;
    if (!titulo) continue;
    const ano = d.ano !== null && Number.isFinite(d.ano) ? (d.ano as number) : 0;
    anosSet.add(ano);

    registrar(titulo, 'Documento');

    for (const a of d.autores) {
      if (!a) continue;
      registrar(a, 'Autor');
      arestas.push({ u: titulo, v: a, ano });
    }
    if (d.orientador) {
      registrar(d.orientador, 'Orientador');
      arestas.push({ u: titulo, v: d.orientador, ano });
    }
    for (const co of d.co_orientadores) {
      if (!co) continue;
      registrar(co, 'Co-orientador');
      arestas.push({ u: titulo, v: co, ano });
    }
    for (const pk of d.palavras_chave) {
      if (!pk) continue;
      registrar(pk, 'Conceito');
      arestas.push({ u: titulo, v: pk, ano });
    }
    if (d.macrotema) {
      registrar(d.macrotema, 'Macrotema');
      arestas.push({ u: titulo, v: d.macrotema, ano });
    }
  }

  return { tipos, arestas, anos: [...anosSet].filter((a) => a > 0).sort((a, b) => a - b) };
}

/** Paleta de nós, idêntica à do agraph no Streamlit. */
export const CORES_TIPO: Record<string, string> = {
  Documento: '#E56D45',
  Autor: '#55BADC',
  Orientador: '#E9A13B',
  'Co-orientador': '#E9A13B',
  Conceito: '#8FCF3E',
  'Palavra-chave': '#8FCF3E',
  Macrotema: '#6A7DFF',
  'Artefato (Ontologia IA)': '#53D7D0',
  Desconhecido: '#6A7DFF',
};

function formaDoTipo(tipo: TipoNo, foco: boolean): string {
  if (foco) return 'diamond';
  if (tipo === 'Orientador' || tipo === 'Co-orientador') return 'star';
  if (tipo === 'Documento') return 'square';
  if (tipo === 'Conceito' || tipo === 'Palavra-chave') return 'triangle';
  return 'dot';
}

export type MetodoTamanho =
  | 'Tamanho Fixo'
  | 'Betweenness'
  | 'Closeness'
  | 'Degree Centrality'
  | 'Clustering';

export interface OrbitaOptions {
  profundidade?: number;
  anoLimite?: number;
  metodoTamanho?: MetodoTamanho;
  snaGlobal?: SnaGlobal | null;
  /** Trava de segurança para não travar o canvas em hubs gigantes. */
  maxNos?: number;
}

/**
 * Ego-graph do termo em foco, limitado a `anoLimite` e a `profundidade` saltos.
 * Devolve nós/arestas já estilizados para o react-force-graph.
 */
export function gerarOrbitaLocal(
  grafo: GrafoHistorico,
  termoFoco: string,
  {
    profundidade = 1,
    anoLimite = 2026,
    metodoTamanho = 'Tamanho Fixo',
    snaGlobal = null,
    maxNos = 600,
  }: OrbitaOptions = {},
): GraphPayload {
  if (!termoFoco || !grafo.tipos.has(termoFoco)) return { nodes: [], links: [] };

  // Adjacência do recorte temporal
  const adj = new Map<string, Set<string>>();
  const arestasValidas: ArestaHistorica[] = [];
  for (const e of grafo.arestas) {
    if (e.ano > anoLimite) continue;
    arestasValidas.push(e);
    let su = adj.get(e.u);
    if (!su) {
      su = new Set();
      adj.set(e.u, su);
    }
    su.add(e.v);
    let sv = adj.get(e.v);
    if (!sv) {
      sv = new Set();
      adj.set(e.v, sv);
    }
    sv.add(e.u);
  }

  if (!adj.has(termoFoco)) return { nodes: [], links: [] };

  // BFS limitada ao raio da profundidade
  const visitados = new Set<string>([termoFoco]);
  let fronteira = [termoFoco];
  for (let nivel = 0; nivel < profundidade; nivel += 1) {
    const proxima: string[] = [];
    for (const v of fronteira) {
      for (const w of adj.get(v) ?? []) {
        if (visitados.has(w)) continue;
        if (visitados.size >= maxNos) break;
        visitados.add(w);
        proxima.push(w);
      }
      if (visitados.size >= maxNos) break;
    }
    fronteira = proxima;
    if (visitados.size >= maxNos) break;
  }

  const nodes: GraphNode[] = [];
  for (const node of visitados) {
    const tipo = grafo.tipos.get(node) ?? 'Desconhecido';
    const foco = node === termoFoco;

    let tam = 20;
    if (foco) tam = 45;
    else if (snaGlobal && metodoTamanho !== 'Tamanho Fixo') {
      const valor = (snaGlobal[node]?.[metodoTamanho] as number | undefined) ?? 0.1;
      tam = 15 + valor * 30;
    }

    const rotulo = tipo === 'Documento' && node.length > 30 ? `${node.slice(0, 30)}...` : node;

    nodes.push({
      id: node,
      label: rotulo,
      tipo,
      size: tam,
      color: foco ? '#FFFFFF' : (CORES_TIPO[tipo] ?? '#6A7DFF'),
      shape: formaDoTipo(tipo, foco),
      title: `${node} — ${tipo}`,
    });
  }

  const vistos = new Set<string>();
  const links: GraphLink[] = [];
  for (const e of arestasValidas) {
    if (!visitados.has(e.u) || !visitados.has(e.v)) continue;
    const chave = e.u < e.v ? `${e.u}||${e.v}` : `${e.v}||${e.u}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    links.push({ source: e.u, target: e.v, color: '#7D8A84', width: 1, ano: e.ano });
  }

  return { nodes, links };
}
