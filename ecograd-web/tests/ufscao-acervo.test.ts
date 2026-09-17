import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  citacoesInvalidas, dicionarioCompacto, fontesDaAmostra, lerPlano, promptPlanejamento, promptResposta, realcarCitacoes,
  type Panorama,
} from '../src/lib/ufscao-acervo';

test('o plano e lido mesmo com cerca de codigo e texto em volta, e tipo invalido e recusado', () => {
  const plano = lerPlano('Claro!\n```json\n{"tipo":"tema","grupos":[["empreendedorismo","empreendedora"],["mulheres",""]],"ano_min":2015.7}\n```');
  assert.deepEqual(plano, { tipo: 'tema', sql: undefined, grupos: [['empreendedorismo', 'empreendedora'], ['mulheres']], colecao: undefined, ano_min: 2015, ano_max: undefined, motivo: undefined });
  assert.equal(lerPlano('{"tipo":"resposta","sql":"select 1"}'), null);
  assert.equal(lerPlano('sem json nenhum'), null);
  assert.equal(lerPlano('{"tipo":"dados"}'), null, 'dados sem SQL nao e plano');
});

test('misto sem uma das metades vira o que ainda da para fazer', () => {
  assert.equal(lerPlano('{"tipo":"misto","grupos":[["inovacao"]]}')?.tipo, 'tema');
  assert.equal(lerPlano('{"tipo":"misto","sql":"select 1"}')?.tipo, 'dados');
});

const panorama: Panorama = {
  consulta: "'empreendedor' & 'mulh'", obras: 51, registros: 57, obras_sem_resumo: 0,
  por_colecao: [['TCC Administração', 9]], por_ano: [[2020, 5]],
  amostra: [
    { documento_id: 'a', titulo: 'Mulheres empreendedoras', ano: 2020, colecao: 'TCC Administração', nivel: 'TCC (Graduação)', url: 'https://x/a', aderencia: 0.5, autores: ['Silva, Ana'], orientador: 'Souza, Bia', palavras_chave: ['empreendedorismo'], trecho: 'um trecho' },
    { documento_id: 'b', titulo: 'Gênero e negócios', ano: 2018, colecao: 'PPGEP', nivel: null, url: null, aderencia: 0.3, autores: null, orientador: null, palavras_chave: null, trecho: null },
  ],
};

test('citacoes viram botao so para fontes que existem, fora de codigo e link', () => {
  const fontes = fontesDaAmostra(panorama);
  const html = realcarCitacoes('<p>Um estudo [1] e outro [2], mas [7] nao existe.</p><code>[1]</code>', fontes);
  assert.match(html, /data-fonte="1"[^>]*>\[1\]<\/button>/);
  assert.match(html, /data-fonte="2"[^>]*>\[2\]<\/button>/);
  assert.match(html, / \[7\] nao existe/);
  assert.match(html, /<code>\[1\]<\/code>/);
  assert.deepEqual(citacoesInvalidas('ver [1], [3] e [0]', fontes.length), [3, 0]);
  const lista = realcarCitacoes('<p>Vários estudos [1, 2; 9].</p>', fontes);
  assert.match(lista, /data-fonte="1"[^>]*>\[1\]<\/button><button[^>]*data-fonte="2"[^>]*>\[2\]<\/button>\[9\]/);
  assert.deepEqual(citacoesInvalidas('estudos [1, 2, 9]', fontes.length), [9]);
});

test('o contexto da resposta traz panorama, amostra numerada e erros declarados', () => {
  const { mensagem } = promptResposta('empreendedorismo feminino?', { tipo: 'tema', grupos: [['x']] }, null, null, panorama, null);
  assert.match(mensagem, /Obras encontradas: 51 \(57 registros\)/);
  assert.match(mensagem, /\[1\] Mulheres empreendedoras \(2020\)/);
  assert.match(mensagem, /\[2\] Gênero e negócios \(2018\)[\s\S]*sem resumo utilizável/);
  const falhou = promptResposta('quantos?', { tipo: 'dados', sql: 'select 1' }, null, 'relation "x" does not exist', null, null);
  assert.match(falhou.mensagem, /a consulta falhou e não há números apurados/);
  const amplo = promptResposta('educação?', { tipo: 'tema', grupos: [['educação']] }, null, null, null, 'canceling statement due to statement timeout');
  assert.match(amplo.mensagem, /amplo demais/);
});

test('o planejamento leva dicionario, exemplos e so os ultimos turnos da conversa', () => {
  const dic = dicionarioCompacto([
    { visao: 'pessoas', descricao_visao: 'Uma linha por pessoa', coluna: 'obras_orientadas', tipo: 'integer', descricao: 'Trabalhos orientados' },
    { visao: 'pessoas', descricao_visao: 'Uma linha por pessoa', coluna: 'nome', tipo: 'text', descricao: null },
  ]);
  assert.equal(dic, '### pessoas — Uma linha por pessoa\n- obras_orientadas (integer): Trabalhos orientados\n- nome (text)');
  const turnos = Array.from({ length: 5 }, (_, i) => ({ pergunta: `p${i}`, plano: null, resposta: `r${i}` }));
  const { sistema, mensagem } = promptPlanejamento(dic, 'e depois de 2020?', turnos);
  assert.match(sistema, /tokens_de_nome\('patricia de sa freire'\)/, 'exemplos de SQL entram no prompt');
  assert.match(sistema, /obras_orientadas \(integer\)/);
  assert.doesNotMatch(mensagem, /p1/);
  assert.match(mensagem, /p2[\s\S]*p4[\s\S]*PERGUNTA: e depois de 2020\?/);
});
