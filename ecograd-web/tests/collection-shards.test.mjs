import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { collectionShards } from '../scripts/collection-shards.mjs';

test('sharding preserves exact labels, duplicate documents and zero collections deterministically', () => {
  const repeated = { programa_origem: 'A', titulo: 'igual' };
  const input = [repeated, { programa_origem: 'A (Outro)' }, repeated];
  const shards = collectionShards(input, ['A', 'Vazia', 'A (Outro)']);
  assert.deepEqual(shards, collectionShards(input, ['A', 'Vazia', 'A (Outro)']));
  const a = JSON.parse(gunzipSync(shards[0].compressed));
  assert.deepEqual(a.indices, [0, 2]); assert.deepEqual(a.registros, [repeated, repeated]);
  assert.equal(shards[1].descriptor.total, 0);
});

test('every real shard reconstitutes its original base in exact order with identical raw records', () => {
  const root = new URL('../public/data/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
  const coverage = JSON.parse(readFileSync(new URL('colecoes-cobertura.json', root)));
  for (const [tipo, filename] of [['ppg', 'base_consolidada_ufsc.json.gz'], ['tcc', 'base_tcc_ufsc.json.gz']]) {
    const original = JSON.parse(gunzipSync(readFileSync(new URL(filename, root))));
    const restored = new Map();
    for (const entry of manifest.collections[tipo]) {
      const compressed = readFileSync(new URL(entry.path.split('/').pop(), root));
      assert.equal(compressed.length, entry.bytes);
      const raw = gunzipSync(compressed);
      assert.equal(createHash('sha256').update(raw).digest('hex'), entry.sha256);
      const data = JSON.parse(raw); assert.equal(data.registros.length, entry.total);
      data.indices.forEach((index, i) => {
        assert.equal(restored.has(index), false); restored.set(index, data.registros[i]);
        assert.equal(String(data.registros[i].programa_origem ?? ''), entry.nome);
        assert.deepEqual(data.registros[i], original[index]);
      });
      const preview = coverage.colecoes.find(c => c.tipo === tipo && c.nome === entry.nome);
      if (preview) { assert.equal(preview.downloadBytes, entry.bytes); assert.equal(preview.total, entry.total); }
    }
    assert.deepEqual([...restored].sort((a, b) => a[0] - b[0]).map(r => r[1]), original.filter(r => r && typeof r === 'object'));
  }
});
