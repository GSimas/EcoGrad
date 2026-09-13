import { iaVazia, type EstadoIA } from '../lib/ia-state';
import { aplicarPorIdentidade } from '../lib/ontologia-importacao';
import { referenciaDocumento } from '../lib/resultados';
import { objetivoPorId } from '../lib/objetivos';
import type { SelecaoColecoes } from '../lib/selecao';
import { create } from 'zustand';
import type {
  ChatMessage,
  BootstrapMap,
  Documento,
  MaturidadeRede,
  OntologiaIA,
  Rota,
  SnaGlobal,
  TipoBusca,
  TipoForesight,
} from '@/types';

export type StatusSNA = 'ocioso' | 'calculando' | 'pronto' | 'erro' | 'cancelado';

export interface Conversa {
  mensagens: ChatMessage[];
  tentativa?: { historico: ChatMessage[]; contexto: string };
  parciaisAnteriores?: string[];
  entrada: string;
  parcial: string;
  streaming: boolean;
  erro: string | null;
  contexto: string;
}
export const conversaVazia = (): Conversa => ({ mensagens: [], entrada: '', parcial: '', streaming: false, erro: null, contexto: '' });

export interface EcoGradState {
  ia: EstadoIA;
  setIA: (valor: Partial<EstadoIA>) => void;
  analysisId: string;
  baseVersion: string;
  ui: Record<string, unknown>;
  chat: Conversa;
  setChat: (value: Partial<Conversa>) => void;

  /** Tela de apresentação (antes da seleção de coleções). Persistida. */
  apresentacaoVista: boolean;
  /** Aba ativa depois que a base é carregada. */
  rota: Rota;
  /** Painel lateral recolhido (só ícones). Persistido. */
  sidebarRecolhida: boolean;

  // --- Seleção de coleções (persistida) ---
  programasSelecionados: string[];
  cursosTccSelecionados: string[];

  // --- Base ativa (checkpoint limitado no IndexedDB) ---
  docs: Documento[];
  dadosCarregados: boolean;
  carregando: boolean;
  mensagemCarregamento: string;
  erroCarregamento: string | null;

  // --- Resultados associados à versão da base ---
  snaGlobal: SnaGlobal | null;
  statusSNA: StatusSNA;
  maturidade: MaturidadeRede | null;

  // --- Foresight ---
  tipoForesight: TipoForesight;
  janelaRecente: number;
  metodoCorte: 'Percentil fixo' | 'K-Means adaptativo (4 clusters)';
  percentilCorte: number;
  usarBootstrap: boolean;
  bootstrap: BootstrapMap | null;

  fonteMemes: 'Palavras-chave' | 'Artefatos Extraídos';
  minCoocorrencia: number;
  setFonteMemes: (fonte: EcoGradState['fonteMemes']) => void;
  setMinCoocorrencia: (valor: number) => void;

  // --- Motor de busca (persistido) ---
  buscaTipo: TipoBusca;
  buscaTermo: string | null;

  // --- Ações ---
  concluirApresentacao: () => void;
  voltarParaApresentacao: () => void;
  setRota: (r: Rota) => void;
  alternarSidebar: () => void;
  setProgramas: (v: string[]) => void;
  setCursosTcc: (v: string[]) => void;
  iniciarCarregamento: () => void;
  setMensagemCarregamento: (v: string) => void;
  concluirCarregamento: (docs: Documento[], selecao?: SelecaoColecoes, baseVersion?: string, objetivo?: string) => void;
  falharCarregamento: (msg: string) => void;
  novaConsulta: () => void;

  setSnaGlobal: (sna: SnaGlobal) => void;
  setStatusSNA: (s: StatusSNA) => void;
  setMaturidade: (m: MaturidadeRede | null) => void;

  setTipoForesight: (t: TipoForesight) => void;
  setJanelaRecente: (n: number) => void;
  setMetodoCorte: (m: EcoGradState['metodoCorte']) => void;
  setPercentilCorte: (p: number) => void;
  setUsarBootstrap: (v: boolean) => void;
  setBootstrap: (b: BootstrapMap | null) => void;

  navegarDocumento: (indice: number) => void;
  navegarPara: (tipo: TipoBusca, termo: string | null) => void;

  /** Injeta ontologias (lote da IA ou upload de CSV) sem recriar a base inteira. */
  aplicarOntologia: (porId: Map<string, OntologiaIA>, substituir?: boolean, antesDeAplicar?: () => void) => Promise<number>;
}

