import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoriaDe, categoriaTem, montarCatalogo, rotuloDe, idPorRotulo } from '../src/lib/busca-categorias';
import { construirIndicesInvertidos, docsDoTermo } from '../src/lib/entities';
import type { Documento } from '../src/types';

const doc = (d: Partial<Documento>): Documento => ({
  titulo: 'T', autores: [], orientador: '', co_orientadores: [], palavras_chave: [],
  macrotema: '', programa_origem: 'Coleção', ano: 2020, nivel_academico: 'Dissertações',
  resumo: '', fonte: '', ...d,
} as Documento);

/** "Educação Infantil" existe como macrotema e como palavra-chave no acervo real. */
const homonimos = [
  doc({ titulo: 'A', macrotema: 'Educação Infantil', palavras_chave: ['creche'] }),
  doc({ titulo: 'B', palavras_chave: ['Educação Infantil'], macrotema: 'Outro' }),
];

test('os papeis e os tipos de tema caem nas categorias certas', () => {
  assert.equal(categoriaDe('Documento'), 'documentos');
  assert.equal(categoriaDe('Pessoa'), 'pessoas');
  // Papéis chegam por link antigo ou pelo atalho do dossiê: pertencem a Pessoas.
  assert.equal(categoriaDe('Orientador'), 'pessoas');
  assert.equal(categoriaDe('Co-orientador'), 'pessoas');
  assert.equal(categoriaDe('Autor'), 'pessoas');
  assert.equal(categoriaDe('Palavra-chave'), 'temas');
  assert.equal(categoriaDe('Macrotema'), 'temas');
  assert.equal(idPorRotulo('Temas'), 'temas');
  assert.equal(idPorRotulo('inexistente'), 'tudo');
  // A barra só lista o tipo unificado; os papéis não viram itens repetidos.
  assert.equal(categoriaTem('pessoas', 'Pessoa'), true);
  assert.equal(categoriaTem('pessoas', 'Orientador'), false);
});

test('temas de mesmo nome e origens diferentes seguem sendo itens distintos', () => {
  const idx = construirIndicesInvertidos(homonimos);
  const catalogo = montarCatalogo(idx, 'temas');
  assert.ok(catalogo.has('Educação Infantil (Macrotema)'));
  assert.ok(catalogo.has('Educação Infantil (Palavra-chave)'));
  assert.deepEqual(catalogo.get('Educação Infantil (Macrotema)'), { tipo: 'Macrotema', nome: 'Educação Infantil' });
  assert.deepEqual(catalogo.get('Educação Infantil (Palavra-chave)'), { tipo: 'Palavra-chave', nome: 'Educação Infantil' });
  // E apontam para conjuntos de trabalhos diferentes — por isso não se fundem.
  assert.deepEqual(docsDoTermo(idx, 'Macrotema', 'Educação Infantil').map((d) => d.titulo), ['A']);
  assert.deepEqual(docsDoTermo(idx, 'Palavra-chave', 'Educação Infantil').map((d) => d.titulo), ['B']);
});

test('o filtro de origem isola os macrotemas, que sumiriam entre as palavras-chave', () => {
  const idx = construirIndicesInvertidos(homonimos);
  const soMacro = [...montarCatalogo(idx, 'temas', 'Todos', 'Macrotema').keys()];
  const soChave = [...montarCatalogo(idx, 'temas', 'Todos', 'Palavra-chave').keys()];
  assert.deepEqual(soMacro.sort(), ['Educação Infantil (Macrotema)', 'Outro (Macrotema)']);
  assert.deepEqual(soChave.sort(), ['Educação Infantil (Palavra-chave)', 'creche (Palavra-chave)']);
});

test('pessoas aparecem uma vez, com os papeis na etiqueta, e o filtro por papel recorta', () => {
  const docs = [
    doc({ titulo: 'A', autores: ['Ana'], orientador: 'Bia' }),
    doc({ titulo: 'B', orientador: 'Ana', co_orientadores: ['Caio'] }),
  ];
  const idx = construirIndicesInvertidos(docs);
  const catalogo = montarCatalogo(idx, 'pessoas');
  // Ana acumula dois papéis, mas é um item só.
  assert.equal([...catalogo.keys()].filter((k) => k.startsWith('Ana ')).length, 1);
  assert.equal(rotuloDe('Pessoa', 'Ana', idx), 'Ana (Autor · Orientador)');
  assert.deepEqual([...catalogo.keys()].sort(), ['Ana (Autor · Orientador)', 'Bia (Orientador)', 'Caio (Co-orientador)']);

  const soOrientadores = [...montarCatalogo(idx, 'pessoas', 'Orientador').values()].map((v) => v.nome).sort();
  assert.deepEqual(soOrientadores, ['Ana', 'Bia']);
  assert.deepEqual([...montarCatalogo(idx, 'pessoas', 'Co-orientador').values()].map((v) => v.nome), ['Caio']);
});

test('Tudo reune as tres categorias sem repetir a pessoa em cada papel', () => {
  const idx = construirIndicesInvertidos([doc({ titulo: 'A', autores: ['Ana'], orientador: 'Ana', palavras_chave: ['tema'], macrotema: 'Macro' })]);
  const tudo = [...montarCatalogo(idx, 'tudo').keys()].sort();
  assert.deepEqual(tudo, ['A (Documento)', 'Ana (Autor · Orientador)', 'Macro (Macrotema)', 'tema (Palavra-chave)']);
});
