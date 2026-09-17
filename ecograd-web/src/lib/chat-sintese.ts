/**
 * Síntese citada do chat — a segunda metade da resposta, na ordem da decisão D7
 * do ADR 001: o recorte verificável já foi apurado pelas ferramentas
 * determinísticas, e o modelo só escreve texto por cima dele.
 *
 * Duas profundidades (decisão D8). A leitura padrão envia até `RESUMOS_PADRAO`
 * resumos numerados numa chamada. "Aprofundar" lê todos os resumos utilizáveis
 * do recorte em lotes: cada lote devolve notas citadas (`promptLote`) e uma
 * última chamada escreve a síntese sobre as notas (`promptReducao`). Antes de
 * aprofundar, `planejarAprofundamento` estima chamadas, tokens e tempo, porque
 * quantos resumos se lê é o que domina o custo — e quem paga é o usuário.
 *
 * Tudo que o modelo afirmar precisa citar `[n]`, e `verificarCitacoes` aponta
 * citação a fonte que não foi enviada — o sinal mais barato de fabricação.
 *
 * Nada aqui chama rede: o envio é BYOK, em `services/sintese-acervo.ts`.
 * Importa por caminho relativo: os testes compilam sem o atalho `@/`.
 */
import { resumoUtilizavel, type Contagem, type ItemRecorte, type Recorte } from './chat-ferramentas';
import { chaveBusca } from './utils';
import type { Documento } from '../types';

/** Leitura padrão da decisão D8 (15 a 25 resumos). */
export const RESUMOS_PADRAO = 20;
/** Resumos por chamada ao aprofundar. */
export const RESUMOS_POR_LOTE = 20;
/** Lotes enviados ao mesmo tempo: rápido sem esbarrar no limite de requisições dos planos mais baixos. */
export const LOTES_SIMULTANEOS = 3;
/** Resposta de um lote sem nada sobre a pergunta; a síntese final a descarta. */
export const SEM_RELEVANCIA = 'NADA RELEVANTE';

/** O resumo médio da pós tem 2.133 caracteres; o raro muito longo não pode dominar o contexto. */
export const MAX_CARACTERES_RESUMO = 3000;
/** Português dá perto de 4 caracteres por token. É ordem de grandeza para avisar, não cobrança. */
const CARACTERES_POR_TOKEN = 4;
/** Regras, pergunta e recorte, repetidos em cada chamada. */
const CARACTERES_FIXOS_POR_CHAMADA = 2500;
/** Saída esperada de cada lote e da síntese final. */
const TOKENS_NOTAS_POR_LOTE = 700;
const TOKENS_SINTESE = 900;
/** Faixa por chamada com streaming; muda com provedor, modelo e horário. */
const SEGUNDOS_POR_CHAMADA: readonly [number, number] = [8, 30];

/**
 * Uma obra com resumo, numerada para citação. É o mínimo que os prompts e a
 * estimativa de custo precisam — e o que o índice também sabe devolver, na fase
 * C do ADR 004, sem ter um `docs` local onde achar o registro.
 */
export interface FonteResumo {
  numero: number;
  titulo: string;
  ano: number | null;
  colecao: string;
  nivel: string;
  autores: readonly string[];
  orientador: string;
  resumo: string;
}

export interface FonteSintese extends FonteResumo {
  /** Posição em `docs`: abre o dossiê do registro exato, não de um homônimo. */
  indice: number;
}

/** O registro de `docs` que um item do recorte descreve, por título, URL e coleção. */
export function indiceDoItem(docs: readonly Documento[], item: ItemRecorte): number {
  return docs.findIndex((d) => d.titulo === item.titulo && d.url === item.url && d.programa_origem === item.colecao);
}

const obra = (titulo: string) => chaveBusca(titulo).replace(/\s+/g, ' ').trim();

/**
 * Até `limite` fontes do recorte com resumo utilizável, na ordem do recorte, sem
 * enviar duas vezes a mesma obra catalogada em coleções diferentes.
 */
export function fontesDaSintese(docs: readonly Documento[], recorte: Recorte, limite = RESUMOS_PADRAO): FonteSintese[] {
  const fontes: FonteSintese[] = [];
  const vistas = new Set<string>();
  for (const item of recorte.itens) {
    if (fontes.length >= limite) break;
    const indice = indiceDoItem(docs, item);
    const d = docs[indice];
    if (!d || !resumoUtilizavel(d) || vistas.has(obra(d.titulo))) continue;
    vistas.add(obra(d.titulo));
    fontes.push({
      numero: fontes.length + 1,
      indice,
      titulo: d.titulo,
      ano: d.ano,
      colecao: d.programa_origem,
      nivel: d.nivel_academico,
      autores: d.autores,
      orientador: d.orientador,
      resumo: d.resumo.trim().slice(0, MAX_CARACTERES_RESUMO),
    });
  }
  return fontes;
}

