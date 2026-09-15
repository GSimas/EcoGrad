import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planejar, type Intencao } from '../src/lib/chat-roteador';

/**
 * As perguntas vêm do próprio conjunto de aferição, não de exemplos inventados:
 * o roteador precisa acertar a intenção das 25 que definem o critério da Etapa 0.
 */
function carregarPerguntas() {
  const candidatos = ['../docs/evidencias/afericao/perguntas.json', '../../docs/evidencias/afericao/perguntas.json']
    .map((r) => resolve(process.cwd(), r));
  const caminho = candidatos.find(existsSync);
  if (!caminho) throw new Error(`perguntas.json não encontrado a partir de ${process.cwd()}`);
  return JSON.parse(readFileSync(caminho, 'utf8')).perguntas as Array<{ id: string; pergunta: string; classe: string }>;
}

/** Intenção esperada para cada pergunta da aferição. */
const ESPERADO: Record<string, Intencao> = {
  Q01: 'colecao', Q02: 'serie', Q03: 'ranking_orientacao', Q04: 'panorama', Q05: 'pessoa',
  Q06: 'tema', Q07: 'existencia', Q08: 'origem_termo', Q09: 'macrotemas', Q10: 'tema',
  Q11: 'tema', Q12: 'tema', Q13: 'tema', Q14: 'tema', Q15: 'ontologia', Q16: 'ontologia',
  Q17: 'ontologia', Q18: 'acao_carregar', Q19: 'acao_abrir', Q20: 'qualidade',
  Q21: 'dado_pessoal', Q22: 'fora_do_acervo', Q23: 'ano', Q24: 'contagem_pessoas', Q25: 'titulo',
};

test('o roteador acerta a intencao das 25 perguntas da afericao', () => {
  const perguntas = carregarPerguntas();
  assert.equal(perguntas.length, 25);
  const erros: string[] = [];
  for (const { id, pergunta } of perguntas) {
    const obtido = planejar(pergunta, { baseCarregada: true }).intencao;
    if (obtido !== ESPERADO[id]) erros.push(`${id}: esperava ${ESPERADO[id]}, obteve ${obtido} — "${pergunta}"`);
  }
  assert.deepEqual(erros, []);
});

test('o alvo extraido e o assunto, sem a moldura da pergunta', () => {
  const alvo = (p: string) => planejar(p, { baseCarregada: true }).alvo;
  assert.equal(alvo('Como os trabalhos na UFSC estão tratando empreendedorismo feminino?'), 'empreendedorismo feminino');
  assert.equal(alvo('O que a UFSC produziu sobre psicologia positiva?'), 'psicologia positiva');
  assert.equal(alvo('Quais trabalhos falam de mulheres empreendedoras?'), 'mulheres empreendedoras');
  assert.equal(alvo('Quantos trabalhos a Patricia de Sá Freire tem no acervo, e em quais papéis?'), 'patricia de sa freire');
  assert.equal(alvo('Quantos trabalhos de 2026 existem no acervo?'), '2026');
  assert.equal(alvo('Educação infantil é palavra-chave ou macrotema?'), 'educacao infantil');
  // Título citado entre aspas vem inteiro, com a grafia original.
  assert.equal(alvo("O trabalho 'Doenças: construção e realidade na formção dos médicos' aparece quantas vezes?"),
    'Doenças: construção e realidade na formção dos médicos');
});

test('recusa nao consulta nada e explica o motivo', () => {
  const qualidade = planejar('Qual é o melhor trabalho sobre gestão do conhecimento?', { baseCarregada: true });
  assert.equal(qualidade.escopo, 'nenhum');
  assert.equal(qualidade.ferramenta, null);
  assert.match(qualidade.recusa ?? '', /não medem qualidade/);

  const pessoal = planejar('Qual o e-mail e o telefone da Patricia de Sá Freire?', { baseCarregada: true });
  assert.equal(pessoal.escopo, 'nenhum');
  assert.match(pessoal.recusa ?? '', /não vou procurar fora/);
});

test('pedido de escrita recusa a autoria e ainda entrega o recorte', () => {
  const p = planejar('Escreva minha revisão de literatura sobre psicologia positiva.', { baseCarregada: true });
  assert.equal(p.intencao, 'fora_do_acervo');
  assert.match(p.recusa ?? '', /Não escrevo o trabalho em seu nome/);
  assert.equal(p.ferramenta, 'buscar_no_texto', 'recusar a autoria não é recusar o dado');
  assert.deepEqual(p.argumentos, { consulta: 'psicologia positiva', frase: true });
});

test('sem base carregada, a intencao de recorte cai para o catalogo e declara o limite', () => {
  const comBase = planejar('Como os trabalhos na UFSC estão tratando empreendedorismo feminino?', { baseCarregada: true });
  assert.equal(comBase.escopo, 'recorte');
  assert.equal(comBase.ferramenta, 'buscar_no_texto');

  const semBase = planejar('Como os trabalhos na UFSC estão tratando empreendedorismo feminino?', { baseCarregada: false });
  assert.equal(semBase.escopo, 'catalogo');
  assert.equal(semBase.ferramenta, 'tema_no_catalogo');
  assert.deepEqual(semBase.argumentos, { consulta: 'empreendedorismo feminino' });
  assert.ok(semBase.declarar.some((d) => /só está no resumo exige carregar o recorte/.test(d)));
  assert.equal(semBase.exigeResumo, true, 'a resposta na tela inicial precisa oferecer o recorte');
});

test('o que o catalogo responde inteiro nao muda de escopo', () => {
  const p = planejar('Quem mais orienta na pós-graduação da UFSC?', { baseCarregada: false });
  assert.equal(p.escopo, 'catalogo');
  assert.equal(p.ferramenta, 'top_do_tipo');
  assert.deepEqual(p.argumentos, { tipo: 'Orientador', limite: 10 });
  assert.equal(p.exigeResumo, false, 'ranking por grafia nao depende de ler resumo');
});

test('cada intencao carrega as declaracoes que a resposta precisa fazer', () => {
  const declaracoes = (p: string) => planejar(p, { baseCarregada: true }).declarar.join(' ');
  assert.match(declaracoes('Quais são os macrotemas mais frequentes do acervo?'), /classificação automática/);
  assert.match(declaracoes('Quantos trabalhos de 2026 existem no acervo?'), /em coleta/);
  assert.match(declaracoes('Quantas pessoas diferentes orientam trabalhos no acervo?'), /por grafia/);
  assert.match(declaracoes('Qual o tamanho do acervo?'), /resumo utilizável/);
  assert.match(declaracoes('Quais ferramentas estão sendo utilizadas no contexto de psicologia positiva?'), /não traz teorias, ferramentas e métodos extraídos/);
  assert.match(declaracoes("O trabalho 'Doenças: construção e realidade na formção dos médicos' aparece quantas vezes?"), /mesma obra em mais de uma coleção/);
});

test('pergunta sem padrao conhecido busca os termos em vez de errar de intencao', () => {
  const p = planejar('gamificação em bibliotecas universitárias', { baseCarregada: true });
  assert.equal(p.intencao, 'tema');
  assert.equal(p.ferramenta, 'buscar_no_texto');
  assert.match(String(p.argumentos.consulta), /gamificacao em bibliotecas universitarias/);
});
