import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buscarNoAcervo, colecoesDoItem, itemDoAcervo, prepararBusca, type IndiceBusca } from '../src/lib/busca-global';
import { correspondeBusca, filtrarPorRelevancia } from '../src/lib/utils';

const indice: IndiceBusca = {
  schema: 1,
  tipos: ['Documento', 'Autor', 'Orientador', 'Co-orientador', 'Palavra-chave', 'Macrotema'],
  colecoes: [['Mestrado A', 'ppg'], ['TCC B', 'tcc']],
  itens: [
    ['Gestão pública', 4, 3, [0]],
    ['Avaliação da gestão escolar', 0, 1, [1]],
    ['Gestão', 5, 9, [1, 0]],
    ['Congestão urbana', 0, 20, [0]],
    ['Silva, Gestão', 1, 1, [0]],
  ],
};

test('busca no acervo ignora acentos e ordena por nome exato, início, palavra e trecho', () => {
  const busca = prepararBusca(indice);
  assert.deepEqual(
    buscarNoAcervo(busca, 'GESTAO').map((r) => r.nome),
    ['Gestão', 'Gestão pública', 'Avaliação da gestão escolar', 'Silva, Gestão', 'Congestão urbana'],
  );
  assert.deepEqual(buscarNoAcervo(busca, ' g '), []);

  const [gestao] = buscarNoAcervo(busca, 'gestão');
  assert.equal(gestao.tipo, 'Macrotema');
  assert.deepEqual(colecoesDoItem(gestao), { programas: ['Mestrado A'], cursosTcc: ['TCC B'], omitidas: 0 });
  assert.deepEqual(colecoesDoItem(gestao, 1), { programas: [], cursosTcc: ['TCC B'], omitidas: 1 });
  assert.equal(itemDoAcervo(indice, 'Autor', ' Silva, Gestão ')?.nome, 'Silva, Gestão');
  assert.equal(itemDoAcervo(indice, 'Orientador', 'Silva, Gestão'), null);
});

test('termos em qualquer ordem acham o nome oficial do acervo', () => {
  const busca = prepararBusca({ ...indice, itens: [...indice.itens, ['Souza, Richard Demo', 1, 3, [0]], ['Demolição de estruturas', 0, 1, [0]]] });
  for (const consulta of ['Richard Demo', 'Demo Richard', 'Demo', 'Richard', 'souza, richard']) {
    assert.ok(buscarNoAcervo(busca, consulta).some((r) => r.nome === 'Souza, Richard Demo'), consulta);
  }
  assert.equal(buscarNoAcervo(busca, 'souza richard demo')[0].nome, 'Souza, Richard Demo');
  // Um termo sozinho que é palavra inteira do nome vem antes de nomes que só começam com ele.
  assert.equal(buscarNoAcervo(busca, 'Demo')[0].nome, 'Souza, Richard Demo');
  assert.equal(buscarNoAcervo(busca, 'Richard')[0].nome, 'Souza, Richard Demo');
  assert.deepEqual(filtrarPorRelevancia(['Democracia', 'Richardson, Ana', 'Souza, Richard Demo'], 'demo'), ['Souza, Richard Demo', 'Democracia']);
  assert.deepEqual(filtrarPorRelevancia(['Democracia', 'Richardson, Ana', 'Souza, Richard Demo'], 'richard'), ['Souza, Richard Demo', 'Richardson, Ana']);
  assert.deepEqual(buscarNoAcervo(busca, 'Demo Richard').map((r) => r.nome), ['Souza, Richard Demo']);
  assert.ok(correspondeBusca('Souza, Richard Demo', 'demo SOUZA'));
  assert.equal(correspondeBusca('Souza, Richard Demo', 'richard silva'), false);
});
