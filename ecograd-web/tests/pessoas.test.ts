import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapaDeGrafias, grupoDe, validarPessoas, type GrupoPessoa } from '../src/services/pessoas';
import { aplicarUnificacao, unificacaoConservadora, variacaoDoMesmoNome } from '../src/lib/unificacao';
import { construirIndicesInvertidos } from '../src/lib/entities';
import type { Documento } from '../src/types';

const doc = (d: Partial<Documento>): Documento => ({
  titulo: 'T', autores: [], orientador: '', co_orientadores: [], palavras_chave: [],
  macrotema: '', programa_origem: 'Coleção', ano: 2020, nivel_academico: 'Dissertações',
  resumo: '', fonte: '', ...d,
} as Documento);

test('grafias invalidas, repetidas ou de um grupo so sao descartadas sem derrubar o resto', () => {
  const grupos = validarPessoas([
    { canonico: '  Patricia de Sá Freire  ', grafias: ['Patricia de Sa', 'Patricia de Sá Freire'] },
    { canonico: 'Sem par', grafias: [] },                       // grupo de um nome so nao e fusao
    { canonico: '', grafias: ['A', 'B'] },                      // sem canonico
    { canonico: 'Outro', grafias: ['Patricia de Sa', 'Outro'] }, // grafia ja usada acima
    'lixo', null,
  ]);
  assert.deepEqual(grupos, [{ canonico: 'Patricia de Sá Freire', grafias: ['Patricia de Sá Freire', 'Patricia de Sa'] }]);
  assert.equal(validarPessoas(null).length, 0);
});

test('o mapa aponta so as grafias secundarias e o grupo e achado por qualquer uma delas', () => {
  const grupos: GrupoPessoa[] = [{ canonico: 'Patricia de Sá Freire', grafias: ['Patricia de Sá Freire', 'Patricia de Sa'] }];
  const mapa = mapaDeGrafias(grupos);
  assert.deepEqual([...mapa], [['Patricia de Sa', 'Patricia de Sá Freire']]);
  assert.equal(grupoDe(grupos, ' Patricia de Sa ')?.canonico, 'Patricia de Sá Freire');
  assert.equal(grupoDe(grupos, 'Outra pessoa'), undefined);
});

test('a unificacao reescreve os tres papeis, funde repeticoes e preserva identidade sem fusao', () => {
  const docs = [
    doc({ titulo: 'A', autores: ['Patricia de Sa', 'Outro'], orientador: 'Patricia de Sá Freire' }),
    doc({ titulo: 'B', autores: ['Patricia de Sa', 'Patricia de Sá Freire'], co_orientadores: ['Patricia de Sa'] }),
    doc({ titulo: 'C', autores: ['Ninguém'] }),
  ];
  const mapa = mapaDeGrafias([{ canonico: 'Patricia de Sá Freire', grafias: ['Patricia de Sá Freire', 'Patricia de Sa'] }]);

  // Sem fusoes a base volta identica, para nao invalidar as memoizacoes.
  assert.equal(aplicarUnificacao(docs, new Map()), docs);

  const saida = aplicarUnificacao(docs, mapa);
  assert.deepEqual(saida[0].autores, ['Patricia de Sá Freire', 'Outro']);
  assert.equal(saida[0].orientador, 'Patricia de Sá Freire');
  // As duas grafias no mesmo campo viram uma entrada so.
  assert.deepEqual(saida[1].autores, ['Patricia de Sá Freire']);
  assert.deepEqual(saida[1].co_orientadores, ['Patricia de Sá Freire']);
  assert.equal(saida[2], docs[2], 'documento sem a pessoa nao e recriado');
  assert.deepEqual(docs[0].autores, ['Patricia de Sa', 'Outro'], 'a base original nao e alterada');
});

