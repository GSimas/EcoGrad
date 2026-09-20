/**
 * Cliente do índice do EcoGrad — o mesmo PostgREST que a aplicação web usa,
 * documentado em `docs/API.md`. Sem dependências: só `fetch`, para que
 * `test.mjs` rode antes de qualquer `npm install`.
 */

/**
 * A chave é a publicável (`anon`), pública por desenho: o RLS é somente leitura
 * e não existe tabela de escrita alcançável. Ela já vai no JavaScript que o
 * navegador baixa de ecograd.netlify.app — embuti-la aqui não publica nada novo,
 * e é o que faz `npx ecograd-mcp` funcionar sem configuração. Se ela rotacionar,
 * publique uma versão nova; quem não puder esperar usa as variáveis de ambiente.
 */
export const URL_INDICE = (process.env.ECOGRAD_INDICE_URL || 'https://unipsxtosltcbtuwnikh.supabase.co').replace(/\/+$/, '');
export const CHAVE_INDICE = process.env.ECOGRAD_INDICE_CHAVE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuaXBzeHRvc2x0Y2J0dXduaWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjU0OTAsImV4cCI6MjEwNTE0MTQ5MH0.APIlSdsCkDRW0jQwqmq8kqgrrH3Ebox-b_cUy_RRC3U';

const TEMPO_LIMITE = 20000;
const cabecalhos = () => ({
  apikey: CHAVE_INDICE,
  authorization: `Bearer ${CHAVE_INDICE}`,
  'content-type': 'application/json',
});

/** `statement_timeout` do Postgres: o tema é grande demais para o tempo do papel anônimo. */
const TEMPO_ESGOTADO = '57014';

/**
 * Uma chamada de função do índice.
 *
 * A retentativa não é otimismo: o banco tem `statement_timeout` de 3 s, e tema
 * amplo com cache frio passa disso — a segunda tentativa costuma achar o cache
 * quente. É o que o cliente oficial faz, pelo mesmo motivo.
 */
export async function rpc(funcao, argumentos = {}, { tentativas = 2 } = {}) {
  let ultimo;
  for (let n = 0; n < tentativas; n += 1) {
    const r = await fetch(`${URL_INDICE}/rest/v1/rpc/${funcao}`, {
      method: 'POST',
      headers: cabecalhos(),
      body: JSON.stringify(argumentos),
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });
    if (r.ok) return r.json();
    const erro = await r.json().catch(() => null);
    ultimo = Object.assign(new Error(erro?.message || `o índice respondeu ${r.status}`), { code: erro?.code });
    if (ultimo.code !== TEMPO_ESGOTADO) throw ultimo;
  }
  throw ultimo;
}

const grupos = (g) => (Array.isArray(g) ? g.map((alternativas) => alternativas.map(String)) : []);

/**
 * Panorama exato de um tema, com amostra representativa.
 *
 * Sem `vetor`: a busca por significado precisa de um embedding de 768 dimensões
 * que só a chave do projeto calcula, e a função que o faz só aceita chamada do
 * próprio site. Busca léxica sobre grupos de sinônimos é o que sobra — e é o que
 * sustenta contagem, que nunca deve sair de similaridade.
 */
export const panoramaTematico = (tema, { colecao = null, ano_min = null, ano_max = null, amostra = 20 } = {}) =>
  rpc('panorama_tematico', { grupos: grupos(tema), amostra, colecao_filtro: colecao, ano_min, ano_max, vetor: null });

/** Todas as obras do tema — só os ids, que é a parte cara de montar. */
export async function obrasDoTema(tema, { colecao = null, ano_min = null, ano_max = null, teto = 400 } = {}) {
  try {
    return await rpc('obras_do_tema', { grupos: grupos(tema), colecao_filtro: colecao, ano_min, ano_max, teto });
  } catch (e) {
    if (e.code !== TEMPO_ESGOTADO) throw e;
    throw new Error('O tema tem obras demais para listar dentro do limite de tempo do banco. Restrinja por coleção ou por período e peça de novo.');
  }
}

/** Resumo completo das obras, na ordem dos ids. O banco corta em 200 por chamada. */
export const resumosDasObras = (ids) => rpc('resumos_das_obras', { ids: ids.slice(0, 100) });

/** Um SELECT somente leitura sobre as views comentadas do schema `consulta`. */
export const consultar = (consulta_sql, limite = 200) => rpc('consultar', { consulta_sql, limite });

/** O esquema consultável: é o que se lê antes de escrever SQL. */
export const dicionario = () =>
  consultar('select visao, descricao_visao, coluna, tipo, descricao from dicionario', 1000);

export const contarAcervo = () => rpc('contar_acervo', {});
export const pessoaNoIndice = (nome) => rpc('pessoa_no_indice', { nome });
export const serieAnual = (colecao = null) => rpc('serie_anual', { colecao_filtro: colecao });
