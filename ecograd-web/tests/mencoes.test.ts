import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownParaHtml } from '../src/lib/markdown';
import { dicionarioDoAcervo, realcarMencoes } from '../src/lib/mencoes';
import type { Documento } from '../src/types';

const doc = (d: Partial<Documento>): Documento => ({
  titulo: 'T', autores: [], orientador: '', co_orientadores: [], palavras_chave: [],
  macrotema: '', programa_origem: 'Coleção', ano: 2020, nivel_academico: 'Dissertação',
  resumo: '', url: 'https://exemplo/1', ...d,
} as Documento);

const acervo = [
  doc({ titulo: 'Governança de dados na saúde', orientador: 'Costa, Eduardo Moreira Da', palavras_chave: ['cidades inteligentes'], macrotema: 'Gestão do Conhecimento' }),
  doc({ titulo: 'Outro trabalho', orientador: "D'Ávila, Ana", palavras_chave: ['ia'] }),
];
const dic = dicionarioDoAcervo(acervo);

test('nome do acervo vira botão mesmo escrito na ordem direta, com acento e outra caixa', () => {
  const html = realcarMencoes(markdownParaHtml('Procure **Eduardo Moreira da Costa**, que estuda Cidades Inteligentes.'), dic);
  assert.match(html, /<button type="button" class="eco-mencao eco-tipo-pessoa" data-mencao="Pessoa" data-nome="Costa, Eduardo Moreira Da"[^>]*>Eduardo Moreira da Costa<\/button>/);
  assert.match(html, /data-mencao="Palavra-chave" data-nome="cidades inteligentes"[^>]*>Cidades Inteligentes</);
  assert.match(html, /<strong>/, 'a marcação do markdown continua de pé');
});

test('título leva o índice do registro, e a menção mais longa vence a mais curta', () => {
  const html = realcarMencoes(markdownParaHtml('Leia Governança de dados na saúde para começar.'), dic);
  assert.match(html, /data-mencao="Documento" data-nome="Governança de dados na saúde" data-indice="0"/);
  assert.equal(html.match(/<button/g)?.length, 1);
});

test('apóstrofo escapado não quebra o casamento do nome', () => {
  const html = realcarMencoes(markdownParaHtml("Fale com D'Ávila, Ana."), dic);
  assert.match(html, /data-nome="D&#39;Ávila, Ana"/);
});

test('dentro de código nada é realçado, atributo nunca é varrido e a varredura é idempotente', () => {
  assert.doesNotMatch(realcarMencoes(markdownParaHtml('`cidades inteligentes`'), dic), /<button/);
  // O nome dentro do atributo do próprio botão não pode virar outro botão.
  const duplo = realcarMencoes(realcarMencoes(markdownParaHtml('Cidades inteligentes.'), dic), dic);
  assert.equal(duplo.match(/<button/g)?.length, 1);
});

test('rótulo curto demais não vira menção: casaria dentro de prosa comum', () => {
  assert.doesNotMatch(realcarMencoes(markdownParaHtml('A ia avança.'), dic), /<button/);
});

test('cada família tem sua classe de cor: trabalho, pessoa e tema', () => {
  const html = realcarMencoes(markdownParaHtml('Eduardo Moreira Da Costa, cidades inteligentes, Gestão do Conhecimento e Outro trabalho.'), dic);
  assert.match(html, /class="eco-mencao eco-tipo-pessoa"[^>]*>Eduardo Moreira Da Costa</);
  assert.match(html, /class="eco-mencao eco-tipo-tema"[^>]*>cidades inteligentes</);
  assert.match(html, /class="eco-mencao eco-tipo-tema"[^>]*>Gestão do Conhecimento</);
  assert.match(html, /class="eco-mencao eco-tipo-documento"[^>]*>Outro trabalho</);
});

test('link de trabalho vira botão do dossiê mais o link da fonte original', () => {
  const html = realcarMencoes(markdownParaHtml('Leia [Governança de dados na saúde](https://exemplo/1).'), dic);
  assert.match(html, /<button[^>]*data-mencao="Documento"[^>]*data-indice="0"[^>]*>Governança de dados na saúde<\/button>/);
  assert.match(html, /<a href="https:\/\/exemplo\/1" target="_blank" rel="noopener noreferrer" class="eco-fonte-externa"/);
  assert.equal(html.match(/<button/g)?.length, 1, 'o botão não é duplicado pela varredura de texto');
});

test('link que não é trabalho do acervo continua só link', () => {
  const html = realcarMencoes(markdownParaHtml('Veja [o repositório](https://repositorio.ufsc.br).'), dic);
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /<a href="https:\/\/repositorio\.ufsc\.br"/);
});
