import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anoEmColeta, buscarNoTexto, contarAcervo, dossiePessoa, executarFerramenta, grafiasDoPapel,
  montarRecorte, origemDoTermo, recorteDaColecao, registrosDoTitulo, titulosRepetidos, topMacrotemas,
} from '../src/lib/chat-ferramentas';
import { construirIndicesInvertidos } from '../src/lib/entities';
import type { Documento } from '../src/types';

const LONGO = 'x'.repeat(250);
const doc = (d: Partial<Documento>): Documento => ({
  titulo: 'T', autores: [], orientador: '', co_orientadores: [], palavras_chave: [],
  macrotema: '', programa_origem: 'Coleção', ano: 2020, nivel_academico: 'Dissertações',
  resumo: LONGO, url: 'https://exemplo/1', fonte: '', ...d,
} as Documento);

const base = (docs: readonly Documento[]) => ({ docs, indices: construirIndicesInvertidos(docs) });

test('recorte separa registros de trabalhos distintos e conta resumo inutilizavel', () => {
  const docs = [
    doc({ titulo: 'Mesma obra', programa_origem: 'Educação' }),
    doc({ titulo: 'MESMA OBRA', programa_origem: 'Educação (ID: 75514)' }),   // duplicata de catalogacao
    doc({ titulo: 'Outra', programa_origem: 'Direito', resumo: 'curto' }),
  ];
  const r = montarRecorte(docs);
  assert.equal(r.registros, 3);
  assert.equal(r.trabalhosDistintos, 2, 'acento e caixa nao criam trabalho novo');
  assert.equal(r.semResumoUtilizavel, 1);
  assert.deepEqual(r.colecoes.map(([c]) => c).sort(), ['Direito', 'Educação', 'Educação (ID: 75514)']);
  assert.deepEqual(titulosRepetidos(docs), { titulosRepetidos: 1, titulosDistintos: 2 });
});

test('ano em coleta e detectado sem acusar serie estavel', () => {
  const serie = (por: Record<number, number>) => Object.entries(por).flatMap(([ano, n]) => Array.from({ length: n }, () => doc({ ano: Number(ano) })));
  // 2026 com uma fracao do que vinha antes: coleta em andamento.
  assert.equal(anoEmColeta(serie({ 2023: 100, 2024: 90, 2025: 95, 2026: 12 })), 2026);
  assert.equal(anoEmColeta(serie({ 2023: 100, 2024: 90, 2025: 95, 2026: 88 })), null);
  // Queda real de producao nao e coleta parcial: metade ainda e metade.
  assert.equal(anoEmColeta(serie({ 2023: 100, 2024: 90, 2025: 95, 2026: 50 })), null);
  assert.equal(anoEmColeta(serie({ 2025: 10, 2026: 1 })), null, 'serie curta nao permite a inferencia');
});

test('busca no texto separa o que a busca por rotulo alcanca do que so esta no resumo', () => {
  const docs = [
    doc({ titulo: 'Empreendedorismo feminino no sul', palavras_chave: ['gestão'] }),
    doc({ titulo: 'Negócios locais', resumo: `Estudo sobre empreendedorismo feminino em ${LONGO}` }),
    doc({ titulo: 'Sem relação', resumo: LONGO }),
  ];
  const r = buscarNoTexto(docs, 'empreendedorismo feminino');
  assert.equal(r.registros, 2);
  assert.equal(r.alcancaveisPorRotulo, 1);
  assert.equal(r.somenteNoResumo, 1, 'a lacuna da busca atual e medida, nao suposta');
  assert.deepEqual(r.itens.map((i) => i.somenteNoResumo), [undefined, true]);
  assert.equal(buscarNoTexto(docs, '   ').registros, 0, 'consulta vazia nao devolve o acervo inteiro');
});

test('dossie reune papeis sem somar o mesmo documento duas vezes', () => {
  const docs = [
    doc({ titulo: 'A', autores: ['Freire, Patricia De Sa'], orientador: 'Freire, Patricia De Sa' }),
    doc({ titulo: 'B', orientador: 'Freire, Patricia De Sa' }),
    doc({ titulo: 'C', co_orientadores: ['Freire, Patricia De Sa'] }),
    doc({ titulo: 'D', orientador: 'Outra Pessoa' }),
  ];
  // Quem pergunta escreve na ordem direta; o acervo guarda invertida e com acento.
  const d = dossiePessoa(base(docs).indices, 'Patricia de Sá Freire');
  assert.equal(d.encontrada, true);
  assert.equal(d.recorte.registros, 3, 'tres documentos, ainda que sejam quatro papeis');
  assert.deepEqual(d.porPapel, { Autor: 1, Orientador: 2, 'Co-orientador': 1 });
  assert.deepEqual(d.papeis, ['Autor', 'Orientador', 'Co-orientador']);
  assert.equal(dossiePessoa(base(docs).indices, 'Ninguém').encontrada, false);
});

