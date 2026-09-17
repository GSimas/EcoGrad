import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownParaHtml } from '../src/lib/markdown';

test('tabela markdown vira tabela HTML, com alinhamento e marcação dentro das células', () => {
  const html = markdownParaHtml([
    '| Indicador | Valor no dossiê |',
    '|---|---:|',
    '| Trabalhos orientados | **5** |',
    '| Macrotemas | Cidades Inteligentes |',
  ].join('\n'));
  assert.match(html, /<div class="eco-tabela-markdown"><table><thead><tr><th>Indicador<\/th><th style="text-align:right">Valor no dossiê<\/th>/);
  assert.match(html, /<td style="text-align:right"><strong>5<\/strong><\/td>/);
  assert.equal(html.match(/<tr>/g)?.length, 3, 'cabeçalho e duas linhas');
  assert.doesNotMatch(html, /\|/, 'nenhuma barra sobra como texto');
});

test('tabela sem barras nas pontas e com linha incompleta ainda fecha as colunas', () => {
  const html = markdownParaHtml(['Indicador | Valor', ':--- | :---:', '| Só um campo |'].join('\n'));
  assert.match(html, /<th style="text-align:center">Valor<\/th>/);
  assert.match(html, /<tr><td>Só um campo<\/td><td style="text-align:center"><\/td><\/tr>/);
});

test('linha sem barra nenhuma encerra a tabela e volta a ser parágrafo', () => {
  const html = markdownParaHtml(['| A | B |', '|---|---|', '| 1 | 2 |', 'Comentário solto.'].join('\n'));
  assert.equal(html.match(/<tr>/g)?.length, 2, 'só cabeçalho e a linha com barras');
  assert.match(html, /<p>Comentário solto\.<\/p>/);
});

test('frase com barra continua parágrafo: só o separador do cabeçalho cria tabela', () => {
  const html = markdownParaHtml('Escolha A | B conforme o caso.');
  assert.match(html, /^<p>Escolha A \| B conforme o caso\.<\/p>$/);
});

test('conteúdo da tabela continua escapado, como no resto do renderizador', () => {
  const html = markdownParaHtml(['| Campo |', '|---|', '| <img src=x onerror=alert(1)> |'].join('\n'));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('texto depois da tabela volta a ser parágrafo', () => {
  const html = markdownParaHtml(['| A |', '|---|', '| 1 |', '', 'Depois da tabela.'].join('\n'));
  assert.match(html, /<\/table><\/div>\n?<p>Depois da tabela\.<\/p>/);
});
