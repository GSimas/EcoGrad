import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buscaShard, indiceBusca } from '../scripts/busca-index.mjs';

test('catálogo de busca separa tipos e catálogos, preserva nomes e ordena coleções por registros', () => {
  const bases = {
    ppg: [
      { programa_origem: 'Mestrado A', titulo: 'T1', autores: ['Ana', 'Ana', ' '], orientador: 'Bia', co_orientadores: [], palavras_chave: ['gestão'], macrotema: '' },
      { programa_origem: 'Mestrado A', titulo: 'T2 ', autores: ['Caio'], orientador: 'Ana', palavras_chave: ['gestão'] },
    ],
    tcc: [{ programa_origem: 'Mestrado A', titulo: 'T3', autores: ['Ana'], palavras_chave: ['gestão'] }, null],
  };
  const { tipos, colecoes, itens } = indiceBusca(bases);
  const item = (nome, tipo) => itens.find((i) => i[0] === nome && tipos[i[1]] === tipo);

  assert.deepEqual(colecoes, [['Mestrado A', 'ppg'], ['Mestrado A', 'tcc']]);
  assert.deepEqual(item('Ana', 'Autor'), ['Ana', 1, 2, [0, 1]]);
  assert.deepEqual(item('Ana', 'Orientador'), ['Ana', 2, 1, [0]]);
  assert.deepEqual(item('gestão', 'Palavra-chave'), ['gestão', 4, 3, [0, 1]]);
  // O título mantém o espaço final: é a chave que o Motor de Busca usa.
  assert.ok(item('T2 ', 'Documento'));
  assert.equal(itens.some((i) => !i[0].trim()), false);

  const a = buscaShard(bases);
  assert.equal(a.descriptor.path, `/data/busca-${a.descriptor.sha256}.json.gz`);
  assert.ok(a.compressed.equals(buscaShard(bases).compressed));
});
