/**
 * Ferramentas determinísticas do chat — a metade da resposta que não pode errar.
 *
 * Toda pergunta de contagem, série, ranking, papel ou identidade é respondida
 * aqui, por varredura do recorte carregado, e não pelo modelo de linguagem. A
 * decisão D2 do ADR 001 existe por causa disso: busca por similaridade devolve
 * os k mais parecidos e jamais um total, então deixar contagem por conta dela
 * produz número errado com aparência de certeza.
 *
 * Nada aqui chama rede, nada depende de provedor e nada guarda estado: são
 * funções sobre `Documento[]` e os índices invertidos que a aplicação já monta.
 * A camada de síntese recebe estes objetos e só escreve texto em cima deles.
 *
 * Importa por caminho relativo de propósito: os testes compilam com um tsconfig
 * próprio que não resolve o atalho `@/`.
 */
import { chaveBusca, correspondeBusca } from './utils';
import { PAPEIS_PESSOA, type Documento, type IndicesInvertidos, type PapelPessoa } from '../types';

/**
 * Abaixo deste tamanho o resumo não sustenta leitura nem busca semântica. O
 * mesmo limite vale em `scripts/afericao-gabaritos.mjs`; o executor da aferição
 * compara as duas contas e acusa se um dos lados mudar sozinho.
 */
export const RESUMO_MINIMO = 200;
export const resumoUtilizavel = (d: Documento) => String(d.resumo ?? '').trim().length >= RESUMO_MINIMO;

/** Rótulo e quantos registros ele reúne. */
export type Contagem = [rotulo: string, registros: number];

export interface ItemRecorte {
  titulo: string;
  ano: number | null;
  colecao: string;
  nivel: string;
  url: string;
  /** Só aparece pelo texto do resumo: a busca por rótulo do EcoGrad não o alcança. */
  somenteNoResumo?: boolean;
}

/**
 * O que a resposta mostra antes de qualquer síntese: o recorte verificável.
 * `registros` e `trabalhosDistintos` são separados porque o acervo cataloga o
 * mesmo trabalho em mais de uma coleção — apresentar um como o outro infla a
 * contagem, e é a falha mais fácil de cometer aqui.
 */
export interface Recorte {
  registros: number;
  trabalhosDistintos: number;
  semResumoUtilizavel: number;
  colecoes: Contagem[];
  niveis: Contagem[];
  macrotemas: Contagem[];
  serieAnual: Contagem[];
  /** Último ano cuja coleta parece incompleta; a resposta precisa declarar isso. */
  anoEmColeta: number | null;
  itens: ItemRecorte[];
  itensOmitidos: number;
}

export interface BaseChat {
  docs: readonly Documento[];
  indices: IndicesInvertidos;
}

const ITENS_PADRAO = 25;
const normalizar = (s: unknown) => chaveBusca(String(s ?? '')).replace(/\s+/g, ' ').trim();
const anoDe = (d: Documento) => (typeof d.ano === 'number' && Number.isFinite(d.ano) ? d.ano : null);

function agrupar(docs: readonly Documento[], campo: (d: Documento) => string | null | undefined): Contagem[] {
  const por = new Map<string, number>();
  for (const d of docs) {
    const v = campo(d);
    if (v) por.set(v, (por.get(v) ?? 0) + 1);
  }
  return [...por].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
}

const serieAnual = (docs: readonly Documento[]): Contagem[] =>
  agrupar(docs, (d) => (anoDe(d) === null ? null : String(anoDe(d)))).sort((a, b) => Number(a[0]) - Number(b[0]));

/**
 * Detecta o ano final ainda em coleta comparando-o com a mediana dos três
 * anteriores. Sem isso o agente anuncia 531 trabalhos em 2026 como se fosse a
 * produção do ano fechado, quando 2025 teve 3.742 — a pergunta Q23 da aferição
 * existe para pegar exatamente esse erro.
 */
export function anoEmColeta(docs: readonly Documento[]): number | null {
  const serie = serieAnual(docs);
  if (serie.length < 4) return null;
  const [ultimoAno, ultimoTotal] = serie[serie.length - 1];
  const anteriores = serie.slice(-4, -1).map(([, n]) => n).sort((a, b) => a - b);
  const mediana = anteriores[1];
  return ultimoTotal < mediana * 0.4 ? Number(ultimoAno) : null;
}

