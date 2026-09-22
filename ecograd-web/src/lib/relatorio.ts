/**
 * Modelo do relatório em PDF: o que existe no documento, antes de virar papel.
 *
 * Três camadas separadas de propósito. Aqui fica o **modelo** — blocos puros,
 * sem jsPDF e sem React, que o teste consegue exercitar. `services/relatorio`
 * monta esses blocos lendo a análise carregada, e `lib/relatorio-pdf` os
 * desenha. Trocar a biblioteca de PDF não toca no conteúdo, e mudar o conteúdo
 * não toca no desenho.
 */
import type { TipoBusca } from '@/types';

export type Bloco =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'paragrafo'; texto: string }
  /** Texto miúdo e cinza: ressalvas, critérios, contagens de corte. */
  | { tipo: 'nota'; texto: string }
  /** Texto de modelo de linguagem, desenhado dentro da tarja de aviso. */
  | { tipo: 'ia'; texto: string }
  | { tipo: 'indicadores'; itens: ReadonlyArray<{ rotulo: string; valor: string }> }
  | { tipo: 'tabela'; titulo: string; colunas: readonly string[]; linhas: ReadonlyArray<readonly string[]>; nota?: string }
  | { tipo: 'imagem'; dataUrl: string; alt: string; proporcao: number }
  | { tipo: 'pagina' };

export interface Relatorio {
  /** Vai para os metadados do PDF e para o topo da capa. */
  titulo: string;
  arquivo: string;
  capa: readonly Bloco[];
  corpo: readonly Bloco[];
}

export interface SecaoRelatorio {
  id: string;
  rotulo: string;
  descricao: string;
  /** Conteúdo escrito por modelo de linguagem: nunca vem marcado por padrão. */
  ia?: boolean;
}

/**
 * Seções do Dashboard, na ordem em que aparecem na tela e no PDF.
 *
 * A granularidade é a seção, e não o bloco: marcar "Destaques do Ecossistema"
 * leva os quatro rankings, a genealogia e o diagrama junto.
 */
export const SECOES_DASHBOARD: readonly SecaoRelatorio[] = [
  { id: 'indicadores', rotulo: 'Indicadores gerais', descricao: 'Contagens do recorte e cobertura dos metadados.' },
  { id: 'destaques', rotulo: 'Destaques do Ecossistema', descricao: 'Rankings por volume, genealogia, intermediação e diagrama radial.' },
  { id: 'trabalhos', rotulo: 'Trabalhos', descricao: 'A tabela de trabalhos, com o filtro e a ordenação da tela.' },
  { id: 'relacoes', rotulo: 'Relações em destaque', descricao: 'Temas e orientadores mais frequentes no recorte.' },
  { id: 'cobertura', rotulo: 'Cobertura de metadados por ano', descricao: 'Preenchimento de cada campo por ano e volume de registros.' },
  { id: 'colecoes', rotulo: 'Comparar coleções', descricao: 'Volumes e cobertura lado a lado, quando há mais de uma coleção.' },
  { id: 'sintese-ia', rotulo: 'Síntese por IA (Ficha Técnica)', descricao: 'Texto escrito por modelo de linguagem a partir do recorte.', ia: true },
];

/** Chave estável de um dossiê na seleção. `\u0000` não ocorre em nome nem título. */
const SEP = '\u0000';
export const chaveDossie = (tipo: TipoBusca, termo: string) => `${tipo}${SEP}${termo}`;
export function lerChaveDossie(chave: string): { tipo: TipoBusca; termo: string } | null {
  const corte = chave.indexOf(SEP);
  if (corte < 0) return null;
  return { tipo: chave.slice(0, corte) as TipoBusca, termo: chave.slice(corte + 1) };
}

export type TemaRelatorio = 'claro' | 'escuro';

/**
 * Em que forma o relatório sai.
 *
 * O PDF é o documento para ler e circular; o JSON é o mesmo conteúdo para
 * reprocessar, e leva junto os registros completos da análise — com resumo e
 * palavras-chave, como na base de origem. Um gráfico não sobrevive à travessia:
 * no JSON vão as tabelas que o sustentam, e o nome da figura omitida.
 */
export const FORMATOS_RELATORIO = ['pdf', 'json'] as const;
export type FormatoRelatorio = typeof FORMATOS_RELATORIO[number];

export interface SelecaoRelatorio {
  dashboard: readonly string[];
  /** Chaves de `chaveDossie`. */
  dossies: readonly string[];
  tema: TemaRelatorio;
  formato: FormatoRelatorio;
  /**
   * Resumos e artefatos da ontologia no JSON. Ligado por padrão — é o que
   * "dados completos" quer dizer —, mas desligável: num acervo grande os
   * resumos respondem pela maior parte do arquivo.
   */
  incluirResumos: boolean;
}

/** Nada marcado por padrão significaria um PDF vazio; o útil é o oposto. */
export function selecaoInicial(): SelecaoRelatorio {
  return {
    dashboard: SECOES_DASHBOARD.filter((s) => !s.ia).map((s) => s.id),
    dossies: [],
    tema: 'claro',
    formato: 'pdf',
    incluirResumos: true,
  };
}

