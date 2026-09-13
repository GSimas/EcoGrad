/** Presentation only: never mutates scientific rows or recalculates metrics. */
export interface ConsultaTabela { busca: string; coluna: string; direcao: 'asc' | 'desc'; pagina: number }
export const consultaInicial: ConsultaTabela = { busca: '', coluna: '', direcao: 'asc', pagina: 0 };
const texto = (v: unknown) => String(v ?? '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
const numero = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
export function consultarLinhas<T extends Record<string, unknown>>(linhas: readonly T[], colunas: readonly string[], consulta: ConsultaTabela): T[] {
  const busca = texto(consulta.busca).trim();
  const result = linhas.filter((l) => !busca || colunas.some((c) => texto(l[c]).includes(busca)));
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