export function montarRecorte(docs: readonly Documento[], limite = ITENS_PADRAO): Recorte {
  const titulos = new Set(docs.map((d) => normalizar(d.titulo)));
  return {
    registros: docs.length,
    trabalhosDistintos: titulos.size,
    semResumoUtilizavel: docs.filter((d) => !resumoUtilizavel(d)).length,
    colecoes: agrupar(docs, (d) => d.programa_origem),
    niveis: agrupar(docs, (d) => d.nivel_academico),
    macrotemas: agrupar(docs, (d) => d.macrotema),
    serieAnual: serieAnual(docs),
    anoEmColeta: anoEmColeta(docs),
    itens: docs.slice(0, limite).map(item),
    itensOmitidos: Math.max(0, docs.length - limite),
  };
}

const item = (d: Documento): ItemRecorte => ({ titulo: d.titulo, ano: anoDe(d), colecao: d.programa_origem, nivel: d.nivel_academico, url: d.url });

// ---------------------------------------------------------------- ferramentas

export interface Acervo {
  registros: number;
  comResumoUtilizavel: number;
  semResumoUtilizavel: number;
  niveis: Contagem[];
  colecoes: number;
  anoMin: number | null;
  anoMax: number | null;
  anoEmColeta: number | null;
}
/** Tamanho e cobertura do que está carregado. */
export function contarAcervo(docs: readonly Documento[]): Acervo {
  const anos = docs.map(anoDe).filter((a): a is number => a !== null);
  return {
    registros: docs.length,
    comResumoUtilizavel: docs.filter(resumoUtilizavel).length,
    semResumoUtilizavel: docs.filter((d) => !resumoUtilizavel(d)).length,
    niveis: agrupar(docs, (d) => d.nivel_academico),
    colecoes: new Set(docs.map((d) => d.programa_origem).filter(Boolean)).size,
    anoMin: anos.length ? Math.min(...anos) : null,
    anoMax: anos.length ? Math.max(...anos) : null,
    anoEmColeta: anoEmColeta(docs),
  };
}

/**
 * Recorte de uma coleção. Tenta igualdade normalizada antes de conter, porque a
 * mesma coleção aparece com e sem sufixo de identificador — "Programa de
 * Pós-Graduação em Educação" e "... (ID: 75514)" são a mesma no acervo.
 */
export function recorteDaColecao(docs: readonly Documento[], nome: string, limite = ITENS_PADRAO): Recorte {
  const alvo = normalizar(nome);
  if (!alvo) return montarRecorte([], limite);
  const exatos = docs.filter((d) => normalizar(d.programa_origem) === alvo);
  const achados = exatos.length ? exatos : docs.filter((d) => normalizar(d.programa_origem).includes(alvo));
  return montarRecorte(achados, limite);
}

/** Quem mais aparece num papel, contado por grafia — ver `grafiasDoPapel`. */
export function rankingDoPapel(indices: IndicesInvertidos, papel: PapelPessoa, limite = 10): Contagem[] {
  const mapa = mapaDoPapel(indices, papel);
  return [...mapa].map(([nome, docs]): Contagem => [nome, docs.length])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limite);
}

const mapaDoPapel = (indices: IndicesInvertidos, papel: PapelPessoa) =>
  papel === 'Autor' ? indices.por_autor : papel === 'Orientador' ? indices.por_orientador : indices.por_coorientador;

export interface DossiePessoa {
  nome: string;
  encontrada: boolean;
  papeis: PapelPessoa[];
  porPapel: Record<PapelPessoa, number>;
  grafiasNoRecorte: string[];
  recorte: Recorte;
}
/**
 * Pessoa reunida em todos os papéis. `recorte.registros` conta documentos, não
 * papéis: quem é autora e orientadora do mesmo trabalho entra uma vez. Somar
 * `porPapel` para anunciar total é o erro que a pergunta Q05 da aferição cobra.
 *
 * Casa por grafia contida, sem acento nem caixa, porque o acervo guarda nome em
 * ordem invertida ("Freire, Patricia De Sa") e quem pergunta escreve na ordem
 * direta. A unificação canônica de grafias distintas é outra camada (D11).
 */
