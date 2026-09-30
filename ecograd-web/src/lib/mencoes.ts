/**
 * Menções ao acervo dentro do texto que o agente escreve.
 *
 * O modelo devolve prosa; quem aparece nela — pessoas, títulos, palavras-chave
 * e macrotemas — existe como item navegável do EcoGrad. Aqui o texto já
 * convertido em HTML é varrido e cada nome reconhecido vira botão para o perfil
 * do item no Motor de Busca.
 *
 * Duas decisões sustentam o resto:
 *
 * 1. A varredura parte do TEXTO, não do dicionário: para cada sequência de até
 *    `MAX_PALAVRAS` palavras consulta-se o mapa. Percorrer o dicionário seria
 *    percorrer dezenas de milhares de nomes a cada resposta.
 * 2. A comparação usa `dobrar`, que troca cada caractere por um equivalente sem
 *    acento e em minúscula preservando a posição — assim o trecho original é
 *    devolvido intacto, com a grafia que o modelo escreveu.
 *
 * O nome guardado no botão é sempre a grafia do acervo, e não a do texto: é ela
 * que os índices invertidos do Motor de Busca resolvem.
 *
 * Importa por caminho relativo: os testes compilam com um tsconfig próprio que
 * não resolve o atalho `@/`.
 */
import { escaparHtml } from './markdown';
import { classeDoTipo } from './tipos-cor';
import type { Documento, TipoBusca } from '../types';

export interface Mencao {
  /** `Termo`: marcado pelo modelo mas fora do dicionário; o tipo sai do acervo no clique. */
  tipo: TipoBusca | 'Termo';
  /** Grafia do acervo, que o Motor de Busca resolve. */
  nome: string;
  /** Só para `Documento`: posição em `docs`, que identifica o registro exato. */
  indice?: number;
}

/** Chave dobrada (e já escapada em HTML) → item do acervo. */
export type DicionarioMencoes = Map<string, Mencao>;

/** Abaixo disso a chave casa dentro de prosa comum e o realce vira ruído. */
const MINIMO = 4;
/** Títulos são longos; além disso a varredura só gastaria tempo. */
const MAX_PALAVRAS = 40;
const PALAVRA = /[\p{L}\p{N}]+/gu;

/**
 * Minúsculas sem acento preservando o comprimento: cada caractere vira
 * exatamente um caractere, para que a posição encontrada na chave valha também
 * no texto original. Casos raros em que a dobra mudaria o tamanho ficam de fora
 * pelo confronto de comprimento em `mencoesNoTexto`.
 */
export function dobrar(texto: string): string {
  let saida = '';
  for (const c of texto) {
    const base = c.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
    saida += [...base][0] ?? c;
  }
  return saida;
}

/**
 * Chave de comparação: além de tirar acento e caixa, colapsa espaços e cola a
 * pontuação à palavra anterior. O acervo guarda "Algas calcárias nos recifes
 * brasileiros : diversidade" e quem responde escreve "brasileiros: diversidade"
 * — a diferença é de digitação, não de obra.
 */
export const chaveDeBusca = (texto: string) => dobrar(texto).replace(/\s+/g, ' ').replace(/ ([:;,.!?])/g, '$1').trim();

/** "Sobrenome, Nome Do Meio" também é escrito na ordem direta por quem responde. */
function variantes(nome: string): string[] {
  const virgula = nome.indexOf(',');
  if (virgula <= 0) return [nome];
  const direto = `${nome.slice(virgula + 1).trim()} ${nome.slice(0, virgula).trim()}`.trim();
  return direto ? [nome, direto] : [nome];
}

/**
 * O que o acervo carregado oferece como item navegável. Pessoa atravessa os
 * papéis (autoria, orientação, coorientação), como no Motor de Busca; título
 * guarda o índice porque o dossiê precisa do registro exato, não só do nome.
 */
