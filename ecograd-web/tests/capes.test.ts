import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import capesProxy from '../netlify/functions/capes-proxy';
import { carregarCatalogoCapes, encontrarFichaCapes, filtrarProgramasCapes, programaEmFuncionamento } from '../src/lib/capes';
import type { CatalogoCapes, ProgramaCapes } from '../src/types';

afterEach(() => mock.restoreAll());

const programa = { nome: 'ENGENHARIA MECÂNICA', codigo: '41001010006P8', conceito: '6', situacao: 'EM FUNCIONAMENTO' };

function simularCapes(paginas: Array<{ status?: number; dados?: unknown; erro?: string }>) {
  const urls: URL[] = [];
  mock.method(https, 'get', (url: URL, _options: unknown, callback: (res: EventEmitter) => void) => {
    urls.push(url);
    const pagina = paginas[urls.length - 1];
    const req = new EventEmitter();
    queueMicrotask(() => {
      if (!pagina || pagina.erro) {
        req.emit('error', new Error(pagina?.erro ?? 'Página inesperada'));
        return;
      }
      const res = Object.assign(new EventEmitter(), {
        statusCode: pagina.status ?? 200,
        setEncoding() {},
        resume() {},
      });
      callback(res);
      res.emit('data', JSON.stringify(pagina.dados));
      res.emit('end');
    });
    return req;
  });
  return urls;
}

const consultar = (query = '') => capesProxy(new Request(`https://localhost/api/capes-proxy${query}`));

test('indexa por código e mantém as notas e a proveniência oficiais', async () => {
  const urls = simularCapes([{ dados: { content: [programa] } }]);
  const r = await consultar();
  assert.equal(r.status, 200);
  const dados = await r.json();
  assert.equal(dados.programas[programa.codigo].Nota, '6');
  assert.equal(dados.versao, 2);
  assert.equal(dados.fonte.totalProgramas, 1);
  assert.equal(dados.fonte.idIes, '4362');
  assert.ok(Number.isFinite(Date.parse(dados.fonte.consultadoEm)));
  assert.equal(new URL(dados.fonte.url).searchParams.get('query'), 'id-ies:(4362)');
  assert.equal(urls[0].searchParams.get('query'), 'id-ies:(4362)');
  assert.match(r.headers.get('cache-control')!, /max-age=86400/);
});

test('falha TLS produz 502 sem cache, em vez de catálogo vazio com 200', async () => {
  simularCapes([{ erro: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }]);
  const r = await consultar();
  assert.equal(r.status, 502);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match((await r.json()).error, /Tente novamente/);
});

