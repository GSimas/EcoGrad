import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colunaNumerica, consultaInicial, consultarLinhas, extremosDaColuna, filtroAtivo, modoDoFiltro, passaNosFiltros, passoDaFaixa, perfilDaColuna, valorExibido, valoresDaColuna } from '../src/lib/visualizacao';

const linhas = [
  { nome: 'Ana Paula', registros: 10, nota: 4.5 },
  { nome: 'Bruno', registros: 3, nota: 3.0 },
  { nome: 'Carla', registros: 7, nota: 5.0 },
  { nome: 'Daniel', registros: 0, nota: null },
];
const chaves = ['nome', 'registros', 'nota'];
const consultar = (filtros: Record<string, unknown>) =>
  consultarLinhas(linhas, chaves, { ...consultaInicial, filtros: filtros as never }).map((l) => l.nome);

test('coluna numerica exige que todo valor preenchido seja numero', () => {
  assert.equal(colunaNumerica(linhas, 'registros'), true);
  // Nulos nao descaracterizam a coluna; textos sim.
  assert.equal(colunaNumerica(linhas, 'nota'), true);
  assert.equal(colunaNumerica(linhas, 'nome'), false);
  assert.equal(colunaNumerica([{ x: null }], 'x'), false, 'coluna sem nenhum valor nao e numerica');
  assert.deepEqual(extremosDaColuna(linhas, 'registros'), { min: 0, max: 10, inteira: true });
  assert.deepEqual(extremosDaColuna(linhas, 'nota'), { min: 3, max: 5, inteira: false });
});

test('filtro vazio nao restringe e nao conta como ativo', () => {
  assert.equal(filtroAtivo(undefined), false);
  assert.equal(filtroAtivo({ texto: '   ' }), false);
  assert.equal(filtroAtivo({ modo: 'faixa', min: null, max: null }), false);
  assert.equal(filtroAtivo({ modo: 'igual', igual: null }), false);
  assert.equal(filtroAtivo({ modo: 'igual', igual: 0 }), true, 'zero e um filtro valido');
  assert.deepEqual(consultar({ registros: { modo: 'faixa', min: null, max: null } }), ['Ana Paula', 'Bruno', 'Carla', 'Daniel']);
});

test('faixa aceita pontas em aberto e inclui os extremos', () => {
  assert.deepEqual(consultar({ registros: { modo: 'faixa', min: 3, max: 7 } }), ['Bruno', 'Carla']);
  assert.deepEqual(consultar({ registros: { modo: 'faixa', min: 7, max: null } }), ['Ana Paula', 'Carla']);
  assert.deepEqual(consultar({ registros: { modo: 'faixa', min: null, max: 3 } }), ['Bruno', 'Daniel']);
});

test('igual exige o valor exato, e zero nao e confundido com ausencia', () => {
  assert.deepEqual(consultar({ registros: { modo: 'igual', igual: 7 } }), ['Carla']);
  assert.deepEqual(consultar({ registros: { modo: 'igual', igual: 0 } }), ['Daniel']);
  assert.deepEqual(consultar({ registros: { modo: 'igual', igual: 99 } }), []);
});

test('linha sem valor numerico nao satisfaz filtro numerico', () => {
  assert.deepEqual(consultar({ nota: { modo: 'faixa', min: 0, max: 10 } }), ['Ana Paula', 'Bruno', 'Carla']);
  assert.equal(passaNosFiltros({ nota: null }, { nota: { modo: 'igual', igual: 5 } }), false);
});

test('texto casa sem acento nem caixa e filtros se acumulam com a busca', () => {
  assert.deepEqual(consultar({ nome: { texto: 'ana' } }), ['Ana Paula']);
  assert.deepEqual(consultar({ nome: { texto: 'ANA PAULA' } }), ['Ana Paula']);
  // Dois filtros ao mesmo tempo: os dois precisam passar.
  assert.deepEqual(consultar({ nome: { texto: 'a' }, registros: { modo: 'faixa', min: 7, max: null } }), ['Ana Paula', 'Carla']);
  const comBusca = consultarLinhas(linhas, chaves, { ...consultaInicial, busca: 'Carla', filtros: { registros: { modo: 'faixa', min: 8, max: null } } });
  assert.deepEqual(comBusca, [], 'busca e filtro se somam, nao se substituem');
});

test('o passo da barra respeita a natureza da coluna', () => {
  // Contagens andam de um em um: a barra nunca para em 203,84.
  assert.equal(passoDaFaixa(34, 806, true), 1);
  assert.equal(passoDaFaixa(0, 1, false), 0.01);
  assert.equal(passoDaFaixa(0, 1000, false), 10);
  assert.equal(passoDaFaixa(5, 5, false), 1, 'coluna de valor unico nao trava a barra');
});

