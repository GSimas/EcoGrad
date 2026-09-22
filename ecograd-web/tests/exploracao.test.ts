import test from 'node:test';
import assert from 'node:assert/strict';
import Graph from 'graphology';
import { linhasMacrotemas, linhasPalavrasChave, quadrantesTematicos } from '../src/lib/mapa-tematico';
import { calcularFurosEstruturais, construirGrafoFuros } from '../src/lib/burt-furos';
import { caixasQL, entidadesDisponiveis, gerarBaseBoxplotQL } from '../src/lib/boxplot-ql';
import { periodosPadrao, prepararSankeyTemporal } from '../src/lib/sankey-temporal';
import { escaparXml, grafoParaGexf, grafoParaGraphml, grafoParaNodeLink, serializarGrafo } from '../src/lib/exportar-grafo';
import { agruparPorComunidade, ELEVACAO_MAXIMA, ELEVACAO_MINIMA, normalizarCamera, pontosTopologicos, projetarEspaco } from '../src/lib/espaco-topologico';
import { linhasBaseSNA, maximosBaseSNA } from '../src/lib/base-sna';
import type { Documento, MetricasSNA, SnaGlobal, TipoNo } from '../src/types';

function doc(parcial: Partial<Documento>): Documento {
  return {
    titulo: 'Sem título',
    nivel_academico: 'Dissertação (Mestrado)',
    autores: [],
    orientador: '',
    co_orientadores: [],
    palavras_chave: [],
    macrotema: '',
    resumo: '',
    programa_origem: 'PPG Exemplo',
    url: '',
    ano: null,
    ...parcial,
  };
}

function metrica(parcial: Partial<MetricasSNA> & { Tipo: TipoNo }): MetricasSNA {
  return {
    'Grau Absoluto': 0,
    'Degree Centrality': 0,
    Betweenness: 0,
    Closeness: 0,
    Clustering: 0,
    Comunidade: 'N/A',
    'Ranking Global': 'N/A',
    ...parcial,
  };
}

const BASE: Documento[] = [
  doc({ titulo: 'T1', ano: 2010, nivel_academico: 'Tese (Doutorado)', orientador: 'Ana', autores: ['Bia'], palavras_chave: ['redes', 'grafos'], macrotema: 'Complexidade' }),
  doc({ titulo: 'T2', ano: 2012, orientador: 'Ana', autores: ['Caio'], palavras_chave: ['redes'], macrotema: 'Complexidade' }),
  doc({ titulo: 'T3', ano: 2016, orientador: 'Duda', autores: ['Bia'], palavras_chave: ['grafos', 'ontologia'], macrotema: 'Semântica' }),
  doc({ titulo: 'T4', ano: 2020, nivel_academico: 'TCC', orientador: 'Duda', autores: ['Eva'], palavras_chave: ['ontologia'], macrotema: 'Semântica' }),
];

test('a tabela de macrotemas agrega volumes, anos e o especialista por QL', () => {
  const sna: SnaGlobal = {
    Complexidade: metrica({ Tipo: 'Macrotema', 'Grau Absoluto': 4, Betweenness: 0.5, Closeness: 0.3 }),
  };
  const linhas = linhasMacrotemas(BASE, sna);
  assert.equal(linhas.length, 2);

  const complexidade = linhas.find((l) => l.Macrotema === 'Complexidade')!;
  assert.equal(complexidade.Docs, 2);
  assert.equal(complexidade.Teses, 1);
  assert.equal(complexidade.Dissertações, 1);
  assert.equal(complexidade.Início, 2010);
  assert.equal(complexidade.Recente, 2012);
  assert.equal(complexidade.Grau, 4);
  assert.equal(complexidade.Betweenness, 0.5);
  // Ana só orienta dentro de Complexidade: QL = (2/2) / (2/4) = 2.
  assert.equal(complexidade['Especialista (Orientador)'], 'Ana');
  assert.equal(complexidade['QL do orientador'], 2);
  // Sem coorientadores na base, a coluna fica explicitamente vazia.
  assert.equal(complexidade['Especialista (Co-orientador)'], '-');
  assert.equal(complexidade['QL do co-orientador'], null);

  // Macrotema sem métrica no grafo recebe zero, e não some da tabela.
  const semantica = linhas.find((l) => l.Macrotema === 'Semântica')!;
  assert.equal(semantica.Grau, 0);
  assert.equal(semantica.Betweenness, 0);

  // Ordenação por volume; a tabela também funciona sem rede calculada.
  assert.deepEqual(linhasMacrotemas(BASE, null).map((l) => l.Grau), [0, 0]);
});

