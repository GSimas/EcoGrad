import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buscarNoAcervo, colecoesDoItem, itemDoAcervo, itensDaEntidade, prepararBusca, termoDoAcervo, type IndiceBusca } from '../src/lib/busca-global';
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

test('o termo clicado numa nuvem acha a entidade sem saber o tipo dela', () => {
  // A nuvem do acervo entrega os termos normalizados, sem acento e em minúsculas;
  // a do dossiê entrega o que estava no texto. Os dois precisam achar o mesmo item.
  assert.equal(termoDoAcervo(indice, 'gestao')?.nome, 'Gestão');
  assert.equal(termoDoAcervo(indice, 'GESTÃO')?.nome, 'Gestão');
  assert.equal(termoDoAcervo(indice, '  Gestão  ')?.nome, 'Gestão');

  // "Gestão pública" é palavra-chave e "Gestão" é macrotema: nomes diferentes,
  // itens diferentes. A busca é por igualdade, não por trecho.
  assert.equal(termoDoAcervo(indice, 'gestão pública')?.tipo, 'Palavra-chave');
  assert.equal(termoDoAcervo(indice, 'congestão'), null);

  // Termo que só existe dentro de um título não é entidade: o modal precisa
  // disso para dizer que não há o que abrir, em vez de abrir a coisa errada.
  assert.equal(termoDoAcervo(indice, 'escolar'), null);
  assert.equal(termoDoAcervo(indice, ''), null);

  // Homônimo entre tipos: o temático vence o nome de pessoa.
  const comHomonimo: IndiceBusca = { ...indice, itens: [...indice.itens, ['Gestão', 1, 40, [0]]] };
  const achado = termoDoAcervo(comHomonimo, 'gestao');
  assert.equal(achado?.tipo, 'Macrotema');
  assert.equal(achado?.registros, 9);
});

test('entidade do dossiê acha o item do índice sem diferenciar acento e caixa, e a pessoa em todos os papéis', () => {
  const idx: IndiceBusca = {
    ...indice,
    itens: [['ostras', 4, 5, [0]], ['Ostras', 5, 2, [1]], ['Bainy, Afonso', 1, 1, [1]], ['Bainy, Afonso ', 2, 7, [0, 1]], ['Bainy, Afonsa', 2, 1, [0]]],
  };
  assert.deepEqual(itensDaEntidade(idx, 'Palavra-chave', ' OSTRAS ').map((i) => [i.nome, i.tipo]), [['ostras', 'Palavra-chave']]);
  assert.deepEqual(itensDaEntidade(idx, 'Pessoa', 'Bainy, Afonso').map((i) => i.tipo), ['Autor', 'Orientador']);
  assert.deepEqual(itensDaEntidade(idx, 'Orientador', 'Bainy, Afonso')[0].colecoes.map((c) => c.nome), ['Mestrado A', 'TCC B']);
  assert.deepEqual(itensDaEntidade(idx, 'Macrotema', 'Inexistente'), []);
});
