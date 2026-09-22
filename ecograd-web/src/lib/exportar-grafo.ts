/**
 * Exportação da rede em GEXF, GraphML e JSON node-link.
 * Transcrição de `preparar_exportacao_grafo` (backend.py:1289), que delegava a
 * `nx.write_gexf`, `nx.write_graphml` e `nx.node_link_data`.
 *
 * A serialização é feita aqui, e não por biblioteca, porque os três formatos
 * exigidos por Gephi e Cytoscape cabem em algumas dezenas de linhas e porque o
 * grafo já existe em memória como `graphology`. O que sai é a rede completa —
 * nunca o recorte visual de 400 nós que o desenho na tela aplica.
 */
import type Graph from 'graphology';

export const FORMATOS_GRAFO = ['GEXF (Gephi)', 'GraphML', 'JSON (Node-Link)'] as const;
export type FormatoGrafo = typeof FORMATOS_GRAFO[number];

export const EXTENSAO_GRAFO: Record<FormatoGrafo, string> = {
  'GEXF (Gephi)': 'gexf',
  GraphML: 'graphml',
  'JSON (Node-Link)': 'json',
};

export const MIME_GRAFO: Record<FormatoGrafo, string> = {
  'GEXF (Gephi)': 'application/xml;charset=utf-8',
  GraphML: 'application/xml;charset=utf-8',
  'JSON (Node-Link)': 'application/json;charset=utf-8',
};

/** Escapa texto para dentro de um atributo XML, inclusive aspas e `&`. */
export function escaparXml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Caracteres de controle não são válidos em XML 1.0 e quebram o Gephi.
    // Tabulação, quebra de linha e retorno de carro seguem permitidos.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** Tipo declarado no cabeçalho dos formatos XML, a partir do valor observado. */
function tipoAtributo(valor: unknown): 'string' | 'integer' | 'double' | 'boolean' {
  if (typeof valor === 'boolean') return 'boolean';
  if (typeof valor === 'number') return Number.isInteger(valor) ? 'integer' : 'double';
  return 'string';
}

interface Atributos {
  /** Chave → tipo, na ordem de primeira aparição. */
  tipos: Map<string, string>;
}

function coletarAtributos(entradas: Iterable<Record<string, unknown>>): Atributos {
  const tipos = new Map<string, string>();
  for (const attrs of entradas) {
    for (const [chave, valor] of Object.entries(attrs)) {
      if (valor === null || valor === undefined) continue;
      const tipo = tipoAtributo(valor);
      const anterior = tipos.get(chave);
      // Tipos conflitantes na mesma chave viram string: é o que o NetworkX faz
      // ao encontrar valores heterogêneos, e o que Gephi lê sem reclamar.
      if (anterior === undefined) tipos.set(chave, tipo);
      else if (anterior !== tipo) tipos.set(chave, 'string');
    }
  }
  return { tipos };
}

function valorSerializado(valor: unknown): string {
  return typeof valor === 'boolean' ? String(valor) : String(valor);
}

