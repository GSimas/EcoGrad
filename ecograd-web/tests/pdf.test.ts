import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleDoRegistro, LIMIAR_EXIBICAO, pdfsDoTrabalho, podeEmbutirPdf, tamanhoLegivel, urlDoPdf } from '../src/lib/pdf';
import { normalizarDocumentos } from '../src/lib/data-loader';
import type { Documento } from '../src/types';

const doc = (p: Partial<Documento> = {}): Documento => ({
  titulo: 'Título', nivel_academico: 'TCC', autores: ['Ana'], orientador: 'Bia',
  co_orientadores: [], palavras_chave: [], macrotema: '', resumo: '',
  programa_origem: 'TCC Engenharia', url: 'https://repositorio.ufsc.br/handle/123456789/272516',
  ano: 2024, ...p,
});

test('o handle sai da url do registro, inclusive na forma antiga com /xmlui/', () => {
  assert.equal(handleDoRegistro('https://repositorio.ufsc.br/handle/123456789/272516'), '123456789/272516');
  assert.equal(handleDoRegistro('https://repositorio.ufsc.br/xmlui/handle/123456789/130473'), '123456789/130473');
  assert.equal(handleDoRegistro('https://repositorio.ufsc.br/handle/123456789/272516?show=full'), '123456789/272516');
});

test('registro de outro domínio não decide o que a página embute', () => {
  // O endereço montado aqui vai para o `src` de um iframe: aceitar qualquer host
  // deixaria um registro da base escolher o que carregar.
  assert.equal(handleDoRegistro('https://exemplo.invalido/handle/123456789/1'), null);
  assert.equal(handleDoRegistro('javascript:alert(1)'), null);
  assert.equal(handleDoRegistro('https://repositorio.ufsc.br/handle/nao-e-handle'), null);
  assert.equal(handleDoRegistro(''), null);
  assert.equal(urlDoPdf(doc({ url: 'https://exemplo.invalido/handle/1/2' }), { n: 'a.pdf', s: 1 }), null);
});

test('o endereço do PDF é a forma que o DSpace serve inline, com o nome codificado', () => {
  assert.equal(
    urlDoPdf(doc(), { n: 'TCC Lucas Sodré.pdf', s: 1 }),
    'https://repositorio.ufsc.br/bitstream/handle/123456789/272516/TCC%20Lucas%20Sodr%C3%A9.pdf?sequence=1',
  );
});

test('um registro pode ter vários PDFs, e a ordem do repositório é preservada', () => {
  // Trabalho + prancha + memorial acontece de verdade no acervo: quem lê escolhe.
  const pdfs = pdfsDoTrabalho(doc({
    arquivos: [{ n: 'artigo.pdf', s: 1, b: 1200000 }, { n: 'Prancha.pdf', s: 2 }],
  }));
  assert.deepEqual(pdfs.map((p) => p.rotulo), ['artigo.pdf · 1,1 MB', 'Prancha.pdf']);
  assert.match(pdfs[1].url, /Prancha\.pdf\?sequence=2$/);
});

test('sem arquivos, ou com arquivo que não monta endereço, não sobra nada para abrir', () => {
  assert.deepEqual(pdfsDoTrabalho(doc()), []);
  assert.deepEqual(pdfsDoTrabalho(doc({ arquivos: [] })), []);
  assert.deepEqual(pdfsDoTrabalho(doc({ url: '', arquivos: [{ n: 'a.pdf', s: 1 }] })), []);
});

test('acima de 8 MiB o repositório manda baixar, e a interface precisa saber antes do clique', () => {
  // Limiar medido contra o repositório: 7,76 MB abre embutido, 9,33 MB baixa.
  const [pequeno] = pdfsDoTrabalho(doc({ arquivos: [{ n: 'a.pdf', s: 1, b: LIMIAR_EXIBICAO - 1 }] }));
  const [grande] = pdfsDoTrabalho(doc({ arquivos: [{ n: 'b.pdf', s: 1, b: LIMIAR_EXIBICAO }] }));
  const [semTamanho] = pdfsDoTrabalho(doc({ arquivos: [{ n: 'c.pdf', s: 1 }] }));
  assert.equal(pequeno.exibivel, true);
  assert.equal(grande.exibivel, false);
  // Sem tamanho, o palpite otimista custa um quadro branco; o pessimista
  // esconderia um PDF que abriria.
  assert.equal(semTamanho.exibivel, true);
});

test('sequência negativa sai da URL em vez de virar ?sequence=-1', () => {
  // O REST devolve `sequenceId: -1` para bitstream sem sequência; o nome resolve sozinho.
  assert.equal(
    urlDoPdf(doc(), { n: 'PEGC0856-D.pdf', s: -1 }),
    'https://repositorio.ufsc.br/bitstream/handle/123456789/272516/PEGC0856-D.pdf',
  );
});

test('o tamanho só aparece quando o repositório o informou', () => {
  assert.equal(tamanhoLegivel(1298530), '1,2 MB');
  assert.equal(tamanhoLegivel(73372), '72 KB');
  assert.equal(tamanhoLegivel(undefined), '');
  assert.equal(tamanhoLegivel(0), '');
});

test('celular não embute o PDF; ponteiro fino embute', () => {
  // Checagem por capacidade, não por User-Agent: notebook com tela sensível ao
  // toque continua tendo `hover` e embute normalmente.
  assert.equal(podeEmbutirPdf((q) => q === '(hover: none) and (pointer: coarse)'), false);
  assert.equal(podeEmbutirPdf(() => false), true);
});

test('o carregamento descarta arquivo malformado e mantém o campo ausente quando nada sobra', () => {
  const [bom] = normalizarDocumentos([{ titulo: 'a', arquivos: [{ n: ' t.pdf ', s: 2, b: 10 }, { n: '', s: 1 }, { n: 'x.pdf', s: 'um' }, 'lixo'] }]);
  assert.deepEqual(bom.arquivos, [{ n: 't.pdf', s: 2, b: 10 }]);
  const [semNada] = normalizarDocumentos([{ titulo: 'b', arquivos: [{ n: '', s: 0 }] }]);
  assert.equal(semNada.arquivos, undefined);
  const [semCampo] = normalizarDocumentos([{ titulo: 'c' }]);
  assert.equal(semCampo.arquivos, undefined);
});