const listar = (itens: readonly Contagem[], n: number) => itens.slice(0, n).map(([rotulo, total]) => `${rotulo} (${total})`).join('; ') || 'não informado';

function blocoRecorte(recorte: Recorte, declarar: readonly string[]): string[] {
  const serie = recorte.serieAnual;
  const anos = serie.length === 0
    ? 'não informado'
    : `${serie[0][0]}${serie.length > 1 ? `–${serie[serie.length - 1][0]}` : ''}${recorte.anoEmColeta !== null ? ` (${recorte.anoEmColeta} ainda em coleta, não é ano fechado)` : ''}`;
  return [
    'RECORTE (apurado pelo aplicativo; é o único lugar de onde números podem vir):',
    `- Registros: ${recorte.registros} · Trabalhos distintos: ${recorte.trabalhosDistintos} · Sem resumo utilizável: ${recorte.semResumoUtilizavel}`,
    `- Anos: ${anos}`,
    `- Coleções: ${listar(recorte.colecoes, 8)}`,
    `- Macrotemas mais frequentes (classificação automática da base): ${listar(recorte.macrotemas, 6)}`,
    ...(declarar.length ? ['', 'RESSALVAS QUE A SÍNTESE DEVE RESPEITAR:', ...declarar.map((d) => `- ${d}`)] : []),
  ];
}

export const blocoFontes = (fontes: readonly FonteResumo[]) => fontes.flatMap((f) => [
  '',
  `[${f.numero}] ${f.titulo || 'Trabalho sem título'} (${f.ano ?? 'sem ano'}) · ${f.colecao} · ${f.nivel || 'nível não informado'}`,
  `Autoria: ${f.autores.join('; ') || 'não informada'} · Orientação: ${f.orientador || 'não informada'}`,
  `Resumo: ${f.resumo}`,
]);

/**
 * Regras de pontuação da aferição (docs/AFERICAO-ETAPA-0.md), valem para as duas
 * profundidades e para as duas superfícies: coleções carregadas e índice.
 */
export function sistemaSintese(material: string, leitura: string): string {
  return [
    'Você escreve a síntese de uma resposta do EcoGrad sobre o acervo de trabalhos acadêmicos da UFSC.',
    'O aplicativo já apurou o recorte (números, coleções, anos) e o mostra ao usuário antes do seu texto. Sua parte é só sintetizar o que o material fornecido diz sobre a pergunta.',
    '',
    'Regras obrigatórias:',
    `1. Use somente ${material}. Nada de conhecimento externo sobre trabalhos, pessoas ou a UFSC.`,
    '2. Toda frase que afirma algo sobre o acervo termina com a citação das fontes que a sustentam, como [3] ou [2][5]. Se não há fonte para a frase, não a escreva.',
    '3. Não invente título, autor, ano, instrumento, número ou resultado.',
    `4. Número sobre o recorte só pode ser copiado do bloco RECORTE. ${leitura}`,
    '5. Não emita juízo de qualidade ("melhor", "mais relevante", "mais importante").',
    '6. Macrotema é classificação automática da base, não categoria oficial de programa.',
    '7. Se o material não sustenta resposta, escreva "Não encontrei base suficiente nos resumos lidos para afirmar isso." e diga, com citação, do que as fontes tratam.',
    '8. Não escreva revisão de literatura nem texto em nome de quem pesquisa: agrupe o que as fontes dizem, sempre com citação.',
    '',
    'Formato: português do Brasil, no máximo 250 palavras, parágrafos curtos ou tópicos em Markdown, sem título e sem lista de referências no fim (o aplicativo já mostra as fontes).',
  ].join('\n');
}

/** Leitura padrão: uma chamada com até `RESUMOS_PADRAO` resumos. */
export function promptSintese(pergunta: string, recorte: Recorte, fontes: readonly FonteSintese[], declarar: readonly string[]) {
  const sistema = sistemaSintese(
    'as FONTES numeradas da mensagem',
    `Você leu ${fontes.length} de ${recorte.registros} registros: não generalize a amostra para o recorte inteiro nem estime totais ou proporções.`,
  );
  const mensagem = [
    `PERGUNTA: ${pergunta}`,
    '',
    ...blocoRecorte(recorte, declarar),
    '',
    `FONTES (${fontes.length} de ${recorte.registros} registros; só estas podem ser citadas):`,
    ...blocoFontes(fontes),
  ].join('\n');
  return { sistema, mensagem };
}

export interface PlanoAprofundamento<F extends FonteResumo = FonteSintese> {
  lotes: F[][];
  /** Um por lote, mais a síntese final. */
  chamadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  /** Faixa de tempo, em segundos. */
  segundos: [number, number];
}

