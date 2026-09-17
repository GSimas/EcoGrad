import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEM_RELEVANCIA } from '../src/lib/chat-sintese';
import {
  citacoesInvalidas, dicionarioCompacto, fontesDaAmostra, lerPlano, obrasLidas, planejarLeituraDoTema,
  promptPlanejamento, promptReducaoDoTema, promptResposta, realcarCitacoes,
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

test('obra achada so por significado e marcada, e sem termos casados nao ha contagem', () => {
  const comVetor: Panorama = {
    ...panorama, busca_por_significado: true, obras_so_por_significado: 7,
    amostra: [{ ...panorama.amostra![0], origem: 'ambos' }, { ...panorama.amostra![1], origem: 'significado' }],
  };
  const { mensagem } = promptResposta('tema?', { tipo: 'tema', grupos: [['x']] }, null, null, comVetor, null);
  assert.match(mensagem, /7 obras próximas em significado não usam os termos[\s\S]*NÃO entram em nenhuma contagem/);
  assert.doesNotMatch(mensagem, /\[1\] Mulheres empreendedoras \(2020\)[^\n]*SIGNIFICADO/);
  assert.match(mensagem, /\[2\] Gênero e negócios \(2018\)[^\n]*ACHADA SÓ POR SIGNIFICADO/);

  const soVetor = promptResposta('tema?', { tipo: 'tema', grupos: [['x']] }, null, null, { ...comVetor, obras: 0, registros: 0 }, null).mensagem;
  assert.match(soVetor, /nenhuma obra usa os termos da busca[\s\S]*não dê número de obras/);
  assert.doesNotMatch(soVetor, /Obras encontradas:/);
  assert.equal(fontesDaAmostra(comVetor)[1].origem, 'significado');
  const amplo = promptResposta('educação?', { tipo: 'tema', grupos: [['educação']] }, null, null, { ...comVetor, obras: 0, amplo_demais: true }, null).mensagem;
  assert.match(amplo, /amplo demais para contar[\s\S]*NÃO dê nenhum número/);
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

const doIndice = (n: number, resumo = 'x'.repeat(50)) => ({
  documento_id: `d${n}`, titulo: `Obra ${n}`, ano: 2000 + n, colecao: 'TCC Administração',
  nivel: null, url: null, autores: null, orientador: null, resumo,
});

test('aprofundar numera na ordem do indice, normaliza o que falta e corta resumo longo', () => {
  const [a, b] = obrasLidas([
    { ...doIndice(1), nivel: 'Mestrado', autores: ['Silva, Ana'], orientador: 'Souza, Bia' },
    { ...doIndice(2), resumo: 'y'.repeat(5000) },
  ]);
  assert.equal(a.numero, 1);
  assert.equal(a.documentoId, 'd1');
  assert.equal(a.origem, 'texto', 'obra lida entra pelos termos: significado nao tem total (D2)');
  assert.equal(b.numero, 2);
  assert.deepEqual([b.nivel, b.autores, b.orientador], ['', [], ''], 'nulo do banco vira vazio, nao "null" no prompt');
  assert.equal(b.resumo.length, 3000, 'resumo longo nao pode dominar o contexto');
  assert.equal(obrasLidas([doIndice(9)], 40)[0].numero, 41, 'a numeracao continua de onde parou');
});

test('a conta do aprofundamento sai antes de gastar a chave', () => {
  const plano = planejarLeituraDoTema(obrasLidas(Array.from({ length: 45 }, (_, i) => doIndice(i))));
  assert.equal(plano.lotes.length, 3, '45 obras em lotes de 20');
  assert.equal(plano.chamadas, 4, 'um por lote, mais a sintese final');
  assert.ok(plano.tokensEntrada > 0 && plano.tokensSaida > 0);
  assert.ok(plano.segundos[0] < plano.segundos[1]);
  assert.equal(planejarLeituraDoTema([]).lotes.length, 0, 'sem obra com resumo nao ha o que ler');
});

test('a reducao do tema conta pelo panorama, cita as obras lidas e declara o que ficou de fora', () => {
  const obras = obrasLidas([doIndice(1), doIndice(2)]);
  const leitura = { obras: 51, comResumo: 2, lidas: 2 };
  const { sistema, mensagem } = promptReducaoDoTema('empreendedorismo feminino?', panorama, leitura, obras,
    ['- Fala de microcredito [1]', `  ${SEM_RELEVANCIA}  `]);
  assert.match(mensagem, /Obras encontradas: 51 \(57 registros\)/, 'o numero vem do panorama, nao da leitura');
  assert.match(mensagem, /FONTES LIDAS \(2; os n/);
  assert.match(mensagem, /\[1\] Obra 1 \(2001\)/);
  assert.match(mensagem, /- Fala de microcredito \[1\]/);
  assert.doesNotMatch(mensagem, new RegExp(SEM_RELEVANCIA), 'lote sem nada relevante nao entra na sintese');
  assert.match(sistema, /cobrem as 2 obras com resumo utilizável do tema, de 51 no total/);

  const cortada = promptReducaoDoTema('tema?', panorama, { obras: 900, comResumo: 700, lidas: 400 }, obras, []);
  assert.match(cortada.sistema, /400 obras de maior aderência, de 700 com resumo utilizável[\s\S]*você deve dizer isso/);
  assert.match(cortada.mensagem, /nenhum lote encontrou conteúdo relevante/);
});
