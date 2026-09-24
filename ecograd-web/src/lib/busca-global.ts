/**
 * Busca da apresentação em todo o acervo, sem carregar coleções. Usa o catálogo
 * leve gerado por `scripts/busca-index.mjs`; só o item escolhido carrega dados.
 */
import type { TipoBusca } from '@/types';
import { carregarJsonGz } from './data-loader';
import { carregarManifestoColecoes } from './collection-loader';
import { chaveBusca, termosBusca, nivelBusca } from './utils';

export interface IndiceBusca {
  schema: 1;
  tipos: TipoBusca[];
  colecoes: Array<[nome: string, catalogo: 'ppg' | 'tcc']>;
  itens: Array<[nome: string, tipo: number, registros: number, colecoes: number[]]>;
}

export interface ResultadoBusca {
  nome: string;
  tipo: TipoBusca;
  registros: number;
  /** Da coleção com mais registros do item para a com menos. */
  colecoes: Array<{ nome: string; catalogo: 'ppg' | 'tcc' }>;
}

export interface BuscaPreparada {
  indice: IndiceBusca;
  chaves: string[];
}

/** Um item presente em muitas coleções carrega só as maiores; o resto fica em "Editar seleção". */
export const MAX_COLECOES_POR_ITEM = 8;

const CAMINHO = /^\/data\/busca-[a-f0-9]{64}\.json\.gz$/;

/**
 * Baixa, descomprime e valida o catálogo. É o trabalho pesado — ~5 MB
 * comprimidos, centenas de milhares de itens —, e por isso quem o chama é o
 * `busca.worker`; a página recebe o resultado por `services/indice-busca`.
 */
export async function carregarIndiceBusca(signal?: AbortSignal): Promise<IndiceBusca> {
  const manifest = await carregarManifestoColecoes(signal) as { busca?: { path?: unknown } };
  const path = manifest.busca?.path;
  if (typeof path !== 'string' || !CAMINHO.test(path)) throw new Error('A busca em todo o acervo está indisponível nesta versão da base.');
  const indice = await carregarJsonGz<IndiceBusca>(path, signal);
  if (indice?.schema !== 1 || !Array.isArray(indice.tipos) || !Array.isArray(indice.colecoes) || !Array.isArray(indice.itens)) {
    throw new Error('Catálogo de busca inválido.');
  }
  return indice;
}

/**
 * Chaves de busca já calculadas para um índice, por identidade do objeto.
 * `excecoes` guarda, para os poucos nomes com espaço nas pontas, a chave do
 * nome aparado; os demais têm as duas chaves iguais.
 */
interface ChavesProntas { chaves: string[]; excecoes: ReadonlyMap<number, string> }
const chavesProntas = new WeakMap<IndiceBusca, ChavesProntas>();

/** Normaliza cada nome uma vez, com a mesma regra que `termoDoAcervo` e `itensDaEntidade` aplicam. */
export function calcularChaves(indice: IndiceBusca): ChavesProntas {
  const chaves = new Array<string>(indice.itens.length);
  const excecoes = new Map<number, string>();
  for (let i = 0; i < indice.itens.length; i++) {
    const nome = indice.itens[i][0];
    chaves[i] = chaveBusca(nome);
    const aparado = nome.trim();
    if (aparado !== nome) excecoes.set(i, chaveBusca(aparado));
  }
  return { chaves, excecoes };
}

/** Associa ao índice as chaves que o worker já calculou, para ninguém normalizar de novo. */
export function registrarChaves(indice: IndiceBusca, prontas: ChavesProntas) {
  chavesProntas.set(indice, prontas);
}

/** `chaveBusca(nome.trim())` do item, sem refazer a normalização quando ela já existe. */
function chaveAparada(indice: IndiceBusca, prontas: ChavesProntas | undefined, i: number): string {
  return prontas ? prontas.excecoes.get(i) ?? prontas.chaves[i] : chaveBusca(indice.itens[i][0].trim());
}

/** Normaliza uma única vez; cada tecla depois só compara strings prontas. */
export function prepararBusca(indice: IndiceBusca): BuscaPreparada {
  return { indice, chaves: chavesProntas.get(indice)?.chaves ?? indice.itens.map(([nome]) => chaveBusca(nome)) };
}

/**
 * Posições cujas chaves contêm todos os termos, com o nível de cada uma.
 *
 * A checagem de presença vem antes e num laço simples: quase todas as chaves
 * falham nela, e só as que passam pagam o `nivelBusca` completo — que devolve
 * -1 exatamente quando falta algum termo, então o resultado é o mesmo.
 * `candidatos` restringe a varredura a um superconjunto conhecido das respostas.
 */
export function casarNoAcervo(chaves: readonly string[], termos: readonly string[], candidatos?: readonly number[]): Array<[nivel: number, i: number]> {
  const achados: Array<[nivel: number, i: number]> = [];
  const total = candidatos ? candidatos.length : chaves.length;
  proxima: for (let k = 0; k < total; k++) {
    const i = candidatos ? candidatos[k] : k;
    const chave = chaves[i];
    for (let t = 0; t < termos.length; t++) if (!chave.includes(termos[t])) continue proxima;
    achados.push([nivelBusca(chave, termos), i]);
  }
  return achados;
}

/** Ordem da busca: nível, depois mais registros, depois a posição no índice. */
export function ordenarAchados(indice: IndiceBusca, achados: Array<[nivel: number, i: number]>, limite: number): ResultadoBusca[] {
  achados.sort((a, b) => a[0] - b[0] || indice.itens[b[1]][2] - indice.itens[a[1]][2] || a[1] - b[1]);
  return achados.slice(0, limite).map(([, i]) => paraResultado(indice, i));
}

