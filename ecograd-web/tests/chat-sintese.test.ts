import assert from 'node:assert/strict';
import { test } from 'node:test';
import { montarRecorte } from '../src/lib/chat-ferramentas';
import {
  fontesDaSintese, indiceDoItem, planejarAprofundamento, promptLote, promptReducao, promptSintese, verificarCitacoes,
} from '../src/lib/chat-sintese';
import type { Documento } from '../src/types';

const LONGO = 'resumo utilizavel '.repeat(20);
const doc = (d: Partial<Documento>): Documento => ({
  titulo: 'T', autores: [], orientador: '', co_orientadores: [], palavras_chave: [],
  macrotema: '', programa_origem: 'Coleção', ano: 2020, nivel_academico: 'Dissertação',
  resumo: LONGO, url: 'https://exemplo/1', ...d,
} as Documento);

test('fontes da sintese: so resumo utilizavel, sem repetir obra e apontando o registro exato', () => {
  const docs = [
    doc({ titulo: 'Sem resumo', url: 'u0', resumo: 'curto' }),
    doc({ titulo: 'Mesma obra', url: 'u1', programa_origem: 'Educação' }),
    doc({ titulo: 'MESMA OBRA', url: 'u2', programa_origem: 'Educação (ID: 75514)' }),
    doc({ titulo: 'Outra', url: 'u3', resumo: 'x'.repeat(5000) }),
  ];
  const recorte = montarRecorte(docs);
  const fontes = fontesDaSintese(docs, recorte);
  assert.deepEqual(fontes.map((f) => [f.numero, f.titulo, f.indice]), [[1, 'Mesma obra', 1], [2, 'Outra', 3]]);
  assert.equal(fontes[1].resumo.length, 3000, 'resumo longo e cortado');
  assert.equal(indiceDoItem(docs, recorte.itens[2]), 2, 'titulo, URL e colecao identificam o registro');
  assert.equal(fontesDaSintese(docs, recorte, 1).length, 1);
});

test('prompt leva so os numeros apurados, as ressalvas e as fontes numeradas', () => {
  const docs = [doc({ titulo: 'Empreendedorismo e gênero', autores: ['Silva, Ana'], orientador: 'Souza, Bia', macrotema: 'Gênero e Trabalho' })];
  const recorte = montarRecorte(docs);
  const { sistema, mensagem } = promptSintese('Como tratam empreendedorismo feminino?', recorte, fontesDaSintese(docs, recorte), ['Macrotema é classificação automática da base.']);
  assert.match(sistema, /\[3\] ou \[2\]\[5\]/);
  assert.match(sistema, /leu 1 de 1 registros/);
  assert.match(mensagem, /PERGUNTA: Como tratam empreendedorismo feminino\?/);
  assert.match(mensagem, /Registros: 1 · Trabalhos distintos: 1 · Sem resumo utilizável: 0/);
  assert.match(mensagem, /\[1\] Empreendedorismo e gênero \(2020\) · Coleção · Dissertação/);
  assert.match(mensagem, /Autoria: Silva, Ana · Orientação: Souza, Bia/);
  assert.match(mensagem, /- Macrotema é classificação automática da base\./);
});

test('aprofundar: lotes cobrem todas as fontes com numeracao global, e a sintese final descarta lote sem relevancia', () => {
  const docs = Array.from({ length: 45 }, (_, i) => doc({ titulo: `Obra ${i + 1}`, url: `u${i}`, ano: 2000 + (i % 20) }));
  const recorte = montarRecorte(docs, Infinity);
  const fontes = fontesDaSintese(docs, recorte, Infinity);
  assert.equal(fontes.length, 45);

  const plano = planejarAprofundamento(fontes);
  assert.deepEqual(plano.lotes.map((l) => l.length), [20, 20, 5]);
  assert.equal(plano.chamadas, 4, 'um por lote e a sintese final');
  assert.ok(plano.tokensEntrada > plano.tokensSaida);
  assert.ok(plano.segundos[0] < plano.segundos[1]);

  const { mensagem: lote2 } = promptLote('Pergunta?', plano.lotes[1]);
  assert.match(lote2, /^\[21\] Obra 21 \(2000\)/m, 'o segundo lote comeca na fonte 21');
  assert.doesNotMatch(lote2, /^\[1\] /m);

  const { sistema, mensagem } = promptReducao('Pergunta?', recorte, fontes, ['- Achado A [3]', 'NADA RELEVANTE', '- Achado B [44]'], []);
  assert.match(sistema, /todos os 45 resumos utilizáveis/);
  assert.match(mensagem, /Achado A \[3\][\s\S]*Achado B \[44\]/);
  assert.doesNotMatch(mensagem, /NADA RELEVANTE/);
  assert.match(mensagem, /^\[45\] Obra 45 \(2004\)$/m);
});

test('verificacao aponta citacao inexistente e sintese sem fonte, e aceita recusa declarada', () => {
  assert.deepEqual(verificarCitacoes('A [1] e B [2][7]. De novo [1].', 3), { citadas: [1, 2], inexistentes: [7], semCitacao: false, recusou: false });
  assert.equal(verificarCitacoes('Texto sem fonte.', 3).semCitacao, true);
  assert.equal(verificarCitacoes('Só cita [9].', 3).semCitacao, true, 'citacao inexistente nao conta como fonte');
  assert.deepEqual(verificarCitacoes('Aprofundada cita [312].', 400).citadas, [312]);
  const recusa = verificarCitacoes('Não encontrei base suficiente nos resumos lidos para afirmar isso.', 3);
  assert.equal(recusa.recusou, true);
  assert.equal(recusa.semCitacao, false);
});
