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
  tipo: TipoBusca;
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
      const chave = dobrar(escaparHtml(v));
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
      const mencao = dic.get(chave.slice(inicio, fim));
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
  return `<button type="button" class="eco-mencao ${classeDoTipo(m.tipo)}" data-mencao="${escaparHtml(m.tipo)}" data-nome="${escaparHtml(m.nome)}"${indice}`
    + ` title="Abrir ${escaparHtml(m.tipo === 'Pessoa' ? 'o perfil' : m.tipo === 'Documento' ? 'o dossiê' : 'o item')} no Motor de Busca">${texto}</button>`;
};

/**
 * Link de trabalho vira botão do dossiê **mais** o link da fonte original.
 *
 * O modelo é instruído a citar o trabalho como link do repositório da UFSC.
 * Trocar o link por botão perderia a fonte; manter só o link deixaria o
 * trabalho de fora da navegação do EcoGrad. Ficam os dois, nessa ordem.
 */
function linksDeDocumento(html: string, dic: DicionarioMencoes): string {
  return html.replace(/<a href="([^"]*)"[^>]*>([^<]+)<\/a>/g, (inteiro, href: string, texto: string) => {
    const mencao = dic.get(dobrar(texto.trim()));
    if (!mencao || mencao.tipo !== 'Documento') return inteiro;
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
  if (dic.size === 0) return html;
  let dentro = 0;
  return linksDeDocumento(html, dic).split(/(<[^>]*>)/).map((parte) => {
    if (parte.startsWith('<')) {
      if (/^<(a|code|button)\b/i.test(parte)) dentro += 1;
      else if (/^<\/(a|code|button)>/i.test(parte)) dentro = Math.max(0, dentro - 1);
      return parte;
    }
    if (dentro > 0 || !parte) return parte;
    const achados = mencoesNoTexto(parte, dic);
    if (!achados.length) return parte;
    let saida = '';
    let cursor = 0;
    for (const { inicio, fim, mencao } of achados) {
      saida += parte.slice(cursor, inicio) + botao(parte.slice(inicio, fim), mencao);
      cursor = fim;
    }
    return saida + parte.slice(cursor);
  }).join('');
}
