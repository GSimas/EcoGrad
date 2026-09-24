import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, encode, envelope, recoveryDecision, saveText, SESSION_SCHEMA, SESSION_TTL, TEXT_LIMIT, validateEnvelope } from '../src/lib/session-codec';

test('round trip preserves drafts, partial conversation, parameters and non-finite scientific values', () => {
  const data = { draft: 'Ecologia\nGovernança 🌿', chat: [{ role: 'assistant', content: 'Resposta parcial' }], filter: [], all: null,
    window: 5, result: { score: NaN, positive: Infinity, negative: -Infinity, zero: 0 } };
  const saved = envelope(data, 'analysis', 'version');
  assert.deepEqual(decode(encode(saved)), saved);
});
test('schema and expiry are checked before restoration', () => {
  const saved = envelope({}, 'a', 'v');
  assert.equal(validateEnvelope(saved, saved.updated + SESSION_TTL - 1), true);
  assert.equal(validateEnvelope(saved, saved.updated + SESSION_TTL), false);
  assert.equal(validateEnvelope({ ...saved, schema: SESSION_SCHEMA + 1 }), false);
  assert.equal(validateEnvelope({ ...saved, updated: Infinity }), false);
  assert.equal(validateEnvelope({ ...saved, updated: Date.now() + 120000 }), false);
  assert.equal(validateEnvelope(null), false);
  assert.throws(() => decode('{broken'));
});
test('only the same analysis and verified base can restore scientific results', () => {
  const saved = envelope({}, 'a', 'v1');
  assert.equal(recoveryDecision(saved, 'a', 'v1'), 'restore');
  assert.equal(recoveryDecision(saved, 'a', 'v2'), 'different-version');
  assert.equal(recoveryDecision(saved, 'new-analysis', 'v1'), 'different-analysis');
  assert.equal(recoveryDecision(saved, 'a', null), 'unverified');
});
test('text quota includes UTF-16 bytes and removes obsolete drafts instead of silently truncating', () => {
  const map = new Map<string, string>();
  const storage = { setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
  assert.equal(saveText(storage, 'session', 'a'.repeat(TEXT_LIMIT / 2)), null);
  assert.ok(saveText(storage, 'session', 'a'.repeat(TEXT_LIMIT / 2 + 1)));
  assert.equal(map.has('session'), false);
});
test('browser storage rejection never propagates to typing or navigation', () => {
  const storage = { setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('SecurityError'); } };
  assert.equal(saveText(storage, 'session', 'draft'), 'QuotaExceededError');
});

test('large snapshots respect 64 MiB without truncating scientific results', async () => {
  const { fitsAnalysis, ANALYSIS_LIMIT } = await import('../src/lib/session-codec');
  assert.equal(fitsAnalysis(ANALYSIS_LIMIT), true);
  assert.equal(fitsAnalysis(ANALYSIS_LIMIT + 1), false);
  assert.equal(fitsAnalysis(Infinity), false);
});
test('storage cleanup removes expired and oldest checkpoints to enforce total and count limits', async () => {
  const { evictedSessions, ANALYSIS_LIMIT } = await import('../src/lib/session-codec');
  const now = Date.now();
  const item = (id: string, bytes: number, updated = now) => ({ id, bytes, updated });
  assert.deepEqual(evictedSessions([item('old', 1, now - SESSION_TTL), item('current', 10), item('other', 10)], 'current', 20, now), ['old', 'current']);
  assert.deepEqual(evictedSessions([item('older', ANALYSIS_LIMIT, now - 1), item('recent', ANALYSIS_LIMIT)], 'new', ANALYSIS_LIMIT, now), ['older']);
  assert.deepEqual(evictedSessions(['1', '2', '3', '4'].map((id, i) => item(id, 1, now - 10 + i)), 'new', 1, now), ['1']);
});
test('immediate reload reconciles new execution intentions with the last committed scientific result', async () => {
  const { reconcileTasks } = await import('../src/lib/session-codec');
  const saved = { id: 'grid', titulo: 'Grid', executionId: 'old', pedido: { min: 3 }, pedidoResultado: { min: 3 }, status: 'concluida' as const, progresso: 100, texto: '', resultado: { score: 0.508 } };
  const latest = { ...saved, executionId: 'new', pedido: { min: 4 }, status: 'executando' as const };
  const [recovered] = reconcileTasks([saved], [latest]);
  assert.equal(recovered.executionId, 'new');
  assert.deepEqual(recovered.pedido, { min: 4 });
  assert.deepEqual(recovered.pedidoResultado, { min: 3 });
  assert.deepEqual(recovered.resultado, { score: 0.508 });
  assert.equal(recovered.status, 'executando'); // WorkerTasks.restore turns this into cancelled.
  assert.equal(reconcileTasks([saved], [{ ...latest, status: 'concluida' }])[0].status, 'cancelada');
  assert.deepEqual(reconcileTasks([saved], []), []); // Reset cannot resurrect old work.
});

