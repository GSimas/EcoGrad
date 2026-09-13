/**
 * Tipos canônicos do EcoGrad.
 * Espelham o schema dos documentos produzidos por `pipeline_ufsc.py`
 * e normalizados por `_normalizar_documentos` (backend.py:50).
 */

export interface OntologiaIA {
  teorias_e_modelos: string[];
  ferramentas_e_artefatos: string[];
  metodos_e_tecnicas: string[];
}

export interface Documento {
  titulo: string;
  nivel_academico: string;
  autores: string[];
  orientador: string;
  co_orientadores: string[];
  possui_coorientador?: boolean;
  palavras_chave: string[];
  macrotema: string;
  resumo: string;
  programa_origem: string;
  url: string;
  /** Normalizado para `number | null` pelo data-loader. */
  ano: number | null;
  /** Peculiaridade temática pré-computada pelo pipeline (0–100). */
  pureza_nmf?: number;
  ontologia_ia?: OntologiaIA | string;
}

/** Nível acadêmico canônico — `_normalizar_nivel` (backend.py:1743). */
export type NivelCanonico = 'Teses' | 'Dissertações' | 'TCC' | 'Outros';

/** Categorias de nó do multigrafo global. */
export type TipoNo =
  | 'Documento'
  | 'Autor'
  | 'Orientador'
  | 'Co-orientador'
  | 'Palavra-chave'
  | 'Macrotema'
  | 'Artefato (Ontologia IA)'
  | 'Conceito'
  | 'Desconhecido';

/** Entidades pesquisáveis no Motor de Busca. */
export type TipoBusca =
  | 'Documento'
  | 'Autor'
  | 'Orientador'
  | 'Co-orientador'
  | 'Palavra-chave'
  | 'Macrotema';

/** Dimensão de análise do Radar de Foresight. */
export type TipoForesight = 'Palavra-chave' | 'Macrotema' | 'Artefatos (Ontologia IA)';

/** Métricas SNA por nó — saída de `calcular_sna_global` (backend.py:1993). */
export interface MetricasSNA {
  Tipo: TipoNo;
  'Grau Absoluto': number;
  'Degree Centrality': number;
  Betweenness: number;
  Closeness: number;
  Clustering: number;
  Comunidade: number | 'N/A';
  'Ranking Global': number | 'N/A';
}

export type SnaGlobal = Record<string, MetricasSNA>;

/** Métricas topológicas agregadas — `calcular_metricas_complexas` (backend.py:1255). */
export interface MetricasComplexas {
  densidade: number;
  links: { media: number; min: number; max: number; std: number };
  eficiencia: number;
  redundancia: number;
  entropia: number;
  clustering: number;
  pagerank_avg: number;
  eigen_avg: number;
  constraint_avg: number;
  n_nos: number;
}

/** Maturidade topológica — `calcular_maturidade_rede` (backend.py:1423). */
export interface MaturidadeRede {
  Assortatividade: number;
  Rich_Club: number;
  Gamma: number;
  Spearman: number;
}

export type Quadrante =
  | '↗️ Tendência'
  | '↖️ Sinal Fraco'
  | '↘️ Mainstream'
  | '↙️ Base/Declínio';

/** Linha do Radar — `preparar_radar_foresight` (backend.py:460). */
export interface ForesightRow {
  Termo: string;
  Total: number;
  'Aparições Recentes': number;
  'Tração (%)': number;
  'Momentum (Burst)': number;
  'Novidade (Estrutural * IDF)': number;
  'Bet. Robusto?': boolean;
  'Bet. IQR': number | null;
  Quadrante?: Quadrante;
  cluster_id?: number;
}

export interface BootstrapStat {
  median: number;
  p25: number;
  p75: number;
  std: number;
  n_obs: number;
}

export type BootstrapMap = Record<string, BootstrapStat>;

/** Linha do Grid Search — `otimizar_parametros_foresight` (backend.py:248). */
export interface GridSearchRow {
  'Ano Corte': number;
  'Passado (Burst)': number;
  'Futuro (Previsão)': number;
  'Corte (%)': number;
  'MCC (Robusto)': number;
  'F1-Score': number;
  Precisão: number;
  Recall: number;
  'N Total': number;
  'Verdadeiros (+)': number;
  'Falsos (+)': number;
  'Verdadeiros (-)': number;
  'Falsos (-)': number;
}

/** Linha do backtest — `validar_foresight_historico` (backend.py:328). */
export interface BacktestRow {
  Termo: string;
  'Previsão Passada (T1)': Quadrante;
  'Vol. T1': number;
  'Vol. T2 (Futuro)': number;
  'Variação Real Uso (%)': number;
  'Veredito do Modelo': string;
}

