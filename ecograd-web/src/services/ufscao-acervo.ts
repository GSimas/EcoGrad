import { LOTES_SIMULTANEOS, promptLote, type PlanoAprofundamento } from '@/lib/chat-sintese';
import { consultarIndice, dicionarioDoIndice, obrasDoTema, panoramaTematico, resumosDasObras } from '@/lib/indice-remoto';
import type { ConfigIA } from '@/lib/provedores-ia';
import {
  TETO_APROFUNDAR, dicionarioCompacto, lerPlano, obrasLidas, planejarLeituraDoTema, promptCorrecaoSql,
  promptPlanejamento, promptReducaoDoTema, promptResposta,
  type Aprofundamento, type Dados, type LeituraDoTema, type ObraDoIndice, type ObraLida, type Panorama,
  type Plano, type Turno,
} from '@/lib/ufscao-acervo';
import { escreverSintese } from './sintese-acervo';

export type Etapa = 'planejando' | 'consultando' | 'escrevendo';

/**
 * Vetor da pergunta pela função Netlify, com a chave do projeto (decisão E3).
 * Falhar aqui não derruba a resposta: a busca volta a ser só por termos, e a
 * tela diz isso.
 */
export async function vetorDaPergunta(texto: string, signal: AbortSignal): Promise<number[] | null> {
  try {
    const r = await fetch('/.netlify/functions/embedding-consulta', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!r.ok) return null;
    const { vetor } = await r.json() as { vetor?: number[] };
    return Array.isArray(vetor) && vetor.length === 768 ? vetor : null;
  } catch {
    return null;
  }
}

export interface RespostaAcervo {
  id: number;
  pergunta: string;
  plano: Plano | null;
  dados: Dados | null;
  erroSql: string | null;
  panorama: Panorama | null;
  erroPanorama: string | null;
  texto: string;
  /** Preenchido quando o modelo não devolveu plano legível e a pergunta virou busca de tema. */
  planoImprovisado?: boolean;
  /** A busca de tema tentou usar significado e não conseguiu: ficou só nos termos. */
  semSignificado?: boolean;
  /** Leitura de todos os resumos do tema, quando o usuário pediu e pagou por ela (fase C). */
  aprofundamento?: Aprofundamento;
}

/** O dicionário muda só com o esquema: uma leitura por sessão. */
let dicionario: Promise<string> | null = null;
const lerDicionario = () => (dicionario ??= dicionarioDoIndice().then(dicionarioCompacto).catch((e) => { dicionario = null; throw e; }));

/**
 * Uma pergunta do UFSCão sobre o acervo inteiro (ADR 004, fase A): planeja com
 * o modelo do usuário, apura no índice e escreve a resposta citada. A chave vai
 * do navegador direto ao provedor, como no UFSCão das coleções carregadas.
 */
export async function perguntarAoAcervo(
  config: ConfigIA, pergunta: string, turnos: readonly Turno[],
  aoMudarEtapa: (etapa: Etapa) => void, aoEscrever: (texto: string) => void, signal: AbortSignal,
  obterVetor: (texto: string, signal: AbortSignal) => Promise<number[] | null> = vetorDaPergunta,
  /** O índice foi gerado de bases anteriores às publicadas: a resposta precisa declarar (D1). */
  indiceAtrasado = false,
): Promise<RespostaAcervo> {
  aoMudarEtapa('planejando');
  const dic = await lerDicionario();
  const { sistema, mensagem } = promptPlanejamento(dic, pergunta, turnos);
  let bruto = await escreverSintese(config, sistema, mensagem, () => {}, signal);
  let plano = lerPlano(bruto);
  // Sem plano legível, a pergunta inteira vira um conceito: é a busca mais
  // literal possível, e a resposta ainda sai do banco em vez da imaginação.
  const planoImprovisado = !plano;
  if (!plano) plano = { tipo: 'tema', grupos: [[pergunta.slice(0, 80)]] };

  aoMudarEtapa('consultando');
  let dados: Dados | null = null;
  let erroSql: string | null = null;
  if (plano.sql && (plano.tipo === 'dados' || plano.tipo === 'misto')) {
    try {
      dados = { sql: plano.sql, ...(await consultarIndice(plano.sql, 200)) };
    } catch (e) {
      // Uma correção só: o erro do Postgres costuma bastar ao modelo, e insistir
      // mais gastaria a chave do usuário num SQL que não vai sair.
      const primeiroErro = e instanceof Error ? e.message : String(e);
      bruto = await escreverSintese(config, sistema, `${mensagem}\n\n${promptCorrecaoSql(plano.sql, primeiroErro)}`, () => {}, signal);
      const corrigido = lerPlano(bruto);
      if (corrigido?.sql) {
        try {
          dados = { sql: corrigido.sql, ...(await consultarIndice(corrigido.sql, 200)) };
          plano = { ...plano, sql: corrigido.sql };
        } catch (e2) { erroSql = e2 instanceof Error ? e2.message : String(e2); }
      } else erroSql = primeiroErro;
    }
  }

  let panorama: Panorama | null = null;
  let erroPanorama: string | null = null;
  let semSignificado = false;
  if (plano.grupos && (plano.tipo === 'tema' || plano.tipo === 'misto')) {
    try {
      // Os grupos dão o assunto mesmo em pergunta de seguimento ("e depois de 2020?").
      const vetor = await obterVetor(`${plano.grupos.map((g) => g.join(', ')).join('; ')} — ${pergunta}`, signal);
      semSignificado = !vetor;
      const filtros = { colecao: plano.colecao, ano_min: plano.ano_min, ano_max: plano.ano_max };
      try {
        panorama = await panoramaTematico(plano.grupos, filtros, vetor);
      } catch (e) {
        // Tema amplo demais para contar dentro do limite do banco: sem os termos,
        // a função só procura por significado, que é rápido. A resposta fica
        // sem números e diz por quê, em vez de sumir.
        if (!vetor) throw e;
        panorama = { ...(await panoramaTematico([], filtros, vetor)), amplo_demais: true };
      }
    } catch (e) {
      erroPanorama = e instanceof Error ? e.message : String(e);
    }
  }
  signal.throwIfAborted();

  aoMudarEtapa('escrevendo');
  const resposta = promptResposta(pergunta, plano, dados, erroSql, panorama, erroPanorama, turnos, indiceAtrasado);
  const texto = await escreverSintese(config, resposta.sistema, resposta.mensagem, aoEscrever, signal);
  return { id: Date.now(), pergunta, plano, dados, erroSql, panorama, erroPanorama, texto, planoImprovisado, semSignificado };
}

