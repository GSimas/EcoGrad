import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blocosPorIdioma, detectarIdioma } from '../src/lib/idioma';

const PT = 'Este trabalho tem como objetivo analisar a formação dos professores da rede pública, a partir de uma pesquisa de campo realizada em escolas do município.';
const EN = 'This dissertation consists of research into the training of the Military Police and the demands for new skills that are required of them in the field.';
const ES = 'El presente trabajo tiene como objetivo analizar la formación de los docentes de la red pública, a partir de una investigación de campo en las escuelas.';

test('reconhece os três idiomas do acervo', () => {
  assert.equal(detectarIdioma(PT), 'pt');
  assert.equal(detectarIdioma(EN), 'en');
  assert.equal(detectarIdioma(ES), 'es');
});

test('desiste em vez de chutar', () => {
  // Um `lang` errado é pior que nenhum: o leitor troca de voz com confiança para
  // a pronúncia errada. Sem evidência, nada é marcado.
  assert.equal(detectarIdioma(''), null);
  assert.equal(detectarIdioma('Resumo não disponível.'), null);
  assert.equal(detectarIdioma('Blockchain machine learning framework 2024 IoT'), null);
});

test('resumo em português seguido do abstract vira dois blocos', () => {
  // É o caso comum nas teses da UFSC, e marcar o conjunto com um só `lang`
  // erraria metade do texto.
  const blocos = blocosPorIdioma(`${PT}\n\n${EN}`);
  assert.deepEqual(blocos.map((b) => b.idioma), ['pt', 'en']);
  assert.ok(blocos[0].texto.startsWith('Este trabalho'));
  assert.ok(blocos[1].texto.startsWith('This dissertation'));
});

test('texto de um idioma só continua sendo um bloco', () => {
  // O DOM não deve se encher de <span> quando não há nada a separar.
  assert.deepEqual(blocosPorIdioma(PT), [{ texto: PT, idioma: 'pt' }]);
  const doisParagrafos = blocosPorIdioma(`${PT}\n\n${PT}`);
  assert.equal(doisParagrafos.length, 1);
  assert.equal(doisParagrafos[0].idioma, 'pt');
});

test('bloco curto demais herda o idioma do vizinho', () => {
  // "Palavras-chave: ..." no meio do resumo não está em idioma nenhum — está no
  // idioma do resumo.
  const blocos = blocosPorIdioma(`${PT}\n\nPalavras-chave: educação.`);
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0].idioma, 'pt');
});

test('texto vazio não vira bloco', () => {
  assert.deepEqual(blocosPorIdioma('   '), []);
});
