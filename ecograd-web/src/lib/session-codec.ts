import type { Task } from './worker-tasks';
/** Bump when the persisted schema OR the scientific result contract changes. */
export const SESSION_SCHEMA = 1;
export const SESSION_TTL = 24 * 60 * 60 * 1000;
export const TEXT_LIMIT = 1024 * 1024;
export const ANALYSIS_LIMIT = 64 * 1024 * 1024;
export const TOTAL_LIMIT = 128 * 1024 * 1024;
export interface Envelope<T> { schema: number; updated: number; baseVersion: string; analysisId: string; data: T }
export function encode(value: unknown): string {
  return JSON.stringify(value, (_key, v) => typeof v === 'number' && !Number.isFinite(v) ? { $ecogradNumber: String(v) } : v);
}
export function decode(text: string): unknown {
  return JSON.parse(text, (_key, v) => v && typeof v === 'object' && Object.keys(v).length === 1 && '$ecogradNumber' in v
    ? v.$ecogradNumber === 'NaN' ? NaN : v.$ecogradNumber === 'Infinity' ? Infinity : v.$ecogradNumber === '-Infinity' ? -Infinity : v : v);
}
export function envelope<T>(data: T, analysisId: string, baseVersion: string): Envelope<T> {
  return { schema: SESSION_SCHEMA, updated: Date.now(), analysisId, baseVersion, data };
}
export function validateEnvelope(value: unknown, now = Date.now()): value is Envelope<Record<string, unknown>> {
  if (!value || typeof value !== 'object') return false;
  const e = value as Envelope<unknown>;
  return e.schema === SESSION_SCHEMA && Number.isFinite(e.updated) && e.updated <= now + 60000 && now - e.updated < SESSION_TTL
    && typeof e.analysisId === 'string' && typeof e.baseVersion === 'string' && !!e.data && typeof e.data === 'object';
}
export function recoveryDecision(saved: Envelope<unknown>, analysisId: string, version: string | null) {
  if (saved.analysisId !== analysisId) return 'different-analysis';
  if (!version) return 'unverified';
  return saved.baseVersion === version ? 'restore' : 'different-version';
}
/** Storage is optional: private mode, browser quotas and corrupt JSON never stop the app. */
export function saveText(storage: Pick<Storage, 'setItem' | 'removeItem'>, key: string, text: string) {
  // Web Storage counts UTF-16 code units. Never truncate a draft or silently keep an older one.
  try {
    if (text.length * 2 > TEXT_LIMIT) throw new Error('Limite de 1 MiB para textos e preferências excedido.');
    storage.setItem(key, text);
    return null;
  } catch (e) {
    try { storage.removeItem(key); } catch { /* storage unavailable */ }
    return e instanceof Error ? e.message : 'Armazenamento de textos indisponível.';
  }
}

/** Tiny synchronous intentions close the reload window before the large checkpoint commits. */
export function reconcileTasks<P, R>(saved: Task<P, R>[], intents?: Task<P, R>[]): Task<P, R>[] {
  if (!intents) return saved;
  return intents.map((intent) => {
    const previous = saved.find((t) => t.id === intent.id);
    const committed = previous?.executionId === intent.executionId && previous?.status === intent.status;
    if (committed) return previous!;
    return { ...previous, ...intent, progresso: null,
      status: intent.status === 'concluida' ? 'cancelada' : intent.status,
      texto: 'Execução interrompida antes de salvar o resultado. Reinicie quando desejar.',
      resultado: previous?.resultado, pedidoResultado: previous?.pedidoResultado };
  });
}

export function evictedSessions(items: { id: string; bytes: number; updated: number }[], currentId: string, incomingBytes: number, now = Date.now()) {
  const remove = items.filter((s) => s.id === currentId || now - s.updated >= SESSION_TTL).map((s) => s.id);
  const retained = items.filter((s) => !remove.includes(s.id)).sort((a, b) => a.updated - b.updated);
  let bytes = retained.reduce((n, s) => n + s.bytes, incomingBytes);
  while (bytes > TOTAL_LIMIT || retained.length >= 4) {
    const oldest = retained.shift();
    if (!oldest) break;
    bytes -= oldest.bytes; remove.push(oldest.id);
  }
  return remove;
}
export const fitsAnalysis = (bytes: number) => Number.isFinite(bytes) && bytes >= 0 && bytes <= ANALYSIS_LIMIT;

export function recoverConversation<T extends { streaming: boolean; erro: string | null }>(chat: T): T {
  return { ...chat, streaming: false, erro: chat.streaming
    ? 'Resposta interrompida pelo recarregamento. O texto parcial foi preservado; envie novamente se desejar.' : chat.erro };
}
