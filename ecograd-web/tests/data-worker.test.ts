import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

test('ingestion worker applies an entire verified selection and rejects a changed base version', async () => {
  const originalFetch = fetch, originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const messages: Array<{ type: string; docs?: unknown[]; baseVersion?: string; message?: string }> = [];
  let receive: (e: { data: { programas: string[]; cursosTcc: string[]; recorte?: Array<{ tipo: string; nome: string }> } }) => Promise<void> = async () => { throw new Error('Worker not registered'); };
  const raw = Buffer.from(JSON.stringify({ schema: 1, indices: [2], registros: [{ programa_origem: 'A', titulo: 'Título', ano: '2024', autores: ['Autora'] }] }));
  const compressed = gzipSync(raw), sha256 = createHash('sha256').update(raw).digest('hex');
  const manifest = { version: 'a'.repeat(64), collections: { schema: 1, ppg: [{ nome: 'A', path: `/data/colecao-${sha256}.json.gz`, sha256, total: 1, bytes: compressed.length }], tcc: [] } };
  try {
    Object.defineProperty(globalThis, 'self', { configurable: true, value: { addEventListener: (_: string, callback: typeof receive) => { receive = callback; }, postMessage: (m: typeof messages[number]) => messages.push(m) } });
    await import('../src/workers/data.worker');
    for (const changed of [false, true]) {
      messages.length = 0; let calls = 0;
      globalThis.fetch = async url => {
        if (String(url).endsWith('/manifest.json')) { calls++; return new Response(JSON.stringify(calls === 1 ? manifest : { version: changed ? 'b'.repeat(64) : manifest.version })); }
        assert.equal(String(url), manifest.collections.ppg[0].path);
        return new Response(new Uint8Array(compressed));
      };
      await receive({ data: { programas: ['A'], cursosTcc: [] } });
      assert.equal(calls, 2);
      if (changed) {
        assert.equal(messages.some(m => m.type === 'pronto'), false);
        assert.match(messages.at(-1)?.message ?? '', /atualizada durante/);
      } else {
        const ready = messages.at(-1)!;
        assert.equal(ready.type, 'pronto'); assert.equal(ready.baseVersion, manifest.version);
        assert.equal(ready.docs?.length, 1); assert.equal((ready.docs![0] as { ano: number }).ano, 2024);
      }
    }
    // Recorte: a coleção inteira é baixada, mas só o que corresponde ao item
    // escolhido atravessa a fronteira do worker.
    globalThis.fetch = async url => new Response(String(url).endsWith('/manifest.json')
      ? JSON.stringify(manifest) : new Uint8Array(compressed));
    messages.length = 0;
    await receive({ data: { programas: ['A'], cursosTcc: [], recorte: [{ tipo: 'Autor', nome: 'Autora' }] } });
    assert.equal(messages.at(-1)?.type, 'pronto');
    assert.equal(messages.at(-1)?.docs?.length, 1);
    messages.length = 0;
    await receive({ data: { programas: ['A'], cursosTcc: [], recorte: [{ tipo: 'Autor', nome: 'Ninguém' }] } });
    assert.equal(messages.some(m => m.type === 'pronto'), false);
    assert.match(messages.at(-1)?.message ?? '', /corresponde a autor “Ninguém”/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf); else Reflect.deleteProperty(globalThis, 'self');
  }
});