export function dicionarioDoAcervo(docs: readonly Documento[]): DicionarioMencoes {
  const dic: DicionarioMencoes = new Map();
  const registrar = (nome: string, mencao: Mencao) => {
    for (const v of variantes(nome)) {
      const chave = chaveDeBusca(escaparHtml(v));
      // Primeiro a registrar vence: título e palavra-chave homônimos não se sobrescrevem.
      if (chave.length >= MINIMO && !dic.has(chave)) dic.set(chave, mencao);
    }
  };
  docs.forEach((d, indice) => {
    if (d.titulo) registrar(d.titulo, { tipo: 'Documento', nome: d.titulo, indice });
    for (const a of d.autores) if (a) registrar(a, { tipo: 'Pessoa', nome: a });
    if (d.orientador) registrar(d.orientador, { tipo: 'Pessoa', nome: d.orientador });
    for (const co of d.co_orientadores) if (co) registrar(co, { tipo: 'Pessoa', nome: co });
    for (const pk of d.palavras_chave) if (pk) registrar(pk, { tipo: 'Palavra-chave', nome: pk });
    if (d.macrotema) registrar(d.macrotema, { tipo: 'Macrotema', nome: d.macrotema });
  });
  return dic;
}

/**
 * Dicionário de itens soltos, sem base carregada: o UFSCão da tela inicial
 * realça só o que o banco devolveu na resposta — pessoas, títulos e temas que
 * ele de fato consultou.
 */
export function dicionarioDeItens(itens: readonly Mencao[]): DicionarioMencoes {
  const dic: DicionarioMencoes = new Map();
  for (const m of itens) {
    for (const v of variantes(m.nome)) {
      const chave = chaveDeBusca(escaparHtml(v));
      if (chave.length >= MINIMO && !dic.has(chave)) dic.set(chave, m);
    }
  }
  return dic;
}

export interface Achado { inicio: number; fim: number; mencao: Mencao }

/** Menções sem sobreposição num trecho de texto, a mais longa vencendo a mais curta. */
export function mencoesNoTexto(texto: string, dic: DicionarioMencoes): Achado[] {
  const chave = dobrar(texto);
  if (chave.length !== texto.length) return [];
  const palavras = [...chave.matchAll(PALAVRA)];
  const achados: Achado[] = [];
  for (let i = 0; i < palavras.length; i++) {
    const inicio = palavras[i].index;
    for (let j = i; j < Math.min(palavras.length, i + MAX_PALAVRAS); j++) {
      const fim = palavras[j].index + palavras[j][0].length;
      const mencao = dic.get(chaveDeBusca(chave.slice(inicio, fim)));
      if (mencao) achados.push({ inicio, fim, mencao });
    }
  }
  achados.sort((a, b) => a.inicio - b.inicio || (b.fim - b.inicio) - (a.fim - a.inicio));
  const finais: Achado[] = [];
  let ultimo = 0;
  for (const a of achados) if (a.inicio >= ultimo) { finais.push(a); ultimo = a.fim; }
  return finais;
}

const botao = (texto: string, m: Mencao) => {
  const indice = m.indice === undefined ? '' : ` data-indice="${m.indice}"`;
  const titulo = m.tipo === 'Termo' ? 'Procurar no acervo' : `Abrir ${m.tipo === 'Pessoa' ? 'o perfil' : m.tipo === 'Documento' ? 'o dossiê' : 'o item'} no Motor de Busca`;
  return `<button type="button" class="eco-mencao ${classeDoTipo(m.tipo)}" data-mencao="${escaparHtml(m.tipo)}" data-nome="${escaparHtml(m.nome)}"${indice}`
    + ` title="${titulo}">${texto}</button>`;
};

/**
 * `[[nome]]`: o modelo marca cada item do acervo que cita. O dicionário só
 * conhece o que o contexto trouxe, e nome solto que ele não conhece — um tema
 * que o modelo resumiu, uma pessoa de uma contagem — ficaria como texto.
 */
