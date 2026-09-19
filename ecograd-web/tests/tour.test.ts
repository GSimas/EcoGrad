import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHAVE_TOUR, escolherColecaoDemo, passosDoTour, proximoPasso, tamanhoLegivel, tourJaVisto,
  TOTAL_PASSOS_COMPLETO, type ColecaoCandidata,
} from '../src/lib/tour';

const colecao = (p: Partial<ColecaoCandidata> = {}): ColecaoCandidata => ({
  nome: 'Coleção', tipo: 'ppg', total: 100, inicio: 2010, fim: 2024,
  comOrientador: 100, comPalavras: 100, downloadBytes: 50_000, ...p,
});

test('com análise aberta o tour pula o recorte, que substituiria o trabalho em curso', () => {
  const comAnalise = passosDoTour({ temAnalise: true });
  const semAnalise = passosDoTour({ temAnalise: false });
  assert.equal(semAnalise.length, TOTAL_PASSOS_COMPLETO);
  // Os dois passos que carregam dados só existem para quem chega sem nada.
  assert.deepEqual(semAnalise.filter((p) => !comAnalise.includes(p)).map((p) => p.id), ['busca', 'carregar']);
  assert.equal(comAnalise.some((p) => p.acao === 'carregar'), false);
  // O passo de abrir um tema sobrevive nos dois: ele não é destrutivo.
  assert.equal(comAnalise.some((p) => p.acao === 'abrirTema'), true);
});

test('no celular o passo do relatório sai, porque o alvo dele mora na gaveta fechada', () => {
  const largo = passosDoTour({ temAnalise: true });
  const estreito = passosDoTour({ temAnalise: true, estreito: true });
  assert.deepEqual(largo.filter((p) => !estreito.includes(p)).map((p) => p.id), ['relatorio']);
});

test('o roteiro cobre as duas telas de análise, e não só o Dashboard', () => {
  const ids = passosDoTour({ temAnalise: false }).map((p) => p.id);
  for (const esperado of ['indicadores', 'destaques', 'verGrafico', 'coberturaAno', 'filtros', 'analises', 'escolherItem']) {
    assert.ok(ids.includes(esperado), `faltou o passo ${esperado}`);
  }
  assert.equal(new Set(ids).size, ids.length, 'há passos com id repetido');
});

test('todo passo tem alvo por rótulo de acessibilidade, nunca por classe de estilo', () => {
  for (const p of passosDoTour({ temAnalise: false })) {
    assert.ok(p.alvo.includes('aria-label') || p.alvo.includes('role='), `${p.id}: ${p.alvo}`);
    assert.equal(p.alvo.includes('.'), false, `${p.id} usa seletor de classe`);
    assert.ok(p.titulo.length > 0 && p.texto.length > 0, p.id);
  }
});

test('exatamente dois passos pedem ação, e são os que o roteiro prometeu', () => {
  const acoes = passosDoTour({ temAnalise: false }).filter((p) => p.acao);
  assert.deepEqual(acoes.map((p) => p.id), ['carregar', 'tema']);
});

test('a coleção de exemplo é a menor que ainda enche todas as telas', () => {
  const escolhida = escolherColecaoDemo([
    colecao({ nome: 'Grande demais', total: 900, downloadBytes: 1000 }),
    colecao({ nome: 'Pequena demais', total: 12, downloadBytes: 1000 }),
    colecao({ nome: 'Sem orientação', comOrientador: 10, downloadBytes: 1000 }),
    colecao({ nome: 'Sem palavras-chave', comPalavras: 10, downloadBytes: 1000 }),
    colecao({ nome: 'Período curto', inicio: 2020, fim: 2022, downloadBytes: 1000 }),
    colecao({ nome: 'Boa e pesada', downloadBytes: 900_000 }),
    colecao({ nome: 'Boa e leve', downloadBytes: 30_000 }),
  ]);
  assert.equal(escolhida?.nome, 'Boa e leve');
});

test('sem candidata apta, a oferta não inventa uma coleção ruim', () => {
  assert.equal(escolherColecaoDemo([colecao({ total: 5 })]), null);
  assert.equal(escolherColecaoDemo([]), null);
  // Ano ausente desqualifica: sem período não há série anual para o tour mostrar.
  assert.equal(escolherColecaoDemo([colecao({ inicio: null, fim: null })]), null);
});

test('empate de tamanho é resolvido pelo nome, para a escolha não variar entre execuções', () => {
  const a = colecao({ nome: 'Zebra', downloadBytes: 40_000 });
  const b = colecao({ nome: 'Abelha', downloadBytes: 40_000 });
  assert.equal(escolherColecaoDemo([a, b])?.nome, 'Abelha');
  assert.equal(escolherColecaoDemo([b, a])?.nome, 'Abelha');
});

test('a marca de "já visto" é tolerante ao que volta do navegador', () => {
  assert.equal(tourJaVisto(() => JSON.stringify({ visto: true })), true);
  assert.equal(tourJaVisto(() => JSON.stringify({ visto: false })), false);
  assert.equal(tourJaVisto(() => null), false);
  // Lixo no armazenamento não pode derrubar a apresentação inteira.
  assert.equal(tourJaVisto(() => 'não é json'), false);
  assert.equal(tourJaVisto(() => '"texto"'), false);
  assert.equal(CHAVE_TOUR, 'ecograd-tour-v1');
});

test('o tamanho do download é declarado em unidade legível', () => {
  assert.equal(tamanhoLegivel(35_000), '34 KiB');
  assert.equal(tamanhoLegivel(3_000_000), '2.9 MiB');
  assert.equal(tamanhoLegivel(undefined), 'tamanho não informado');
});

test('pular um passo de ação descarta o passo que dependia dela', () => {
  const passos = passosDoTour({ temAnalise: true });
  const tema = passos.findIndex((p) => p.id === 'tema');
  // Cumprida a ação, o dossiê existe na tela e é o próximo.
  assert.equal(passos[proximoPasso(passos, tema, { pulou: false })].id, 'dossie');
  // Pulada, o dossiê nunca foi aberto: apontar para ele travaria o tour. O
  // destino é o primeiro passo que ainda tem alvo sem aquela ação.
  const depoisDePular = passos[proximoPasso(passos, tema, { pulou: true })];
  assert.equal(depoisDePular.dependeDe, undefined);
  assert.equal(passos.slice(tema + 1, passos.indexOf(depoisDePular)).every((p) => p.dependeDe === 'abrirTema'), true);
});

test('pular um passo narrado não descarta nada, e o fim do roteiro é o fim', () => {
  const passos = passosDoTour({ temAnalise: true });
  const cobertura = passos.findIndex((p) => p.id === 'cobertura');
  assert.equal(proximoPasso(passos, cobertura, { pulou: true }), cobertura + 1);
  // Passar do último devolve um índice fora do roteiro — o tour encerra.
  assert.equal(proximoPasso(passos, passos.length - 1, { pulou: true }), passos.length);
});

test('todo passo que depende de uma ação vem depois dela no roteiro', () => {
  const passos = passosDoTour({ temAnalise: false });
  for (const [i, passo] of passos.entries()) {
    if (!passo.dependeDe) continue;
    const acao = passos.findIndex((p) => p.acao === passo.dependeDe);
    assert.ok(acao >= 0, `${passo.id} depende de uma ação que não existe`);
    assert.ok(acao < i, `${passo.id} vem antes da ação de que depende`);
  }
});