export function dossiePessoa(indices: IndicesInvertidos, nome: string, limite = ITENS_PADRAO): DossiePessoa {
  const alvo = normalizar(nome);
  const grafias = alvo ? [...indices.por_pessoa.keys()].filter((g) => casaNome(g, alvo)) : [];
  const docs = new Set<Documento>();
  const papeis = new Set<PapelPessoa>();
  const porPapel: Record<PapelPessoa, number> = { Autor: 0, Orientador: 0, 'Co-orientador': 0 };
  for (const g of grafias) {
    for (const d of indices.por_pessoa.get(g) ?? []) docs.add(d);
    for (const p of indices.papeis_pessoa.get(g) ?? []) papeis.add(p);
    for (const p of PAPEIS_PESSOA) porPapel[p] += (mapaDoPapel(indices, p).get(g) ?? []).length;
  }
  return {
    nome, encontrada: grafias.length > 0,
    papeis: PAPEIS_PESSOA.filter((p) => papeis.has(p)),
    porPapel, grafiasNoRecorte: grafias,
    recorte: montarRecorte([...docs], limite),
  };
}

/** Todos os termos da consulta presentes na grafia, em qualquer ordem. */
const casaNome = (grafia: string, alvo: string) => correspondeBusca(grafia, alvo);

export interface BuscaTexto extends Recorte {
  consulta: string;
  /** `frase` casa a expressão inteira; sem ela, todos os termos em qualquer ordem. */
  frase: boolean;
  /** Quantos só são alcançáveis pelo resumo — a medida da lacuna da busca atual. */
  somenteNoResumo: number;
  alcancaveisPorRotulo: number;
}
/**
 * Busca léxica sobre título, palavras-chave, macrotema e resumo. Separa o que a
 * busca atual do EcoGrad já alcança (rótulos) do que só existe no corpo do
 * resumo: na aferição, 10 dos 31 trabalhos de empreendedorismo feminino estão
 * apenas no resumo, e é esse número que justifica o índice semântico.
 */
export function buscarNoTexto(docs: readonly Documento[], consulta: string, limite = ITENS_PADRAO, frase = false): BuscaTexto {
  const termos = consulta.trim();
  if (!termos) return { ...montarRecorte([], limite), consulta, frase, somenteNoResumo: 0, alcancaveisPorRotulo: 0 };
  // Duas semânticas com usos distintos: "gestão do conhecimento" como expressão
  // é um campo de pesquisa; como termos soltos, alcança qualquer gestão de
  // qualquer conhecimento e infla a contagem.
  const alvo = chaveBusca(termos);
  const casa = frase ? (texto: string) => chaveBusca(texto).includes(alvo) : (texto: string) => correspondeBusca(texto, termos);
  const rotulosDe = (d: Documento) => [d.titulo, d.palavras_chave.join(' '), d.macrotema].join(' ');
  const achados: { doc: Documento; porRotulo: boolean }[] = [];
  for (const d of docs) {
    const porRotulo = casa(rotulosDe(d));
    if (porRotulo || casa(d.resumo ?? '')) achados.push({ doc: d, porRotulo });
  }
  const recorte = montarRecorte(achados.map((a) => a.doc), limite);
  const porRotulo = achados.filter((a) => a.porRotulo).length;
  return {
    ...recorte,
    itens: recorte.itens.map((i, n) => (achados[n].porRotulo ? i : { ...i, somenteNoResumo: true })),
    consulta: termos,
    frase,
    alcancaveisPorRotulo: porRotulo,
    somenteNoResumo: achados.length - porRotulo,
  };
}

/**
 * Onde o termo vive. Palavra-chave vem de quem escreveu o trabalho e macrotema é
 * classificação automática da base: rótulos idênticos apontam conjuntos
 * diferentes, e a resposta precisa dizer de qual está falando.
 */
export function origemDoTermo(indices: IndicesInvertidos, termo: string) {
  const alvo = normalizar(termo);
  const somar = (mapa: Map<string, Documento[]>) => {
    let registros = 0;
    const grafias: string[] = [];
    for (const [k, docs] of mapa) if (normalizar(k) === alvo) { registros += docs.length; grafias.push(k); }
    return { registros, grafias };
  };
  return { termo, comoPalavraChave: somar(indices.por_palavra_chave), comoMacrotema: somar(indices.por_macrotema) };
}

/** Macrotemas mais frequentes. Sempre apresentados como classificação automática. */
export function topMacrotemas(indices: IndicesInvertidos, limite = 10) {
  const lista = [...indices.por_macrotema].map(([nome, docs]): Contagem => [nome, docs.length])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  return { distintos: lista.length, ranking: lista.slice(0, limite), origem: 'classificação automática da base (NMF)' as const };
}

