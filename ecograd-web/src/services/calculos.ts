import { WorkerTasks } from '../lib/worker-tasks';
import { useEcoGradStore } from '../stores/useEcoGradStore';
import type { SnaWorkerRequest, SnaWorkerResponse, Documento, TipoForesight } from '../types';
import type { DataWorkerRequest, DataWorkerResponse } from '../workers/data.worker';
import type { FonteMemes } from '../lib/memetics';

export type Pedido = SnaWorkerRequest | DataWorkerRequest;
export type Resultado = Exclude<SnaWorkerResponse | DataWorkerResponse, { type: 'progress' | 'error' }>;
export const atividades = new WorkerTasks<Pedido, Resultado>((pedido) => pedido.type === 'carregar'
  ? new Worker(new URL('../workers/data.worker.ts', import.meta.url), { type: 'module' })
  : new Worker(new URL('../workers/sna.worker.ts', import.meta.url), { type: 'module' }));

export function calcularSna(docs: Documento[]) {
  atividades.start('sna-global', 'Rede global', { type: 'sna-global', docs }, (r) => {
    if (r.type !== 'sna-global') return;
    useEcoGradStore.getState().setSnaGlobal(r.result);
    atividades.start('maturidade', 'Maturidade da rede', { type: 'maturidade', docs, sna: r.result }, (mat) => {
      if (mat.type === 'maturidade') useEcoGradStore.getState().setMaturidade(mat.result);
    });
  });
}
export const calcularBootstrap = (docs: Documento[], tipo: TipoForesight, nBootstrap = 100, fracaoAmostra = 0.85) =>
  atividades.start(`bootstrap:${tipo}`, `Bootstrap — ${tipo}`, { type: 'bootstrap', docs, tipo, nBootstrap, fracaoAmostra });
export const executarGridSearch = (docs: Documento[], tipo: TipoForesight) =>
  atividades.start(`grid-search:${tipo}`, `Grid Search — ${tipo}`, { type: 'grid-search', docs, tipo });
export const calcularEcologiaMemes = (docs: Documento[], minCoocorrencia: number, fonte: FonteMemes) =>
  atividades.start('ecologia-memes', `Rede memética — ${fonte}, mínimo ${minCoocorrencia}`, { type: 'ecologia-memes', docs, minCoocorrencia, fonte });
export const calcularMetricasComplexas = (docs: Documento[]) =>
  atividades.start('metricas-complexas', 'Métricas complexas', { type: 'metricas-complexas', docs });
/** `aoConcluir` roda depois de a análise ser aplicada (não sobrevive a recarregar a página). */
export function carregarDados(programas: string[], cursosTcc: string[], objetivo?: string, aoConcluir?: () => void) {
  atividades.start('dados', 'Carregamento das coleções', { type: 'carregar', objetivo, programas: [...programas], cursosTcc: [...cursosTcc] }, (r) => {
    if (r.type !== 'pronto') return;
    useEcoGradStore.getState().concluirCarregamento(r.docs, { programas: [...programas], cursosTcc: [...cursosTcc] }, r.baseVersion, objetivo);
    aoConcluir?.();
  });
}

// Mantém consumidores existentes sincronizados, mesmo quando a página não está montada.
const desligarAtividades = atividades.subscribe(() => {
  const rede = atividades.get('sna-global');
  const dados = atividades.get('dados');
  useEcoGradStore.setState({
    statusSNA: !rede ? 'ocioso' : rede.status === 'concluida' ? 'pronto' : rede.status === 'cancelada' ? 'cancelado' : rede.status === 'erro' ? 'erro' : 'calculando',
    carregando: dados?.status === 'executando' || dados?.status === 'fila',
    mensagemCarregamento: dados?.texto ?? '',
    erroCarregamento: dados?.erro ?? null,
  });
});
const desligarBase = useEcoGradStore.subscribe((state, anterior) => {
  if (state.docs !== anterior.docs) {
    atividades.clear((task) => task.id !== 'dados');
    useEcoGradStore.setState({ snaGlobal: null, maturidade: null, bootstrap: null, statusSNA: 'ocioso' });
  }
  if (state.programasSelecionados !== anterior.programasSelecionados || state.cursosTccSelecionados !== anterior.cursosTccSelecionados) {
    atividades.clear((task) => task.id === 'dados');
  }
});
if (import.meta.hot) import.meta.hot.dispose(() => {
  desligarBase();
  desligarAtividades();
  atividades.clear();
  useEcoGradStore.setState({ statusSNA: 'ocioso', carregando: false, snaGlobal: null, maturidade: null });
});

export function restaurarAtividades(tasks: import('../lib/worker-tasks').Task<Pedido, Resultado>[]) {
  atividades.restore(tasks, (task) => (r) => {
    const s = useEcoGradStore.getState();
    if (r.type === 'pronto' && task.pedido.type === 'carregar') s.concluirCarregamento(r.docs, task.pedido, r.baseVersion, task.pedido.objetivo);
    if (r.type === 'maturidade') s.setMaturidade(r.result);
    if (r.type === 'sna-global') {
      s.setSnaGlobal(r.result);
      atividades.start('maturidade', 'Maturidade da rede', { type: 'maturidade', docs: s.docs, sna: r.result }, (m) => {
        if (m.type === 'maturidade') useEcoGradStore.getState().setMaturidade(m.result);
      });
    }
  });
}
