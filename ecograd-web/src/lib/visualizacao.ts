import { correspondeBusca, termosBusca } from './utils';
/** Presentation only: never mutates scientific rows or recalculates metrics. */
/**
 * Filtro de uma coluna. `texto` casa sem acento nem caixa; `selecao` aceita só
 * os rótulos marcados; `faixa` e `igual` valem em colunas numéricas — a primeira
 * admite qualquer das pontas em aberto. `modo` ausente é inferido do que estiver
 * preenchido, para que filtros salvos em sessões antigas continuem valendo.
 */
export type ModoFiltro = 'texto' | 'selecao' | 'faixa' | 'igual';
export interface FiltroColuna {
  modo?: ModoFiltro;
  texto?: string;
  /** Rótulos exibidos que podem passar. Lista vazia não restringe nada. */
  valores?: string[];
  min?: number | null;
  max?: number | null;
  igual?: number | null;
}
export type FiltrosTabela = Record<string, FiltroColuna>;

export function modoDoFiltro(f: FiltroColuna): ModoFiltro {
  if (f.modo) return f.modo;
  if (f.valores?.length) return 'selecao';
  if (f.texto !== undefined) return 'texto';
  return 'faixa';
}

export interface ConsultaTabela {
  busca: string;
  coluna: string;
  direcao: 'asc' | 'desc';
  pagina: number;
  /** Por chave de coluna; ausente significa coluna sem filtro. */
  filtros?: FiltrosTabela;
}
export const consultaInicial: ConsultaTabela = { busca: '', coluna: '', direcao: 'asc', pagina: 0, filtros: {} };

/** Um filtro vazio não restringe nada e não deve contar como filtro ativo. */
export function filtroAtivo(f: FiltroColuna | undefined): boolean {
  if (!f) return false;
  switch (modoDoFiltro(f)) {
    case 'selecao': return Boolean(f.valores?.length);
    case 'texto': return Boolean(f.texto?.trim());
    case 'igual': return typeof f.igual === 'number' && Number.isFinite(f.igual);
    default: return [f.min, f.max].some((v) => typeof v === 'number' && Number.isFinite(v));
  }
}

/**
 * Se a coluna comporta os filtros numéricos. Exige que todo valor preenchido
 * seja número: uma coluna com textos misturados ordenaria por faixa de forma
 * enganosa.
 */
export function colunaNumerica(linhas: readonly Record<string, unknown>[], chave: string): boolean {
  let vistos = 0;
  for (const l of linhas) {
    const v = l[chave];
    if (v === null || v === undefined || v === '') continue;
    if (!Number.isFinite(numero(v))) return false;
    vistos += 1;
  }
  return vistos > 0;
}

/**
 * Texto da célula. Serve também de chave do filtro por seleção: a opção marcada
 * é exatamente o que se lê na tabela, sem o usuário precisar adivinhar o valor
 * bruto por trás da formatação.
 */
export function valorExibido(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return valorNumericoTabela(v);
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (v === null || v === undefined) return 'Não informado';
  const s = String(v);
  return s.trim() === '' ? 'Não informado' : s;
}

/**
 * Como a célula é lida. Uma coluna com formatação própria (um ano escrito sem
 * separador de milhar, por exemplo) informa a sua, para que a opção marcada no
 * filtro por seleção seja igual ao que está na tabela.
 */
export type RotulosColuna = Record<string, (linha: Record<string, unknown>) => string>;
export function rotuloDaCelula(linha: Record<string, unknown>, chave: string, rotulos?: RotulosColuna): string {
  const proprio = rotulos?.[chave]?.(linha);
  return typeof proprio === 'string' ? proprio : valorExibido(linha[chave]);
}

/** Valores distintos da coluna com quantas linhas cada um tem. */
export function valoresDaColuna(linhas: readonly Record<string, unknown>[], chave: string, rotulos?: RotulosColuna): { valor: string; contagem: number }[] {
  const por = new Map<string, { contagem: number; ordem: number }>();
  for (const l of linhas) {
    const rotulo = rotuloDaCelula(l, chave, rotulos);
    const atual = por.get(rotulo);
    if (atual) atual.contagem += 1;
    else por.set(rotulo, { contagem: 1, ordem: numero(l[chave]) });
  }
  // Número ordena por grandeza; texto, pela ordem alfabética do português.
  return [...por].map(([valor, d]) => ({ valor, contagem: d.contagem, ordem: d.ordem }))
    .sort((a, b) => (Number.isFinite(a.ordem) && Number.isFinite(b.ordem)
      ? a.ordem - b.ordem
      : a.valor.localeCompare(b.valor, 'pt-BR', { numeric: true, sensitivity: 'base' })))
    .map(({ valor, contagem }) => ({ valor, contagem }));
}

/**
 * Pontas da barra de faixa. `inteira` diz se a coluna só tem inteiros: numa
 * contagem, um passo fracionário faria a barra parar em 203,84 em vez de 204.
 */