test('interrupted conversations keep the question, draft and partial response without resending', async () => {
  const { recoverConversation } = await import('../src/lib/session-codec');
  const chat = { mensagens: [{ role: 'user', content: 'Pergunta' }], entrada: 'Rascunho', parcial: 'Resposta parcial', streaming: true, erro: null };
  const restored = recoverConversation(chat);
  assert.deepEqual(restored.mensagens, chat.mensagens);
  assert.equal(restored.parcial, chat.parcial);
  assert.equal(restored.entrada, chat.entrada);
  assert.equal(restored.streaming, false);
  assert.match(restored.erro ?? '', /interrompida/);
});

test('checkpoint in slices and with ready-made JSON is byte-identical to a single encode', async () => {
  const { bytesUtf8, encodeComProntos, encodeEmFatias } = await import('../src/lib/session-codec');
  const ceder = () => Promise.resolve();
  const docs = Array.from({ length: 300 }, (_, i) => ({
    titulo: `Gestão ${i} — ação, coração, 🐕 ${'x'.repeat(i % 7)}`, ano: i % 11 === 0 ? null : 2000 + (i % 20),
    nota: i % 13 === 0 ? NaN : i % 17 === 0 ? -Infinity : i / 3, ausente: undefined, lista: [1, undefined, 'é'],
  }));
  const sna: Record<string, unknown> = { '10': { grau: Infinity }, 'Órbita': { grau: 2 }, vazio: undefined, '2': [NaN] };
  // O envelope de uma atividade carrega o mesmo objeto do topo: só o objeto tem JSON pronto.
  const valor = { schema: 1, data: { ia: { texto: 'síntese' }, docs, sna, tarefas: [{ resultado: sna }, { resultado: { type: 'sna-global', result: sna } }, { resultado: null }] } };
  const esperado = encode(valor);

  for (const parte of [docs, sna, 'texto solto', 42, null]) {
    const fatiado = await encodeEmFatias(parte, ceder, 0);
    assert.equal(fatiado.texto, encode(parte));
    assert.equal(fatiado.bytes, Buffer.byteLength(encode(parte)));
  }

  const prontos = new Map<object, { texto: string; bytes: number }>([[docs, await encodeEmFatias(docs, ceder)], [sna, await encodeEmFatias(sna, ceder)]]);
  const montado = encodeComProntos(valor, prontos);
  assert.equal(montado.texto, esperado);
  assert.equal(montado.bytes, new Blob([esperado]).size);
  assert.deepEqual(decode(montado.texto), decode(esperado));
  assert.equal(encodeComProntos(valor, new Map()).texto, esperado);
  // Surrogates isolados viram U+FFFD (3 bytes), como no Blob.
  for (const s of ['a\uD800b', '\uDC00', '🐕', 'ç']) assert.equal(bytesUtf8(s), new Blob([s]).size);
});