test('não retorna catálogo parcial quando uma página posterior falha', async () => {
  const urls = simularCapes([
    { dados: Array.from({ length: 100 }, (_, i) => ({ ...programa, nome: `Programa ${i}`, codigo: `codigo-${i}` })) },
    { status: 503 },
  ]);
  const r = await consultar();
  assert.equal(r.status, 502);
  assert.equal(urls[1].searchParams.get('page'), '1');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('catálogo vazio não é armazenado como sucesso', async () => {
  simularCapes([{ dados: { content: [] } }]);
  const r = await consultar();
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('resposta com formato inesperado produz erro recuperável', async () => {
  simularCapes([{ dados: { mensagem: 'indisponível' } }]);
  assert.equal((await consultar()).status, 502);
});

test('instituição inválida é rejeitada antes da consulta externa', async () => {
  const urls = simularCapes([]);
  assert.equal((await consultar('?idIes=invalid')).status, 400);
  assert.equal(urls.length, 0);
});

test('consulta no navegador ignora o catálogo vazio armazenado no cache HTTP antigo', async () => {
  const catalogo = catalogoTeste([ficha()]);
  const signal = new AbortController().signal;
  mock.method(globalThis, 'fetch', async (_url: string, options?: RequestInit) => {
    assert.equal(options?.signal, signal);
    // Reproduz o cache antigo: sem no-store, até uma nova tentativa recebe {}.
    return Response.json(options?.cache === 'no-store' ? catalogo : {});
  });
  assert.deepEqual(await carregarCatalogoCapes(signal), catalogo);
});

test('catálogo vazio recebido do serviço continua sendo tratado como erro', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(carregarCatalogoCapes(), /não retornou programas/);
});

function ficha(campos: Partial<ProgramaCapes> = {}): ProgramaCapes {
  return {
    Nome: 'DIREITO', Código: '41001010011P1', Nota: '6', 'Grande Área': 'CIÊNCIAS SOCIAIS APLICADAS',
    'Área de Avaliação': 'DIREITO', 'Área de Conhecimento': 'DIREITO', Modalidade: 'ACADÊMICO',
    Situação: 'EM FUNCIONAMENTO', 'Modalidade de Ensino': 'Educação Presencial', 'Grau Acadêmico': 'Mestrado/Doutorado',
    ...campos,
  };
}
function catalogoTeste(programas: ProgramaCapes[]): CatalogoCapes {
  return { versao: 2, programas: Object.fromEntries(programas.map((p) => [p.Código, p])),
    fonte: { idIes: '4362', consultadoEm: '2026-09-11T20:00:00Z', totalProgramas: programas.length,
      url: 'https://apigw-proxy.capes.gov.br/observatorio/data/observatorio/ppg?query=id-ies%3A%284362%29' } };
}

test('preserva homônimos acadêmicos e profissionais como programas distintos', async () => {
  simularCapes([{ dados: [
    { ...programa, nome: 'DIREITO', codigo: '41001010011P1', modalidade: 'ACADÊMICO' },
    { ...programa, nome: 'DIREITO', codigo: '41001010158P2', modalidade: 'PROFISSIONAL' },
  ] }]);
  const r = await consultar();
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.equal(c.fonte.totalProgramas, 2);
  assert.equal(c.programas['41001010011P1'].Modalidade, 'ACADÊMICO');
  assert.equal(c.programas['41001010158P2'].Modalidade, 'PROFISSIONAL');
});

test('registro sem código invalida a consulta, sem publicar um catálogo parcial', async () => {
  simularCapes([{ dados: [programa, { nome: 'SEM CÓDIGO' }] }]);
  const r = await consultar();
  assert.equal(r.status, 502);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('códigos repetidos idênticos não duplicam contagens', async () => {
  simularCapes([{ dados: [programa, programa] }]);
  assert.equal((await (await consultar()).json()).fonte.totalProgramas, 1);
});

test('códigos repetidos conflitantes não são sobrescritos silenciosamente', async () => {
  simularCapes([{ dados: [programa, { ...programa, conceito: '7' }] }]);
  assert.equal((await consultar()).status, 502);
});

test('percorre todas as páginas antes de publicar o catálogo', async () => {
  simularCapes([
    { dados: Array.from({ length: 100 }, (_, i) => ({ ...programa, codigo: `codigo-${i}` })) },
    { dados: [programa] },
  ]);
  const c = await (await consultar()).json();
  assert.equal(c.fonte.totalProgramas, 101);
});

test('nome exato único ignora prefixos, acentos, caixa e espaços repetidos', () => {
  const p = ficha({ Nome: 'ECOLOGIA' });
  assert.deepEqual(encontrarFichaCapes('programa de pós-graduação em   Ecologia', catalogoTeste([p])),
    { status: 'exata', programa: p, criterio: 'nome' });
});

test('homônimos são ambíguos independentemente da ordem; código resolve a identidade', () => {
  const a = ficha();
  const b = ficha({ Código: '41001010158P2', Modalidade: 'PROFISSIONAL' });
  for (const registros of [[a, b], [b, a]]) {
    const c = catalogoTeste(registros);
    const r = encontrarFichaCapes('Programa de Pós-Graduação em Direito', c);
    assert.equal(r.status, 'ambigua');
    if (r.status === 'ambigua') assert.equal(r.candidatos.length, 2);
    assert.deepEqual(encontrarFichaCapes(b.Código, c), { status: 'exata', programa: b, criterio: 'codigo' });
  }
});

test('similaridade apenas sugere e nunca atribui uma ficha oficial', () => {
  const r = encontrarFichaCapes('Direitos', catalogoTeste([ficha()]));
  assert.equal(r.status, 'nao-encontrada');
  if (r.status === 'nao-encontrada') assert.equal(r.sugestoes.length, 1);
  assert.equal(encontrarFichaCapes('Tema sem relação', catalogoTeste([ficha()])).status, 'nao-encontrada');
});

test('catálogo inclui inativos, mas panorama exige situação ativa explícita', () => {
  assert.equal(programaEmFuncionamento(ficha()), true);
  for (const Situação of ['INATIVO', '', 'Não informado', 'EM DESATIVACAO']) {
    assert.equal(programaEmFuncionamento(ficha({ Situação })), false);
  }
});

test('filtros distinguem todos e nenhum em cada dimensão e combinam critérios', () => {
  const a = ficha();
  const b = ficha({ Código: 'prof', Modalidade: 'PROFISSIONAL', Nota: 'A', 'Grau Acadêmico': 'Mestrado Profissional' });
  const todos = { niveis: null, modalidades: null, notas: null };
  assert.equal(filtrarProgramasCapes([a, b], todos).length, 2);
  for (const campo of ['niveis', 'modalidades', 'notas']) {
    assert.equal(filtrarProgramasCapes([a, b], { ...todos, [campo]: [] }).length, 0);
  }
  assert.deepEqual(filtrarProgramasCapes([a, b], { ...todos, niveis: ['Doutorado'] }), [a]);
  assert.deepEqual(filtrarProgramasCapes([a, b], { niveis: ['Mestrado'], modalidades: ['PROFISSIONAL'], notas: ['A'] }), [b]);
  assert.equal(filtrarProgramasCapes([a], { ...todos, niveis: ['Mestrado', 'Doutorado'] }).length, 1);
});

test('grau ausente permanece incluído em todos e pode ser filtrado explicitamente', () => {
  const p = ficha({ 'Grau Acadêmico': 'Não informado' });
  assert.equal(filtrarProgramasCapes([p], { niveis: null, modalidades: null, notas: null }).length, 1);
  assert.equal(filtrarProgramasCapes([p], { niveis: ['Não informado'], modalidades: null, notas: null }).length, 1);
});

test('cliente rejeita contrato antigo, registros incompletos e total inconsistente', async () => {
  for (const dados of [
    { DIREITO: ficha() },
    { ...catalogoTeste([ficha()]), programas: { errado: ficha() } },
    { ...catalogoTeste([ficha()]), programas: { '41001010011P1': { Código: '41001010011P1' } } },
    { ...catalogoTeste([ficha()]), fonte: { ...catalogoTeste([ficha()]).fonte, totalProgramas: 2 } },
  ]) {
    mock.method(globalThis, 'fetch', async () => Response.json(dados));
    await assert.rejects(carregarCatalogoCapes(), /incompleto ou desatualizado/);
  }
});
