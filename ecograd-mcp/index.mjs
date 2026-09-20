#!/usr/bin/env node
/**
 * Servidor MCP do EcoGrad: o acervo indexado da UFSC — 92 mil registros de
 * teses, dissertações e TCCs — como ferramentas de um assistente.
 *
 * Roda na máquina de quem usa, por stdio, e fala direto com o PostgREST do
 * índice. Não há servidor no meio para hospedar nem para pagar.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  panoramaTematico, obrasDoTema, resumosDasObras, consultar, dicionario, contarAcervo, pessoaNoIndice, serieAnual,
} from './indice.mjs';

const servidor = new McpServer({ name: 'ecograd', version: '0.1.0' });

/** Registra uma ferramenta: JSON na saída, e a falha volta como texto, não como exceção morta. */
function ferramenta(nome, descricao, esquema, executar) {
  servidor.registerTool(nome, { description: descricao, inputSchema: esquema }, async (argumentos) => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await executar(argumentos), null, 1) }] };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
  });
}

const GRUPOS = z.array(z.array(z.string())).describe(
  'Grupos de sinônimos. Os grupos se combinam em E, os termos de cada grupo em OU: '
  + '[["empreendedorismo","empreendedora"],["feminino","mulheres"]] casa (empreendedorismo OU empreendedora) E (feminino OU mulheres). '
  + 'Escreva os sinônimos que o acervo usaria, em português, e não só o termo da pergunta.');

const filtros = {
  colecao: z.string().optional().describe('Trecho do nome do programa ou curso, sem acento e sem caixa: "engenharia e gestão".'),
  ano_min: z.number().int().optional(),
  ano_max: z.number().int().optional(),
};

ferramenta('panorama_tematico',
  'Panorama exato de um tema no acervo da UFSC: quantas obras casaram, distribuição por ano, coleção, nível e macrotema, '
  + 'principais orientadores, e uma amostra representativa com título, autoria, link e trecho do resumo. '
  + 'Comece por aqui em qualquer pergunta sobre o que a UFSC produziu sobre um assunto. '
  + 'Os totais são exatos (vêm de SQL); a amostra é recorte, e somá-la dá número errado.',
  { tema: GRUPOS, ...filtros, amostra: z.number().int().min(5).max(30).default(20) },
  ({ tema, amostra, ...f }) => panoramaTematico(tema, { ...f, amostra }));

ferramenta('obras_do_tema',
  'Lista os ids de TODAS as obras do tema, em ordem de aderência, para leitura completa em vez de amostra. '
  + 'Devolve o total e até `teto` ids; os resumos vêm depois, por `resumos_das_obras`. '
  + 'Tema muito amplo estoura o tempo do banco — restrinja por coleção ou período quando isso acontecer.',
  { tema: GRUPOS, ...filtros, teto: z.number().int().min(1).max(1000).default(400) },
  ({ tema, teto, ...f }) => obrasDoTema(tema, { ...f, teto }));

ferramenta('resumos_das_obras',
  'Resumo completo das obras pedidas, na ordem dos ids — é essa ordem que numera as citações. '
  + 'Até 100 ids por chamada; pagine os ids que `obras_do_tema` devolveu.',
  { ids: z.array(z.string()).describe('documento_id vindos de obras_do_tema ou da amostra do panorama.') },
  ({ ids }) => resumosDasObras(ids));

ferramenta('consultar_sql',
  'Executa UM SELECT somente leitura sobre as views do acervo (pessoas, orientacoes, obras, registros, colecoes, rede…). '
  + 'Use para o que o panorama não responde: rankings, séries, cruzamentos, genealogia acadêmica. '
  + 'Leia `dicionario` antes de escrever. O schema já está no search_path: "from obras", não "from consulta.obras". '
  + 'Contar obras é count(distinct documento_id) — count(*) conta catalogações, e a mesma obra aparece em mais de uma coleção.',
  { sql: z.string(), limite: z.number().int().min(1).max(1000).default(200) },
  ({ sql, limite }) => consultar(sql, limite));

ferramenta('dicionario',
  'O esquema consultável por `consultar_sql`: cada view, cada coluna, seu tipo e o que ela significa. '
  + 'Leia antes de escrever SQL pela primeira vez na conversa.',
  {}, () => dicionario());

ferramenta('contar_acervo',
  'Tamanho do acervo e versão do índice. Registros e trabalhos distintos são números diferentes: '
  + 'a mesma obra pode estar catalogada em mais de uma coleção, e a resposta precisa dizer qual está usando.',
  {}, () => contarAcervo());

ferramenta('pessoa',
  'Procura uma pessoa (autoria ou orientação) por trecho do nome, com quantas obras tem em cada papel. '
  + 'A unificação de grafias é automática e conservadora, sem curadoria humana: grafias variantes podem ter escapado.',
  { nome: z.string() }, ({ nome }) => pessoaNoIndice(nome));

ferramenta('serie_anual',
  'Registros por ano, no acervo inteiro ou numa coleção. O último ano vem marcado com em_coleta: '
  + 'ainda está sendo depositado, e tratá-lo como produção fechada inventa uma queda que não existe.',
  { colecao: z.string().optional() }, ({ colecao }) => serieAnual(colecao ?? null));

await servidor.connect(new StdioServerTransport());