test('macrotema vazio entra na tabela com o rotulo padrao do modelo original', () => {
  const linhas = linhasMacrotemas([doc({ titulo: 'X', macrotema: '' })], null);
  assert.equal(linhas[0].Macrotema, 'Multidisciplinar / Transversal');
});

test('as palavras-chave do mapa contam documentos e respeitam o topo pedido', () => {
  const linhas = linhasPalavrasChave(BASE, null, 2);
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas.map((l) => l['Palavra-chave']), ['grafos', 'ontologia']);
  // "redes" e "grafos" e "ontologia" aparecem 2, 2 e 2 vezes: empate resolvido
  // por ordem alfabética, para que o corte não dependa da ordem dos documentos.
  assert.equal(linhas[0].Frequência, 2);
});

test('os quadrantes dividem pela media e o valor igual a media fica no lado baixo', () => {
  const linhas = [
    { nome: 'a', x: 0, y: 0 },
    { nome: 'b', x: 2, y: 2 },
    { nome: 'c', x: 1, y: 1 },
  ];
  const { linhas: divididas, xMid, yMid } = quadrantesTematicos(linhas, 'x', 'y');
  assert.equal(xMid, 1);
  assert.equal(yMid, 1);
  assert.equal(divididas.find((l) => l.nome === 'b')!.Quadrante, 'Temas Motores');
  assert.equal(divididas.find((l) => l.nome === 'a')!.Quadrante, 'Temas Emergentes / Declínio');
  // Exatamente na média: cai no lado baixo dos dois eixos, sem ambiguidade.
  assert.equal(divididas.find((l) => l.nome === 'c')!.Quadrante, 'Temas Emergentes / Declínio');
  assert.deepEqual(quadrantesTematicos([], 'x', 'y'), { linhas: [], xMid: 0, yMid: 0 });
});

test('a rede de furos liga orientadores a palavras-chave, sem lacos', () => {
  const { grafo, orientadores } = construirGrafoFuros([
    ...BASE,
    // Palavra-chave homônima do orientador não vira laço.
    doc({ titulo: 'T5', orientador: 'Ana', palavras_chave: ['Ana'] }),
  ]);
  assert.deepEqual([...orientadores].sort(), ['Ana', 'Duda']);
  assert.equal(grafo.hasEdge('Ana', 'redes'), true);
  assert.equal(grafo.hasEdge('Ana', 'Ana'), false);
  // Documentos e autores não entram nesta rede.
  assert.equal(grafo.hasNode('T1'), false);
  assert.equal(grafo.hasNode('Bia'), false);
});

