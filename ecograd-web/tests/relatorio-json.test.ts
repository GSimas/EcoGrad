import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  camposExportados, estimarTamanho, montarRelatorioJson, registroExportado,
  secoesDosBlocos, tamanhoLegivel, VERSAO_JSON,
} from '../src/lib/relatorio-json';
import { LIMITES_DO_RELATORIO, type Bloco, type Relatorio } from '../src/lib/relatorio';
import type { Documento } from '../src/types';

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

const COMPLETO = doc({
  titulo: 'A dispersão dos saberes',
  ano: 2019,
  autores: ['Bia Autora'],
  orientador: 'Ana Orientadora',
  co_orientadores: ['Caio Coorientador'],
  palavras_chave: ['redes', 'grafos'],
  macrotema: 'Complexidade',
  resumo: 'Este trabalho investiga a dispersão dos saberes.',
  url: 'https://repositorio.ufsc.br/handle/123',
  pureza_nmf: 72.5,
  ontologia_ia: { teorias_e_modelos: ['Teoria X'], ferramentas_e_artefatos: [], metodos_e_tecnicas: ['Método Y'] },
});

test('os blocos do PDF viram secoes enderecaveis, sem perder nada pelo caminho', () => {
  const blocos: Bloco[] = [
    { tipo: 'titulo', texto: 'Dashboard' },
    { tipo: 'nota', texto: 'Base: Coleção A.' },
    { tipo: 'indicadores', itens: [{ rotulo: 'Registros', valor: '408' }] },
    { tipo: 'subtitulo', texto: 'Destaques' },
    { tipo: 'paragrafo', texto: 'Os rankings abaixo contam ocorrências.' },
    { tipo: 'imagem', dataUrl: 'data:image/jpeg;base64,xxx', alt: 'Top 10 orientadores', proporcao: 0.5 },
    { tipo: 'tabela', titulo: 'Top 10', colunas: ['Nome', 'n'], linhas: [['Ana', '12']], nota: 'Frequência não mede mérito.' },
    { tipo: 'pagina' },
    { tipo: 'ia', texto: 'Texto escrito por modelo de linguagem.' },
  ];
  const secoes = secoesDosBlocos(blocos);
  assert.equal(secoes.length, 2);

  assert.equal(secoes[0].titulo, 'Dashboard');
  assert.equal(secoes[0].nivel, 'capitulo');
  assert.deepEqual(secoes[0].notas, ['Base: Coleção A.']);
  assert.deepEqual(secoes[0].indicadores, [{ rotulo: 'Registros', valor: '408' }]);

  assert.equal(secoes[1].titulo, 'Destaques');
  assert.equal(secoes[1].nivel, 'secao');
  assert.deepEqual(secoes[1].paragrafos, ['Os rankings abaixo contam ocorrências.']);
  // A imagem não atravessa: fica o nome, e o dado dela está na tabela ao lado.
  assert.deepEqual(secoes[1].figurasOmitidas, ['Top 10 orientadores']);
  assert.equal(secoes[1].tabelas[0].titulo, 'Top 10');
  assert.deepEqual(secoes[1].tabelas[0].linhas, [['Ana', '12']]);
  assert.equal(secoes[1].tabelas[0].nota, 'Frequência não mede mérito.');
  // Texto de IA fica separado do resto, para quem lê não o confundir com dado.
  assert.deepEqual(secoes[1].textosDeIA, ['Texto escrito por modelo de linguagem.']);
  // Quebra de página é instrução de desenho e não sobrevive à travessia.
  assert.equal(JSON.stringify(secoes).includes('pagina'), false);
});

test('bloco antes do primeiro cabecalho nao se perde', () => {
  const secoes = secoesDosBlocos([{ tipo: 'nota', texto: 'Órfã' }, { tipo: 'titulo', texto: 'Depois' }]);
  assert.equal(secoes.length, 2);
  assert.equal(secoes[0].titulo, '');
  assert.deepEqual(secoes[0].notas, ['Órfã']);
  assert.deepEqual(secoesDosBlocos([]), []);
});

