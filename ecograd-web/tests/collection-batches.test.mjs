import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aplicarColetas, BATCH_FILE } from '../scripts/collection-batches.mjs';

const url = (h) => `https://repositorio.ufsc.br/handle/123/${h}`;

test('batches replace every record of a handle, remove deleted handles and keep records without handle', () => {
  const bases = { ppg: [{ url: url(1), programa_origem: 'A' }, { url: url(1), programa_origem: 'B' }, { url: url(2) }, { titulo: 'sem url' }], tcc: [{ url: url(3) }] };
  const lotes = [
    { schema: 1, ppg: [{ url: url(1), titulo: 'novo' }], tcc: [], removidos: ['123/3'] },
    { schema: 1, ppg: [], tcc: [{ url: `https://repositorio.ufsc.br/xmlui/handle/123/4` }], removidos: [] },
  ];
  const { ppg, tcc } = aplicarColetas(bases, lotes);
  assert.deepEqual(ppg, [{ url: url(2) }, { titulo: 'sem url' }, { url: url(1), titulo: 'novo' }]);
  assert.deepEqual(tcc, [{ url: 'https://repositorio.ufsc.br/xmlui/handle/123/4' }]);
  assert.deepEqual(aplicarColetas(bases, []), bases);
});

test('invalid batches stop the build and batch names sort chronologically', () => {
  assert.throws(() => aplicarColetas({ ppg: [], tcc: [] }, [{ schema: 2, ppg: [], tcc: [], removidos: [] }]), /inválido/);
  assert.throws(() => aplicarColetas({ ppg: [], tcc: [] }, [{ schema: 1, ppg: [] }]), /inválido/);
  const nomes = ['2026-09-21T060000Z.json.gz', '2026-09-14T180000Z.json.gz', '2026-09-14T060000Z.json.gz', 'estado.json'];
  assert.deepEqual(nomes.filter((n) => BATCH_FILE.test(n)).sort(), ['2026-09-14T060000Z.json.gz', '2026-09-14T180000Z.json.gz', '2026-09-21T060000Z.json.gz']);
});
