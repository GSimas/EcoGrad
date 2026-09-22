import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blocosDaCapa, carimboDeData, chaveDossie, lerChaveDossie, LIMITES_DO_RELATORIO,
  nomeDoArquivo, SECOES_DASHBOARD, selecaoInicial, selecaoValida, selecaoVazia,
  dossiesVisitados,
} from '../src/lib/relatorio';

test('a seleção inicial traz o Dashboard, deixa a IA de fora e nenhum dossiê', () => {
  const s = selecaoInicial();
  assert.equal(s.tema, 'claro');
  assert.deepEqual(s.dossies, []);
  // Toda seção que não é de IA entra marcada; as de IA, nunca.
  assert.deepEqual(s.dashboard, SECOES_DASHBOARD.filter((x) => !x.ia).map((x) => x.id));
  assert.equal(s.dashboard.includes('sintese-ia'), false);
  assert.equal(selecaoVazia(s), false);
  assert.equal(s.formato, 'pdf');
  assert.equal(s.incluirResumos, true);
  assert.equal(selecaoVazia({ dashboard: [], dossies: [], tema: 'claro', formato: 'pdf', incluirResumos: true }), true);
  // O JSON entrega os registros mesmo sem seção marcada: ele nunca fica vazio.
  assert.equal(selecaoVazia({ dashboard: [], dossies: [], tema: 'claro', formato: 'json', incluirResumos: true }), false);
});

test('a seleção que volta da sessão é saneada sem derrubar o modal', () => {
  // Ids inventados somem; a ordem canônica das seções é preservada, não a da sessão.
  const s = selecaoValida({ dashboard: ['trabalhos', 'nao-existe', 'indicadores'], dossies: ['Autor\u0000Ana'], tema: 'escuro' });
  assert.deepEqual(s.dashboard, ['indicadores', 'trabalhos']);
  assert.deepEqual(s.dossies, ['Autor\u0000Ana']);
  assert.equal(s.tema, 'escuro');
  // Chave de dossiê malformada não passa.
  assert.deepEqual(selecaoValida({ dashboard: [], dossies: ['sem-separador'], tema: 'claro' }).dossies, []);
  // Lixo de sessão antiga cai no padrão em vez de quebrar.
  assert.deepEqual(selecaoValida(null).dashboard, selecaoInicial().dashboard);
  assert.deepEqual(selecaoValida('texto').dossies, []);
  assert.equal(selecaoValida({ tema: 'roxo' }).tema, 'claro');
});

test('chave de dossiê sobrevive a nome com pontuação e volta inteira', () => {
  const nome = 'Hernandez, Malva Isabel Medina';
  const chave = chaveDossie('Orientador', nome);
  assert.deepEqual(lerChaveDossie(chave), { tipo: 'Orientador', termo: nome });
  // Título com separador visual não confunde a leitura: só o primeiro \u0000 corta.
  assert.deepEqual(lerChaveDossie(chaveDossie('Documento', 'A dispersão: um estudo')), { tipo: 'Documento', termo: 'A dispersão: um estudo' });
  assert.equal(lerChaveDossie('Orientador'), null);
});

test('a capa carrega as ressalvas e o carimbo, sempre', () => {
  const capa = blocosDaCapa({
    colecoes: ['Programa de Pós-Graduação em Ecologia'],
    registros: 264, periodo: '2010–2026', baseVersao: 'v7',
    geradoEm: new Date(2026, 8, 18, 14, 5),
  });
  const notas = capa.filter((b) => b.tipo === 'nota').map((b) => (b as { texto: string }).texto);
  // Cada limite declarado precisa estar na capa: eles não são desmarcáveis.
  for (const limite of LIMITES_DO_RELATORIO) assert.ok(notas.includes(limite), limite.slice(0, 40));
  assert.ok(notas.some((n) => n.includes('18/09/2026')));
  assert.ok(capa.some((b) => b.tipo === 'paragrafo' && b.texto.includes('Ecologia')));
  const indicadores = capa.find((b) => b.tipo === 'indicadores');
  assert.ok(indicadores && indicadores.itens.some((i) => i.valor === '264'));
});

test('sem coleção, a capa diz isso em vez de imprimir vazio', () => {
  const capa = blocosDaCapa({ colecoes: [], registros: 0, periodo: 'Não informado', baseVersao: '', geradoEm: new Date() });
  assert.ok(capa.some((b) => b.tipo === 'paragrafo' && b.texto === 'Nenhuma coleção identificada'));
  assert.ok(capa.some((b) => b.tipo === 'indicadores' && b.itens.some((i) => i.valor === 'não informada')));
});

test('nome do arquivo e carimbo saem em formato brasileiro e estável', () => {
  assert.equal(nomeDoArquivo(new Date(2026, 0, 5)), 'ecograd-relatorio-2026-01-05.pdf');
  assert.match(carimboDeData(new Date(2026, 8, 18, 9, 7)), /^18\/09\/2026 às 09:07$/);
});

test('dossiês visitados: o atual vem primeiro, sem repetir e sem entrada sem entidade', () => {
  const visita = (page: string, buscaTipo: string, buscaTermo: string | null) => ({ page, context: { buscaTipo, buscaTermo } });
  const lista = dossiesVisitados([
    visita('dashboard', 'Documento', null),
    visita('busca', 'Autor', 'Ana'),
    visita('busca', 'Orientador', 'Bia'),
    visita('busca', 'Autor', 'Ana'),
    visita('busca', 'Palavra-chave', null),
  ], { tipo: 'Orientador', termo: 'Bia' });
  // O dossiê aberto agora encabeça a lista; duplicatas colapsam.
  assert.deepEqual(lista.map((d) => `${d.tipo}:${d.termo}`), ['Orientador:Bia', 'Autor:Ana']);
  // Sem dossiê aberto, só o histórico; páginas que não são busca ficam fora.
  const semAtual = dossiesVisitados([visita('dashboard', 'Autor', 'Ana'), visita('busca', 'Autor', 'Ana')], { tipo: 'Documento', termo: null });
  assert.deepEqual(semAtual.map((d) => d.termo), ['Ana']);
  assert.deepEqual(dossiesVisitados([], { tipo: 'Documento', termo: null }), []);
});