export function grafoParaGexf(g: Graph): string {
  const nos = g.nodes().map((n) => g.getNodeAttributes(n) as Record<string, unknown>);
  const arestas = g.edges().map((e) => g.getEdgeAttributes(e) as Record<string, unknown>);
  const attrNo = coletarAtributos(nos);
  const attrAresta = coletarAtributos(arestas);
  const indiceNo = new Map([...attrNo.tipos.keys()].map((k, i) => [k, i]));
  const indiceAresta = new Map([...attrAresta.tipos.keys()].map((k, i) => [k, i]));

  const declarar = (classe: string, tipos: Map<string, string>) =>
    tipos.size === 0
      ? ''
      : `      <attributes class="${classe}" mode="static">\n${[...tipos.entries()]
          .map(([chave, tipo], i) => `        <attribute id="${i}" title="${escaparXml(chave)}" type="${tipo}"/>`)
          .join('\n')}\n      </attributes>\n`;

  const valores = (attrs: Record<string, unknown>, indice: Map<string, number>) => {
    const itens = Object.entries(attrs).filter(([chave, v]) => v !== null && v !== undefined && indice.has(chave));
    if (itens.length === 0) return '';
    return `\n${itens
      .map(([chave, v]) => `          <attvalue for="${indice.get(chave)}" value="${escaparXml(valorSerializado(v))}"/>`)
      .join('\n')}\n        `;
  };

  const corpoNos = g
    .nodes()
    .map((n) => {
      const attrs = g.getNodeAttributes(n) as Record<string, unknown>;
      const label = escaparXml(attrs.label ?? n);
      const interno = valores(attrs, indiceNo);
      return interno
        ? `        <node id="${escaparXml(n)}" label="${label}">\n          <attvalues>${interno}</attvalues>\n        </node>`
        : `        <node id="${escaparXml(n)}" label="${label}"/>`;
    })
    .join('\n');

  const corpoArestas = g
    .edges()
    .map((e, i) => {
      const attrs = g.getEdgeAttributes(e) as Record<string, unknown>;
      const interno = valores(attrs, indiceAresta);
      const cabecalho = `        <edge id="${i}" source="${escaparXml(g.source(e))}" target="${escaparXml(g.target(e))}"`;
      return interno
        ? `${cabecalho}>\n          <attvalues>${interno}</attvalues>\n        </edge>`
        : `${cabecalho}/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}">
    <creator>EcoGrad</creator>
    <description>Rede global da seleção ativa</description>
  </meta>
  <graph defaultedgetype="undirected" mode="static">
${declarar('node', attrNo.tipos)}${declarar('edge', attrAresta.tipos)}      <nodes>
${corpoNos}
      </nodes>
      <edges>
${corpoArestas}
      </edges>
  </graph>
</gexf>
`;
}

export function grafoParaGraphml(g: Graph): string {
  const attrNo = coletarAtributos(g.nodes().map((n) => g.getNodeAttributes(n) as Record<string, unknown>));
  const attrAresta = coletarAtributos(g.edges().map((e) => g.getEdgeAttributes(e) as Record<string, unknown>));

  // GraphML distingue as chaves de nó e de aresta pelo prefixo do id.
  const chaves = [
    ...[...attrNo.tipos.entries()].map(([chave, tipo]) =>
      `  <key id="n_${escaparXml(chave)}" for="node" attr.name="${escaparXml(chave)}" attr.type="${tipo}"/>`),
    ...[...attrAresta.tipos.entries()].map(([chave, tipo]) =>
      `  <key id="e_${escaparXml(chave)}" for="edge" attr.name="${escaparXml(chave)}" attr.type="${tipo}"/>`),
  ].join('\n');

  const dados = (attrs: Record<string, unknown>, prefixo: string, tipos: Map<string, string>) =>
    Object.entries(attrs)
      .filter(([chave, v]) => v !== null && v !== undefined && tipos.has(chave))
      .map(([chave, v]) => `        <data key="${prefixo}_${escaparXml(chave)}">${escaparXml(valorSerializado(v))}</data>`)
      .join('\n');

  const corpoNos = g
    .nodes()
    .map((n) => {
      const interno = dados(g.getNodeAttributes(n) as Record<string, unknown>, 'n', attrNo.tipos);
      return interno
        ? `      <node id="${escaparXml(n)}">\n${interno}\n      </node>`
        : `      <node id="${escaparXml(n)}"/>`;
    })
    .join('\n');

  const corpoArestas = g
    .edges()
    .map((e, i) => {
      const interno = dados(g.getEdgeAttributes(e) as Record<string, unknown>, 'e', attrAresta.tipos);
      const cabecalho = `      <edge id="e${i}" source="${escaparXml(g.source(e))}" target="${escaparXml(g.target(e))}"`;
      return interno ? `${cabecalho}>\n${interno}\n      </edge>` : `${cabecalho}/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
${chaves}${chaves ? '\n' : ''}  <graph edgedefault="undirected">
${corpoNos}
${corpoArestas}
  </graph>
</graphml>
`;
}

/** Mesma forma de `networkx.node_link_data`, que o Cytoscape e o D3 leem. */
export function grafoParaNodeLink(g: Graph): string {
  return JSON.stringify(
    {
      directed: false,
      multigraph: false,
      graph: {},
      nodes: g.nodes().map((n) => ({ id: n, ...(g.getNodeAttributes(n) as Record<string, unknown>) })),
      links: g.edges().map((e) => ({
        source: g.source(e),
        target: g.target(e),
        ...(g.getEdgeAttributes(e) as Record<string, unknown>),
      })),
    },
    null,
    2,
  );
}

export function serializarGrafo(g: Graph, formato: FormatoGrafo): string {
  if (formato === 'GEXF (Gephi)') return grafoParaGexf(g);
  if (formato === 'GraphML') return grafoParaGraphml(g);
  return grafoParaNodeLink(g);
}
