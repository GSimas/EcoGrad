import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fichaDocumentada, vinculoDocumentado, nomeParaComparar, validarCobertura, urlColecao, carregarCobertura } from '../src/lib/colecoes';
import { objetivoPorId, OBJETIVOS } from '../src/lib/objetivos';
import { useEcoGradStore as store } from '../src/stores/useEcoGradStore';
import { readFileSync } from 'node:fs';
import type { CatalogoCapes, Documento } from '../src/types';
const nome = 'Programa de Pós-Graduação em Odontologia (ID: 74720)';
const spec = 'col_123456789_74720';
const code = '41001010008P0';
const catalogo = { fonte: { idIes: '4362' }, programas: { [code]: { Código: code, Nome: 'ODONTOLOGIA', Modalidade: 'ACADÊMICO' } } } as unknown as CatalogoCapes;
test('only documented exact identity binds a collection; sibling labels and codes never inherit', () => {
  assert.ok(fichaDocumentada(nome, [spec], catalogo));
  assert.equal(fichaDocumentada('Programa de Pós-Graduação em Odontologia', ['col_123456789_214138'], catalogo), null);
  assert.equal(fichaDocumentada(nome, ['col_123456789_7843'], catalogo), null);
  assert.equal(fichaDocumentada(code, [spec], catalogo), null);
  assert.equal(vinculoDocumentado(nome, [spec, 'col_1_2']), undefined);
  assert.equal(vinculoDocumentado(nome, [spec], 'tcc'), undefined);
});
test('changed official identity or removed code requires review', () => {
  const changed = structuredClone(catalogo); changed.programas[code].Modalidade = 'PROFISSIONAL';
  assert.equal(fichaDocumentada(nome, [spec], changed), null);
  changed.programas[code].Modalidade = 'ACADÊMICO'; changed.fonte.idIes = 'other';
  assert.equal(fichaDocumentada(nome, [spec], changed), null);
  changed.fonte.idIes = '4362'; changed.programas = {};
  assert.equal(fichaDocumentada(nome, [spec], changed), null);
});
test('similar-name groups are display-only and source links accept repository IDs only', () => {
  assert.equal(nomeParaComparar('Direito (Mestrado Profissional)'), nomeParaComparar('Direito'));
  assert.equal(vinculoDocumentado('Direito', ['col_1_2']), undefined);
  assert.equal(urlColecao(spec), 'https://repositorio.ufsc.br/handle/123456789/74720');
  assert.equal(urlColecao('javascript:alert(1)'), null);
});
test('preview rejects wrong version, malformed counters and unsupported schemas', () => {
  const raw = JSON.parse(readFileSync('public/data/colecoes-cobertura.json', 'utf8'));
  assert.equal(validarCobertura(raw, raw.version), raw);
  assert.throws(() => validarCobertura(raw, 'a'.repeat(64)));
  assert.throws(() => validarCobertura({ ...raw, schema: 99 }, raw.version));
  const bad = structuredClone(raw); bad.colecoes[0].comResumo = -1;
  assert.throws(() => validarCobertura(bad, raw.version));
});
test('preview rejects a panorama that contradicts itself', () => {
  const raw = JSON.parse(readFileSync('public/data/colecoes-cobertura.json', 'utf8'));
  // Um painel sobre todo o acervo é o tipo de número que ninguém confere de
  // cabeça: melhor recusar do que exibir um total impossível.
  const semPanorama = structuredClone(raw); delete semPanorama.panorama;
  assert.throws(() => validarCobertura(semPanorama, raw.version));
  const maisQueTudo = structuredClone(raw); maisQueTudo.panorama.comPdf = raw.panorama.registros + 1;
  assert.throws(() => validarCobertura(maisQueTudo, raw.version));
  const serieTorta = structuredClone(raw); serieTorta.panorama.porAno = [['dois mil', 1]];
  assert.throws(() => validarCobertura(serieTorta, raw.version));
});
test('preview fetch never downloads a document base and rejects updates during the request', async () => {
  const raw = JSON.parse(readFileSync('public/data/colecoes-cobertura.json', 'utf8'));
  const original = globalThis.fetch; const calls: string[] = [];
  globalThis.fetch = (async (url) => { calls.push(String(url)); return new Response(JSON.stringify(calls.length === 2 ? raw : { version: calls.length === 1 ? raw.version : 'b'.repeat(64) })); }) as typeof fetch;
  try { await assert.rejects(carregarCobertura()); assert.deepEqual(calls, ['/data/manifest.json', '/data/colecoes-cobertura.json', '/data/manifest.json']); } finally { globalThis.fetch = original; }
});
test('goal is captured for loading; page routing preserves drafts and conversation', () => {
  for (const goal of OBJETIVOS) {
    store.setState(store.getInitialState(), true);
    store.setState({ ui: { 'entrada.objetivo': 'different', 'selecao.busca.ppg': 'texto' } });
    store.getState().setChat({ entrada: 'rascunho privado' });
    const docs = [{ titulo: 'Exemplo' }] as Documento[];
    store.getState().concluirCarregamento(docs, { programas: ['Exemplo'], cursosTcc: [] }, 'version', goal.id);
    assert.equal(store.getState().rota, goal.rota);
    if (goal.buscaTipo) assert.equal(store.getState().buscaTipo, goal.buscaTipo);
    assert.equal(store.getState().chat.entrada, 'rascunho privado');
    assert.equal(store.getState().ui['selecao.busca.ppg'], 'texto');
    store.getState().setRota('avancada'); assert.equal(store.getState().docs, docs);
  }
  assert.equal(objetivoPorId('invalid').rota, 'dashboard');
});
