import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export const SHARD_SCHEMA = 1;

/** Preserve raw records and their original positions, including repeated records. */
export function collectionShards(records, catalogNames = []) {
  if (!Array.isArray(records)) throw new Error('A base deve conter uma lista de documentos.');
  const groups = new Map(catalogNames.map(name => [name, { indices: [], registros: [] }]));
  records.forEach((record, index) => {
    if (!record || typeof record !== 'object') return;
    const name = String(record.programa_origem ?? '');
    if (!groups.has(name)) groups.set(name, { indices: [], registros: [] });
    groups.get(name).indices.push(index);
    groups.get(name).registros.push(record);
  });
  return [...groups].map(([nome, data]) => {
    const raw = Buffer.from(JSON.stringify({ schema: SHARD_SCHEMA, ...data }));
    const sha256 = createHash('sha256').update(raw).digest('hex');
    const compressed = gzipSync(raw);
    return { descriptor: { nome, path: `/data/colecao-${sha256}.json.gz`, sha256, bytes: compressed.length, total: data.registros.length }, compressed };
  });
}
