import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compararColecoes, filtrarTrabalhos, fonteSegura, intervaloComum, orientandos, periodoTexto, referenciaDocumento, relacionados, resolverDocumento, resumoRegistros } from '../src/lib/resultados';
import type { Documento } from '../src/types';
const doc = (p: Partial<Documento>): Documento => ({ titulo: 'Um trabalho', nivel_academico: 'Outros', autores: [], orientador: '', co_orientadores: [], palavras_chave: [], macrotema: '', resumo: '', programa_origem: 'A', url: '', ano: null, ...p });
const docs = [
  doc({ titulo: 'Mesmo título', ano: 2010, resumo: 'Resumo A', url: 'https://repositorio.ufsc.br/handle/1/1', autores: ['Ana'], palavras_chave: ['Saúde', 'Saúde'], orientador: 'João' }),
  doc({ titulo: 'Mesmo título', ano: 2020, programa_origem: 'B', resumo: 'Resumo B', url: 'https://repositorio.ufsc.br/handle/1/2', autores: ['Bia'] }),
  doc({ titulo: 'Outro', ano: 2022, palavras_chave: ['Saúde'], url: 'https://repositorio.ufsc.br/xmlui/handle/1/1' }),
  doc({ titulo: 'Sem ano', resumo: 'Metadado tardio', programa_origem: 'B' }),
  doc({ titulo: 'Recente', ano: 2024, programa_origem: 'B', nivel_academico: 'Tese (Doutorado)' }),
];
test('coverage preserves original classifications, missing metadata and repeated source URLs', () => {
  const r = resumoRegistros(docs);
  assert.equal(r.total, 5); assert.equal(r.comResumo, 3); assert.equal(r.comPalavras, 2);
  assert.equal(r.comOrientador, 1); assert.equal(r.semAno, 1); assert.equal(r.anos, 4);
  assert.equal(r.fontesDistintas, 2); assert.equal(r.comFonte, 3);
  assert.deepEqual(r.tipos, { Outros: 4, 'Tese (Doutorado)': 1 });
  assert.equal(periodoTexto(r), '2010–2024');
  assert.equal(periodoTexto(resumoRegistros([])), 'Não informado');
});
test('common comparison window changes only display counts, keeps zeros and excludes undated records', () => {
  const snapshot = JSON.stringify(docs);
  assert.deepEqual(intervaloComum(docs, ['A', 'B']), [2020, 2022]);
  const rows = compararColecoes(docs, ['A', 'B', 'Vazia'], [2020, 2022]);
  assert.deepEqual(rows.map((r) => [r.nome, r.total, r.totalOriginal]), [['A', 1, 2], ['B', 1, 3], ['Vazia', 0, 0]]);
  assert.equal(rows[1].semAnoOriginal, 1); assert.equal(rows[1].semAno, 0);
  assert.equal(JSON.stringify(docs), snapshot);
});
test('no common period when a collection is empty, undated or disjoint', () => {
  assert.equal(intervaloComum(docs, ['A', 'Ausente']), null);
  assert.equal(intervaloComum([doc({ ano: 2010 }), doc({ programa_origem: 'B', ano: 2020 })], ['A', 'B']), null);
  assert.equal(intervaloComum([doc({ ano: 2010 }), doc({ programa_origem: 'B' })], ['A', 'B']), null);
});
test('work search covers title, author, advisor, keyword and abstract, with conjunctive filters', () => {
  const all = { busca: '', colecao: '', comResumo: false };
  assert.deepEqual(filtrarTrabalhos(docs, all).map((d) => d.titulo), ['Recente', 'Outro', 'Mesmo título', 'Mesmo título', 'Sem ano']);
  assert.equal(filtrarTrabalhos(docs, { ...all, busca: 'saude' }).length, 2);
  assert.equal(filtrarTrabalhos(docs, { ...all, busca: 'joao' })[0], docs[0]);
  assert.equal(filtrarTrabalhos(docs, { ...all, busca: 'Bia' })[0], docs[1]);
  assert.equal(filtrarTrabalhos(docs, { ...all, busca: 'tardio', colecao: 'B', comResumo: true })[0], docs[3]);
  assert.equal(filtrarTrabalhos(docs, { ...all, busca: 'saude', colecao: 'B', comResumo: true }).length, 0);
  assert.equal(docs[0].ano, 2010); // sorting must not mutate scientific input
});
test('related people and terms count at most once per record without changing raw metadata', () => {
  assert.deepEqual(relacionados(docs, 'Palavra-chave'), [['Saúde', 2]]);
  assert.deepEqual(relacionados(docs, 'Orientador'), [['João', 1]]);
  assert.deepEqual(docs[0].palavras_chave, ['Saúde', 'Saúde']);
});
test('duplicate titles require an explicit record; stale or fabricated references do not choose one', () => {
  assert.equal(resolverDocumento(docs, 'Mesmo título', undefined), null);
  assert.equal(resolverDocumento(docs, 'Mesmo título', referenciaDocumento(docs, 0)), docs[0]);
  assert.equal(resolverDocumento(docs, 'Mesmo título', referenciaDocumento(docs, 1)), docs[1]);
  assert.equal(resolverDocumento(docs, 'Mesmo título', { ...referenciaDocumento(docs, 1), origem: 'incorrect' }), null);
  assert.equal(resolverDocumento(docs, 'Outro', undefined), docs[2]);
  assert.equal(referenciaDocumento(docs, -1), null); assert.equal(referenciaDocumento(docs, 100), null);
});
test('source links permit web URLs only and preserve missing source state', () => {
  assert.equal(fonteSegura('javascript:alert(1)'), null); assert.equal(fonteSegura('data:text/html,test'), null);
  assert.equal(fonteSegura(''), null); assert.equal(fonteSegura('https://repositorio.ufsc.br/handle/1/1'), 'https://repositorio.ufsc.br/handle/1/1');
});
test('orientandos lists every author with works, levels and period, most recent first', () => {
  const r = orientandos([...docs, doc({ autores: ['Ana', ' '], ano: 2015, nivel_academico: 'Dissertação (Mestrado)' }), doc({ autores: ['Caio'] })]);
  assert.deepEqual(r.map((o) => [o.nome, o.trabalhos, o.niveis, o.periodo]), [['Bia', 1, 'Outros', '2020'], ['Ana', 2, 'Dissertação (Mestrado); Outros', '2010–2015'], ['Caio', 1, 'Outros', 'Não informado']]);
});
