import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcularGenealogia } from '../src/lib/destaques';
import type { Documento } from '../src/types';

const doc = (autor: string, orientador: string): Documento => ({
  titulo: autor, nivel_academico: 'Tese', autores: [autor], orientador, co_orientadores: [], palavras_chave: [],
  macrotema: '', resumo: '', programa_origem: 'P', url: '', ano: 2020,
});

test('formadores de orientadores listam quem cada um formou, sem autoformação nem alunos que não orientam', () => {
  const docs = [doc('Bruna', 'Ana'), doc('Carlos', 'Ana'), doc('Davi', 'Ana'), doc('Ana', 'Ana'), doc('Elisa', 'Bruna')];
  const { formadores } = calcularGenealogia(docs, { orientadores: new Set(['Ana', 'Bruna']), coorientadores: new Set(['Carlos']) });
  assert.deepEqual(formadores, [['Ana', ['Bruna', 'Carlos']]]);
});