test('os furos estruturais devolvem uma linha por orientador, em ordem de restricao', () => {
  const { linhas, totalPalavrasChave, betweennessAproximado } = calcularFurosEstruturais(BASE);
  assert.deepEqual(linhas.map((l) => l.Orientador).sort(), ['Ana', 'Duda']);
  assert.equal(totalPalavrasChave, 3);
  assert.equal(betweennessAproximado, false);
  for (const l of linhas) {
    assert.ok(Number.isFinite(l['Restrição (Constraint)']));
    assert.ok(l.Diversidade >= 1);
  }
  // Ordem crescente de restrição: o primeiro é o de vizinhança menos redundante.
  assert.ok(linhas[0]['Restrição (Constraint)'] <= linhas[1]['Restrição (Constraint)']);

  // Orientador sem palavra-chave não tem vizinhança: restrição 0, não NaN.
  const isolado = calcularFurosEstruturais([doc({ titulo: 'S1', orientador: 'Solo' })]);
  assert.equal(isolado.linhas.length, 1);
  assert.equal(isolado.linhas[0]['Restrição (Constraint)'], 0);
  assert.equal(isolado.linhas[0].Diversidade, 0);

  // Base sem orientador nenhum não produz rede.
  assert.deepEqual(calcularFurosEstruturais([doc({ titulo: 'S2' })]).linhas, []);
});

test('o QL por nivel compara a entidade com a proporcao da selecao', () => {
  // Na base: 1 Tese, 2 Dissertações e 1 TCC (que cai em "Outros").
  const linhas = gerarBaseBoxplotQL(BASE, 'Orientador', ['Ana']);
  assert.equal(linhas.length, 3);
  const porNivel = Object.fromEntries(linhas.map((l) => [l.Nível, l]));
  // Ana tem 2 documentos: 1 Tese e 1 Dissertação.
  // Teses: (1/2) / (1/4) = 2. Dissertações: (1/2) / (2/4) = 1. Outros: 0.
  assert.equal(porNivel.Teses['Valor QL'], 2);
  assert.equal(porNivel.Dissertações['Valor QL'], 1);
  assert.equal(porNivel.Outros['Valor QL'], 0);
  assert.equal(porNivel.Teses.Documentos, 1);
  assert.equal(porNivel.Teses['Total da entidade'], 2);

  // Entidade ausente da seleção simplesmente não gera linhas.
  assert.deepEqual(gerarBaseBoxplotQL(BASE, 'Orientador', ['Ninguém']), []);
  assert.deepEqual(gerarBaseBoxplotQL([], 'Orientador', ['Ana']), []);
});

test('as caixas do boxplot resumem exatamente os tres niveis de cada entidade', () => {
  const caixas = caixasQL(gerarBaseBoxplotQL(BASE, 'Orientador', ['Ana', 'Duda']));
  assert.deepEqual(caixas.map((c) => c.entidade), ['Ana', 'Duda']);
  const ana = caixas[0];
  assert.equal(ana.valores.length, 3);
  // [min, Q1, mediana, Q3, max] sobre {0, 1, 2}.
  assert.deepEqual(ana.resumo, [0, 0.5, 1, 1.5, 2]);
});

test('as entidades disponiveis saem ordenadas por volume e ignoram vazios', () => {
  assert.deepEqual(entidadesDisponiveis(BASE, 'Orientador'), ['Ana', 'Duda']);
  assert.deepEqual(entidadesDisponiveis(BASE, 'Palavra-chave'), ['grafos', 'ontologia', 'redes']);
  // Macrotema vazio não vira opção.
  assert.deepEqual(entidadesDisponiveis([doc({ titulo: 'V', macrotema: '' })], 'Macrotema'), []);
});

test('o sankey liga termos por pessoas presentes nos dois periodos', () => {
  const periodos = periodosPadrao(BASE)!;
  assert.deepEqual(periodos.map((p) => [p.inicio, p.fim]), [[2010, 2013], [2013, 2016], [2016, 2020]]);

  const fluxo = prepararSankeyTemporal(
    BASE,
    5,
    [{ inicio: 2010, fim: 2011 }, { inicio: 2012, fim: 2016 }, { inicio: 2017, fim: 2020 }],
  );
  assert.equal(fluxo.periodoVazio, null);
  assert.deepEqual(fluxo.documentosPorPeriodo, [1, 2, 1]);
  // Ana e Bia atravessam os períodos 1 e 2; só Duda atravessa o 2 e o 3.
  assert.deepEqual(fluxo.pesquisadoresEmComum, [2, 1]);
  assert.ok(fluxo.links.length > 0);
  for (const l of fluxo.links) {
    assert.ok(fluxo.nos.some((n) => n.nome === l.origem));
    assert.ok(fluxo.nos.some((n) => n.nome === l.destino));
  }
  // O rótulo do nó carrega o ano inicial do período, como no original.
  assert.ok(fluxo.nos.some((n) => n.nome === 'redes (2010)'));
});

