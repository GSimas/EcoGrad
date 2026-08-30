/**
 * Estado global do EcoGrad (substitui o `st.session_state` do Streamlit).
 *
 * Persistência: apenas a *seleção* e o estado de UI vão para o sessionStorage.
 * Os documentos (centenas de MB depois de descomprimidos) nunca são persistidos —
 * ao retomar a sessão, o app recarrega a base a partir da seleção salva.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BootstrapMap,
  Documento,
  MaturidadeRede,
  OntologiaIA,
  Rota,
  SnaGlobal,
  TipoBusca,
  TipoForesight,
} from '@/types';

export type StatusSNA = 'ocioso' | 'calculando' | 'pronto' | 'erro';

export interface EcoGradState {
  /** Tela de apresentação (antes da seleção de coleções). Persistida. */
  apresentacaoVista: boolean;
  /** Aba ativa depois que a base é carregada. */
  rota: Rota;

  // --- Seleção de coleções (persistida) ---
  programasSelecionados: string[];
  cursosTccSelecionados: string[];

  // --- Base ativa (volátil) ---
  docs: Documento[];
  dadosCarregados: boolean;
  carregando: boolean;
  mensagemCarregamento: string;
  erroCarregamento: string | null;

  // --- Rede complexa (volátil) ---
  snaGlobal: SnaGlobal | null;
  statusSNA: StatusSNA;
  progressoSNA: number;
  textoProgressoSNA: string;
  maturidade: MaturidadeRede | null;

  // --- Foresight ---
  tipoForesight: TipoForesight;
  janelaRecente: number;
  metodoCorte: 'Percentil fixo' | 'K-Means adaptativo (4 clusters)';
  percentilCorte: number;
  usarBootstrap: boolean;
  bootstrap: BootstrapMap | null;

  // --- Motor de busca (persistido) ---
  buscaTipo: TipoBusca;
  buscaTermo: string | null;

  // --- Ações ---
  concluirApresentacao: () => void;
  voltarParaApresentacao: () => void;
  setRota: (r: Rota) => void;
  setProgramas: (v: string[]) => void;
  setCursosTcc: (v: string[]) => void;
  iniciarCarregamento: () => void;
  setMensagemCarregamento: (v: string) => void;
  concluirCarregamento: (docs: Documento[]) => void;
  falharCarregamento: (msg: string) => void;
  novaConsulta: () => void;

  setProgressoSNA: (valor: number, texto: string) => void;
  setSnaGlobal: (sna: SnaGlobal) => void;
  setStatusSNA: (s: StatusSNA) => void;
  setMaturidade: (m: MaturidadeRede | null) => void;

  setTipoForesight: (t: TipoForesight) => void;
  setJanelaRecente: (n: number) => void;
  setMetodoCorte: (m: EcoGradState['metodoCorte']) => void;
  setPercentilCorte: (p: number) => void;
  setUsarBootstrap: (v: boolean) => void;
  setBootstrap: (b: BootstrapMap | null) => void;

  navegarPara: (tipo: TipoBusca, termo: string | null) => void;

  /** Injeta ontologias (lote da IA ou upload de CSV) sem recriar a base inteira. */
  aplicarOntologia: (porTitulo: Map<string, OntologiaIA>) => number;
}

/** Rótulo da badge "Análise Ativa" na Sidebar. */
export function rotuloAnaliseAtiva(state: Pick<EcoGradState, 'programasSelecionados' | 'cursosTccSelecionados'>): string {
  const nomes = [...state.programasSelecionados, ...state.cursosTccSelecionados];
  if (nomes.length === 0) return 'Base carregada';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.length} Origem(ns) Selecionada(s)`;
}

export const useEcoGradStore = create<EcoGradState>()(
  persist(
    (set, get) => ({
      apresentacaoVista: false,
      rota: 'dashboard',

      programasSelecionados: [],
      cursosTccSelecionados: [],

      docs: [],
      dadosCarregados: false,
      carregando: false,
      mensagemCarregamento: '',
      erroCarregamento: null,

      snaGlobal: null,
      statusSNA: 'ocioso',
      progressoSNA: 0,
      textoProgressoSNA: '',
      maturidade: null,

      tipoForesight: 'Palavra-chave',
      janelaRecente: 3,
      metodoCorte: 'Percentil fixo',
      percentilCorte: 0.65,
      usarBootstrap: false,
      bootstrap: null,

      buscaTipo: 'Documento',
      buscaTermo: null,

      concluirApresentacao: () => set({ apresentacaoVista: true }),
      voltarParaApresentacao: () => set({ apresentacaoVista: false }),
      setRota: (r) => set({ rota: r }),
      setProgramas: (v) => set({ programasSelecionados: v }),
      setCursosTcc: (v) => set({ cursosTccSelecionados: v }),

      iniciarCarregamento: () =>
        set({
          carregando: true,
          erroCarregamento: null,
          mensagemCarregamento: 'Lendo as bases de dados e filtrando a seleção...',
        }),

      setMensagemCarregamento: (v) => set({ mensagemCarregamento: v }),

      concluirCarregamento: (docs) =>
        set({
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
          docs: [],
          dadosCarregados: false,
          carregando: false,
          erroCarregamento: null,
          snaGlobal: null,
          statusSNA: 'ocioso',
          progressoSNA: 0,
          textoProgressoSNA: '',
          maturidade: null,
          bootstrap: null,
          buscaTermo: null,
          programasSelecionados: [],
          cursosTccSelecionados: [],
          // Volta para a seleção de coleções, não para a apresentação
          rota: 'dashboard',
        }),

      setProgressoSNA: (valor, texto) => set({ progressoSNA: valor, textoProgressoSNA: texto }),
      setSnaGlobal: (sna) => set({ snaGlobal: sna, statusSNA: 'pronto', progressoSNA: 100 }),
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
      navegarPara: (tipo, termo) => set({ buscaTipo: tipo, buscaTermo: termo, rota: 'busca' }),

      aplicarOntologia: (porTitulo) => {
        const { docs } = get();
        let atualizados = 0;
        // Mapa por título normalizado, igual ao upload de CSV do Streamlit
        const proximos = docs.map((d) => {
          const onto = porTitulo.get(d.titulo.trim().toLowerCase());
          if (!onto) return d;
          atualizados += 1;
          return { ...d, ontologia_ia: onto };
        });
        if (atualizados > 0) set({ docs: proximos, bootstrap: null });
        return atualizados;
      },
    }),
    {
      name: 'ecograd-sessao',
      storage: createJSONStorage(() => sessionStorage),
      // Apenas seleção e preferências. `docs`/`snaGlobal` são grandes demais e
      // voláteis por natureza — são reconstruídos a partir da seleção.
      partialize: (s) => ({
        apresentacaoVista: s.apresentacaoVista,
        rota: s.rota,
        programasSelecionados: s.programasSelecionados,
        cursosTccSelecionados: s.cursosTccSelecionados,
        buscaTipo: s.buscaTipo,
        buscaTermo: s.buscaTermo,
        tipoForesight: s.tipoForesight,
        janelaRecente: s.janelaRecente,
        metodoCorte: s.metodoCorte,
        percentilCorte: s.percentilCorte,
        usarBootstrap: s.usarBootstrap,
      }),
    },
  ),
);
