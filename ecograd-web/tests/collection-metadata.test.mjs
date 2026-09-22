import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogEntries, summarizeCollections } from '../scripts/collection-metadata.mjs';
import { aplicarColetas, BATCH_FILE } from '../scripts/collection-batches.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
test('exact collection identity, missing data, observed levels and duplicate sources', () => {
  const entries = catalogEntries({ 'Direito': 'col_1_2', 'Direito (Profissional)': 'col_1_3' }, []);
  const data = [
    { programa_origem: 'Direito', ano: ' 2019 ', nivel_academico: 'Outros', resumo: 'a', palavras_chave: [' '], url: 'https://repositorio.ufsc.br/handle/1/20' },
    { programa_origem: 'Direito', ano: null, resumo: ' ', palavras_chave: ['tema'], url: 'https://repositorio.ufsc.br/xmlui/handle/1/20', orientador: 'p' },
    { programa_origem: 'Direito parecido', ano: 2020 }, null,
  ];
  const [c, empty] = summarizeCollections(entries, data);
  assert.equal(c.total, 2); assert.equal(c.semAno, 1); assert.equal(c.inicio, 2019); assert.equal(c.fim, 2019);
  assert.deepEqual(c.niveis, { Outros: 1, 'Não informado': 1 });
  assert.equal(c.comResumo, 1); assert.equal(c.comPalavras, 1); assert.equal(c.comOrientador, 1); assert.equal(c.comFonte, 2); assert.equal(c.fontesDistintas, 1);
  assert.equal(empty.total, 0); assert.equal(empty.inicio, null);
});
test('same TCC label keeps every source ID and never duplicates its records', () => {
  const entries = catalogEntries({}, [{ curso: 'TCC A', setSpec: 'col_1_2' }, { curso: 'TCC A', setSpec: 'col_1_3' }, { curso: 'TCC A', setSpec: 'col_1_2' }]);
  const result = summarizeCollections(entries, [{ programa_origem: 'TCC A' }]);
  assert.equal(result.length, 1); assert.equal(result[0].total, 1); assert.deepEqual(result[0].setSpecs, ['col_1_2', 'col_1_3']);
});
test('published preview agrees with both real bases and manifest, including zero collections', () => {
  const root = new URL('../public/data/', import.meta.url);
  const coverage = JSON.parse(readFileSync(new URL('colecoes-cobertura.json', root)));
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
  assert.equal(coverage.version, manifest.version);
  assert.ok(readFileSync(new URL('colecoes-cobertura.json', root)).length < 128 * 1024);
  // Os lotes da coleta semanal entram sobre as bases antes da prévia ser gerada
  // (`sync-data.mjs`). Comparar com as bases cruas acusaria diferença a cada
  // coleta nova — e acusava: um lote que acrescenta dois registros a uma coleção
  // fazia a prévia publicar 279 onde a base crua tem 277.
  const coletas = new URL('../../coletas/', import.meta.url);
  const lotes = readdirSync(coletas).filter((n) => BATCH_FILE.test(n)).sort()
    .map((n) => JSON.parse(gunzipSync(readFileSync(new URL(n, coletas)))));
  const bases = aplicarColetas({
    ppg: JSON.parse(gunzipSync(readFileSync(new URL('base_consolidada_ufsc.json.gz', root)))),
    tcc: JSON.parse(gunzipSync(readFileSync(new URL('base_tcc_ufsc.json.gz', root)))),
  }, lotes);
  for (const type of ['ppg', 'tcc']) {
    const data = bases[type];
    for (const c of coverage.colecoes.filter((c) => c.tipo === type)) {
      const docs = data.filter((d) => d.programa_origem === c.nome);
      assert.equal(c.total, docs.length, c.nome);
      assert.equal(c.comResumo, docs.filter((d) => String(d.resumo ?? '').trim()).length, c.nome);
    }
  }
});
