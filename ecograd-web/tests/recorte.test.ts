import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mesmoRecorte, recortarDocs, resumoRecorte, somarAoRecorte, validarRecorte } from '../src/lib/recorte';
import type { Documento } from '../src/types';

const doc = (d: Partial<Documento>): Documento => ({
  titulo: '', nivel_academico: 'Dissertações', autores: [], orientador: '', co_orientadores: [],
  palavras_chave: [], macrotema: '', resumo: '', programa_origem: 'PPGEGC', url: '', ano: 2020, ...d,
});

const base = [
  doc({ titulo: 'Empreender no feminino', palavras_chave: ['Empreendedorismo feminino', 'Gênero'], autores: ['Silva, Ana'] }),
  doc({ titulo: 'Redes de inovação', palavras_chave: ['Inovação'], orientador: 'Silva, Ana' }),
  doc({ titulo: 'Gestão do conhecimento', palavras_chave: ['Gestão'], co_orientadores: ['Souza, Beto'], macrotema: 'Gestão' }),
  doc({ titulo: 'Outro curso', programa_origem: 'Administração', palavras_chave: ['Inovação'] }),
];

test('sem recorte a base passa inteira, e pela mesma identidade', () => {
  assert.equal(recortarDocs(base, []), base);
});

test('palavra-chave recorta a base nos documentos daquele tema, sem exigir acento nem caixa', () => {
  const docs = recortarDocs(base, [{ tipo: 'Palavra-chave', nome: 'empreendedorismo FEMININO' }]);
  assert.deepEqual(docs.map((d) => d.titulo), ['Empreender no feminino']);
});

test('“Pessoa” atravessa os papéis; um papel específico só vale no campo dele', () => {
  assert.deepEqual(recortarDocs(base, [{ tipo: 'Pessoa', nome: 'Silva, Ana' }]).map((d) => d.titulo),
    ['Empreender no feminino', 'Redes de inovação']);
  assert.deepEqual(recortarDocs(base, [{ tipo: 'Orientador', nome: 'Silva, Ana' }]).map((d) => d.titulo),
    ['Redes de inovação']);
  assert.deepEqual(recortarDocs(base, [{ tipo: 'Co-orientador', nome: 'Souza, Beto' }]).map((d) => d.titulo),
    ['Gestão do conhecimento']);
});

test('grafias unificadas trazem junto os documentos gravados sob o nome antigo', () => {
  const comGrafia = [...base, doc({ titulo: 'Tese antiga', autores: ['Silva, A.'] })];
  const docs = recortarDocs(comGrafia, [{ tipo: 'Autor', nome: 'Silva, Ana', grafias: ['Silva, Ana', 'Silva, A.'] }]);
  assert.deepEqual(docs.map((d) => d.titulo), ['Empreender no feminino', 'Tese antiga']);
});

test('itens somam entre si e a coleção escolhida de propósito entra inteira', () => {
  const docs = recortarDocs(base, [
    { tipo: 'Palavra-chave', nome: 'Empreendedorismo feminino' },
    { tipo: 'Coleção', nome: 'Administração' },
  ]);
  assert.deepEqual(docs.map((d) => d.titulo), ['Empreender no feminino', 'Outro curso']);
});

test('documento e macrotema recortam pelos próprios campos', () => {
  assert.deepEqual(recortarDocs(base, [{ tipo: 'Documento', nome: 'Redes de inovação' }]).map((d) => d.titulo), ['Redes de inovação']);
  assert.deepEqual(recortarDocs(base, [{ tipo: 'Macrotema', nome: 'Gestão' }]).map((d) => d.titulo), ['Gestão do conhecimento']);
});

test('a comparação de recortes ignora a ordem e a coleção não aparece no resumo', () => {
  const a = [{ tipo: 'Autor' as const, nome: 'Silva, Ana' }, { tipo: 'Coleção' as const, nome: 'PPGEGC' }];
  assert.equal(mesmoRecorte(a, [a[1], a[0]]), true);
  assert.equal(mesmoRecorte(a, [a[0]]), false);
  assert.equal(resumoRecorte(a), 'autor “Silva, Ana”');
  assert.equal(resumoRecorte([{ tipo: 'Coleção', nome: 'PPGEGC' }]), '');
  assert.equal(resumoRecorte([]), '');
});

test('recorte vindo do armazenamento só entra se estiver bem formado', () => {
  const limpo = validarRecorte([
    { tipo: 'Palavra-chave', nome: ' Inovação ' },
    { tipo: 'Inexistente', nome: 'x' },
    { tipo: 'Autor', nome: '   ' },
    { tipo: 'Autor', nome: 'Silva, Ana', grafias: ['Silva, A.', 7, ''] },
    'lixo',
  ]);
  assert.deepEqual(limpo, [
    { tipo: 'Palavra-chave', nome: ' Inovação ' },
    { tipo: 'Autor', nome: 'Silva, Ana', grafias: ['Silva, A.'] },
  ]);
  assert.deepEqual(validarRecorte(undefined), []);
});

test('somar ao recorte junta coleções e itens, sem recortar coleções que estavam inteiras', () => {
  const bainy = { tipo: 'Pessoa' as const, nome: 'Bainy, Afonso' };
  const ostras = { programas: ['PPG A'], cursosTcc: [], recorte: [{ tipo: 'Palavra-chave' as const, nome: 'Ostras' }] };
  const soma = somarAoRecorte(ostras, bainy, { programas: ['PPG A', 'PPG B'], cursosTcc: ['TCC C'] });
  assert.deepEqual(soma, { programas: ['PPG A', 'PPG B'], cursosTcc: ['TCC C'], recorte: [...ostras.recorte, bainy], mudou: true });

  const inteiras = { programas: ['PPG A'], cursosTcc: [], recorte: [] };
  assert.equal(somarAoRecorte(inteiras, bainy, { programas: ['PPG A'], cursosTcc: [] }).mudou, false);
  assert.deepEqual(somarAoRecorte(inteiras, bainy, { programas: ['PPG B'], cursosTcc: [] }).recorte, [{ tipo: 'Coleção', nome: 'PPG A' }, bainy]);

  // Já no recorte, com todas as coleções: nada a carregar. Um papel está dentro da pessoa.
  const comPessoa = { programas: ['PPG A'], cursosTcc: [], recorte: [bainy] };
  assert.equal(somarAoRecorte(comPessoa, { tipo: 'Orientador', nome: 'bainy, afonso' }, { programas: ['PPG A'], cursosTcc: [] }).mudou, false);
  assert.equal(somarAoRecorte(comPessoa, bainy, { programas: ['PPG A', 'PPG B'], cursosTcc: [] }).mudou, true);
});
