/**
 * Cliente do índice da Etapa 2 (ADR 001, revisado pelo ADR 003).
 *
 * O índice é um Postgres no Supabase que guarda o acervo inteiro com o texto
 * dos resumos indexado. É o que permite responder panorama temático na tela
 * inicial sem baixar coleção nenhuma — 79% de revocação contra os 46% da busca
 * por rótulo, medidos contra a triagem assinada.
 *
 * Três regras do ADR moram aqui:
 *
 * **D1 — o índice é derivado, e pode estar atrás.** `indice_meta` guarda o
 * sha256 das duas bases que o geraram, e o `manifest.json` publicado guarda os
 * mesmos hashes. Comparar os dois é a checagem de idade, e ela é obrigatória:
 * sem ela, o índice envelhece em silêncio e responde sobre uma base que não é
 * mais a que o usuário vê na tela.
 *
 * **D1 de novo — se cair, o resto continua inteiro.** Nenhuma falha daqui pode
 * derrubar a conversa: `estadoDoIndice` nunca lança, e devolve o motivo da
 * indisponibilidade para a resposta declarar em vez de silenciar.
 *
 * A chave é a publicável (`anon`), pública por desenho: o RLS é somente leitura
 * e não existe tabela de escrita alcançável. Ela não é segredo, e por isso vai
 * em `VITE_`, ao contrário da `service_role`, que só existe na carga.
 */

const URL_INDICE = String(import.meta.env.VITE_INDICE_URL ?? '').replace(/\/+$/, '');
const CHAVE_INDICE = String(import.meta.env.VITE_INDICE_CHAVE ?? '');

/** Nomes dos arquivos no manifesto, que são a referência de idade do índice. */
const BASE_POS = 'base_consolidada_ufsc.json.gz';
const BASE_TCC = 'base_tcc_ufsc.json.gz';

const TEMPO_LIMITE = 8000;

export const indiceConfigurado = () => Boolean(URL_INDICE && CHAVE_INDICE);

export interface EstadoIndice {
  disponivel: boolean;
  /** Falso quando o índice foi gerado de bases diferentes das publicadas. */
  atualizado: boolean;
  baseVersion: string | null;
  geradoEm: string | null;
  /** Por que não dá para usar, quando não dá. Texto para a resposta declarar. */
  motivo?: string;
}

const INDISPONIVEL = (motivo: string): EstadoIndice =>
  ({ disponivel: false, atualizado: false, baseVersion: null, geradoEm: null, motivo });

async function rpc<T>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${URL_INDICE}/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: { apikey: CHAVE_INDICE, authorization: `Bearer ${CHAVE_INDICE}`, 'content-type': 'application/json' },
    body: JSON.stringify(argumentos),
    signal: AbortSignal.timeout(TEMPO_LIMITE),
  });
  if (!r.ok) throw new Error(`índice respondeu ${r.status}`);
  return r.json() as Promise<T>;
}

/**
 * Estado do índice, comparado com a base publicada. Nunca lança: o chamador
 * recebe `disponivel: false` com o motivo, e a conversa segue pelo catálogo.
 */
export async function estadoDoIndice(): Promise<EstadoIndice> {
  if (!indiceConfigurado()) return INDISPONIVEL('O índice não está configurado nesta instalação.');
  try {
    const [metaResposta, manifesto] = await Promise.all([
      fetch(`${URL_INDICE}/rest/v1/indice_meta?select=base_version,sha256_pos,sha256_tcc,gerado_em`, {
        headers: { apikey: CHAVE_INDICE, authorization: `Bearer ${CHAVE_INDICE}` },
        signal: AbortSignal.timeout(TEMPO_LIMITE),
      }),
      fetch('/data/manifest.json', { cache: 'no-store', signal: AbortSignal.timeout(TEMPO_LIMITE) }),
    ]);
    if (!metaResposta.ok) return INDISPONIVEL(`O índice respondeu ${metaResposta.status}.`);

    const linhas = await metaResposta.json() as Array<{ base_version: string; sha256_pos: string; sha256_tcc: string; gerado_em: string }>;
    const meta = linhas[0];
    // Carga interrompida deixa as tabelas parciais e `indice_meta` vazia, de
    // propósito: sem o carimbo final, o índice não responde sobre meia base.
    if (!meta) return INDISPONIVEL('O índice está sem carimbo de carga concluída.');

    let atualizado = true;
    if (manifesto.ok) {
      const { files } = await manifesto.json() as { files?: Record<string, string> };
      if (files?.[BASE_POS] && files?.[BASE_TCC]) {
        atualizado = files[BASE_POS] === meta.sha256_pos && files[BASE_TCC] === meta.sha256_tcc;
      }
    }
    return { disponivel: true, atualizado, baseVersion: meta.base_version, geradoEm: meta.gerado_em };
  } catch (erro) {
    const fora = erro instanceof DOMException && erro.name === 'TimeoutError';
    return INDISPONIVEL(fora ? 'O índice não respondeu a tempo.' : 'Não foi possível falar com o índice.');
  }
}