test('o registro exportado usa os nomes de campo da base e omite o que esta vazio', () => {
  const r = registroExportado(COMPLETO, true);
  assert.equal(r.titulo, 'A dispersão dos saberes');
  assert.equal(r.ano, 2019);
  assert.deepEqual(r.palavras_chave, ['redes', 'grafos']);
  assert.equal(r.resumo, 'Este trabalho investiga a dispersão dos saberes.');
  assert.equal(r.pureza_nmf, 72.5);
  assert.ok(r.ontologia_ia);

  // Texto vazio e lista vazia somem, como na base — e não viram string vazia.
  const magro = registroExportado(doc({ titulo: 'Só título' }), true);
  assert.deepEqual(Object.keys(magro).sort(), ['ano', 'nivel_academico', 'programa_origem', 'titulo']);
  assert.equal('resumo' in magro, false);
  assert.equal('palavras_chave' in magro, false);
  // `ano: null` fica: na base ele é um valor, e significa "sem ano", não ausência.
  assert.equal(magro.ano, null);

  // Sem resumos, os campos pesados saem e o resto permanece intacto.
  const semResumo = registroExportado(COMPLETO, false);
  assert.equal('resumo' in semResumo, false);
  assert.equal('ontologia_ia' in semResumo, false);
  assert.deepEqual(semResumo.palavras_chave, ['redes', 'grafos']);
  assert.equal(semResumo.titulo, 'A dispersão dos saberes');

  // A lista de campos declarada no arquivo acompanha a escolha.
  assert.ok(camposExportados(true).includes('resumo'));
  assert.equal(camposExportados(false).includes('resumo'), false);
  assert.ok(camposExportados(false).includes('palavras_chave'));
});

test('o arquivo declara formato, versao, base, limites e os registros completos', () => {
  const relatorio: Relatorio = {
    titulo: 'EcoGrad · Relatório da análise',
    arquivo: 'ecograd-relatorio-2026-09-22.json',
    capa: [{ tipo: 'titulo', texto: 'Capa' }],
    corpo: [{ tipo: 'titulo', texto: 'Dashboard' }, { tipo: 'tabela', titulo: 'T', colunas: ['a'], linhas: [['1']] }],
  };
  const geradoEm = new Date('2026-09-22T15:04:05.000Z');
  const json = montarRelatorioJson(
    relatorio,
    { colecoes: ['Coleção A'], registros: 2, periodo: '2019–2020', baseVersao: 'v7', geradoEm },
    [COMPLETO, doc({ titulo: 'Outro' })],
    { incluirResumos: true, recorte: [{ tipo: 'Orientador', nome: 'Ana Orientadora' }] },
  );

  assert.equal(json.formato, 'ecograd-relatorio');
  assert.equal(json.versao, VERSAO_JSON);
  assert.equal(json.gerado.em, '2026-09-22T15:04:05.000Z');
  assert.equal(json.base.versao, 'v7');
  assert.deepEqual(json.base.colecoes, ['Coleção A']);
  assert.deepEqual(json.base.recorte, [{ tipo: 'Orientador', nome: 'Ana Orientadora' }]);
  // As ressalvas viajam com o arquivo: ele circula longe da tela que as explica.
  assert.deepEqual([...json.limites], LIMITES_DO_RELATORIO);
  assert.equal(json.secoes[0].titulo, 'Dashboard');

  assert.equal(json.documentos.total, 2);
  assert.equal(json.documentos.resumosIncluidos, true);
  assert.equal(json.documentos.registros[0].resumo, 'Este trabalho investiga a dispersão dos saberes.');
  assert.deepEqual(json.documentos.registros[0].palavras_chave, ['redes', 'grafos']);

  // E sobrevive à ida e volta por JSON, que é o ponto do formato.
  const voltou = JSON.parse(JSON.stringify(json));
  assert.deepEqual(voltou.documentos.registros[0].palavras_chave, ['redes', 'grafos']);
  assert.equal(voltou.documentos.registros[1].titulo, 'Outro');
});

test('a estimativa de tamanho acompanha os resumos e sai legivel', () => {
  const grandes = Array.from({ length: 100 }, () => doc({ titulo: 'T', resumo: 'x'.repeat(2000) }));
  const com = estimarTamanho(grandes, true);
  const sem = estimarTamanho(grandes, false);
  // O resumo é a maior parte: sem ele o arquivo encolhe de verdade.
  assert.ok(com > sem * 2, `com=${com} sem=${sem}`);
  assert.ok(sem > 0);
  assert.equal(estimarTamanho([], true) > 0, true);

  assert.equal(tamanhoLegivel(512), '512 B');
  assert.equal(tamanhoLegivel(2048), '2.0 kB');
  assert.equal(tamanhoLegivel(5 * 1024 * 1024), '5.0 MB');
  assert.equal(tamanhoLegivel(300 * 1024 * 1024), '300 MB');
  assert.equal(tamanhoLegivel(3 * 1024 * 1024 * 1024), '3.0 GB');
});