test('periodo sem palavra-chave interrompe o sankey e diz qual foi', () => {
  const vazio = prepararSankeyTemporal(
    BASE,
    5,
    [{ inicio: 1990, fim: 1995 }, { inicio: 2010, fim: 2012 }, { inicio: 2016, fim: 2020 }],
  );
  assert.equal(vazio.periodoVazio, 1);
  assert.deepEqual(vazio.nos, []);
  assert.deepEqual(vazio.links, []);
  assert.equal(periodosPadrao([doc({ titulo: 'N', ano: null })]), null);
});

test('sem pessoa em comum o sankey tem nos mas nenhum fluxo', () => {
  const isolados = [
    doc({ titulo: 'A', ano: 2000, orientador: 'Um', palavras_chave: ['alfa'] }),
    doc({ titulo: 'B', ano: 2005, orientador: 'Dois', palavras_chave: ['beta'] }),
    doc({ titulo: 'C', ano: 2010, orientador: 'Três', palavras_chave: ['gama'] }),
  ];
  const fluxo = prepararSankeyTemporal(isolados, 5, [
    { inicio: 2000, fim: 2001 }, { inicio: 2005, fim: 2006 }, { inicio: 2010, fim: 2011 },
  ]);
  assert.equal(fluxo.nos.length, 3);
  assert.deepEqual(fluxo.links, []);
  assert.deepEqual(fluxo.pesquisadoresEmComum, [0, 0]);
});

test('a exportacao da rede produz XML valido e JSON node-link', () => {
  const g = new Graph({ type: 'undirected' });
  g.addNode('Ana & Cia', { tipo: 'Orientador', grau: 2 });
  g.addNode('<redes>', { tipo: 'Palavra-chave' });
  g.addEdge('Ana & Cia', '<redes>', { peso: 1 });

  const gexf = grafoParaGexf(g);
  assert.ok(gexf.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  // Texto do acervo nunca escapa para dentro da marcação.
  assert.ok(gexf.includes('id="Ana &amp; Cia"'));
  assert.ok(gexf.includes('&lt;redes&gt;'));
  assert.ok(!gexf.includes('<redes>'));
  assert.ok(gexf.includes('<attribute id="0" title="tipo" type="string"/>'));

  const graphml = grafoParaGraphml(g);
  assert.ok(graphml.includes('<graph edgedefault="undirected">'));
  assert.ok(graphml.includes('attr.name="tipo"'));
  assert.ok(graphml.includes('&lt;redes&gt;'));

  const nodeLink = JSON.parse(grafoParaNodeLink(g));
  assert.equal(nodeLink.directed, false);
  assert.deepEqual(nodeLink.nodes.map((n: { id: string }) => n.id), ['Ana & Cia', '<redes>']);
  assert.equal(nodeLink.links[0].source, 'Ana & Cia');
  assert.equal(nodeLink.nodes[0].tipo, 'Orientador');

  assert.equal(serializarGrafo(g, 'GraphML'), graphml);
  // Caracteres de controle quebrariam o XML: saem do texto exportado.
  assert.equal(escaparXml('a\u0000b\u001Fc'), 'abc');
  assert.equal(escaparXml('linha\nnova'), 'linha\nnova');
  assert.equal(escaparXml(null), '');
});

test('o espaco topologico filtra por dimensao, corta pelo grau e projeta o cubo', () => {
  const sna: SnaGlobal = {
    alfa: metrica({ Tipo: 'Palavra-chave', 'Grau Absoluto': 9, Betweenness: 0.9, Closeness: 0.5, Comunidade: 1 }),
    beta: metrica({ Tipo: 'Palavra-chave', 'Grau Absoluto': 3, Betweenness: 0.1, Closeness: 0.2, Comunidade: 2 }),
    Ana: metrica({ Tipo: 'Orientador', 'Grau Absoluto': 5 }),
    Bia: metrica({ Tipo: 'Co-orientador', 'Grau Absoluto': 4 }),
  };
  const pk = pontosTopologicos(sna, 'Palavra-chave');
  assert.deepEqual(pk.pontos.map((p) => p.Item), ['alfa', 'beta']);
  assert.equal(pk.total, 2);

  // "Orientador" recolhe também os coorientadores, como no Python.
  const ori = pontosTopologicos(sna, 'Orientador');
  assert.deepEqual(ori.pontos.map((p) => p.Item), ['Ana', 'Bia']);

  // O corte mantém os de maior grau.
  assert.deepEqual(pontosTopologicos(sna, 'Palavra-chave', 1).pontos.map((p) => p.Item), ['alfa']);
  assert.deepEqual(pontosTopologicos(null, 'Palavra-chave'), { pontos: [], total: 0 });

  const { projetados, cubo } = projetarEspaco(pk.pontos, { azimute: 35, elevacao: 22 });
  assert.equal(projetados.length, 2);
  assert.equal(cubo.length, 8);
  for (const p of projetados) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.profundidade >= 0 && p.profundidade <= 1);
  }
  // Ordem de desenho: o mais distante primeiro.
  assert.ok(projetados[0].profundidade <= projetados[1].profundidade);
  assert.deepEqual(projetarEspaco([]), { projetados: [], cubo: [] });
});

