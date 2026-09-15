import assert from 'node:assert/strict';
import { test } from 'node:test';
import { construirRedeRadial } from '../src/lib/rede-radial';
import type { Documento } from '../src/types';

const doc = (d: Partial<Documento>): Documento => ({
  titulo: 'T', autores: [], orientador: '', co_orientadores: [], palavras_chave: [],
  macrotema: '', programa_origem: 'C', ano: 2020, nivel_academico: 'Dissertações',
  resumo: '', fonte: '', ...d,
} as Documento);

test('macrotemas se ligam pelas pessoas que transitam entre eles, e o peso conta pessoas', () => {
  const docs = [
    doc({ titulo: 'A', macrotema: 'Saúde', orientador: 'Ana' }),
    doc({ titulo: 'B', macrotema: 'Educação', orientador: 'Ana' }),   // Ana liga Saúde–Educação
    doc({ titulo: 'C', macrotema: 'Saúde', autores: ['Bia'] }),
    doc({ titulo: 'D', macrotema: 'Educação', co_orientadores: ['Bia'] }), // Bia liga o mesmo par
    doc({ titulo: 'E', macrotema: 'Direito', orientador: 'Caio' }),   // sem par: fica de fora
  ];
  const rede = construirRedeRadial(docs, 'macrotemas');
  assert.deepEqual(rede.nos.map((n) => n.id).sort(), ['Educação', 'Saúde']);
  assert.equal(rede.arestas.length, 1);
  assert.equal(rede.arestas[0].peso, 2, 'Ana e Bia: duas pessoas em comum');
  // Ocorrências contam registros do tema, não pessoas.
  assert.equal(rede.nos.find((n) => n.id === 'Saúde')?.ocorrencias, 2);
  assert.equal(rede.registrosComPar, 4, 'os quatro registros de Saúde e Educação');
  // Um anel único: o macrotema já é o nó, não há categoria acima dele.
  assert.deepEqual(rede.grupos, ['Macrotema']);
});

test('sem ninguem em dois temas nao ha o que desenhar', () => {
  const rede = construirRedeRadial([
    doc({ titulo: 'A', macrotema: 'Saúde', orientador: 'Ana' }),
    doc({ titulo: 'B', macrotema: 'Educação', orientador: 'Bia' }),
  ], 'macrotemas');
  assert.equal(rede.nos.length, 0);
  assert.equal(rede.totalNos, 0);
});
