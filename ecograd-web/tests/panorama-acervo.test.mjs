import assert from 'node:assert/strict';
import { test } from 'node:test';
import { panoramaAcervo } from '../scripts/collection-metadata.mjs';

const doc = (p = {}) => ({
  titulo: 'T', nivel_academico: 'Dissertações', autores: ['Ana'], orientador: 'Bia',
  co_orientadores: [], palavras_chave: ['ecologia'], macrotema: 'Ambiente', resumo: 'r',
  programa_origem: 'PPG Um', url: 'https://repositorio.ufsc.br/handle/1/1', ano: '2020', ...p,
});

test('conta registros, coleções e pessoas distintas nas duas bases', () => {
  const p = panoramaAcervo({
    ppg: [doc(), doc({ autores: ['Ana', 'Caio'], orientador: 'Duda', co_orientadores: ['Bia'], url: 'https://repositorio.ufsc.br/handle/1/2' })],
    tcc: [doc({ programa_origem: 'TCC Dois', nivel_academico: 'TCC', url: 'https://repositorio.ufsc.br/handle/1/3' })],
  });
  assert.equal(p.registros, 3);
  assert.equal(p.colecoes, 2);
  assert.equal(p.colecoesPpg, 1);
  assert.equal(p.colecoesTcc, 1);
  // Bia aparece como orientadora e como coorientadora: conta em cada papel.
  assert.deepEqual([p.autores, p.orientadores, p.coorientadores], [2, 2, 1]);
  assert.equal(p.palavrasChave, 1);
  assert.equal(p.macrotemas, 1);
});

test('trabalhos únicos reúne pelo link, como no Dashboard', () => {
  const p = panoramaAcervo({
    ppg: [
      // O mesmo trabalho em duas coleções: dois registros, um trabalho.
      doc({ programa_origem: 'PPG Um' }),
      doc({ programa_origem: 'PPG Dois' }),
      // A forma antiga com /xmlui/ é o mesmo link.
      doc({ programa_origem: 'PPG Três', url: 'https://repositorio.ufsc.br/xmlui/handle/1/1' }),
    ],
    tcc: [doc({ url: '' }), doc({ url: '' })],
  });
  assert.equal(p.registros, 5);
  // 1 link distinto + 2 registros sem link, que nunca se fundem.
  assert.equal(p.trabalhosUnicos, 3);
  assert.equal(p.comFonte, 3);
});

test('cobertura de metadados e período saem dos campos presentes', () => {
  const p = panoramaAcervo({
    ppg: [
      doc({ ano: '2015', arquivos: [{ n: 'a.pdf', s: 1 }] }),
      doc({ ano: '2022', resumo: '  ', palavras_chave: [' '], orientador: '', url: 'nao-e-url' }),
    ],
    tcc: [doc({ ano: 'sem ano' })],
  });
  assert.deepEqual([p.inicio, p.fim, p.semAno], [2015, 2022, 1]);
  assert.deepEqual(
    [p.comResumo, p.comPalavras, p.comOrientador, p.comFonte, p.comPdf],
    [2, 2, 2, 2, 1],
  );
});

test('séries saem ordenadas para o gráfico não inverter o tempo', () => {
  const p = panoramaAcervo({
    ppg: [doc({ ano: '2022' }), doc({ ano: '2019' }), doc({ ano: '2022' })],
    tcc: [doc({ programa_origem: 'TCC Dois', nivel_academico: 'TCC' })],
  });
  assert.deepEqual(p.porAno, [[2019, 1], [2020, 1], [2022, 2]]);
  // Nível e coleções vêm por frequência, do maior para o menor.
  assert.deepEqual(p.porNivel, [['Dissertações', 3], ['TCC', 1]]);
  assert.deepEqual(p.maioresColecoes, [['PPG Um', 3], ['TCC Dois', 1]]);
});

test('base vazia não quebra nem inventa período', () => {
  const p = panoramaAcervo({ ppg: [], tcc: [] });
  assert.deepEqual([p.registros, p.trabalhosUnicos, p.colecoes, p.autores], [0, 0, 0, 0]);
  assert.deepEqual([p.inicio, p.fim], [null, null]);
  assert.deepEqual([p.porAno, p.porNivel, p.maioresColecoes], [[], [], []]);
});

test('as 15 maiores coleções são um recorte, não o acervo todo', () => {
  const bases = { ppg: [], tcc: [] };
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j <= i; j++) bases.ppg.push(doc({ programa_origem: `PPG ${i}`, url: `https://repositorio.ufsc.br/handle/1/${i}-${j}` }));
  }
  const p = panoramaAcervo(bases);
  assert.equal(p.colecoes, 20);
  assert.equal(p.maioresColecoes.length, 15);
  assert.deepEqual(p.maioresColecoes[0], ['PPG 19', 20]);
});