const MARCA = /\[\[([^[\]\n]{2,200})\]\]/g;
/** O texto sem as marcas, para onde ele aparece sem realce (streaming, leitor de tela). */
export const semMarcas = (texto: string) => texto.replace(MARCA, '$1');
const desescapar = (html: string) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Menções do dicionário num trecho de texto puro. */
function realcarTrecho(parte: string, dic: DicionarioMencoes): string {
  const achados = mencoesNoTexto(parte, dic);
  let saida = '';
  let cursor = 0;
  for (const { inicio, fim, mencao } of achados) {
    saida += parte.slice(cursor, inicio) + botao(parte.slice(inicio, fim), mencao);
    cursor = fim;
  }
  return saida + parte.slice(cursor);
}

/**
 * Abaixo disso um começo de título casa com obras demais para valer como
 * identificação.
 */
const PREFIXO_MINIMO = 25;

/**
 * Trabalho cujo título **começa** pelo texto do link.
 *
 * Quem responde costuma citar o título sem o subtítulo — "Mar de lama: os
 * efeitos dos desastres de mineração sobre as florestas submersas do Atlântico
 * Sul", quando o acervo guarda "... Sul - caso dos rejeitos do desastre de
 * Mariana (MG, Brasil)". Sem isto, esses links jamais viram botão.
 *
 * Dois trabalhos que comecem igual devolvem nada: melhor manter o link do que
 * abrir o dossiê da obra errada.
 */
function documentoPorPrefixo(dic: DicionarioMencoes, chave: string): Mencao | null {
  if (chave.length < PREFIXO_MINIMO) return null;
  let achado: Mencao | null = null;
  for (const [k, m] of dic) {
    if (m.tipo !== 'Documento' || !k.startsWith(chave)) continue;
    if (achado) return null;
    achado = m;
  }
  return achado;
}

/**
 * Link de trabalho vira botão do dossiê **mais** o link da fonte original.
 *
 * O modelo é instruído a citar o trabalho como link do repositório da UFSC.
 * Trocar o link por botão perderia a fonte; manter só o link deixaria o
 * trabalho de fora da navegação do EcoGrad. Ficam os dois, nessa ordem.
 */
function linksDeDocumento(html: string, dic: DicionarioMencoes): string {
  return html.replace(/<a href="([^"]*)"[^>]*>([^<]+)<\/a>/g, (inteiro, href: string, texto: string) => {
    const chave = chaveDeBusca(texto);
    const exato = dic.get(chave);
    const mencao = exato?.tipo === 'Documento' ? exato : documentoPorPrefixo(dic, chave);
    if (!mencao) return inteiro;
    return `${botao(texto, mencao)}<a href="${href}" target="_blank" rel="noopener noreferrer" class="eco-fonte-externa" title="Fonte original, em nova aba">↗<span class="sr-only"> (abre a fonte original em nova aba)</span></a>`;
  });
}

/**
 * Envolve em botão cada menção do HTML já sanitizado por `markdownParaHtml`.
 *
 * Só o texto fora de marcação é tocado: atributo de tag nunca é varrido, e o
 * conteúdo de `<a>`, `<code>` e de botão já existente fica intacto — botão
 * dentro de link ou de outro botão não é HTML válido, e código citado não é
 * menção. Pular botão também torna a função idempotente.
 */
export function realcarMencoes(html: string, dic: DicionarioMencoes): string {
  let dentro = 0;
  return linksDeDocumento(html, dic).split(/(<[^>]*>)/).map((parte) => {
    if (parte.startsWith('<')) {
      if (/^<(a|code|button)\b/i.test(parte)) dentro += 1;
      else if (/^<\/(a|code|button)>/i.test(parte)) dentro = Math.max(0, dentro - 1);
      return parte;
    }
    if (dentro > 0 || !parte) return parte;
    // Trechos pares são texto corrido; ímpares, o nome dentro de `[[ ]]`.
    return parte.split(MARCA).map((trecho, i) => {
      if (i % 2 === 0) return realcarTrecho(trecho, dic);
      const nome = trecho.trim();
      return botao(nome, dic.get(chaveDeBusca(nome)) ?? { tipo: 'Termo', nome: desescapar(nome) });
    }).join('');
  }).join('');
}