export function extremosDaColuna(linhas: readonly Record<string, unknown>[], chave: string): { min: number; max: number; inteira: boolean } {
  let min = Infinity;
  let max = -Infinity;
  let inteira = true;
  for (const l of linhas) {
    const n = numero(l[chave]);
    if (!Number.isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
    if (!Number.isInteger(n)) inteira = false;
  }
  return Number.isFinite(min) ? { min, max, inteira } : { min: 0, max: 0, inteira: true };
}

/** Passo da barra: inteiro em contagens, centésimo do intervalo em medidas. */
export function passoDaFaixa(min: number, max: number, inteira: boolean): number {
  if (inteira) return 1;
  const bruto = (max - min) / 100;
  if (!(bruto > 0)) return 1;
  // Arredonda para a potência de dez mais próxima abaixo, para render valores legíveis.
  return 10 ** Math.floor(Math.log10(bruto));
}

export interface PerfilColuna {
  numerica: boolean;
  min: number;
  max: number;
  inteira: boolean;
  valores: { valor: string; contagem: number }[];
}
/**
 * Tudo que o menu de uma coluna precisa saber sobre os dados. Fica fora da
 * renderização da tabela de propósito: só é calculado quando alguém abre o menu.
 */
export function perfilDaColuna(linhas: readonly Record<string, unknown>[], chave: string, rotulos?: RotulosColuna): PerfilColuna {
  return { numerica: colunaNumerica(linhas, chave), ...extremosDaColuna(linhas, chave), valores: valoresDaColuna(linhas, chave, rotulos) };
}

/** Uma linha passa quando satisfaz TODOS os filtros de coluna ativos. */
export function passaNosFiltros(linha: Record<string, unknown>, filtros: FiltrosTabela | undefined, rotulos?: RotulosColuna): boolean {
  if (!filtros) return true;
  for (const [chave, filtro] of Object.entries(filtros)) {
    if (!filtroAtivo(filtro)) continue;
    const bruto = linha[chave];
    const modo = modoDoFiltro(filtro);
    if (modo === 'selecao') {
      if (!filtro.valores?.includes(rotuloDaCelula(linha, chave, rotulos))) return false;
      continue;
    }
    if (modo === 'texto') {
      if (!correspondeBusca(String(bruto ?? ''), filtro.texto ?? '')) return false;
      continue;
    }
    const n = numero(bruto);
    // Sem valor numérico a linha não pode satisfazer um filtro numérico.
    if (!Number.isFinite(n)) return false;
    if (modo === 'igual') {
      if (n !== filtro.igual) return false;
      continue;
    }
    if (typeof filtro.min === 'number' && Number.isFinite(filtro.min) && n < filtro.min) return false;
    if (typeof filtro.max === 'number' && Number.isFinite(filtro.max) && n > filtro.max) return false;
  }
  return true;
}
const numero = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
export function consultarLinhas<T extends Record<string, unknown>>(linhas: readonly T[], colunas: readonly string[], consulta: ConsultaTabela, rotulos?: RotulosColuna): T[] {
  const termos = termosBusca(consulta.busca);
  // Termos podem estar em colunas diferentes da mesma linha (ex.: sobrenome e ano).
  const result = linhas.filter((l) =>
    (!termos.length || correspondeBusca(colunas.map((c) => String(l[c] ?? '')).join(' '), termos))
    && passaNosFiltros(l, consulta.filtros, rotulos));
  if (!colunas.includes(consulta.coluna)) return result;
  return result.sort((a, b) => {
    const x = a[consulta.coluna], y = b[consulta.coluna];
    const vazioX = x == null || x === '' || typeof x === 'number' && !Number.isFinite(x);
    const vazioY = y == null || y === '' || typeof y === 'number' && !Number.isFinite(y);
    if (vazioX || vazioY) return Number(vazioX) - Number(vazioY);
    const nx = numero(x), ny = numero(y);
    const ordem = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
    return consulta.direcao === 'desc' ? -ordem : ordem;
  });
}
export function celulaCSV(v: unknown): string {
  let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Keep numbers numeric; prevent spreadsheet formula execution in text metadata.
  if (typeof v !== 'number' && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
export function pacoteExportacao(linhas: readonly Record<string, unknown>[], colunas: readonly { chave: string; rotulo: string }[], contexto: Record<string, unknown>) {
  return { formato: 'ecograd-visualizacao-v1', contexto, colunas: colunas.map(({ chave, rotulo }) => ({ chave, rotulo })), dados: linhas.map((l) => Object.fromEntries(colunas.map((c) => [c.chave, l[c.chave]]))) };
}
export function csvComContexto(pacote: ReturnType<typeof pacoteExportacao>): string {
  const meta = Object.entries(pacote.contexto);
  const headers = [...pacote.colunas.map((c) => c.rotulo), ...meta.map(([k]) => `Contexto: ${k}`)];
  return '\uFEFF' + [headers.map(celulaCSV).join(','), ...pacote.dados.map((l) => [...pacote.colunas.map((c) => l[c.chave]), ...meta.map(([, v]) => v)].map(celulaCSV).join(','))].join('\r\n');
}
/** Explicit allowlist: conversations, drafts, credentials and unrelated UI never enter exports. */
export function contextoPublicavel(s: { baseVersion: string; programasSelecionados: string[]; cursosTccSelecionados: string[]; rota: string; buscaTipo: string; buscaTermo: string | null; docs: readonly { ano: number | null }[] }) {
  const anos = s.docs.map((d) => d.ano).filter((n): n is number => n !== null && Number.isFinite(n));
  return { baseVersao: s.baseVersion, colecoes: [...s.programasSelecionados, ...s.cursosTccSelecionados], registrosCarregados: s.docs.length,
    periodoObservado: anos.length ? [anos.reduce((a,b)=>Math.min(a,b),Infinity), anos.reduce((a,b)=>Math.max(a,b),-Infinity)] : null, dataColeta: 'Não informada',
    pagina: s.rota, entidade: s.rota === 'busca' ? { tipo: s.buscaTipo, nome: s.buscaTermo } : null,
    fonte: 'Recorte local do Repositório Institucional da UFSC', limites: 'Metadados incompletos e registros sobrepostos são possíveis; indicadores não medem qualidade. Filtros de apresentação não alteram os cálculos.' };
}

export function valorNumericoTabela(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v !== 0 && Math.abs(v) < 0.0001) return v.toExponential(4).replace('.', ',');
  return v.toLocaleString('pt-BR', Number.isInteger(v) ? {} : { maximumSignificantDigits: 8 });
}