/**
 * Sem acento e sem caixa, e com os termos em qualquer ordem: "Demo Richard", "Demo"
 * e "Richard" acham "Souza, Richard Demo". A ordem segue `nivelBusca`; empates vão
 * para o item com mais registros.
 */
export function buscarNoAcervo({ indice, chaves }: BuscaPreparada, consulta: string, limite = 50): ResultadoBusca[] {
  const termos = termosBusca(consulta);
  if (termos.join('').length < 2) return [];
  return ordenarAchados(indice, casarNoAcervo(chaves, termos), limite);
}

function paraResultado(indice: IndiceBusca, i: number): ResultadoBusca {
  const [nome, tipo, registros, cols] = indice.itens[i];
  return { nome, tipo: indice.tipos[tipo], registros, colecoes: cols.map((c) => ({ nome: indice.colecoes[c][0], catalogo: indice.colecoes[c][1] })) };
}

/**
 * O item do acervo que corresponde a um termo solto, sem saber o tipo dele.
 *
 * As nuvens de palavras não sabem o que cada termo é: o mesmo desenho mistura
 * palavras-chave declaradas e palavras isoladas de títulos e resumos. A busca é
 * tolerante a acento e caixa — a nuvem do acervo já traz os termos
 * normalizados, a do dossiê traz o que estava no texto — e prefere os tipos
 * temáticos, porque um termo que também é sobrenome de alguém quase sempre foi
 * clicado como tema.
 *
 * Devolve `null` quando o termo não existe no acervo. É essa ausência que
 * distingue a palavra que vale a pena abrir daquela que só aparece dentro de
 * um título.
 */
const PREFERENCIA_DE_TIPO: readonly TipoBusca[] = ['Palavra-chave', 'Macrotema', 'Documento', 'Orientador', 'Co-orientador', 'Autor'];

export function termoDoAcervo(indice: IndiceBusca, nome: string): ResultadoBusca | null {
  // Trim dos dois lados, como em `itemDoAcervo`: o índice de orientações remove
  // espaços nas pontas, e um termo clicado pode chegar com eles.
  const alvo = chaveBusca(nome.trim());
  if (!alvo) return null;
  const prontas = chavesProntas.get(indice);
  let melhor = -1;
  let melhorPeso = Number.POSITIVE_INFINITY;
  for (let i = 0; i < indice.itens.length; i += 1) {
    const [, t, registros] = indice.itens[i];
    if (chaveAparada(indice, prontas, i) !== alvo) continue;
    const preferencia = PREFERENCIA_DE_TIPO.indexOf(indice.tipos[t]);
    // Tipo preferido primeiro; entre iguais, o que cobre mais registros.
    const peso = (preferencia < 0 ? PREFERENCIA_DE_TIPO.length : preferencia) * 1e9 - registros;
    if (peso < melhorPeso) { melhorPeso = peso; melhor = i; }
  }
  return melhor < 0 ? null : paraResultado(indice, melhor);
}

/** O item exato do catálogo. Compara sem espaços nas pontas, que o índice de orientações remove. */
export function itemDoAcervo(indice: IndiceBusca, tipo: TipoBusca, nome: string): ResultadoBusca | null {
  const t = indice.tipos.indexOf(tipo);
  const alvo = nome.trim();
  const i = indice.itens.findIndex(([n, ti]) => ti === t && n.trim() === alvo);
  return i < 0 ? null : paraResultado(indice, i);
}

/** No índice cada papel é um item à parte; o dossiê de `Pessoa` reúne os três. */
const PAPEIS_DA_PESSOA: readonly TipoBusca[] = ['Autor', 'Orientador', 'Co-orientador'];

/**
 * Tudo o que o índice guarda sob uma entidade do dossiê — o caminho de volta do
 * recorte carregado para o acervo inteiro.
 *
 * Compara pela chave de busca, e não pelo texto exato: o índice guarda
 * palavras-chave normalizadas ("ostras"), e o dossiê mostra a grafia do
 * registro ("Ostras"). É a mesma comparação do recorte, então o que se acha
 * aqui é o que o recorte vai reter depois de carregar.
 */
export function itensDaEntidade(indice: IndiceBusca, tipo: TipoBusca, nome: string): ResultadoBusca[] {
  const alvo = chaveBusca(nome.trim());
  if (!alvo) return [];
  const tipos = new Set((tipo === 'Pessoa' ? PAPEIS_DA_PESSOA : [tipo]).map((t) => indice.tipos.indexOf(t)).filter((t) => t >= 0));
  const prontas = chavesProntas.get(indice);
  const achados: ResultadoBusca[] = [];
  for (let i = 0; i < indice.itens.length; i += 1) {
    const t = indice.itens[i][1];
    if (tipos.has(t) && chaveAparada(indice, prontas, i) === alvo) achados.push(paraResultado(indice, i));
  }
  return achados;
}

/** Coleções a carregar para abrir o item, separadas pelos dois catálogos. */
export function colecoesDoItem(item: ResultadoBusca, limite = MAX_COLECOES_POR_ITEM) {
  const escolhidas = item.colecoes.slice(0, limite);
  return {
    programas: escolhidas.filter((c) => c.catalogo === 'ppg').map((c) => c.nome),
    cursosTcc: escolhidas.filter((c) => c.catalogo === 'tcc').map((c) => c.nome),
    omitidas: Math.max(0, item.colecoes.length - limite),
  };
}
