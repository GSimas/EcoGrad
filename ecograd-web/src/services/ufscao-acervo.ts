import { consultarIndice, dicionarioDoIndice, panoramaTematico } from '@/lib/indice-remoto';
import type { ConfigIA } from '@/lib/provedores-ia';
import {
  dicionarioCompacto, lerPlano, promptCorrecaoSql, promptPlanejamento, promptResposta,
  type Dados, type Panorama, type Plano, type Turno,
} from '@/lib/ufscao-acervo';
import { escreverSintese } from './sintese-acervo';

export type Etapa = 'planejando' | 'consultando' | 'escrevendo';

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
  if (plano.grupos && (plano.tipo === 'tema' || plano.tipo === 'misto')) {
    try {
      panorama = await panoramaTematico(plano.grupos, { colecao: plano.colecao, ano_min: plano.ano_min, ano_max: plano.ano_max });
    } catch (e) {
      erroPanorama = e instanceof Error ? e.message : String(e);
    }
  }
  signal.throwIfAborted();

  aoMudarEtapa('escrevendo');
  const resposta = promptResposta(pergunta, plano, dados, erroSql, panorama, erroPanorama, turnos);
  const texto = await escreverSintese(config, resposta.sistema, resposta.mensagem, aoEscrever, signal);
  return { id: Date.now(), pergunta, plano, dados, erroSql, panorama, erroPanorama, texto, planoImprovisado };
}
