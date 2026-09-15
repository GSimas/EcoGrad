/**
 * Recorte da análise: quando a busca da apresentação escolhe itens específicos
 * (um documento, uma pessoa, uma palavra-chave), a base ativa fica restrita aos
 * documentos daquele item. As coleções continuam sendo a unidade de download —
 * elas é que existem como arquivo —, mas apresentar tudo o que veio junto
 * responderia uma pergunta que o usuário não fez.
 */
import type { Documento, TipoBusca } from '@/types';
import { chaveBusca } from './utils';

/** `Coleção` mantém a coleção inteira dentro do recorte; os demais vêm da busca. */
export type TipoRecorte = TipoBusca | 'Coleção';

export interface ItemRecorte {
  tipo: TipoRecorte;
  nome: string;
  /** Grafias equivalentes da mesma pessoa, quando há fusão. Inclui `nome`. */
  grafias?: string[];
}

/** Comparação tolerante a acento, caixa e espaços nas pontas. */
const chave = (nome: string) => chaveBusca(nome.trim());

const TODAS_AS_PESSOAS: readonly TipoRecorte[] = ['Pessoa', 'Autor', 'Orientador', 'Co-orientador'];

interface Alvos {
  titulos: Set<string>;
  autores: Set<string>;
  orientadores: Set<string>;
  coorientadores: Set<string>;
  palavras: Set<string>;
  macrotemas: Set<string>;
  colecoes: Set<string>;
}

/** Um índice por campo: cada documento é testado em O(1) por campo, não por item. */
function alvosDe(recorte: readonly ItemRecorte[]): Alvos {
  const a: Alvos = {
    titulos: new Set(), autores: new Set(), orientadores: new Set(),
    coorientadores: new Set(), palavras: new Set(), macrotemas: new Set(), colecoes: new Set(),
  };
  for (const item of recorte) {
    // Uma grafia fundida some da base ativa, mas os documentos dela continuam
    // sendo da mesma pessoa: todas as grafias do grupo entram no recorte.
    const nomes = (item.grafias?.length ? [...item.grafias, item.nome] : [item.nome]).map(chave).filter(Boolean);
    if (item.tipo === 'Documento') nomes.forEach((n) => a.titulos.add(n));
    else if (item.tipo === 'Palavra-chave') nomes.forEach((n) => a.palavras.add(n));
    else if (item.tipo === 'Macrotema') nomes.forEach((n) => a.macrotemas.add(n));
    else if (item.tipo === 'Coleção') nomes.forEach((n) => a.colecoes.add(n));
    else if (TODAS_AS_PESSOAS.includes(item.tipo)) {
      // `Pessoa` atravessa os papéis; um papel específico só vale no seu campo.
      if (item.tipo === 'Pessoa' || item.tipo === 'Autor') nomes.forEach((n) => a.autores.add(n));
      if (item.tipo === 'Pessoa' || item.tipo === 'Orientador') nomes.forEach((n) => a.orientadores.add(n));
      if (item.tipo === 'Pessoa' || item.tipo === 'Co-orientador') nomes.forEach((n) => a.coorientadores.add(n));
    }
  }
  return a;
}

/** O documento pertence a pelo menos um dos itens do recorte. */
function pertence(d: Documento, a: Alvos): boolean {
  if (a.titulos.size && d.titulo && a.titulos.has(chave(d.titulo))) return true;
  if (a.colecoes.size && d.programa_origem && a.colecoes.has(chave(d.programa_origem))) return true;
  if (a.orientadores.size && d.orientador && a.orientadores.has(chave(d.orientador))) return true;
  if (a.macrotemas.size && d.macrotema && a.macrotemas.has(chave(d.macrotema))) return true;
  if (a.autores.size && d.autores?.some((n) => n && a.autores.has(chave(n)))) return true;
  if (a.coorientadores.size && d.co_orientadores?.some((n) => n && a.coorientadores.has(chave(n)))) return true;
  if (a.palavras.size && d.palavras_chave?.some((n) => n && a.palavras.has(chave(n)))) return true;
  return false;
}

/**
 * Restringe a base aos documentos do recorte. Recorte vazio devolve o mesmo
 * array — sem recorte, a análise é das coleções inteiras.
 */
export function recortarDocs(docs: readonly Documento[], recorte: readonly ItemRecorte[]): Documento[] {
  if (!recorte.length) return docs as Documento[];
  const alvos = alvosDe(recorte);
  return (docs as Documento[]).filter((d) => pertence(d, alvos));
}

export const mesmoRecorte = (a: readonly ItemRecorte[], b: readonly ItemRecorte[]): boolean =>
  a.length === b.length && a.every((x) => b.some((y) => y.tipo === x.tipo && chave(y.nome) === chave(x.nome)));

/** Rótulo curto do recorte, para cabeçalhos e status. */
export function resumoRecorte(recorte: readonly ItemRecorte[]): string {
  const itens = recorte.filter((i) => i.tipo !== 'Coleção');
  if (!itens.length) return '';
  if (itens.length === 1) return `${itens[0].tipo.toLowerCase()} “${itens[0].nome}”`;
  return `${itens.length} itens selecionados`;
}

const TIPOS: readonly TipoRecorte[] = ['Documento', 'Pessoa', 'Autor', 'Orientador', 'Co-orientador', 'Palavra-chave', 'Macrotema', 'Coleção'];
/** Teto defensivo: o recorte volta do armazenamento do navegador a cada carga. */
const MAX_ITENS = 200;
const MAX_GRAFIAS = 50;

/** Aceita só o que está bem formado; valores gravados por outra versão não derrubam a sessão. */
export function validarRecorte(valor: unknown): ItemRecorte[] {
  if (!Array.isArray(valor)) return [];
  const saida: ItemRecorte[] = [];
  for (const bruto of valor.slice(0, MAX_ITENS)) {
    if (!bruto || typeof bruto !== 'object') continue;
    const { tipo, nome, grafias } = bruto as ItemRecorte;
    if (typeof nome !== 'string' || !nome.trim() || !TIPOS.includes(tipo)) continue;
    const validas = Array.isArray(grafias)
      ? [...new Set(grafias.filter((g): g is string => typeof g === 'string' && !!g.trim()))].slice(0, MAX_GRAFIAS)
      : undefined;
    saida.push(validas?.length ? { tipo, nome, grafias: validas } : { tipo, nome });
  }
  return saida;
}
