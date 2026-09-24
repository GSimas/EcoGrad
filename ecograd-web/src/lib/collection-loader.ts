/**
 * Descomprime gzip com o `DecompressionStream` nativo, e com o `pako` só onde
 * ele falta ou falha. O `pako` entra por `import()`: a página importa este
 * módulo para ler o manifesto e não deve baixar ~100 KB de descompressor que
 * quase nunca usa. O hash conferido por quem chama garante os mesmos bytes.
 */
export async function descomprimirGzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(fluxo).arrayBuffer());
    } catch { /* cai no pako, que devolve o próprio erro se o arquivo estiver corrompido */ }
  }
  const { inflate } = await import('pako');
  return inflate(bytes);
}

export interface CollectionFile {
  nome: string; path: string; sha256: string; bytes: number; total: number;
}
export interface CollectionManifest {
  version: string;
  collections: { schema: 1; ppg: CollectionFile[]; tcc: CollectionFile[] };
}
const digestPattern = /^[a-f0-9]{64}$/;
const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;

export function validarManifestoColecoes(value: unknown): CollectionManifest {
  const m = value as CollectionManifest | null;
  if (!m || typeof m.version !== 'string' || !digestPattern.test(m.version) || m.collections?.schema !== 1) {
    throw new Error('A entrega por coleção está indisponível. Atualize a página ou tente novamente mais tarde.');
  }
  for (const tipo of ['ppg', 'tcc'] as const) {
    const entries = m.collections[tipo];
    if (!Array.isArray(entries) || entries.some(e => !e || typeof e.nome !== 'string' ||
      typeof e.sha256 !== 'string' || !digestPattern.test(e.sha256) || e.path !== `/data/colecao-${e.sha256}.json.gz` ||
      !count(e.bytes) || e.bytes === 0 || !count(e.total)) || new Set(entries.map(e => e.nome)).size !== entries.length) {
      throw new Error('Índice de coleções inválido. Nenhum resultado foi aplicado.');
    }
  }
  return m;
}

export async function carregarManifestoColecoes(signal?: AbortSignal): Promise<CollectionManifest> {
  const r = await fetch('/data/manifest.json', { cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Não foi possível verificar as coleções disponíveis.');
  return validarManifestoColecoes(await r.json());
}

/** Sequential downloads bound mobile memory; never silently fall back to the full base. */
/** Relata o andamento: o texto para leitura e a fração já concluída (0 a 1) destas coleções. */
export type ProgressoColecoes = (text: string, fracao: number) => void;

export async function carregarColecoes(
  tipo: 'ppg' | 'tcc', nomes: readonly string[], manifest: CollectionManifest,
  signal?: AbortSignal, progress?: ProgressoColecoes,
): Promise<unknown[]> {
  validarManifestoColecoes(manifest);
  const selected = [...new Set(nomes)].map(nome => {
    const entry = manifest.collections[tipo].find(e => e.nome === nome);
    if (!entry) throw new Error(`A coleção “${nome}” não está disponível nesta versão. Atualize a seleção.`);
    return entry;
  });
  const rows: Array<{ index: number; record: Record<string, unknown> }> = [];
  const positions = new Set<number>();
  for (const [i, entry] of selected.entries()) {
    signal?.throwIfAborted();
    progress?.(`Baixando coleção ${i + 1} de ${selected.length}: ${entry.nome}`, i / selected.length);
    // Revalidate cached responses so a corrected corrupt cache can recover on retry.
    const r = await fetch(entry.path, { signal, cache: 'no-cache' });
    if (!r.ok) throw new Error(`Não foi possível baixar “${entry.nome}” (HTTP ${r.status}). Tente novamente; a análise anterior foi preservada.`);
    const compressed = new Uint8Array(await r.arrayBuffer());
    const isGzip = compressed[0] === 0x1f && compressed[1] === 0x8b;
    if (isGzip && compressed.length !== entry.bytes) throw new Error(`Download incompleto de “${entry.nome}”. Tente novamente.`);
    // Some servers decompress at HTTP level. Hash the original JSON in either case.
    const raw = isGzip ? await descomprimirGzip(compressed) : compressed;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(raw)))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== entry.sha256) throw new Error(`Falha de integridade em “${entry.nome}”. Nenhum resultado foi aplicado.`);
    const data = JSON.parse(new TextDecoder().decode(raw));
    if (data?.schema !== 1 || !Array.isArray(data.indices) || !Array.isArray(data.registros) ||
      data.indices.length !== entry.total || data.registros.length !== entry.total) throw new Error('Arquivo de coleção inválido.');
    for (let j = 0; j < data.indices.length; j++) {
      const index = data.indices[j], record = data.registros[j];
      if (!count(index) || positions.has(index) || (j > 0 && index <= data.indices[j - 1]) ||
        !record || typeof record !== 'object' || Array.isArray(record) || String(record.programa_origem ?? '') !== entry.nome) {
        throw new Error('Identidade ou ordem de registros inválida. Nenhum resultado foi aplicado.');
      }
      positions.add(index);
      rows.push({ index, record });
    }
    signal?.throwIfAborted();
  }
  return rows.sort((a, b) => a.index - b.index).map(r => r.record);
}
