import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FONTES_NUVEM, fontesValidas, obterFrequenciasTexto } from '../src/lib/lexicon';
import type { Documento } from '../src/types';

const doc = (p: Partial<Documento> = {}): Documento => ({
  titulo: '', nivel_academico: 'Dissertações', autores: [], orientador: '', co_orientadores: [],
  palavras_chave: [], macrotema: '', resumo: '', programa_origem: 'PPG', url: '', ano: 2024, ...p,
});

const valor = (linhas: { name: string; value: number }[], nome: string) =>
  linhas.find((l) => l.name === nome)?.value ?? 0;

test('palavras-chave contam a expressão inteira; títulos e resumos, palavra a palavra', () => {
  const docs = [doc({ palavras_chave: ['mudanças climáticas'], titulo: 'Efeitos das mudanças climáticas' })];
  const pk = obterFrequenciasTexto(docs, ['Conceitos (Palavras-chave)']);
  assert.deepEqual(pk, [{ name: 'mudanças climáticas', value: 1 }]);
  const titulos = obterFrequenciasTexto(docs, ['Títulos']).map((l) => l.name).sort();
  // "das" é stopword e "Efeitos" entra minúsculo, sem pontuação.
  assert.deepEqual(titulos, ['climáticas', 'efeitos', 'mudanças']);
});

test('fontes combinadas somam o mesmo termo em vez de duplicar a linha', () => {
  const docs = [
    doc({ palavras_chave: ['ecologia'], titulo: 'Ecologia de campo', resumo: 'ecologia aplicada' }),
    doc({ palavras_chave: ['ecologia'], titulo: 'Notas', resumo: 'sem o termo' }),
  ];
  const combinado = obterFrequenciasTexto(docs, [...FONTES_NUVEM]);
  assert.equal(combinado.filter((l) => l.name === 'ecologia').length, 1);
  // 2 como palavra-chave + 1 no título + 1 no resumo.
  assert.equal(valor(combinado, 'ecologia'), 4);
  // A soma bate com as fontes isoladas, então combinar não inventa contagem.
  const isoladas = FONTES_NUVEM.reduce((t, f) => t + valor(obterFrequenciasTexto(docs, [f]), 'ecologia'), 0);
  assert.equal(valor(combinado, 'ecologia'), isoladas);
});

test('o corte topN é aplicado depois da soma, não por fonte', () => {
  // "raro" só chega ao topo porque as duas fontes se somam.
  const docs = [
    doc({ palavras_chave: ['raro', 'comum', 'outro'], titulo: 'raro' }),
    doc({ palavras_chave: ['comum', 'outro'], titulo: 'comum outro' }),
  ];
  const top1 = obterFrequenciasTexto(docs, [...FONTES_NUVEM], 1);
  assert.equal(top1.length, 1);
  const todos = obterFrequenciasTexto(docs, [...FONTES_NUVEM]);
  assert.equal(top1[0].value, Math.max(...todos.map((l) => l.value)));
});

test('nenhuma fonte devolve lista vazia, sem varrer documento algum', () => {
  assert.deepEqual(obterFrequenciasTexto([doc({ palavras_chave: ['x'] })], []), []);
});

test('a seleção que volta da sessão é filtrada ao que é fonte de verdade', () => {
  assert.deepEqual(fontesValidas(['Títulos']), ['Títulos']);
  // Ordem canônica, não a da sessão: o desenho não muda conforme a ordem de clique.
  assert.deepEqual(fontesValidas(['Resumos (Abstracts)', 'Conceitos (Palavras-chave)']),
    ['Conceitos (Palavras-chave)', 'Resumos (Abstracts)']);
  assert.deepEqual(fontesValidas(['Títulos', 'fonte inventada']), ['Títulos']);
  // Valores de uma sessão antiga (string) ou corrompida não derrubam a aba.
  assert.deepEqual(fontesValidas('Títulos'), []);
  assert.deepEqual(fontesValidas(undefined), []);
  assert.deepEqual(fontesValidas({ 0: 'Títulos' }), []);
});