/** Só o que é seção de verdade sobrevive: a seleção volta da sessão como `unknown`. */
export function selecaoValida(valor: unknown): SelecaoRelatorio {
  const padrao = selecaoInicial();
  if (!valor || typeof valor !== 'object') return padrao;
  const v = valor as Partial<Record<keyof SelecaoRelatorio, unknown>>;
  const ids = new Set(SECOES_DASHBOARD.map((s) => s.id));
  return {
    dashboard: Array.isArray(v.dashboard) ? SECOES_DASHBOARD.map((s) => s.id).filter((id) => (v.dashboard as unknown[]).includes(id) && ids.has(id)) : padrao.dashboard,
    dossies: Array.isArray(v.dossies) ? (v.dossies as unknown[]).filter((d): d is string => typeof d === 'string' && lerChaveDossie(d) !== null) : [],
    tema: v.tema === 'escuro' ? 'escuro' : 'claro',
    formato: v.formato === 'json' ? 'json' : 'pdf',
    incluirResumos: v.incluirResumos !== false,
  };
}

/**
 * Seleção que não produziria nada.
 *
 * Vale só para o PDF: sem seção marcada ele sairia com capa e mais nada. O JSON
 * ainda entrega os registros completos da análise, que não dependem de seção
 * nenhuma — por isso não fica vazio.
 */
export const selecaoVazia = (s: SelecaoRelatorio) =>
  s.formato === 'pdf' && s.dashboard.length === 0 && s.dossies.length === 0;

export interface ContextoCapa {
  colecoes: readonly string[];
  registros: number;
  periodo: string;
  baseVersao: string;
  geradoEm: Date;
}

/** Data e hora local, legíveis sem depender da configuração do leitor de PDF. */
export const carimboDeData = (d: Date) =>
  `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

export const nomeDoArquivo = (d: Date, formato: FormatoRelatorio = 'pdf') =>
  `ecograd-relatorio-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.${formato}`;

/**
 * Ressalvas que acompanham todo relatório.
 *
 * Não são desmarcáveis, como em toda exportação do EcoGrad: um PDF circula
 * solto, longe da tela que explica o que os números são e o que não são.
 */
export const LIMITES_DO_RELATORIO = [
  'Este relatório descreve o recorte local carregado no EcoGrad, e não toda a produção da instituição. A ausência de um registro aqui não comprova ausência no repositório.',
  'Os dados vêm do Repositório Institucional da UFSC. O EcoGrad reorganiza metadados; não produz dado novo e não confere o texto integral dos trabalhos.',
  'Registros não equivalem a trabalhos únicos: nenhuma deduplicação científica foi aplicada. Contagens de nomes são contagens de grafias, não de pessoas — homônimos colapsam e variações da mesma pessoa contam separado.',
  'Indicadores e métricas de rede descrevem a estrutura observada. Não medem qualidade, mérito, produtividade nem disponibilidade para orientação.',
  'A data da coleta não está informada na base. Filtros de apresentação mudam o que aparece, nunca os cálculos.',
];

export function blocosDaCapa(c: ContextoCapa): Bloco[] {
  const colecoes = c.colecoes.length ? c.colecoes.join('; ') : 'Nenhuma coleção identificada';
  return [
    { tipo: 'titulo', texto: 'EcoGrad · Relatório da análise' },
    { tipo: 'indicadores', itens: [
      { rotulo: 'Registros carregados', valor: c.registros.toLocaleString('pt-BR') },
      { rotulo: 'Período observado', valor: c.periodo },
      { rotulo: 'Coleções', valor: String(c.colecoes.length) },
      { rotulo: 'Versão da base', valor: c.baseVersao || 'não informada' },
    ] },
    { tipo: 'subtitulo', texto: 'Coleções da análise' },
    { tipo: 'paragrafo', texto: colecoes },
    { tipo: 'subtitulo', texto: 'Limites desta leitura' },
    ...LIMITES_DO_RELATORIO.map((texto): Bloco => ({ tipo: 'nota', texto })),
    { tipo: 'nota', texto: `Gerado em ${carimboDeData(c.geradoEm)} pelo EcoGrad · Ecologia do Conhecimento · UFSC.` },
  ];
}

/** Linhas de uma tabela já consultada, convertidas para texto do PDF. */
export function linhasDeTabela(
  linhas: ReadonlyArray<Record<string, unknown>>,
  colunas: ReadonlyArray<{ chave: string; rotulo: string }>,
  formatar: (v: unknown) => string,
): { colunas: string[]; linhas: string[][] } {
  return {
    colunas: colunas.map((c) => c.rotulo),
    linhas: linhas.map((l) => colunas.map((c) => formatar(l[c.chave]))),
  };
}

/**
 * Dossiês que o usuário visitou nesta análise, para o modal oferecer.
 *
 * O aberto agora encabeça a lista — é o que ele tem em mente ao exportar.
 */
export function dossiesVisitados(
  visits: ReadonlyArray<{ page: string; context: { buscaTipo: string; buscaTermo: string | null } }>,
  atual: { tipo: TipoBusca; termo: string | null },
): Array<{ chave: string; tipo: TipoBusca; termo: string }> {
  const vistos = new Map<string, { chave: string; tipo: TipoBusca; termo: string }>();
  const juntar = (tipo: TipoBusca, termo: string | null) => {
    if (termo === null) return;
    const chave = chaveDossie(tipo, termo);
    if (!vistos.has(chave)) vistos.set(chave, { chave, tipo, termo });
  };
  if (atual.termo !== null) juntar(atual.tipo, atual.termo);
  for (const v of visits) {
    if (v.page === 'busca') juntar(v.context.buscaTipo as TipoBusca, v.context.buscaTermo);
  }
  return [...vistos.values()];
}
