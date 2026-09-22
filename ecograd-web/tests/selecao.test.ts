import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mesmaSelecao } from '../src/lib/selecao';
import type { Documento } from '../src/types';

const memoria = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (key: string) => memoria.get(key) ?? null,
  setItem: (key: string, value: string) => memoria.set(key, value),
  removeItem: (key: string) => memoria.delete(key),
} });

test('mesmas coleções em outra ordem não exigem novo cálculo', () => {
  assert.equal(mesmaSelecao({ programas: ['A', 'B'], cursosTcc: [] }, { programas: ['B', 'A'], cursosTcc: [] }), true);
  assert.equal(mesmaSelecao({ programas: ['A'], cursosTcc: [] }, { programas: [], cursosTcc: ['A'] }), false);
  assert.equal(mesmaSelecao({ programas: ['A'], cursosTcc: [] }, { programas: ['A', 'B'], cursosTcc: [] }), false);
});

test('aplicar seleção substitui nomes e documentos atomicamente; navegação preserva a base', async () => {
  const { useEcoGradStore: store } = await import('../src/stores/useEcoGradStore');
  store.getState().novaConsulta();
  const anterior = [{ titulo: 'Trabalho A' } as Documento];
  store.getState().concluirCarregamento(anterior, { programas: ['A'], cursosTcc: [] });
  store.getState().setRota('avancada');
  assert.equal(store.getState().docs, anterior);
  const novos = [{ titulo: 'Trabalho B' } as Documento];
  const registros: Array<{ docs: Documento[]; nomes: string[] }> = [];
  const unsub = store.subscribe((s) => registros.push({ docs: s.docs, nomes: s.programasSelecionados }));
  store.getState().concluirCarregamento(novos, { programas: ['B'], cursosTcc: [] });
  unsub();
  assert.equal(registros.length, 1);
  assert.equal(registros[0].docs, novos);
  assert.deepEqual(registros[0].nomes, ['B']);
  assert.equal(store.getState().rota, 'dashboard');
  assert.equal(store.getState().snaGlobal, null);
});

test('nova análise limpa coleções e resultados, enquanto trocar de página os preserva', async () => {
  const { useEcoGradStore: store } = await import('../src/stores/useEcoGradStore');
  const docs = [{ titulo: 'Trabalho A' } as Documento];
  store.getState().concluirCarregamento(docs, { programas: ['A'], cursosTcc: ['TCC B'] });
  store.getState().setSnaGlobal({});
  store.getState().setRota('avancada');
  assert.equal(store.getState().docs, docs);
  assert.deepEqual(store.getState().programasSelecionados, ['A']);
  store.getState().novaConsulta();
  assert.deepEqual(store.getState().docs, []);
  assert.deepEqual(store.getState().programasSelecionados, []);
  assert.deepEqual(store.getState().cursosTccSelecionados, []);
  assert.equal(store.getState().dadosCarregados, false);
  assert.equal(store.getState().snaGlobal, null);
});
