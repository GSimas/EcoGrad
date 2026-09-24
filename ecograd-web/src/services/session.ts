import { iaVazia, recuperarIA, type EstadoIA } from '../lib/ia-state';
import { create } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import { useEcoGradStore, type EcoGradState, type Conversa } from '../stores/useEcoGradStore';
import { atividades, restaurarAtividades, type Pedido, type Resultado } from './calculos';
import type { Task } from '../lib/worker-tasks';
import { fitsAnalysis, decode, encode, encodeComProntos, encodeEmFatias, envelope, recoveryDecision, saveText, validateEnvelope, reconcileTasks, recoverConversation, type Codificado } from '../lib/session-codec';
import { readAnalysis, writeAnalysis, type StoredAnalysis } from '../lib/session-db';
import type { PedidoSessao, RespostaSessao } from '../workers/sessao.worker';
import { cederVez } from '../lib/fatias';
import { validarRecorte } from '../lib/recorte';
import { versaoPublicada } from '../lib/base-version';

const TEXT_KEY = 'ecograd-session-v1';
const ID_KEY = 'ecograd-tab-id';
export const useRecovery = create<{ message: string; error: string; saved: string; saving: boolean }>(() => ({ message: '', error: '', saved: '', saving: false }));
function light(s: EcoGradState) {
  const { analysisId, baseVersion, apresentacaoVista, rota, sidebarRecolhida, programasSelecionados, cursosTccSelecionados, recorte,
    buscaTipo, buscaTermo, tipoForesight, janelaRecente, metodoCorte, percentilCorte, usarBootstrap, fonteMemes, minCoocorrencia, ui, chat } = s;
  return { activityIntents: atividades.getSnapshot().map(({ id, titulo, pedido, status, executionId }) => ({ id, titulo, pedido: compactPedido(pedido), status, executionId })), analysisId, baseVersion, apresentacaoVista, rota, sidebarRecolhida, programasSelecionados, cursosTccSelecionados, recorte,
    buscaTipo, buscaTermo, tipoForesight, janelaRecente, metodoCorte, percentilCorte, usarBootstrap, fonteMemes, minCoocorrencia, ui, chat };
}
function validLight(value: Record<string, unknown>): boolean {
  const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  const chat = value.chat as Conversa | undefined;
  return typeof value.analysisId === 'string' && strings(value.programasSelecionados) && strings(value.cursosTccSelecionados)
    && ['dashboard', 'busca', 'avancada', 'exploracao', 'foresight', 'memetica', 'chat'].includes(String(value.rota))
    && !!value.ui && typeof value.ui === 'object' && !!chat && Array.isArray(chat.mensagens)
    && chat.mensagens.every((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    && typeof chat.entrada === 'string' && typeof chat.parcial === 'string' && typeof chat.contexto === 'string'
    && typeof chat.streaming === 'boolean' && (chat.erro === null || typeof chat.erro === 'string')
    && ['apresentacaoVista', 'sidebarRecolhida', 'usarBootstrap'].every((key) => typeof value[key] === 'boolean')
    && ['janelaRecente', 'percentilCorte', 'minCoocorrencia'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))
    && typeof value.baseVersion === 'string' && !Array.isArray(value.ui)
    && (value.recorte === undefined || Array.isArray(value.recorte));
}
function compactPedido(p: Pedido) { const { docs: _docs, sna: _sna, ...small } = p as Pedido & { docs?: unknown; sna?: unknown }; return small; }
function snapshot(client: QueryClient) {
  const s = useEcoGradStore.getState();
  return envelope({
    ia: s.ia, docs: s.docs, snaGlobal: s.snaGlobal, maturidade: s.maturidade,
    tasks: atividades.getSnapshot().filter((t) => t.id !== 'dados' || t.status !== 'concluida').map((t) => ({ ...t,
      pedido: compactPedido(t.pedido), pedidoResultado: t.pedidoResultado && compactPedido(t.pedidoResultado),
      resultado: t.resultado?.type === 'pronto' ? undefined : t.resultado,
    })),
    queries: client.getQueryCache().getAll().filter((q) => q.queryKey[0] === 'sintese' && q.state.status === 'success')
      .map((q) => ({ key: q.queryKey, data: q.state.data, updated: q.state.dataUpdatedAt })),
  }, s.analysisId, s.baseVersion);
}
let tabId = '';
let client: QueryClient;
let active = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let queue = Promise.resolve();
let revision = 0;
let textError = '';
let analysisError = '';
const reportError = () => useRecovery.setState({ error: [textError, analysisError].filter(Boolean).join(' ') });
/**
 * Rascunhos, filtros e o texto da conversa mudam a cada tecla e a cada trecho
 * da resposta. Gravar o texto leve a cada mudança serializava tudo de novo na
 * main thread; agora vai no máximo uma gravação por intervalo curto. Sair da
 * aba (`pagehide`), escondê-la ou salvar a análise gravam na hora.
 */
let timerLeve: ReturnType<typeof setTimeout> | undefined;
function agendarLeve() {
  if (timerLeve === undefined) timerLeve = setTimeout(saveLight, 150);
}
function saveLight() {
  clearTimeout(timerLeve);
  timerLeve = undefined;
  try {
    const s = useEcoGradStore.getState();
    const data = light(s);
    textError = saveText(sessionStorage, TEXT_KEY, encode(envelope(data, s.analysisId, s.baseVersion))) ?? '';
    if (textError) {
      const fallback = { ...data, ui: {}, chat: { mensagens: [], entrada: '', parcial: '', streaming: false, erro: null, contexto: '' },
        persistenceWarning: 'Os textos e filtros detalhados não puderam ser salvos. A seleção e a análise foram recuperadas quando disponíveis.' };
      saveText(sessionStorage, TEXT_KEY, encode(envelope(fallback, s.analysisId, s.baseVersion)));
    }
  }
  catch { textError = 'O navegador bloqueou o armazenamento de textos.'; }
  reportError();
}
/**
 * `writeAnalysis` no `sessao.worker`. A transação lê de volta as sessões
 * guardadas — textos de dezenas de MB — para decidir o despejo, e isso não pode
 * travar a página. Sem worker, ou se ele cair, a mesma função roda aqui.
 */
let gravador: Worker | null | undefined;
let ultimaGravacao = 0;
const gravacoes = new Map<number, { aba: string; valor?: StoredAnalysis; ok: () => void; falha: (e: unknown) => void }>();
function obterGravador(): Worker | null {
  if (gravador !== undefined) return gravador;
  try {
    const w = new Worker(new URL('../workers/sessao.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<RespostaSessao>) => {
      const p = gravacoes.get(e.data.id);
      if (!p) return;
      gravacoes.delete(e.data.id);
      if (e.data.ok) p.ok();
      else p.falha(new Error(e.data.mensagem));
    };
    // Um worker que não carregou não é falha de armazenamento: o que estava
    // pendente é gravado aqui mesmo, e as próximas gravações também.
    w.onerror = (e) => {
      e.preventDefault();
      w.terminate();
      gravador = null;
      for (const p of gravacoes.values()) writeAnalysis(p.aba, p.valor).then(p.ok, p.falha);
      gravacoes.clear();
    };
    gravador = w;
  } catch { gravador = null; }
  return gravador;
}
function gravarAnalise(aba: string, valor?: StoredAnalysis): Promise<void> {
  const w = obterGravador();
  if (!w) return writeAnalysis(aba, valor);
  const id = ++ultimaGravacao;
  return new Promise((ok, falha) => {
    gravacoes.set(id, { aba, valor, ok, falha });
    w.postMessage({ id, aba, valor } satisfies PedidoSessao);
  });
}

/**
 * JSON dos objetos grandes do checkpoint — a base, as métricas da rede, os
 * resultados das atividades —, por identidade. Eles são sempre substituídos,
 * nunca alterados no lugar: um objeto já visto tem o mesmo JSON. Assim o
 * checkpoint que segue o fim do SNA não serializa a base inteira de novo.
 */
const jsonPronto = new WeakMap<object, Codificado>();
/**
 * O resultado de uma atividade é um envelope (`{ type, result }`) em volta de
 * objetos que o store também guarda — a rede do SNA é o mesmo `snaGlobal`.
 * Guardar o JSON do envelope duplicava o do objeto; guarda-se o de cada objeto
 * que ele carrega, e o envelope só quando não carrega nenhum.
 */
const objetosDoResultado = (resultado: object) => {
  const filhos = Object.values(resultado).filter((v): v is object => !!v && typeof v === 'object');
  return filhos.length ? filhos : [resultado];
};
async function prontosDoCheckpoint(value: ReturnType<typeof snapshot>): Promise<Map<object, Codificado>> {
  const { ia, docs, snaGlobal, tasks } = value.data;
  const grandes = [ia, docs, snaGlobal, ...tasks.flatMap((t) => t.resultado ? objetosDoResultado(t.resultado) : [])]
    .filter((x): x is NonNullable<typeof x> & object => !!x && typeof x === 'object');
  const prontos = new Map<object, Codificado>();
  for (const obj of grandes) {
    let pronto = jsonPronto.get(obj);
    if (!pronto) {
      // Em fatias: a base de uma coleção grande tem dezenas de MB de JSON.
      pronto = await encodeEmFatias(obj, cederVez);
      jsonPronto.set(obj, pronto);
    }
    prontos.set(obj, pronto);
  }
  return prontos;
}
export function saveSession() {
  if (!active) return;
  clearTimeout(timer);
  saveLight();
  const generation = ++revision;
  useRecovery.setState({ saving: true });
  queue = queue.then(async () => {
    if (generation !== revision) return;
    try {
      const value = snapshot(client);
      const prontos = await prontosDoCheckpoint(value);
      // Enquanto as fatias eram serializadas, outro checkpoint pode ter sido pedido.
      if (generation !== revision) return;
      const { texto: text, bytes } = encodeComProntos(value, prontos);
      if (!fitsAnalysis(bytes)) {
        await gravarAnalise(tabId);
        throw new Error('A análise excede 64 MiB. Continua disponível nesta aba, mas precisará ser carregada novamente após recarregar.');
      }
      await gravarAnalise(tabId, { id: tabId, updated: value.updated, text, bytes });
      if (generation !== revision) return;
      analysisError = '';
      useRecovery.setState({ saved: new Date().toLocaleTimeString('pt-BR'), saving: false });
    } catch {
      // Delete a prior checkpoint rather than present it later as the latest state.
      try { await gravarAnalise(tabId); } catch { /* quota/blocked storage */ }
      analysisError = 'Não foi possível salvar a análise (limite de 64 MiB ou armazenamento bloqueado/cheio). Ela continua disponível nesta aba.';
      if (generation === revision) useRecovery.setState({ saving: false });
    }
    reportError();
  });
}
function schedule() {
  if (!active) return;
  useRecovery.setState({ saving: true });
  clearTimeout(timer);
  timer = setTimeout(saveSession, 250);
}
export async function initializeSession(queryClient: QueryClient) {
  client = queryClient;
  try {
    const previousTabId = sessionStorage.getItem(ID_KEY);
    // A duplicated tab may inherit sessionStorage: fork the checkpoint on each boot.
    tabId = crypto.randomUUID();
    sessionStorage.setItem(ID_KEY, tabId);
    const raw = sessionStorage.getItem(TEXT_KEY);
    let intents: Task<Pedido, Resultado>[] | undefined;
    if (raw) {
      const parsed = decode(raw);
      if (!validateEnvelope(parsed) || !validLight(parsed.data)) throw new Error('A sessão salva expirou ou está incompatível/corrompida.');
      const textWarning = typeof parsed.data.persistenceWarning === 'string' ? parsed.data.persistenceWarning : '';
      if (textWarning) useRecovery.setState({ message: textWarning });
      // Whitelist persisted keys: never restore actions/functions from storage.
      const allowed = Object.keys(light(useEcoGradStore.getState()));
      const values = Object.fromEntries(allowed.map((key) => [key, parsed.data[key]]));
      intents = values.activityIntents as Task<Pedido, Resultado>[] | undefined;
      delete values.activityIntents;
      const chat = values.chat as Conversa;
      values.chat = recoverConversation(chat);
      // Sessões anteriores ao consultor de IA flutuante (hoje UFSCão) podem trazer a antiga página de chat.
      if (values.rota === 'chat') values.rota = 'dashboard';
      const ui = { ...(values.ui as Record<string, unknown>) };
      if (ui['ontologia.processando']) {
        ui['ontologia.processando'] = false;
        ui['ontologia.status'] = 'Extração interrompida pelo recarregamento. Os documentos já enriquecidos foram preservados. Processe o próximo lote para continuar.';
      }
      values.ui = ui;
      // O recorte volta do armazenamento do navegador: só entra o que está bem formado.
      values.recorte = validarRecorte(values.recorte);
      useEcoGradStore.setState(values);
    }
    const saved = previousTabId ? await readAnalysis(previousTabId) : undefined;
    if (!saved && previousTabId && raw) useRecovery.setState({ message: 'A análise salva não está mais disponível neste navegador. Textos e preferências foram recuperados; carregue novamente as coleções.' });
    if (saved) {
      const parsed = decode(saved.text);
      if (!validateEnvelope(parsed)) throw new Error('A análise salva expirou ou está incompatível/corrompida.');
      let version: string | null = null;
      try { version = await versaoPublicada(); } catch { /* do not trust scientific results without version verification */ }
      const noBase = Array.isArray(parsed.data.docs) && parsed.data.docs.length === 0 && parsed.baseVersion === '';
      const decision = recoveryDecision({ ...parsed, baseVersion: noBase ? version ?? 'no-base' : parsed.baseVersion }, useEcoGradStore.getState().analysisId, noBase ? version ?? 'no-base' : version);
      if (decision === 'restore') {
        const data = parsed.data;
        if (!Array.isArray(data.docs) || !Array.isArray(data.tasks) || !Array.isArray(data.queries)) throw new Error('Análise salva inválida.');
        useEcoGradStore.setState({ docs: data.docs as EcoGradState['docs'], dadosCarregados: data.docs.length > 0, baseVersion: parsed.baseVersion });
        useEcoGradStore.setState({ ia: data.ia ? recuperarIA(data.ia as EstadoIA) : iaVazia() });
        useEcoGradStore.setState({ snaGlobal: data.snaGlobal as EcoGradState['snaGlobal'], maturidade: data.maturidade as EcoGradState['maturidade'] });
        const inflate = (p: Pedido) => p.type === 'carregar' ? p : { ...p, docs: data.docs, ...(p.type === 'maturidade' ? { sna: data.snaGlobal } : {}) } as Pedido;
        restaurarAtividades(reconcileTasks(data.tasks as Task<Pedido, Resultado>[], intents)
          .filter((t) => t.pedido.type !== 'maturidade' || !!data.snaGlobal).map((t) => ({ ...t, pedido: inflate(t.pedido), pedidoResultado: t.pedidoResultado && inflate(t.pedidoResultado) })));
        for (const q of data.queries as { key: unknown[]; data: unknown; updated: number }[]) {
          if (q.key[0] === 'sintese') client.setQueryData(q.key, q.data, { updatedAt: q.updated });
        }
        useRecovery.setState({ message: [useRecovery.getState().message, 'Sessão recuperada. Cálculos e respostas interrompidos podem ser reiniciados manualmente.'].filter(Boolean).join(' ') });
      } else if (decision !== 'different-analysis') {
        useEcoGradStore.setState({ buscaTermo: null });
        useRecovery.setState({ message: decision === 'unverified'
          ? 'Não foi possível verificar a versão da base. Textos e preferências foram recuperados; carregue as coleções quando a conexão voltar.'
          : 'A base foi atualizada. Textos e preferências foram recuperados, mas os resultados anteriores foram invalidados. Carregue novamente as coleções.' });
      }
    }
  } catch (e) {
    useRecovery.setState({ message: e instanceof Error ? e.message : 'Recuperação indisponível. A aplicação pode continuar sem armazenamento.' });
  }
  active = true;
  useEcoGradStore.subscribe((s, before) => {
    if (s.analysisId !== before.analysisId) useRecovery.setState({ message: '' });
    agendarLeve();
    if (s.ia !== before.ia || s.docs !== before.docs || s.analysisId !== before.analysisId || s.snaGlobal !== before.snaGlobal || s.maturidade !== before.maturidade) schedule();
  });
  let previousTasks = '';
  atividades.subscribe(() => {
    const signature = atividades.getSnapshot().map((t) => `${t.id}:${t.status}`).join('|');
    if (signature !== previousTasks) { previousTasks = signature; schedule(); }
  });
  client.getQueryCache().subscribe((event) => { if (event.type === 'updated' && event.query.queryKey[0] === 'sintese' && event.query.state.status === 'success') schedule(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveSession(); });
  window.addEventListener('pagehide', saveLight);
  // Existing documents must have a terminal/restartable task; don't silently restart after reload.
  if (useEcoGradStore.getState().docs.length && !atividades.get('sna-global')) useEcoGradStore.setState({ statusSNA: 'cancelado' });
  saveSession();
}
