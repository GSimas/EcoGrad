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
const codificador = typeof TextEncoder === 'function' ? new TextEncoder() : null;
/** Área reaproveitada pelo `encodeInto`: cada unidade UTF-16 vira no máximo 3 bytes. */
let areaUtf8 = new Uint8Array(0);
const LIMITE_AREA = 1 << 20;

/**
 * Bytes do texto em UTF-8 — o mesmo que `new Blob([texto]).size`. Nos trechos
 * pequenos do checkpoint o `encodeInto` nativo conta sem alocar; texto grande
 * vai inteiro para o `Blob`, uma vez.
 */
export function bytesUtf8(texto: string): number {
  if (codificador && texto.length * 3 <= LIMITE_AREA) {
    if (areaUtf8.length < texto.length * 3) areaUtf8 = new Uint8Array(Math.min(LIMITE_AREA, Math.max(texto.length * 3, 4096)));
    return codificador.encodeInto(texto, areaUtf8).written;
  }
  if (typeof Blob === 'function') return new Blob([texto]).size;
  let bytes = texto.length;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 0x80) continue;
    if (c < 0x800) bytes += 1;
    else if (c >= 0xd800 && c <= 0xdbff && (texto.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { bytes += 2; i++; }
    else bytes += 2; // inclui surrogate isolado, que vira U+FFFD (3 bytes)
  }
  return bytes;
}

export interface Codificado { texto: string; bytes: number }

/**
 * O mesmo texto de `encode(valor)`, produzido em fatias: depois de cada
 * `orcamentoMs` de trabalho a vez volta à página por `ceder`. Serve para os
 * valores grandes do checkpoint (a base inteira, as métricas da rede), cujo
 * `JSON.stringify` de uma vez só travava a página por centenas de milissegundos.
 */
export async function encodeEmFatias(valor: unknown, ceder: () => Promise<void>, orcamentoMs = 8): Promise<Codificado> {
  const lista = Array.isArray(valor);
  const plano = !lista && !!valor && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype;
  if (!lista && !plano) {
    const texto = encode(valor);
    return { texto, bytes: bytesUtf8(texto) };
  }
  const partes: string[] = [];
  let bytes = 2;
  let inicio = performance.now();
  const chaves = lista ? null : Object.keys(valor as object);
  const total = lista ? (valor as unknown[]).length : chaves!.length;
  for (let i = 0; i < total; i++) {
    let parte: string | undefined;
    if (lista) parte = encode((valor as unknown[])[i]) ?? 'null';
    else {
      const t = encode((valor as Record<string, unknown>)[chaves![i]]);
      // Como no `JSON.stringify`: propriedade que não vira JSON fica de fora.
      if (t !== undefined) parte = `${JSON.stringify(chaves![i])}:${t}`;
    }
    if (parte !== undefined) { partes.push(parte); bytes += bytesUtf8(parte); }
    if (performance.now() - inicio > orcamentoMs) { await ceder(); inicio = performance.now(); }
  }
  bytes += Math.max(0, partes.length - 1);
  return { texto: lista ? `[${partes.join(',')}]` : `{${partes.join(',')}}`, bytes };
}

/**
 * `encode(value)` reaproveitando o JSON já pronto de objetos grandes que não
 * mudaram desde o último checkpoint. Cada objeto de `prontos` entra no lugar
 * exato em que o `JSON.stringify` o escreveria, então o texto — e a contagem
 * de bytes — é idêntico ao de `encode(value)`.
 */
export function encodeComProntos(value: unknown, prontos: ReadonlyMap<object, Codificado>): Codificado {
  const marca = `\u0000ecograd-pronto:${Math.random().toString(36).slice(2)}:`;
  const usados: Codificado[] = [];
  const esqueleto = JSON.stringify(value, (_key, v) => {
    if (v !== null && typeof v === 'object' && prontos.has(v)) {
      usados.push(prontos.get(v)!);
      return `${marca}${usados.length - 1}`;
    }
    return typeof v === 'number' && !Number.isFinite(v) ? { $ecogradNumber: String(v) } : v;
  });
  if (!usados.length) return { texto: esqueleto, bytes: bytesUtf8(esqueleto) };
  // No esqueleto a marca aparece escapada (`\u0000`), sempre entre aspas e só em ASCII.
  const padrao = new RegExp(`"${JSON.stringify(marca).slice(1, -1).replace(/\\/g, '\\\\')}(\\d+)"`, 'g');
  let bytes = bytesUtf8(esqueleto);
  const texto = esqueleto.replace(padrao, (inteiro, i: string) => {
    const pronto = usados[Number(i)];
    bytes += pronto.bytes - inteiro.length;
    return pronto.texto;
  });
  return { texto, bytes };
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