test('termo homonimo nao funde palavra-chave com macrotema', () => {
  const docs = [
    doc({ titulo: 'A', macrotema: 'Educação Infantil' }),
    doc({ titulo: 'B', palavras_chave: ['educacao infantil'] }),
    doc({ titulo: 'C', palavras_chave: ['Educação Infantil'] }),
  ];
  const o = origemDoTermo(base(docs).indices, 'Educação Infantil');
  assert.equal(o.comoMacrotema.registros, 1);
  assert.equal(o.comoPalavraChave.registros, 2, 'grafias equivalentes somam no mesmo termo');
  assert.deepEqual(o.comoPalavraChave.grafias.sort(), ['Educação Infantil', 'educacao infantil']);
});

test('colecao casa a variante com sufixo de identificador', () => {
  const docs = [
    doc({ titulo: 'A', programa_origem: 'Programa de Pós-Graduação em Educação' }),
    doc({ titulo: 'B', programa_origem: 'Programa de Pós-Graduação em Educação (ID: 75514)' }),
    doc({ titulo: 'C', programa_origem: 'Programa de Pós-Graduação em Direito' }),
  ];
  assert.equal(recorteDaColecao(docs, 'Programa de Pós-Graduação em Educação').registros, 1, 'igualdade exata tem precedencia');
  assert.equal(recorteDaColecao(docs, 'Pós-Graduação em Educação').registros, 2, 'sem correspondencia exata, alcanca as variantes');
  assert.equal(recorteDaColecao(docs, 'Inexistente').registros, 0);
});

test('grafias de orientador sao contadas como grafias, com as colisoes a vista', () => {
  const docs = [
    doc({ titulo: 'A', orientador: 'Freire, Patricia De Sa' }),
    doc({ titulo: 'B', orientador: 'FREIRE, PATRICIA DE SÁ' }),
    doc({ titulo: 'C', orientador: 'Outra Pessoa' }),
  ];
  const g = grafiasDoPapel(base(docs).indices, 'Orientador');
  assert.equal(g.grafiasDistintas, 3);
  assert.equal(g.colidemAoNormalizar, 1, 'duas grafias da mesma pessoa diferem so por acento e caixa');
  assert.equal(g.unidade, 'grafias, não pessoas');
});

test('titulo repetido devolve todos os registros da mesma obra', () => {
  const docs = [
    doc({ titulo: 'Doenças na formção dos médicos', programa_origem: 'Educação' }),
    doc({ titulo: 'Doenças na formção dos médicos', programa_origem: 'Direito' }),
    doc({ titulo: 'Outro', programa_origem: 'Educação' }),
  ];
  const r = registrosDoTitulo(docs, 'Doencas na formcao dos medicos');
  assert.equal(r.registros, 2);
  assert.equal(r.trabalhosDistintos, 1, 'uma obra, dois registros');
  assert.deepEqual(r.itens.map((i) => i.colecao), ['Educação', 'Direito']);
});

test('macrotemas vem rotulados como classificacao automatica e o acervo declara cobertura', () => {
  const docs = [doc({ titulo: 'A', macrotema: 'Tema X' }), doc({ titulo: 'B', macrotema: 'Tema X' }), doc({ titulo: 'C', macrotema: 'Tema Y', resumo: '' })];
  const t = topMacrotemas(base(docs).indices);
  assert.deepEqual(t.ranking, [['Tema X', 2], ['Tema Y', 1]]);
  assert.match(t.origem, /classificação automática/);
  const a = contarAcervo(docs);
  assert.deepEqual([a.registros, a.comResumoUtilizavel, a.semResumoUtilizavel], [3, 2, 1]);
});

test('o despacho por nome recusa ferramenta inexistente', () => {
  const b = base([doc({ titulo: 'A' })]);
  assert.equal((executarFerramenta('contar_acervo', b) as { registros: number }).registros, 1);
  assert.equal((executarFerramenta('recorte_da_colecao', b, { nome: 'Coleção' }) as { registros: number }).registros, 1);
  assert.throws(() => executarFerramenta('inventada' as never, b), /Ferramenta desconhecida/);
});
