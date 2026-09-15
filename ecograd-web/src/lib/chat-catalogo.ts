/**
 * Ferramentas do chat sobre o catálogo global — o que dá para responder na tela
 * inicial, antes de carregar coleção alguma.
 *
 * O catálogo (`scripts/busca-index.mjs`, 5,3 MB) traz 254.867 itens com o tipo,
 * quantos registros cada um reúne e em que coleções está. Isso responde muito:
 * existência, papéis de uma pessoa, ranking de orientação, quais coleções
 * guardam um tema. E não responde uma coisa importante: **nada do que está só no
 * texto do resumo**, porque o catálogo indexa rótulos.
 *
 * Essa fronteira é a razão de cada ferramenta aqui devolver `ressalva` e
 * `colecoesParaCarregar`: a resposta na tela inicial diz o que sabe, declara o
 * que não alcança e oferece carregar o recorte para continuar com profundidade
 * total — onde as ferramentas de `chat-ferramentas.ts` assumem.
 *
 * Importa por caminho relativo: os testes compilam com um tsconfig que não
 * resolve o atalho `@/`.
 */
import { buscarNoAcervo, MAX_COLECOES_POR_ITEM, type BuscaPreparada, type IndiceBusca, type ResultadoBusca } from './busca-global';
import { chaveBusca, correspondeBusca } from './utils';
import { PAPEIS_PESSOA, type PapelPessoa, type TipoBusca } from '../types';
import type { Contagem } from './chat-ferramentas';

/** Teto de itens que uma resposta examina; o restante entra como omitido. */
const MAX_ITENS = 40;

const normalizar = (s: string) => chaveBusca(s).replace(/\s+/g, ' ').trim();

export interface Panorama {
  colecoes: number;
  itens: number;
  porTipo: Contagem[];
  /** O catálogo conta rótulos distintos, não trabalhos. */
  unidade: 'itens distintos no catálogo, não trabalhos';
}
/** O que existe no acervo, em rótulos. Serve para situar quem acaba de chegar. */
export function panoramaDoCatalogo(indice: IndiceBusca): Panorama {
  const por = new Map<string, number>();
  for (const [, tipo] of indice.itens) {
    const t = indice.tipos[tipo];
    if (t) por.set(t, (por.get(t) ?? 0) + 1);
  }
  return {
    colecoes: indice.colecoes.length,
    itens: indice.itens.length,
    porTipo: [...por].sort((a, b) => b[1] - a[1]),
    unidade: 'itens distintos no catálogo, não trabalhos',
  };
}

/**
 * Ranking de um tipo por registros — "quem mais orienta" respondido sobre o
 * acervo inteiro, sem carregar nada. Atenção ao escopo: inclui orientação de
 * TCC, então o ranking difere do que sai só da pós-graduação.
 */
export function topDoTipo(indice: IndiceBusca, tipo: TipoBusca, limite = 10) {
  const t = indice.tipos.indexOf(tipo);
  const itens = t < 0 ? [] : indice.itens
    .filter(([, ti]) => ti === t)
    .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limite)
    .map(([nome, , registros, cols]): ItemCatalogo => ({ nome, tipo, registros, colecoes: cols.length }));
  return { tipo, ranking: itens, escopo: 'acervo inteiro, graduação e pós-graduação', unidade: 'registros por grafia' as const };
}

export interface ItemCatalogo { nome: string; tipo: TipoBusca; registros: number; colecoes: number }
const paraItem = (r: ResultadoBusca): ItemCatalogo => ({ nome: r.nome, tipo: r.tipo, registros: r.registros, colecoes: r.colecoes.length });

/** Coleções a carregar para um conjunto de itens, sem repetir e com teto. */
export function colecoesParaCarregar(itens: readonly ResultadoBusca[], limite = MAX_COLECOES_POR_ITEM) {
  const porNome = new Map<string, { nome: string; catalogo: 'ppg' | 'tcc'; registros: number }>();
  for (const item of itens) {
    for (const c of item.colecoes) {
      const atual = porNome.get(c.nome);
      if (atual) atual.registros += item.registros;
      else porNome.set(c.nome, { ...c, registros: item.registros });
    }
  }
  // As maiores primeiro: se houver teto, o recorte carregado é o mais informativo.
  const ordenadas = [...porNome.values()].sort((a, b) => b.registros - a.registros);
  const escolhidas = ordenadas.slice(0, limite);
  return {
    programas: escolhidas.filter((c) => c.catalogo === 'ppg').map((c) => c.nome),
    cursosTcc: escolhidas.filter((c) => c.catalogo === 'tcc').map((c) => c.nome),
    omitidas: Math.max(0, ordenadas.length - escolhidas.length),
    total: ordenadas.length,
  };
}

export interface PessoaNoCatalogo {
  consulta: string;
  encontrada: boolean;
  porPapel: Record<PapelPessoa, number>;
  grafias: ItemCatalogo[];
  registrosSomados: number;
  colecoesParaCarregar: ReturnType<typeof colecoesParaCarregar>;
  ressalva: string;
  /** Itens crus do catálogo: é o que a ação de abrir ou carregar recebe. */
  resultados: ResultadoBusca[];
}
/**
 * Uma pessoa vista pelo catálogo: os papéis e quantos registros em cada um.
 *
 * `registrosSomados` é teto, não total: quem é autora e orientadora do mesmo
 * trabalho aparece nos dois papéis, e daqui não se sabe se houve sobreposição.
 * O número exato exige o recorte carregado — é o que a ressalva diz.
 */