test('o modo ausente e deduzido do que esta preenchido, para filtros salvos antes', () => {
  assert.equal(modoDoFiltro({ texto: 'ana' }), 'texto');
  assert.equal(modoDoFiltro({ min: 3 }), 'faixa');
  assert.equal(modoDoFiltro({ valores: ['Bruno'] }), 'selecao');
  assert.equal(modoDoFiltro({ modo: 'igual', texto: 'resto de outro modo' }), 'igual');
});

test('o rotulo exibido e a chave da selecao, inclusive com numero formatado', () => {
  assert.equal(valorExibido(1200), '1.200');
  assert.equal(valorExibido(4.5), '4,5');
  assert.equal(valorExibido(true), 'Sim');
  assert.equal(valorExibido(null), 'Não informado');
  assert.equal(valorExibido('   '), 'Não informado', 'vazio e ausencia se leem igual');
  assert.equal(valorExibido('Ana'), 'Ana');
});

test('os valores da coluna vem distintos, contados e em ordem util', () => {
  const repetidas = [{ n: 'Ana' }, { n: 'Bruno' }, { n: 'Ana' }, { n: null }];
  assert.deepEqual(valoresDaColuna(repetidas, 'n'), [
    { valor: 'Ana', contagem: 2 }, { valor: 'Bruno', contagem: 1 }, { valor: 'Não informado', contagem: 1 },
  ]);
  // Numeros ordenam por grandeza, nao pelo texto: 9 antes de 1.200.
  assert.deepEqual(valoresDaColuna([{ x: 1200 }, { x: 9 }], 'x').map((v) => v.valor), ['9', '1.200']);
  assert.deepEqual(valoresDaColuna(linhas, 'registros').map((v) => v.valor), ['0', '3', '7', '10']);
});

test('selecao aceita so os valores marcados e sem marcacao nao restringe', () => {
  assert.deepEqual(consultar({ nome: { modo: 'selecao', valores: ['Bruno', 'Carla'] } }), ['Bruno', 'Carla']);
  assert.deepEqual(consultar({ nome: { modo: 'selecao', valores: [] } }), ['Ana Paula', 'Bruno', 'Carla', 'Daniel']);
  assert.equal(filtroAtivo({ modo: 'selecao', valores: [] }), false);
  // Em coluna numerica o marcado e o rotulo lido na tabela.
  assert.deepEqual(consultar({ registros: { modo: 'selecao', valores: ['0', '10'] } }), ['Ana Paula', 'Daniel']);
  assert.deepEqual(consultar({ nota: { modo: 'selecao', valores: ['Não informado'] } }), ['Daniel']);
  // Soma com outro filtro de coluna, como qualquer outro modo.
  assert.deepEqual(consultar({ nome: { modo: 'selecao', valores: ['Bruno', 'Carla'] }, registros: { modo: 'faixa', min: 5, max: null } }), ['Carla']);
});

test('o perfil da coluna reune o que o menu precisa numa passada', () => {
  const perfil = perfilDaColuna(linhas, 'registros');
  assert.equal(perfil.numerica, true);
  assert.equal(perfil.inteira, true);
  assert.deepEqual([perfil.min, perfil.max], [0, 10]);
  assert.equal(perfil.valores.length, 4);
  assert.equal(perfilDaColuna(linhas, 'nome').numerica, false);
});

test('coluna com formatacao propria dita o rotulo listado e o casado na selecao', () => {
  const anos = [{ ano: 2006 }, { ano: 2026 }, { ano: 2006 }];
  // Sem rotulo proprio, o ano sai com separador de milhar, como qualquer numero.
  assert.deepEqual(valoresDaColuna(anos, 'ano').map((v) => v.valor), ['2.006', '2.026']);
  const rotulos = { ano: (l: Record<string, unknown>) => String(l.ano) };
  assert.deepEqual(valoresDaColuna(anos, 'ano', rotulos), [{ valor: '2006', contagem: 2 }, { valor: '2026', contagem: 1 }]);
  // E o filtro casa pelo mesmo texto que a tabela mostra.
  const filtros = { ano: { modo: 'selecao' as const, valores: ['2026'] } };
  assert.equal(passaNosFiltros(anos[1], filtros, rotulos), true);
  assert.equal(passaNosFiltros(anos[0], filtros, rotulos), false);
  assert.deepEqual(consultarLinhas(anos, ['ano'], { ...consultaInicial, filtros }, rotulos), [{ ano: 2026 }]);
  assert.deepEqual(consultarLinhas(anos, ['ano'], { ...consultaInicial, filtros }), [], 'sem o rotulo proprio, "2026" nao casa com "2.026"');
});
