import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { carregarColecoes, validarManifestoColecoes, type CollectionManifest } from '../src/lib/collection-loader';

function fixture(nome: string, indices: number[], records = indices.map(i => ({ programa_origem: nome, titulo: `Título ${i}` }))) {
  const raw = Buffer.from(JSON.stringify({ schema: 1, indices, registros: records }));
  const compressed = gzipSync(raw), sha256 = createHash('sha256').update(raw).digest('hex');
  return { raw, compressed, descriptor: { nome, path: `/data/colecao-${sha256}.json.gz`, sha256, total: indices.length, bytes: compressed.length } };
}
const a = fixture('Direito', [0, 3]), b = fixture('Direito (Profissional)', [1, 2]);
const manifest = (): CollectionManifest => ({ version: 'a'.repeat(64), collections: { schema: 1, ppg: [a.descriptor, b.descriptor], tcc: [] } });

test('only selected exact names are fetched, duplicate selections do not duplicate rows, source order wins', async () => {
  const original = fetch, calls: string[] = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(new Uint8Array(String(url) === a.descriptor.path ? a.compressed : b.compressed)); };
  try {
    const selected = await carregarColecoes('ppg', ['Direito', 'Direito'], manifest());
    assert.deepEqual(calls, [a.descriptor.path]); assert.equal(selected.length, 2);
    calls.length = 0;
    const both = await carregarColecoes('ppg', [b.descriptor.nome, a.descriptor.nome], manifest());
    assert.deepEqual(both.map(d => (d as { titulo: string }).titulo), ['Título 0', 'Título 1', 'Título 2', 'Título 3']);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});

test('HTTP decompression is accepted only when the original JSON hash matches', async () => {
  const original = fetch;
  globalThis.fetch = async () => new Response(new Uint8Array(a.raw));
  try { assert.equal((await carregarColecoes('ppg', ['Direito'], manifest())).length, 2); }
  finally { globalThis.fetch = original; }
});

test('missing collection, invalid index and unsupported delivery fail without full-base fallback', async () => {
  const original = fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected network'); };
  try {
    await assert.rejects(carregarColecoes('ppg', ['direito'], manifest()), /não está disponível/);
    assert.throws(() => validarManifestoColecoes({ version: 'a'.repeat(64) }));
    const m = manifest(); m.collections.ppg.push(a.descriptor); assert.throws(() => validarManifestoColecoes(m));
    const bad = manifest(); bad.collections.ppg[0] = { ...a.descriptor, path: 'https://outside.example/base.gz' };
    assert.throws(() => validarManifestoColecoes(bad));
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('HTTP failure, corrupted or truncated payload cannot return a partial selection', async () => {
  const original = fetch;
  try {
    globalThis.fetch = async url => String(url) === a.descriptor.path ? new Response(new Uint8Array(a.compressed)) : new Response('', { status: 503 });
    await assert.rejects(carregarColecoes('ppg', ['Direito', b.descriptor.nome], manifest()), /HTTP 503/);
    globalThis.fetch = async () => new Response(new Uint8Array(b.raw));
    await assert.rejects(carregarColecoes('ppg', ['Direito'], manifest()), /integridade/);
    globalThis.fetch = async () => new Response(new Uint8Array(a.compressed.subarray(0, 12)));
    await assert.rejects(carregarColecoes('ppg', ['Direito'], manifest()), /incompleto/);
  } finally { globalThis.fetch = original; }
});

test('correct hash does not excuse mismatched collection identity or repeated positions', async () => {
  const original = fetch;
  try {
    for (const f of [fixture('Direito', [0, 0]), fixture('Direito', [0], [{ programa_origem: 'Outra', titulo: 'Título' }])]) {
      const m = manifest(); m.collections.ppg = [f.descriptor];
      globalThis.fetch = async () => new Response(new Uint8Array(f.compressed));
      await assert.rejects(carregarColecoes('ppg', ['Direito'], m), /Identidade ou ordem/);
    }
  } finally { globalThis.fetch = original; }
});

test('cancellation between collections stops the remaining downloads', async () => {
  const original = fetch, controller = new AbortController(); let calls = 0;
  globalThis.fetch = async () => { calls++; controller.abort(); return new Response(new Uint8Array(a.compressed)); };
  try {
    await assert.rejects(carregarColecoes('ppg', ['Direito', b.descriptor.nome], manifest(), controller.signal), { name: 'AbortError' });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
