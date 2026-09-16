import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_CATALOGO, promptConsultor, selecionarCatalogo, selecionarDocentes, type DossieConsultor, type ItemCatalogo } from '../src/lib/consultor-prompt';

const item = (i: number, extra: Partial<ItemCatalogo> = {}): ItemCatalogo => ({
  titulo: `Trabalho ${i}`, autores: [`Autor ${i}`], orientador: `Orientador ${i}`,
  macrotema: 'Outros', conceitos: ['generico'], url: `https://exemplo/${i}`, ...extra,
});

const catalogo = [
  ...Array.from({ length: 900 }, (_, i) => item(i)),
  item(901, { titulo: 'Governança de dados na saúde', conceitos: ['governanca', 'saude'] }),
  item(902, { titulo: 'Cidades inteligentes e governança', macrotema: 'Cidades Inteligentes', conceitos: ['governanca'] }),
];

test('a seleção põe na frente o que casa com a pergunta e respeita o teto', () => {
  const s = selecionarCatalogo(catalogo, 'Quero pesquisar governança de dados na saúde. Quem poderia orientar?');
  assert.equal(s.itens.length, MAX_CATALOGO);
  assert.equal(s.total, 902);
  assert.deepEqual(s.itens.slice(0, 2).map((i) => i.titulo), ['Governança de dados na saúde', 'Cidades inteligentes e governança']);
  assert.ok(s.relevantes >= 2 && s.relevantes < 902, 'só alguns casam');
});

test('pergunta sem termos úteis vira amostra espaçada, não os primeiros do catálogo', () => {
  const s = selecionarCatalogo(catalogo, 'Quais trabalhos?');
  assert.equal(s.relevantes, 0);
  assert.equal(s.itens.length, MAX_CATALOGO);
  assert.notDeepEqual(s.itens.slice(0, 3).map((i) => i.titulo), catalogo.slice(0, 3).map((i) => i.titulo));
});

test('catálogo menor que o teto vai inteiro', () => {
  const s = selecionarCatalogo(catalogo.slice(0, 10), 'governança');
  assert.equal(s.itens.length, 10);
});

test('orientadores: casam com a pergunta primeiro, depois os de maior volume, sempre com teto', () => {
  const docentes = [
    { nome: 'Silva, Ana', total: 90, temas: ['Educação'] },
    ...Array.from({ length: 300 }, (_, i) => ({ nome: `Docente ${i}`, total: 300 - i, temas: ['Outros'] })),
    { nome: 'Costa, Bia', total: 3, temas: ['Cidades Inteligentes'] },
  ];
  const escolhidos = selecionarDocentes(docentes, 'quem orienta cidades inteligentes?');
  assert.equal(escolhidos[0].nome, 'Costa, Bia', 'tema citado vem antes do volume');
  assert.equal(escolhidos.length, 40);
});

test('o prompt declara que é seleção, não a base inteira, e encolhe de verdade', () => {
  const dossie: DossieConsultor = {
    nomePrograma: 'Programa X', totalDocumentos: 902,
    lideresVolume: [], pontesInterdisciplinares: [], principaisConceitos: [],
    docentes: Array.from({ length: 300 }, (_, i) => ({ nome: `Docente ${i}`, total: i, temas: ['Outros'] })),
    catalogo,
  };
  const texto = promptConsultor(dossie, 'governança de dados na saúde');
  assert.match(texto, /TRABALHOS \(120 de 902 registros do recorte carregado\)/);
  assert.match(texto, /40 de 300 orientadores/);
  assert.match(texto, /Não conclua que um trabalho ausente não existe/);
  // O dossiê antigo levava 1.500 trabalhos e todos os orientadores em toda mensagem.
  assert.ok(texto.length < 25000, `prompt com ${texto.length} caracteres`);
});