/**
 * Grafias de um papel, e quantas colidem só por acento e caixa. Responder
 * "quantas pessoas orientam" com este número seria errado: são grafias, e o
 * total de pessoas depende da unificação canônica.
 */
export function grafiasDoPapel(indices: IndicesInvertidos, papel: PapelPessoa) {
  const grafias = [...mapaDoPapel(indices, papel).keys()];
  const por = new Map<string, number>();
  for (const g of grafias) por.set(normalizar(g), (por.get(normalizar(g)) ?? 0) + 1);
  return { papel, grafiasDistintas: grafias.length, colidemAoNormalizar: [...por.values()].filter((n) => n > 1).length, unidade: 'grafias, não pessoas' as const };
}

/** Todos os registros de um título — a mesma obra catalogada mais de uma vez. */
export function registrosDoTitulo(docs: readonly Documento[], titulo: string) {
  const alvo = normalizar(titulo);
  if (!alvo) return { titulo, registros: 0, trabalhosDistintos: 0, itens: [] as ItemRecorte[] };
  const exatos = docs.filter((d) => normalizar(d.titulo) === alvo);
  const achados = exatos.length ? exatos : docs.filter((d) => normalizar(d.titulo).includes(alvo));
  return {
    titulo, registros: achados.length,
    trabalhosDistintos: new Set(achados.map((d) => normalizar(d.titulo))).size,
    itens: achados.map(item),
  };
}

/** Quantos títulos do recorte aparecem em mais de um registro. */
export function titulosRepetidos(docs: readonly Documento[]) {
  const por = new Map<string, number>();
  for (const d of docs) { const k = normalizar(d.titulo); if (k) por.set(k, (por.get(k) ?? 0) + 1); }
  return { titulosRepetidos: [...por.values()].filter((n) => n > 1).length, titulosDistintos: por.size };
}

// ------------------------------------------------------------------ despacho

export const FERRAMENTAS = {
  contar_acervo: (b: BaseChat) => contarAcervo(b.docs),
  recorte_da_colecao: (b: BaseChat, a: { nome: string; limite?: number }) => recorteDaColecao(b.docs, a.nome, a.limite),
  serie_anual: (b: BaseChat) => ({ serie: serieAnual(b.docs), anoEmColeta: anoEmColeta(b.docs) }),
  ranking_do_papel: (b: BaseChat, a: { papel: PapelPessoa; limite?: number }) => ({ ranking: rankingDoPapel(b.indices, a.papel, a.limite), unidade: 'registros por grafia' }),
  dossie_pessoa: (b: BaseChat, a: { nome: string; limite?: number }) => dossiePessoa(b.indices, a.nome, a.limite),
  buscar_no_texto: (b: BaseChat, a: { consulta: string; limite?: number; frase?: boolean }) => buscarNoTexto(b.docs, a.consulta, a.limite, a.frase),
  origem_do_termo: (b: BaseChat, a: { termo: string }) => origemDoTermo(b.indices, a.termo),
  top_macrotemas: (b: BaseChat, a: { limite?: number }) => topMacrotemas(b.indices, a?.limite),
  grafias_do_papel: (b: BaseChat, a: { papel: PapelPessoa }) => grafiasDoPapel(b.indices, a.papel),
  registros_do_titulo: (b: BaseChat, a: { titulo: string }) => registrosDoTitulo(b.docs, a.titulo),
  titulos_repetidos: (b: BaseChat) => titulosRepetidos(b.docs),
} as const;

export type NomeFerramenta = keyof typeof FERRAMENTAS;
export const NOMES_FERRAMENTAS = Object.keys(FERRAMENTAS) as NomeFerramenta[];

/**
 * Ponto único de entrada: a camada de síntese e o executor da aferição chamam
 * por nome, sem conhecer a implementação de cada uma.
 */
export function executarFerramenta<N extends NomeFerramenta>(nome: N, base: BaseChat, argumentos?: Record<string, unknown>): unknown {
  const f = FERRAMENTAS[nome];
  if (!f) throw new Error(`Ferramenta desconhecida: ${String(nome)}`);
  return (f as (b: BaseChat, a: Record<string, unknown>) => unknown)(base, argumentos ?? {});
}
