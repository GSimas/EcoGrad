import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orientacoesDe, orientacoesLocais } from '../src/lib/orientacoes';
import type { Documento } from '../src/types';

const doc = (p: Partial<Documento>): Documento => ({ titulo: 'Um trabalho', nivel_academico: '', autores: [], orientador: '', co_orientadores: [], palavras_chave: [], macrotema: '', resumo: '', programa_origem: 'A', url: '', ano: null, ...p });

test('orientandos juntam papéis, coleções, tipos e período por pessoa, sem autolaço', () => {
  const docs = [
    doc({ autores: ['Ana'], orientador: 'Bia', ano: 2010, nivel_academico: 'Mestrado', programa_origem: 'PPG A' }),
    doc({ autores: ['Ana '], orientador: 'Caio', co_orientadores: ['Bia'], ano: 2015, nivel_academico: 'Doutorado', programa_origem: 'PPG B' }),
    doc({ autores: ['Bia'], orientador: 'Bia', programa_origem: 'PPG A' }),
    doc({ autores: ['Davi'], orientador: 'Caio' }),
  ];
  assert.deepEqual(orientacoesDe(orientacoesLocais(docs, 'Bia'), 'Bia'), [
    { nome: 'Ana', orientou: 1, coorientou: 1, colecoes: ['PPG A', 'PPG B'], niveis: 'Doutorado; Mestrado', periodo: '2010–2015', ultimoAno: 2015 },
  ]);
  assert.deepEqual(orientacoesDe(orientacoesLocais(docs, 'Eva'), 'Eva'), []);
});