test('a escala logaritmica reposiciona sem trocar a ordem dos nos', () => {
  const sna: SnaGlobal = {
    gigante: metrica({ Tipo: 'Palavra-chave', 'Grau Absoluto': 1000, Betweenness: 0.9, Closeness: 0.9 }),
    medio: metrica({ Tipo: 'Palavra-chave', 'Grau Absoluto': 10, Betweenness: 0.05, Closeness: 0.5 }),
    pequeno: metrica({ Tipo: 'Palavra-chave', 'Grau Absoluto': 1, Betweenness: 0, Closeness: 0.1 }),
  };
  const { pontos } = pontosTopologicos(sna, 'Palavra-chave');
  const camera = { azimute: 0, elevacao: 0 };
  const linear = projetarEspaco(pontos, camera, 'Linear (modelo original)');
  const log = projetarEspaco(pontos, camera, 'Logarítmica');

  // Sem azimute nem elevação, o eixo X do desenho é o grau normalizado: dá para
  // comparar as duas escalas diretamente.
  const xPor = (r: typeof linear) => Object.fromEntries(r.projetados.map((p) => [p.ponto.Item, p.x]));
  const xLinear = xPor(linear);
  const xLog = xPor(log);
  // A ordem entre os nós é a mesma nas duas escalas: a transformação é monótona.
  assert.ok(xLinear.pequeno < xLinear.medio && xLinear.medio < xLinear.gigante);
  assert.ok(xLog.pequeno < xLog.medio && xLog.medio < xLog.gigante);
  // No linear o nó médio cola no pequeno; no log ele se afasta de verdade.
  assert.ok(xLinear.medio - xLinear.pequeno < 0.02);
  assert.ok(xLog.medio - xLog.pequeno > 0.2);
  // Nenhum valor da métrica é transformado: a tabela segue com os originais.
  assert.equal(log.projetados.find((p) => p.ponto.Item === 'gigante')!.ponto.Grau, 1000);
});