export interface AchadoNoIndice { documento_id: string; titulo: string; aderencia: number }

/**
 * Recorte temático sobre o acervo inteiro, lendo o texto do resumo.
 *
 * O limite padrão é a profundidade da decisão D8 — 15 a 25 resumos por
 * pergunta —, e é onde a medição encontrou o melhor par: 79% de revocação com
 * 76% de precisão. Subir o limite melhora a revocação e derruba a precisão.
 */
export const buscarNoIndice = (consulta: string, limite = 25) =>
  rpc<AchadoNoIndice[]>('buscar_texto', { consulta, limite });

/** Os termos que o acervo usa para o tema, e que a consulta literal não alcança. */
export const tesauroDoIndice = (consulta: string, termos = 8) =>
  rpc<Array<{ lexema: string; na_semente: number; no_acervo: number; lift: number }>>('tesauro', { consulta, termos });

export interface PanoramaIndice {
  registros: number; trabalhos_distintos: number; com_resumo: number; sem_resumo: number;
  colecoes: number; base_version: string; unidade: string;
}
export const panoramaDoIndice = () => rpc<PanoramaIndice[]>('contar_acervo');

export const serieDoIndice = (colecao?: string) =>
  rpc<Array<{ ano: number; registros: number; em_coleta: boolean }>>('serie_anual', { colecao_filtro: colecao ?? null });

export const colecaoNoIndice = (nome: string) =>
  rpc<Array<{ colecao: string; registros: number; trabalhos_distintos: number; sem_resumo: number; ano_min: number; ano_max: number; niveis: string }>>(
    'recorte_da_colecao', { nome });

export const pessoaNoIndice = (nome: string) =>
  rpc<Array<{ grafia: string; papel: string; registros: number; trabalhos_distintos: number; colecoes: number; unidade: string }>>(
    'pessoa_no_indice', { nome });

export const macrotemasDoIndice = (limite = 10) =>
  rpc<Array<{ macrotema: string; registros: number; origem: string }>>('top_macrotemas', { limite });

/**
 * SQL do modelo, executado como `consulta_leitor` sobre as views do schema
 * `consulta` (ADR 004). O banco recusa escrita, múltiplas instruções e o que
 * passar de 3 segundos; o erro volta com a mensagem do Postgres, que é o que o
 * modelo precisa para corrigir a consulta.
 */
export async function consultarIndice(sql: string, limite = 200): Promise<{ linhas: Record<string, unknown>[]; truncado: boolean }> {
  const r = await fetch(`${URL_INDICE}/rest/v1/rpc/consultar`, {
    method: 'POST',
    headers: { apikey: CHAVE_INDICE, authorization: `Bearer ${CHAVE_INDICE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ consulta_sql: sql, limite }),
    signal: AbortSignal.timeout(TEMPO_LIMITE),
  });
  const corpo = await r.json().catch(() => null) as { linhas?: Record<string, unknown>[]; truncado?: boolean; message?: string } | null;
  if (!r.ok) throw new Error(corpo?.message ?? `índice respondeu ${r.status}`);
  return { linhas: corpo?.linhas ?? [], truncado: corpo?.truncado === true };
}

/** O esquema consultável, que o modelo lê antes de escrever SQL. */
export const dicionarioDoIndice = () =>
  consultarIndice('select visao, descricao_visao, coluna, tipo, descricao from dicionario', 1000)
    .then((r) => r.linhas as unknown as import('./ufscao-acervo').LinhaDicionario[]);

/**
 * Panorama exato e amostra representativa de um tema. Tema muito amplo pode
 * passar dos 3 segundos com o cache do banco frio; a segunda tentativa costuma
 * achar o cache quente, então repete uma vez antes de desistir.
 */
export async function panoramaTematico(grupos: string[][], filtros: { colecao?: string; ano_min?: number; ano_max?: number } = {}, amostra = 20) {
  const corpo = { grupos, amostra, colecao_filtro: filtros.colecao ?? null, ano_min: filtros.ano_min ?? null, ano_max: filtros.ano_max ?? null };
  try {
    return await rpc<import('./ufscao-acervo').Panorama>('panorama_tematico', corpo);
  } catch {
    return rpc<import('./ufscao-acervo').Panorama>('panorama_tematico', corpo);
  }
}

export const registrosDoTituloNoIndice = (titulo: string) =>
  rpc<Array<{ documento_id: string; titulo: string; colecao: string; ano: number; url: string }>>(
    'registros_do_titulo', { titulo_busca: titulo });
