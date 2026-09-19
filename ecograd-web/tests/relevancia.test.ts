import assert from 'node:assert/strict';
import { test } from 'node:test';
import { relevanciaDossie, temVizinhancaNoGrafo } from '../src/lib/relevancia';
import { temLigacaoRadial } from '../src/lib/rede-radial';
import type { Documento } from '../src/types';

const doc = (p: Partial<Documento> = {}): Documento => ({
  titulo: 'Título', nivel_academico: 'Dissertações', autores: ['Ana'], orientador: 'Bia',
  co_orientadores: [], palavras_chave: ['ecologia'], macrotema: 'Ambiente', resumo: '',
  programa_origem: 'PPG', url: '', ano: 2024, ...p,
});

const nomes = (o: { ocultas: { nome: string }[] }) => o.ocultas.map((x) => x.nome).sort();
const motivo = (o: { ocultas: { nome: string; motivo: string }[] }, nome: string) =>
  o.ocultas.find((x) => x.nome === nome)?.motivo ?? '';

test('registro único esconde tudo que precisa de comparação, e mantém a órbita', () => {
  const r = relevanciaDossie({ tipo: 'Documento', docsAlvo: [doc()], anosNaSerie: 1, linhasQL: 0 });
  // A órbita usa a base inteira: um documento com autoria e tema ainda tem vizinhança.
  assert.deepEqual([...r.mostrar].sort(), ['orbita', 'similares']);
  assert.deepEqual(nomes(r), ['Evolução Histórica', 'Frequências e relações (QL)', 'Lexicometria']);
  assert.match(motivo(r, 'Evolução Histórica'), /único ano/);
  assert.match(motivo(r, 'Frequências e relações (QL)'), /não se aplica a este tipo/);
});

test('sem ano informado, a evolução some por motivo diferente do ano único', () => {
  const docs = [doc({ ano: null }), doc({ ano: null, titulo: 'Outro' })];
  const r = relevanciaDossie({ tipo: 'Orientador', docsAlvo: docs, anosNaSerie: 0, linhasQL: 4 });
  assert.equal(r.mostrar.has('evolucao'), false);
  assert.match(motivo(r, 'Evolução Histórica'), /nenhum registro com ano/);
  // Dois registros e QL com linhas: as demais análises continuam de pé.
  assert.deepEqual([...r.mostrar].sort(), ['lexicometria', 'orbita', 'perfil', 'similares']);
});

test('QL: cada motivo de ocultação é distinto e não se confunde com os outros', () => {
  const dois = [doc(), doc({ titulo: 'Outro', ano: 2023 })];
  // Tipo que tem QL, dois registros, mas nenhuma entidade cruzada na base.
  const semLinhas = relevanciaDossie({ tipo: 'Macrotema', docsAlvo: dois, anosNaSerie: 2, linhasQL: 0 });
  assert.match(motivo(semLinhas, 'Frequências e relações (QL)'), /não trazem as entidades cruzadas/);
  // Tipo que tem QL, com linhas, mas um registro só: a proporção é a raridade global.
  const umSo = relevanciaDossie({ tipo: 'Macrotema', docsAlvo: [doc()], anosNaSerie: 1, linhasQL: 7 });
  assert.match(motivo(umSo, 'Frequências e relações (QL)'), /um único registro/);
  // Tipo com QL, dois registros e linhas: aparece.
  const ok = relevanciaDossie({ tipo: 'Palavra-chave', docsAlvo: dois, anosNaSerie: 2, linhasQL: 7 });
  assert.equal(ok.mostrar.has('perfil'), true);
  assert.equal(nomes(ok).includes('Frequências e relações (QL)'), false);
});

test('Pessoa nunca mostra semelhantes; os demais papéis mostram', () => {
  const dois = [doc(), doc({ titulo: 'Outro', ano: 2023 })];
  const pessoa = relevanciaDossie({ tipo: 'Pessoa', docsAlvo: dois, anosNaSerie: 2, linhasQL: 0 });
  assert.equal(pessoa.mostrar.has('similares'), false);
  assert.match(motivo(pessoa, 'Itens Semelhantes'), /abra um papel/);
  const autor = relevanciaDossie({ tipo: 'Autor', docsAlvo: dois, anosNaSerie: 2, linhasQL: 0 });
  assert.equal(autor.mostrar.has('similares'), true);
});

test('item isolado perde a órbita; título vazio não vira nó', () => {
  const isolado = doc({ autores: [], orientador: '', co_orientadores: [], palavras_chave: [], macrotema: '' });
  assert.equal(temVizinhancaNoGrafo([isolado]), false);
  assert.equal(temVizinhancaNoGrafo([doc({ titulo: '' })]), false);
  assert.equal(temVizinhancaNoGrafo([isolado, doc()]), true);
  // Campos só com string vazia não contam como vizinho.
  assert.equal(temVizinhancaNoGrafo([doc({ ...isolado, autores: [''], palavras_chave: [''] })]), false);
  const r = relevanciaDossie({ tipo: 'Documento', docsAlvo: [isolado], anosNaSerie: 1, linhasQL: 0 });
  assert.equal(r.mostrar.has('orbita'), false);
  assert.match(motivo(r, 'Órbita de Relacionamentos'), /autoria, orientação nem tema/);
});

test('diagrama radial: detecta ligação em cada modo, e nenhuma quando não há par', () => {
  // Nenhum par: uma palavra-chave, sem coorientador, e uma pessoa num tema só.
  assert.equal(temLigacaoRadial([doc(), doc({ titulo: 'Outro' })]), false);
  // Orientação conjunta.
  assert.equal(temLigacaoRadial([doc({ co_orientadores: ['Caio'] })]), true);
  // Dois coorientadores, sem orientador, também formam par.
  assert.equal(temLigacaoRadial([doc({ orientador: '', co_orientadores: ['Caio', 'Duda'] })]), true);
  // Coocorrência de palavras-chave.
  assert.equal(temLigacaoRadial([doc({ palavras_chave: ['ecologia', 'rede'] })]), true);
  // Mesma pessoa em dois macrotemas distintos.
  assert.equal(temLigacaoRadial([doc(), doc({ titulo: 'Outro', macrotema: 'Energia' })]), true);
  // A mesma pessoa em dois registros do MESMO macrotema não liga nada.
  assert.equal(temLigacaoRadial([doc(), doc({ titulo: 'Outro', macrotema: 'Ambiente' })]), false);
  // Autolaço (mesma pessoa nos dois papéis) é descartado, como na rede real.
  assert.equal(temLigacaoRadial([doc({ orientador: 'Bia', co_orientadores: ['Bia'] })]), false);
  assert.equal(temLigacaoRadial([]), false);
});
