import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepararBusca, type IndiceBusca } from '../src/lib/busca-global';
import { colecoesParaCarregar, existeNoCatalogo, panoramaDoCatalogo, pessoaNoCatalogo, temaNoCatalogo, topDoTipo } from '../src/lib/chat-catalogo';

/** Recorte fiel do catálogo real: mesma pessoa em três papéis, tema com rótulo e título. */
const indice: IndiceBusca = {
  schema: 1,
  tipos: ['Documento', 'Autor', 'Orientador', 'Co-orientador', 'Palavra-chave', 'Macrotema'],
  colecoes: [['PPG Educação', 'ppg'], ['TCC Administração', 'tcc'], ['PPG Psicologia', 'ppg'], ['TCC Economia', 'tcc']],
  itens: [
    ['Freire, Patricia De Sa', 1, 2, [0]],
    ['Freire, Patricia De Sa', 2, 28, [0, 2]],
    ['Freire, Patricia De Sa', 3, 10, [0]],
    ['empreendedorismo feminino', 4, 5, [1, 3]],
    ['Empreendedorismo feminino em empresas de tecnologia', 0, 1, [1]],
    ['Genero e Trabalho', 5, 12, [0, 1]],
    ['educacao', 4, 3419, [0]],
    ['Silva, Joao', 2, 40, [2]],
  ],
};
const preparada = prepararBusca(indice);

test('panorama conta rotulos por tipo e declara a unidade', () => {
  const p = panoramaDoCatalogo(indice);
  assert.equal(p.colecoes, 4);
  assert.equal(p.itens, 8);
  // Duas grafias de orientador; coorientação é outro tipo e conta em separado.
  assert.deepEqual(p.porTipo.find(([t]) => t === 'Orientador'), ['Orientador', 2]);
  assert.deepEqual(p.porTipo.find(([t]) => t === 'Co-orientador'), ['Co-orientador', 1]);
  assert.match(p.unidade, /não trabalhos/);
});

test('ranking por tipo ordena por registros e declara o escopo', () => {
  const t = topDoTipo(indice, 'Orientador', 2);
  assert.deepEqual(t.ranking.map((i) => [i.nome, i.registros]), [['Silva, Joao', 40], ['Freire, Patricia De Sa', 28]]);
  assert.match(t.escopo, /gradua/);
  assert.equal(t.unidade, 'registros por grafia');
  assert.deepEqual(topDoTipo(indice, 'Pessoa', 5).ranking, [], 'tipo ausente do catalogo nao inventa ranking');
});

test('pessoa vem com os papeis separados e o total declarado como teto', () => {
  const p = pessoaNoCatalogo(preparada, 'Patricia de Sá Freire');
  assert.equal(p.encontrada, true);
  assert.deepEqual(p.porPapel, { Autor: 2, Orientador: 28, 'Co-orientador': 10 });
  assert.equal(p.registrosSomados, 40);
  assert.match(p.ressalva, /pode contar em dois papéis/);
  // As coleções do item, prontas para carregar, sem repetir.
  assert.deepEqual(p.colecoesParaCarregar.programas.sort(), ['PPG Educação', 'PPG Psicologia']);
  assert.deepEqual(p.colecoesParaCarregar.cursosTcc, []);
  assert.equal(pessoaNoCatalogo(preparada, 'Ninguém Aqui').encontrada, false);
});

test('tema separa rotulo de titulo e avisa que o resumo fica de fora', () => {
  const t = temaNoCatalogo(preparada, 'empreendedorismo feminino');
  assert.deepEqual(t.palavrasChave.map((i) => i.nome), ['empreendedorismo feminino']);
  assert.deepEqual(t.documentos.map((i) => i.nome), ['Empreendedorismo feminino em empresas de tecnologia']);
  assert.equal(t.registrosPorRotulo, 5, 'soma so os rotulos; titulo nao e rotulo tematico');
  assert.match(t.ressalva, /só mencionam o tema no corpo do resumo/);
  assert.deepEqual(t.colecoesParaCarregar.cursosTcc.sort(), ['TCC Administração', 'TCC Economia']);
  assert.equal(temaNoCatalogo(preparada, 'x').palavrasChave.length, 0, 'consulta curta nao varre o catalogo');
});

test('colecoes para carregar somam registros, ordenam pelas maiores e contam as omitidas', () => {
  const itens = [
    { nome: 'a', tipo: 'Palavra-chave' as const, registros: 10, colecoes: [{ nome: 'A', catalogo: 'ppg' as const }, { nome: 'B', catalogo: 'tcc' as const }] },
    { nome: 'b', tipo: 'Macrotema' as const, registros: 50, colecoes: [{ nome: 'B', catalogo: 'tcc' as const }, { nome: 'C', catalogo: 'ppg' as const }] },
  ];
  const todas = colecoesParaCarregar(itens);
  assert.equal(todas.total, 3, 'B aparece nos dois itens e conta uma vez');
  assert.deepEqual(todas.cursosTcc, ['B'], 'B soma 60 registros e lidera');
  assert.deepEqual(todas.programas, ['C', 'A']);
  const limitada = colecoesParaCarregar(itens, 1);
  assert.deepEqual([limitada.cursosTcc, limitada.programas, limitada.omitidas], [['B'], [], 2]);
});

test('existencia responde curto e tambem oferece o carregamento', () => {
  const sim = existeNoCatalogo(preparada, 'Genero e Trabalho');
  assert.equal(sim.existe, true);
  assert.equal(sim.itens[0].tipo, 'Macrotema');
  assert.equal(sim.colecoesParaCarregar.total, 2);
  assert.equal(existeNoCatalogo(preparada, 'blockchain quantico').existe, false);
});