test('o indice de pessoa reune os papeis sem contar o mesmo documento duas vezes', () => {
  const docs = [
    doc({ titulo: 'A', autores: ['Ana'], orientador: 'Ana' }),   // dois papeis no mesmo trabalho
    doc({ titulo: 'B', orientador: 'Ana' }),
    doc({ titulo: 'C', autores: ['Ana'], co_orientadores: ['Ana'] }),
  ];
  const idx = construirIndicesInvertidos(docs);
  assert.equal(idx.por_pessoa.get('Ana')?.length, 3, 'um documento por pessoa, ainda que ela acumule papeis nele');
  assert.equal(idx.por_autor.get('Ana')?.length, 2);
  assert.equal(idx.por_orientador.get('Ana')?.length, 2);
  assert.deepEqual([...(idx.papeis_pessoa.get('Ana') ?? [])].sort(), ['Autor', 'Co-orientador', 'Orientador']);
});

test('unificar faz duas grafias virarem uma pessoa so no indice', () => {
  const docs = [
    doc({ titulo: 'A', autores: ['Patricia de Sa'] }),
    doc({ titulo: 'B', orientador: 'Patricia de Sá Freire' }),
  ];
  const antes = construirIndicesInvertidos(docs);
  assert.equal(antes.por_pessoa.size, 2, 'sem fusao, duas pessoas distintas');

  const mapa = mapaDeGrafias([{ canonico: 'Patricia de Sá Freire', grafias: ['Patricia de Sá Freire', 'Patricia de Sa'] }]);
  const depois = construirIndicesInvertidos(aplicarUnificacao(docs, mapa));
  assert.equal(depois.por_pessoa.size, 1);
  assert.equal(depois.por_pessoa.get('Patricia de Sá Freire')?.length, 2);
  assert.deepEqual([...(depois.papeis_pessoa.get('Patricia de Sá Freire') ?? [])].sort(), ['Autor', 'Orientador']);
});

test('variacoes do mesmo nome sao reconhecidas mesmo com nome do meio faltando', () => {
  assert.equal(variacaoDoMesmoNome('Vieira, Paulo Freire', 'Vieira, Paulo Henrique Freire'), true);
  assert.equal(variacaoDoMesmoNome('Patricia de Sa', 'Patricia de Sá Freire'), true);
  assert.equal(variacaoDoMesmoNome('Freire, Patricia De Sa', 'FREIRE, PATRICIA DE SÁ'), true);
  // Pessoas diferentes que compartilham um sobrenome nao podem passar.
  assert.equal(variacaoDoMesmoNome('Freire, Ida Mara', 'Freire, Andrea Santarosa'), false);
  assert.equal(variacaoDoMesmoNome('Marques, Maria Risoleta Freire', 'Vieira, Paulo Freire'), false);
  assert.equal(variacaoDoMesmoNome('', 'Qualquer'), false);
});

test('a unificacao conservadora funde normalizacao e abreviacao unica, e recusa o ambiguo', () => {
  const oc = (nome: string, colecao = 'EGC') => ({ nome, colecao });
  const fusoes = unificacaoConservadora([
    oc('Dal Ri Jr., Arno'), oc('Dal Ri Jr., Arno'), oc('Dal Ri. Jr., Arno'),
    oc('Vieira, Paulo Freire'), oc('Vieira, Paulo Henrique Freire'),
    oc('Silva, Ana'), oc('Silva, Ana Maria'), oc('Silva, Ana Paula'),     // ambiguo
    oc('Costa, Joao'), oc('Costa, Joao Pedro', 'Outra coleção'),          // sem coleção em comum
    oc('Souza, Maria'), oc('Souza, Carla Maria'),                         // primeiro prenome difere
    oc('Lima, Rui'), oc('Lima, Rui Alves'), oc('Lima, Rui Alves Neto'),   // cadeia: vai para a maximal
    oc('Sem Virgula Nome'),
    oc('Radunz, Vera'), oc('Radunz, Vera; Souza, Ana Izabel'),            // grafia com duas pessoas
  ]);
  assert.deepEqual(fusoes, [
    { grafia: 'Dal Ri. Jr., Arno', canonico: 'Dal Ri Jr., Arno', metodo: 'normalizacao' },
    { grafia: 'Lima, Rui', canonico: 'Lima, Rui Alves Neto', metodo: 'abreviacao' },
    { grafia: 'Lima, Rui Alves', canonico: 'Lima, Rui Alves Neto', metodo: 'abreviacao' },
    { grafia: 'Vieira, Paulo Freire', canonico: 'Vieira, Paulo Henrique Freire', metodo: 'abreviacao' },
  ]);
});
