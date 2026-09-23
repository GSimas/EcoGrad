/**
 * O relatório em JSON: o mesmo conteúdo do PDF, mais os registros completos.
 *
 * A terceira saída do modelo de `lib/relatorio`, ao lado do desenho em
 * `lib/relatorio-pdf`. Aqui nada é recalculado: os blocos chegam prontos de
 * `services/relatorio` e só mudam de forma — de sequência de desenho para
 * estrutura endereçável.
 *
 * Duas diferenças declaradas em relação ao PDF. Os gráficos não atravessam:
 * viram o nome da figura omitida, porque a tabela que os sustenta já está no
 * arquivo e uma imagem em base64 dentro de JSON não serve para reprocessar.
 * E os **registros completos** da análise vão junto — título, autores,
 * orientação, palavras-chave, macrotema, resumo e artefatos —, no mesmo formato
 * da base de origem, que é o que o PDF nunca poderia carregar.
 */
import type { Documento } from '@/types';
import {
  carimboDeData, LIMITES_DO_RELATORIO,
  type Bloco, type ContextoCapa, type Relatorio,
} from './relatorio';

/** Versão do formato do arquivo: quem consumir sabe contra o que programou. */
export const VERSAO_JSON = 1;

export interface TabelaJson {
  titulo: string;
  colunas: readonly string[];
  linhas: ReadonlyArray<readonly string[]>;
  nota?: string;
  /** Link de cada linha na coluna nomeada — o título aponta para a fonte do trabalho. */
  links?: { coluna: string; urls: ReadonlyArray<string | null> };
}

export interface SecaoJson {
  titulo: string;
  /** `capitulo` vem de um título de página do PDF; `secao`, de um subtítulo. */
  nivel: 'capitulo' | 'secao';
  paragrafos: string[];
  /** Ressalvas, critérios e contagens de corte — o texto miúdo do PDF. */
  notas: string[];
  /** Texto escrito por modelo de linguagem, separado para não se confundir. */
  textosDeIA: string[];
  indicadores: Array<{ rotulo: string; valor: string }>;
  tabelas: TabelaJson[];
  /** Gráficos que no PDF são imagem. Os dados deles estão em `tabelas`. */
  figurasOmitidas: string[];
}

export interface RelatorioJson {
  formato: 'ecograd-relatorio';
  versao: number;
  titulo: string;
  gerado: { em: string; carimbo: string; ferramenta: string };
  base: {
    versao: string;
    colecoes: readonly string[];
    registros: number;
    periodo: string;
    /** Itens que delimitam a análise dentro das coleções; vazio = coleções inteiras. */
    recorte: ReadonlyArray<{ tipo: string; nome: string }>;
  };
  limites: readonly string[];
  secoes: SecaoJson[];
  documentos: {
    /** O que cada registro traz, para quem lê o arquivo sem abrir o EcoGrad. */
    campos: readonly string[];
    resumosIncluidos: boolean;
    total: number;
    registros: ReadonlyArray<Record<string, unknown>>;
  };
}

const secaoVazia = (titulo: string, nivel: SecaoJson['nivel']): SecaoJson => ({
  titulo, nivel, paragrafos: [], notas: [], textosDeIA: [], indicadores: [], tabelas: [], figurasOmitidas: [],
});

/**
 * Agrupa a sequência plana de blocos em seções.
 *
 * O PDF é uma fita: título, parágrafo, tabela, subtítulo, tabela. Cada título
 * ou subtítulo abre uma seção, e tudo o que vem depois pertence a ela até o
 * próximo. Blocos antes do primeiro cabeçalho — se existirem — caem numa seção
 * sem título, em vez de sumirem.
 */
export function secoesDosBlocos(blocos: readonly Bloco[]): SecaoJson[] {
  const secoes: SecaoJson[] = [];
  let atual: SecaoJson | null = null;
  const garantir = () => {
    if (!atual) {
      atual = secaoVazia('', 'capitulo');
      secoes.push(atual);
    }
    return atual;
  };

  for (const b of blocos) {
    switch (b.tipo) {
      case 'titulo':
      case 'subtitulo':
        atual = secaoVazia(b.texto, b.tipo === 'titulo' ? 'capitulo' : 'secao');
        secoes.push(atual);
        break;
      case 'paragrafo': garantir().paragrafos.push(b.texto); break;
      case 'nota': garantir().notas.push(b.texto); break;
      case 'ia': garantir().textosDeIA.push(b.texto); break;
      case 'indicadores': garantir().indicadores.push(...b.itens); break;
      case 'tabela':
        garantir().tabelas.push({ titulo: b.titulo, colunas: [...b.colunas], linhas: b.linhas.map((l) => [...l]), ...(b.nota ? { nota: b.nota } : {}),
          ...(b.links ? { links: { coluna: b.colunas[b.links.coluna], urls: [...b.links.urls] } } : {}) });
        break;
      case 'imagem': garantir().figurasOmitidas.push(b.alt); break;
      // Quebra de página é instrução de desenho: não existe fora do papel.
      case 'pagina': break;
    }
  }
  return secoes;
}