/** Rótulo da badge "Análise Ativa" na Sidebar. */
export function rotuloAnaliseAtiva(state: Pick<EcoGradState, 'programasSelecionados' | 'cursosTccSelecionados'>): string {
  const nomes = [...state.programasSelecionados, ...state.cursosTccSelecionados];
  if (nomes.length === 0) return 'Base carregada';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.length} Origem(ns) Selecionada(s)`;
}

export const useEcoGradStore = create<EcoGradState>()((set, get) => ({
      analysisId: crypto.randomUUID(),
      baseVersion: '',
      ui: {},
      ia: iaVazia(),
      setIA: (valor) => set((s)=>({ia:{...s.ia,...valor}})),
      chat: conversaVazia(),
      setChat: (value) => set((s) => ({ chat: { ...s.chat, ...value } })),
      apresentacaoVista: false,
      rota: 'dashboard',
      sidebarRecolhida: false,

      programasSelecionados: [],
      cursosTccSelecionados: [],

      docs: [],
      dadosCarregados: false,
      carregando: false,
      mensagemCarregamento: '',
      erroCarregamento: null,

      snaGlobal: null,
      statusSNA: 'ocioso',
      maturidade: null,

      tipoForesight: 'Palavra-chave',
      janelaRecente: 3,
      metodoCorte: 'Percentil fixo',
      percentilCorte: 0.65,
      usarBootstrap: false,
      bootstrap: null,

      fonteMemes: 'Palavras-chave',
      minCoocorrencia: 3,
      setFonteMemes: (fonteMemes) => set({ fonteMemes }),
      setMinCoocorrencia: (minCoocorrencia) => set({ minCoocorrencia }),
      buscaTipo: 'Documento',
      buscaTermo: null,

      concluirApresentacao: () => set({ apresentacaoVista: true }),
      voltarParaApresentacao: () => set({ apresentacaoVista: false }),
      setRota: (r) => set({ rota: r }),
      alternarSidebar: () => set((e) => ({ sidebarRecolhida: !e.sidebarRecolhida })),
      setProgramas: (v) => set({ programasSelecionados: v }),
      setCursosTcc: (v) => set({ cursosTccSelecionados: v }),

      iniciarCarregamento: () =>
        set({
          carregando: true,
          erroCarregamento: null,
          mensagemCarregamento: 'Lendo as bases de dados e filtrando a seleção...',
        }),

      setMensagemCarregamento: (v) => set({ mensagemCarregamento: v }),

      concluirCarregamento: (docs, selecao, baseVersion = '', objetivo) =>
        set({
          analysisId: crypto.randomUUID(),
          ia: iaVazia(),
          baseVersion,
          ui: { ...get().ui, 'selecao.rascunho': undefined, 'dossie.documento': undefined, 'ontologia.processando': false, 'ontologia.status': '', 'ontologia.erros': [], 'ontologia.upload': null },
          ...(selecao && docs.length ? { programasSelecionados: selecao.programas, cursosTccSelecionados: selecao.cursosTcc } : {}),
          rota: objetivoPorId(objetivo).rota,
          ...(objetivoPorId(objetivo).buscaTipo ? { buscaTipo: objetivoPorId(objetivo).buscaTipo } : {}),
          docs,
          dadosCarregados: docs.length > 0,
          carregando: false,
          mensagemCarregamento: '',
          erroCarregamento: docs.length === 0 ? 'Nenhum documento encontrado para a seleção atual.' : null,
          // A rede precisa ser recalculada para a nova base
          snaGlobal: null,
          statusSNA: 'ocioso',
          maturidade: null,
          bootstrap: null,
          buscaTermo: null,
        }),

      falharCarregamento: (msg) =>
        set({ carregando: false, erroCarregamento: msg, mensagemCarregamento: '' }),

      novaConsulta: () =>
        set({
          analysisId: crypto.randomUUID(),
          ia: iaVazia(),
          baseVersion: '',
          ui: {},
          chat: conversaVazia(),
          docs: [],
          dadosCarregados: false,
          carregando: false,
          erroCarregamento: null,
          snaGlobal: null,
          statusSNA: 'ocioso',
          maturidade: null,
          bootstrap: null,
          buscaTermo: null,
          programasSelecionados: [],
          cursosTccSelecionados: [],
          // Volta para a seleção de coleções, não para a apresentação
          rota: 'dashboard',
        }),

      setSnaGlobal: (sna) => set({ snaGlobal: sna, statusSNA: 'pronto' }),
      setStatusSNA: (s) => set({ statusSNA: s }),
      setMaturidade: (m) => set({ maturidade: m }),

      setTipoForesight: (t) => set({ tipoForesight: t, bootstrap: null }),
      setJanelaRecente: (n) => set({ janelaRecente: n }),
      setMetodoCorte: (m) => set({ metodoCorte: m }),
      setPercentilCorte: (p) => set({ percentilCorte: p }),
      setUsarBootstrap: (v) => set({ usarBootstrap: v }),
      setBootstrap: (b) => set({ bootstrap: b }),

      // Além de fixar a entidade, leva para o Motor de Busca — assim um clique
      // em qualquer nome do Dashboard abre o dossiê correspondente.
      navegarPara: (tipo, termo) => set((s) => ({ buscaTipo: tipo, buscaTermo: termo, rota: 'busca', ui: { ...s.ui, 'dossie.documento': undefined } })),
      navegarDocumento: (indice) => {
        const ref = referenciaDocumento(get().docs, indice);
        if (ref) set((s) => ({ buscaTipo: 'Documento', buscaTermo: ref.titulo, rota: 'busca', ui: { ...s.ui, 'dossie.documento': ref } }));
      },

      aplicarOntologia: async (porId, substituir = false, antesDeAplicar) => {
        const { docs, analysisId } = get();
        const {proximos,atualizados}=await aplicarPorIdentidade(docs,porId,substituir);
        antesDeAplicar?.();
        if(get().analysisId!==analysisId || get().docs!==docs) throw new Error('A análise mudou. Revise novamente antes de aplicar.');
        if(atualizados>0)set({docs:proximos,bootstrap:null});
        return atualizados;
      },
}));
