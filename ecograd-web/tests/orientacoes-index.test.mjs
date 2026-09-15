import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indiceOrientacoes, orientacoesShard } from '../scripts/orientacoes-index.mjs';

test('orientações cruzam coleções, separam papéis e ignoram vazios e autolaços', () => {
  const { colecoes, niveis, pessoas } = indiceOrientacoes([
    { programa_origem: 'Graduação A', autores: ['Ana '], orientador: ' Bia', co_orientadores: ['Caio', 'Bia', ''], ano: '2010', nivel_academico: 'TCC (Graduação)' },
    { programa_origem: 'Mestrado B', autores: ['Davi', 'Davi'], orientador: 'Ana', co_orientadores: [], ano: null },
    { programa_origem: 'Mestrado B', autores: ['Eva'], orientador: 'Eva', co_orientadores: null },
    null,
  ]);
  assert.deepEqual(colecoes, ['Graduação A', 'Mestrado B']);
  assert.deepEqual(niveis, ['TCC (Graduação)', 'Não informado']);
  assert.deepEqual(pessoas.Bia, [['Ana', 0, 2010, 0, 0]]);
  assert.deepEqual(pessoas.Caio, [['Ana', 0, 2010, 1, 0]]);
  // Ana foi orientada na graduação e orienta no mestrado: as duas coleções aparecem.
  assert.deepEqual(pessoas.Ana, [['Davi', 1, null, 0, 1]]);
  assert.equal(Object.hasOwn(pessoas, 'Eva'), false);

  const a = orientacoesShard([{ autores: ['X'], orientador: 'Y' }]);
  const b = orientacoesShard([{ autores: ['X'], orientador: 'Y' }]);
  assert.equal(a.descriptor.path, `/data/orientacoes-${a.descriptor.sha256}.json.gz`);
  assert.ok(a.compressed.equals(b.compressed));
});