test('um eixo constante nao divide por zero na projecao', () => {
  const sna: SnaGlobal = {
    a: metrica({ Tipo: 'Macrotema', 'Grau Absoluto': 2, Betweenness: 0.5, Closeness: 0.5 }),
    b: metrica({ Tipo: 'Macrotema', 'Grau Absoluto': 2, Betweenness: 0.5, Closeness: 0.5 }),
  };
  const { projetados } = projetarEspaco(pontosTopologicos(sna, 'Macrotema').pontos);
  assert.equal(projetados.length, 2);
  for (const p of projetados) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('a camera do arrasto da a volta na horizontal e encosta nos limites na vertical', () => {
  // O arrasto soma graus sem fim; o azimute precisa voltar ao começo sozinho.
  assert.deepEqual(normalizarCamera({ azimute: 361, elevacao: 0 }), { azimute: 1, elevacao: 0 });
  assert.deepEqual(normalizarCamera({ azimute: -1, elevacao: 0 }), { azimute: 359, elevacao: 0 });
  assert.deepEqual(normalizarCamera({ azimute: 720, elevacao: 0 }), { azimute: 0, elevacao: 0 });
  // Passar de 90° viraria o cubo e inverteria o eixo Closeness sem aviso.
  assert.equal(normalizarCamera({ azimute: 0, elevacao: 200 }).elevacao, ELEVACAO_MAXIMA);
  assert.equal(normalizarCamera({ azimute: 0, elevacao: -200 }).elevacao, ELEVACAO_MINIMA);
  // Os deslizadores têm passo de 1°: o ângulo do arrasto chega inteiro a eles.
  assert.deepEqual(normalizarCamera({ azimute: 35.4, elevacao: 21.6 }), { azimute: 35, elevacao: 22 });
});

test('a legenda do espaco agrupa as comunidades menores num grupo unico', () => {
  const sna: SnaGlobal = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      `no${i}`,
      metrica({ Tipo: 'Palavra-chave', 'Grau Absoluto': 12 - i, Comunidade: i + 1 }),
    ]),
  );
  const { projetados } = projetarEspaco(pontosTopologicos(sna, 'Palavra-chave').pontos);
  const grupos = agruparPorComunidade(projetados, 8);
  assert.equal(grupos.length, 9);
  assert.ok(grupos.some((g) => g.nome === 'Demais comunidades'));
});

test('a base completa carrega as metricas do no do documento', () => {
  const sna: SnaGlobal = {
    T1: metrica({ Tipo: 'Documento', 'Grau Absoluto': 5, Betweenness: 0.123456, Closeness: 0.5, Comunidade: 3, 'Ranking Global': 7 }),
  };
  const linhas = linhasBaseSNA(BASE, sna);
  assert.equal(linhas.length, 4);
  const t1 = linhas[0];
  assert.equal(t1.Título, 'T1');
  assert.equal(t1.Ano, 2010);
  assert.equal(t1.Autores, 'Bia');
  assert.equal(t1['Palavras-chave'], 'redes, grafos');
  assert.equal(t1['Grau (SNA)'], 5);
  // Quatro casas, como o `round(..., 4)` do Streamlit.
  assert.equal(t1['Betweenness (SNA)'], 0.1235);
  assert.equal(t1['Comunidade (SNA)'], 3);
  assert.equal(t1['Ranking Global (SNA)'], 7);

  // Documento fora do grafo recebe zero e "N/A", nunca some da tabela.
  const t2 = linhas[1];
  assert.equal(t2['Grau (SNA)'], 0);
  assert.equal(t2['Comunidade (SNA)'], 'N/A');

  assert.equal(maximosBaseSNA(linhas).grau, 5);
  // Sem rede calculada, os máximos caem para 1 e as barras não dividem por zero.
  assert.deepEqual(maximosBaseSNA(linhasBaseSNA(BASE, null)), { grau: 1, betweenness: 1, closeness: 1 });
});