/** Linha da tabela de Quociente Locacional. */
export interface LinhaQL {
  Entidade: string;
  Tipo: string;
  Teses: number;
  Dissertações: number;
  Outros: number;
  Total: number;
  'Valor QL': number;
}

/** Memética — `calcular_metricas_memeticas` (backend.py:1008). */
export interface FecundidadeRow {
  meme: string;
  fecundidade: number;
}

export interface LongevidadeRow {
  meme: string;
  ano_nascimento: number;
  ano_extincao: number;
  total_aparicoes: number;
  tempo_vida_anos: number;
}

export interface MetricasMemeticas {
  fecundidade: FecundidadeRow[];
  longevidade: LongevidadeRow[];
  mortalidade: number;
  sobreviventes: number;
  memesMortos: string[];
  memesVivos: FecundidadeRow[];
}

/** Item de similaridade Jaccard — `calcular_similares_rede` (backend.py:1628). */
export interface SimilarItem {
  Item: string;
  'Similaridade (%)': number;
  'Qtd. Traços': number;
  'Traços em Comum': string;
  Nível: string | null;
  Tipo: string;
}

export type SimilaresAgrupados = Record<string, SimilarItem[]>;

/** Ficha oficial da CAPES/Sucupira. */
export interface ProgramaCapes {
  Nome: string;
  Código: string;
  Nota: string;
  'Grande Área': string;
  'Área de Avaliação': string;
  'Área de Conhecimento': string;
  Modalidade: string;
  Situação: string;
  'Modalidade de Ensino': string;
  'Grau Acadêmico': string;
}

/** Contrato versionado: nomes são atributos, o código oficial é a identidade. */
export interface CatalogoCapes {
  versao: 2;
  programas: Record<string, ProgramaCapes>;
  fonte: { url: string; idIes: string; consultadoEm: string; totalProgramas: number };
}

/** Catálogo leve de PPGs: nome → setSpec do repositório. */
export type CatalogoProgramas = Record<string, string>;

export interface ColecaoTCC {
  curso: string;
  setSpec: string;
  handle: string;
}

/** Nós/arestas normalizados para o renderizador de grafo. */
export interface GraphNode {
  id: string;
  label: string;
  tipo: TipoNo;
  size: number;
  color: string;
  shape: string;
  title: string;
  ano?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  color: string;
  width: number;
  ano?: number;
}

export interface GraphPayload {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** Índices invertidos para busca O(1) (Principal.py:247). */
export interface IndicesInvertidos {
  por_titulo: Map<string, Documento>;
  por_autor: Map<string, Documento[]>;
  por_orientador: Map<string, Documento[]>;
  por_coorientador: Map<string, Documento[]>;
  por_palavra_chave: Map<string, Documento[]>;
  por_macrotema: Map<string, Documento[]>;
}

/** Mensagens do worker de SNA. */
// Importado como tipo puro: a implementação vive em `lib/memetic-network.ts`.
import type { EcologiaMemetica } from '@/lib/memetic-network';

export type SnaWorkerRequest =
  | { type: 'sna-global'; docs: Documento[] }
  | { type: 'maturidade'; docs: Documento[]; sna: SnaGlobal }
  | { type: 'metricas-complexas'; docs: Documento[] }
  | {
      type: 'bootstrap';
      docs: Documento[];
      tipo: TipoForesight;
      nBootstrap: number;
      fracaoAmostra: number;
    }
  | { type: 'grid-search'; docs: Documento[]; tipo: TipoForesight }
  | {
      type: 'ecologia-memes';
      docs: Documento[];
      minCoocorrencia: number;
      fonte: 'Palavras-chave' | 'Artefatos Extraídos';
    };

export type SnaWorkerResponse =
  | { type: 'progress'; value: number | null; text: string }
  | { type: 'sna-global'; result: SnaGlobal }
  | { type: 'maturidade'; result: MaturidadeRede }
  | { type: 'metricas-complexas'; result: MetricasComplexas | null }
  | { type: 'bootstrap'; result: BootstrapMap }
  | { type: 'grid-search'; grid: GridSearchRow[]; backtest: BacktestRow[] }
  | { type: 'ecologia-memes'; result: EcologiaMemetica }
  | { type: 'error'; message: string };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Telas da aplicação. Vive aqui (e não no Sidebar) para que o store possa
 * trocar de rota — é o que permite a um clique no Dashboard abrir o Motor de
 * Busca já com a entidade selecionada — sem criar import circular.
 */
export type Rota = 'dashboard' | 'busca' | 'foresight' | 'memetica' | 'chat';
