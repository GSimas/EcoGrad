import { iaVazia, recuperarIA, type EstadoIA } from '../lib/ia-state';
import { create } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import { useEcoGradStore, type EcoGradState, type Conversa } from '../stores/useEcoGradStore';
import { atividades, restaurarAtividades, type Pedido, type Resultado } from './calculos';
import type { Task } from '../lib/worker-tasks';
import { fitsAnalysis, decode, encode, envelope, recoveryDecision, saveText, validateEnvelope, reconcileTasks, recoverConversation } from '../lib/session-codec';
import { readAnalysis, writeAnalysis } from '../lib/session-db';
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
    && ['dashboard', 'busca', 'foresight', 'memetica', 'chat'].includes(String(value.rota))
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
function saveLight() {
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
      const text = encode(value);
      const bytes = new Blob([text]).size;
      if (!fitsAnalysis(bytes)) {
        await writeAnalysis(tabId);
        throw new Error('A análise excede 64 MiB. Continua disponível nesta aba, mas precisará ser carregada novamente após recarregar.');
      }
      await writeAnalysis(tabId, { id: tabId, updated: value.updated, text, bytes });
      if (generation !== revision) return;
      analysisError = '';
      useRecovery.setState({ saved: new Date().toLocaleTimeString('pt-BR'), saving: false });
    } catch {
      // Delete a prior checkpoint rather than present it later as the latest state.
      try { await writeAnalysis(tabId); } catch { /* quota/blocked storage */ }
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
      // Sessões anteriores ao Consultor IA flutuante podem trazer a antiga página de chat.
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
    saveLight();
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