/** Campos do registro, na ordem do schema da base. */
const CAMPOS_BASE = [
  'titulo', 'nivel_academico', 'ano', 'autores', 'orientador', 'co_orientadores',
  'palavras_chave', 'macrotema', 'programa_origem', 'url', 'resumo', 'pureza_nmf',
  'ontologia_ia', 'arquivos',
] as const;

/** Campos que só entram quando os resumos entram: são eles o peso do arquivo. */
const CAMPOS_PESADOS = new Set<string>(['resumo', 'ontologia_ia']);

/**
 * Registro exportado, com os nomes de campo da base de origem.
 *
 * Campos ausentes no documento não viram `null`: eles simplesmente não
 * aparecem, como na base. Quem lê distingue "não informado" de "vazio".
 */
export function registroExportado(d: Documento, incluirResumos: boolean): Record<string, unknown> {
  const registro: Record<string, unknown> = {};
  for (const campo of CAMPOS_BASE) {
    if (!incluirResumos && CAMPOS_PESADOS.has(campo)) continue;
    const valor = (d as unknown as Record<string, unknown>)[campo];
    if (valor === undefined) continue;
    if (typeof valor === 'string' && valor === '') continue;
    if (Array.isArray(valor) && valor.length === 0) continue;
    registro[campo] = valor;
  }
  return registro;
}

export const camposExportados = (incluirResumos: boolean): string[] =>
  CAMPOS_BASE.filter((c) => incluirResumos || !CAMPOS_PESADOS.has(c));

/**
 * Estimativa do tamanho do arquivo, em bytes.
 *
 * Serve ao aviso na tela, antes de a pessoa pedir o download: num acervo grande
 * o JSON passa de centenas de megabytes, e `JSON.stringify` de um objeto desse
 * porte derruba a aba. Soma os textos, que saem verbatim — resumo é a maior
 * parte —, e acrescenta o custo da estrutura: nomes de campo, pontuação e a
 * indentação, que num arquivo legível por humanos não é desprezível.
 */
export function estimarTamanho(docs: readonly Documento[], incluirResumos: boolean): number {
  /** Nomes de campo, chaves, vírgulas e a indentação do registro. */
  const POR_REGISTRO = 700;
  /** Cada item de lista ocupa uma linha própria, com o recuo dela. */
  const POR_ITEM_DE_LISTA = 24;
  let total = 4096;
  for (const d of docs) {
    const itens = d.autores.length + d.co_orientadores.length + d.palavras_chave.length + (d.arquivos?.length ?? 0) * 4;
    total += POR_REGISTRO + itens * POR_ITEM_DE_LISTA;
    total += d.titulo.length + d.autores.join('').length + d.palavras_chave.join('').length + d.co_orientadores.join('').length;
    if (incluirResumos) {
      total += (d.resumo?.length ?? 0);
      total += typeof d.ontologia_ia === 'string' ? d.ontologia_ia.length : d.ontologia_ia ? 200 : 0;
    }
  }
  return total;
}

/** Tamanho legível, para o aviso na tela. */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['kB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) { valor /= 1024; i += 1; }
  return `${valor.toFixed(valor >= 100 ? 0 : 1)} ${unidades[i]}`;
}

export function montarRelatorioJson(
  relatorio: Relatorio,
  contexto: ContextoCapa,
  docs: readonly Documento[],
  { incluirResumos, recorte }: { incluirResumos: boolean; recorte: ReadonlyArray<{ tipo: string; nome: string }> },
): RelatorioJson {
  return {
    formato: 'ecograd-relatorio',
    versao: VERSAO_JSON,
    titulo: relatorio.titulo,
    gerado: {
      em: contexto.geradoEm.toISOString(),
      carimbo: carimboDeData(contexto.geradoEm),
      ferramenta: 'EcoGrad · Ecologia do Conhecimento · UFSC',
    },
    base: {
      versao: contexto.baseVersao,
      colecoes: [...contexto.colecoes],
      registros: contexto.registros,
      periodo: contexto.periodo,
      recorte: recorte.map((i) => ({ tipo: i.tipo, nome: i.nome })),
    },
    // As mesmas ressalvas da capa do PDF: elas não são desmarcáveis em lugar
    // nenhum, e um arquivo circula ainda mais longe da tela que as explica.
    limites: LIMITES_DO_RELATORIO,
    secoes: secoesDosBlocos(relatorio.corpo),
    documentos: {
      campos: camposExportados(incluirResumos),
      resumosIncluidos: incluirResumos,
      total: docs.length,
      registros: docs.map((d) => registroExportado(d, incluirResumos)),
    },
  };
}