export function pessoaNoCatalogo(preparada: BuscaPreparada, nome: string, limite = MAX_ITENS): PessoaNoCatalogo {
  const alvo = normalizar(nome);
  const achados = alvo.length < 2 ? [] : buscarNoAcervo(preparada, nome, limite)
    .filter((r) => (PAPEIS_PESSOA as readonly string[]).includes(r.tipo) && correspondeBusca(r.nome, nome));
  const porPapel: Record<PapelPessoa, number> = { Autor: 0, Orientador: 0, 'Co-orientador': 0 };
  for (const r of achados) porPapel[r.tipo as PapelPessoa] += r.registros;
  const somados = achados.reduce((s, r) => s + r.registros, 0);
  return {
    consulta: nome,
    encontrada: achados.length > 0,
    porPapel,
    grafias: achados.map(paraItem),
    registrosSomados: somados,
    colecoesParaCarregar: colecoesParaCarregar(achados),
    resultados: achados,
    ressalva: 'Soma dos papéis: um mesmo trabalho pode contar em dois papéis. O total de trabalhos distintos exige carregar o recorte.',
  };
}

export interface TemaNoCatalogo {
  consulta: string;
  /** Rótulos que casam, por tipo, do mais frequente ao menos. */
  palavrasChave: ItemCatalogo[];
  macrotemas: ItemCatalogo[];
  documentos: ItemCatalogo[];
  registrosPorRotulo: number;
  colecoesParaCarregar: ReturnType<typeof colecoesParaCarregar>;
  ressalva: string;
  itensOmitidos: number;
  /** Itens crus do catálogo: é o que a ação de carregar o recorte recebe. */
  resultados: ResultadoBusca[];
}
/**
 * Um tema visto pelo catálogo. Reúne as palavras-chave, os macrotemas e os
 * títulos que casam com a consulta e diz em que coleções estão.
 *
 * Aqui mora o limite mais importante da tela inicial: em empreendedorismo
 * feminino, os rótulos do catálogo alcançam uma fração dos trabalhos, porque
 * dez dos trinta e um só mencionam o tema no corpo do resumo. A ressalva diz
 * isso com número e a resposta oferece carregar o recorte.
 */
export function temaNoCatalogo(preparada: BuscaPreparada, consulta: string, limite = MAX_ITENS): TemaNoCatalogo {
  const achados = normalizar(consulta).length < 2 ? [] : buscarNoAcervo(preparada, consulta, limite + 1);
  const usados = achados.slice(0, limite);
  const doTipo = (tipo: TipoBusca) => usados.filter((r) => r.tipo === tipo).map(paraItem);
  const rotulos = usados.filter((r) => r.tipo === 'Palavra-chave' || r.tipo === 'Macrotema');
  return {
    consulta,
    palavrasChave: doTipo('Palavra-chave'),
    macrotemas: doTipo('Macrotema'),
    documentos: doTipo('Documento'),
    registrosPorRotulo: rotulos.reduce((s, r) => s + r.registros, 0),
    colecoesParaCarregar: colecoesParaCarregar(usados),
    resultados: usados,
    ressalva: 'O catálogo indexa rótulos: título, palavra-chave e macrotema. Trabalhos que só mencionam o tema no corpo do resumo não aparecem aqui e exigem carregar o recorte.',
    itensOmitidos: Math.max(0, achados.length - usados.length),
  };
}

/** Existe algo com este nome? Resposta curta, para pergunta de existência. */
export function existeNoCatalogo(preparada: BuscaPreparada, consulta: string, limite = 10) {
  const achados = normalizar(consulta).length < 2 ? [] : buscarNoAcervo(preparada, consulta, limite);
  return {
    consulta,
    existe: achados.length > 0,
    itens: achados.map(paraItem),
    colecoesParaCarregar: colecoesParaCarregar(achados),
    resultados: achados,
  };
}

export const FERRAMENTAS_CATALOGO = {
  panorama_do_catalogo: (p: BuscaPreparada) => panoramaDoCatalogo(p.indice),
  top_do_tipo: (p: BuscaPreparada, a: { tipo: TipoBusca; limite?: number }) => topDoTipo(p.indice, a.tipo, a.limite),
  pessoa_no_catalogo: (p: BuscaPreparada, a: { nome: string; limite?: number }) => pessoaNoCatalogo(p, a.nome, a.limite),
  tema_no_catalogo: (p: BuscaPreparada, a: { consulta: string; limite?: number }) => temaNoCatalogo(p, a.consulta, a.limite),
  existe_no_catalogo: (p: BuscaPreparada, a: { consulta: string; limite?: number }) => existeNoCatalogo(p, a.consulta, a.limite),
} as const;

export type NomeFerramentaCatalogo = keyof typeof FERRAMENTAS_CATALOGO;

export function executarFerramentaCatalogo(nome: NomeFerramentaCatalogo, preparada: BuscaPreparada, argumentos?: Record<string, unknown>): unknown {
  const f = FERRAMENTAS_CATALOGO[nome];
  if (!f) throw new Error(`Ferramenta de catálogo desconhecida: ${String(nome)}`);
  return (f as (p: BuscaPreparada, a: Record<string, unknown>) => unknown)(preparada, argumentos ?? {});
}