/**
 * "Aprofundar" sobre o índice (ADR 004, fase C).
 *
 * Duas metades, de propósito: `prepararAprofundamento` só fala com o índice e
 * devolve quanto vai custar; `aprofundarTema` é o que gasta a chave do usuário,
 * e só roda depois que ele viu a conta. É a mesma ordem do UFSCão das coleções
 * carregadas — quantos resumos se lê domina o custo, e quem paga é quem
 * pergunta.
 */

/** Obras por chamada a `resumos_das_obras`: o banco aceita 200, e 100 mantém a resposta em torno de 200 KB. */
const OBRAS_POR_PAGINA = 100;

export interface PreparoAprofundamento {
  obras: ObraLida[];
  leitura: LeituraDoTema;
  plano: PlanoAprofundamento<ObraLida>;
}

/** Lista as obras do tema e lê os resumos, sem chamar modelo nenhum. */
export async function prepararAprofundamento(plano: Plano, signal: AbortSignal): Promise<PreparoAprofundamento> {
  if (!plano.grupos) throw new Error('Esta resposta não veio de uma busca de tema.');
  const filtros = { colecao: plano.colecao, ano_min: plano.ano_min, ano_max: plano.ano_max };
  const { obras, com_resumo, ids } = await obrasDoTema(plano.grupos, filtros, TETO_APROFUNDAR);

  const lidas: ObraDoIndice[] = [];
  for (let i = 0; i < ids.length; i += OBRAS_POR_PAGINA) {
    signal.throwIfAborted();
    lidas.push(...await resumosDasObras(ids.slice(i, i + OBRAS_POR_PAGINA)));
  }
  const numeradas = obrasLidas(lidas);
  return {
    obras: numeradas,
    leitura: { obras, comResumo: com_resumo, lidas: numeradas.length },
    plano: planejarLeituraDoTema(numeradas),
  };
}

/**
 * Lê os lotes e escreve a síntese sobre as notas. Um lote que falha para os
 * demais: síntese sobre notas incompletas pareceria completa.
 */
export async function aprofundarTema(
  config: ConfigIA, pergunta: string, panorama: Panorama, preparo: PreparoAprofundamento,
  turnos: readonly Turno[], aoProgredir: (feitos: number, lotes: number) => void,
  aoEscrever: (texto: string) => void, signal: AbortSignal,
): Promise<string> {
  const total = preparo.plano.lotes.length;
  if (!total) throw new Error('Nenhuma obra do tema tem resumo utilizável para ler.');
  const notas: string[] = new Array(total).fill('');
  const controle = new AbortController();
  const parar = () => controle.abort(signal.reason);
  signal.addEventListener('abort', parar, { once: true });
  let proximo = 0;
  let feitos = 0;
  aoProgredir(feitos, total);
  try {
    const trabalhador = async () => {
      while (proximo < total && !controle.signal.aborted) {
        const i = proximo++;
        const { sistema, mensagem } = promptLote(pergunta, preparo.plano.lotes[i]);
        try {
          notas[i] = await escreverSintese(config, sistema, mensagem, () => {}, controle.signal);
        } catch (e) {
          controle.abort();
          throw e;
        }
        aoProgredir((feitos += 1), total);
      }
    };
    await Promise.all(Array.from({ length: Math.min(LOTES_SIMULTANEOS, total) }, trabalhador));
    const { sistema, mensagem } = promptReducaoDoTema(pergunta, panorama, preparo.leitura, preparo.obras, notas, turnos);
    return await escreverSintese(config, sistema, mensagem, aoEscrever, controle.signal);
  } finally {
    signal.removeEventListener('abort', parar);
  }
}