/** Lotes e estimativa de volume, mostrados ao usuário antes de gastar a chave dele. */
export function planejarAprofundamento<F extends FonteResumo>(fontes: readonly F[], tamanhoLote = RESUMOS_POR_LOTE): PlanoAprofundamento<F> {
  const lotes: F[][] = [];
  for (let i = 0; i < fontes.length; i += tamanhoLote) lotes.push(fontes.slice(i, i + tamanhoLote));
  const caracteresFontes = blocoFontes(fontes).join('\n').length;
  const tokensEntrada = Math.ceil((caracteresFontes + CARACTERES_FIXOS_POR_CHAMADA * (lotes.length + 1)) / CARACTERES_POR_TOKEN)
    + lotes.length * TOKENS_NOTAS_POR_LOTE;
  const rodadas = Math.ceil(lotes.length / LOTES_SIMULTANEOS) + 1;
  return {
    lotes,
    chamadas: lotes.length + 1,
    tokensEntrada,
    tokensSaida: lotes.length * TOKENS_NOTAS_POR_LOTE + TOKENS_SINTESE,
    segundos: [rodadas * SEGUNDOS_POR_CHAMADA[0], rodadas * SEGUNDOS_POR_CHAMADA[1]],
  };
}

/** Leitura de um lote: só extrai, com a numeração global, o que os resumos dizem sobre a pergunta. */
export function promptLote(pergunta: string, lote: readonly FonteResumo[]) {
  const sistema = [
    'Você lê um lote de resumos do acervo de trabalhos acadêmicos da UFSC para ajudar a responder uma pergunta.',
    'Extraia, em tópicos curtos, apenas o que estes resumos dizem de relevante para a pergunta. Cada tópico termina com a citação da fonte, com o número dela, como [21].',
    'Não conclua, não generalize para o acervo, não conte trabalhos, não use conhecimento externo e não avalie qualidade. Não invente título, autor, ano, instrumento ou resultado.',
    `Se nenhum resumo do lote tratar da pergunta, responda exatamente: ${SEM_RELEVANCIA}`,
    'No máximo 12 tópicos, em português do Brasil.',
  ].join('\n');
  const mensagem = [`PERGUNTA: ${pergunta}`, '', 'FONTES DESTE LOTE:', ...blocoFontes(lote)].join('\n');
  return { sistema, mensagem };
}

/** Síntese final do aprofundamento, escrita sobre as notas citadas de todos os lotes. */
export function promptReducao(pergunta: string, recorte: Recorte, fontes: readonly FonteSintese[], notas: readonly string[], declarar: readonly string[]) {
  const uteis = notas.map((n) => (n ?? '').trim()).filter((n) => n && !n.toUpperCase().includes(SEM_RELEVANCIA));
  const sistema = sistemaSintese(
    'as NOTAS dos lotes e as citações que elas já trazem',
    `As notas cobrem todos os ${fontes.length} resumos utilizáveis do recorte, mas são notas: não conte trabalhos nem estime proporções por conta própria.`,
  );
  const mensagem = [
    `PERGUNTA: ${pergunta}`,
    '',
    ...blocoRecorte(recorte, declarar),
    '',
    `FONTES LIDAS (${fontes.length}; os números das citações se referem a elas):`,
    ...fontes.map((f) => `[${f.numero}] ${f.titulo || 'Trabalho sem título'} (${f.ano ?? 'sem ano'})`),
    '',
    uteis.length
      ? 'NOTAS DOS LOTES (só estas afirmações podem ser usadas, com as citações que já trazem):'
      : 'NOTAS DOS LOTES: nenhum lote encontrou conteúdo relevante para a pergunta.',
    ...uteis.flatMap((n, i) => ['', `— Notas ${i + 1} —`, n]),
  ].join('\n');
  return { sistema, mensagem };
}

export interface VerificacaoCitacoes {
  /** Fontes enviadas que a síntese citou. */
  citadas: number[];
  /** Números citados que não correspondem a nenhuma fonte enviada. */
  inexistentes: number[];
  /** Nenhuma citação válida e nenhuma recusa declarada: o texto não deve ser usado. */
  semCitacao: boolean;
  /** A síntese declarou não ter base suficiente, resposta aceitável pela D7. */
  recusou: boolean;
}

export function verificarCitacoes(texto: string, totalFontes: number): VerificacaoCitacoes {
  const numeros = [...new Set([...texto.matchAll(/\[(\d{1,4})\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  const citadas = numeros.filter((n) => n >= 1 && n <= totalFontes);
  const recusou = /n[aã]o encontrei base suficiente/i.test(texto);
  return { citadas, inexistentes: numeros.filter((n) => n < 1 || n > totalFontes), semCitacao: citadas.length === 0 && !recusou, recusou };
}
