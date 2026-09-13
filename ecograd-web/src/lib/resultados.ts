/** Presentation-only summaries and filters. Scientific inputs and algorithms are untouched. */
import type { Documento, TipoBusca } from '../types';
export const textoBusca = (v: string) => v.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
export function fonteSegura(value: string): string | null {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function chaveFonte(value: string): string | null {
  const safe = fonteSegura(value);
  return safe?.replace('/xmlui/handle/', '/handle/') ?? null;
}
export function resumoRegistros(docs: readonly Documento[]) {
  const anos = [...new Set(docs.map((d) => d.ano).filter((y): y is number => y !== null && Number.isFinite(y)))].sort((a, b) => a - b);
  const tipos: Record<string, number> = {};
  for (const d of docs) { const key = d.nivel_academico.trim() || 'Não informado'; tipos[key] = (tipos[key] ?? 0) + 1; }
  const fontes = docs.map((d) => chaveFonte(d.url)).filter((u): u is string => !!u);
  return { total: docs.length, inicio: anos[0] ?? null, fim: anos.at(-1) ?? null, anos: anos.length,
    semAno: docs.filter((d) => d.ano === null || !Number.isFinite(d.ano)).length,
    comResumo: docs.filter((d) => d.resumo.trim()).length,
    comFonte: fontes.length, fontesDistintas: new Set(fontes).size,
    comPalavras: docs.filter((d) => d.palavras_chave.some((p) => p.trim())).length,
    comOrientador: docs.filter((d) => d.orientador.trim()).length,
    autores: new Set(docs.flatMap((d) => d.autores).filter(Boolean)).size,
    orientadores: new Set(docs.map((d) => d.orientador).filter(Boolean)).size,
    coorientadores: new Set(docs.flatMap((d) => d.co_orientadores).filter(Boolean)).size,
    palavras: new Set(docs.flatMap((d) => d.palavras_chave).filter(Boolean)).size, tipos };
}
export const periodoTexto = (s: ReturnType<typeof resumoRegistros>) => s.inicio === null ? 'Não informado' : s.inicio === s.fim ? String(s.inicio) : `${s.inicio}–${s.fim}`;
export function intervaloComum(docs: readonly Documento[], nomes: readonly string[]): [number, number] | null {
  if (nomes.length < 2) return null;
  const porColecao = new Map<string, [number, number]>();
  for (const d of docs) {
    if (d.ano === null || !Number.isFinite(d.ano)) continue;
    const anterior = porColecao.get(d.programa_origem);
    porColecao.set(d.programa_origem, anterior
      ? [Math.min(anterior[0], d.ano), Math.max(anterior[1], d.ano)]
      : [d.ano, d.ano]);
  }
  if (nomes.some((nome) => !porColecao.has(nome))) return null;
  const spans = nomes.map((nome) => porColecao.get(nome)!);
  const inicio = Math.max(...spans.map((s) => s[0])); const fim = Math.min(...spans.map((s) => s[1]));
  return inicio <= fim ? [inicio, fim] : null;
}
export function compararColecoes(docs: readonly Documento[], nomes: readonly string[], intervalo: [number, number] | null = null) {
  return [...new Set(nomes)].map((nome) => {
    const todos = docs.filter((d) => d.programa_origem === nome);
    const recorte = intervalo ? todos.filter((d) => d.ano !== null && Number.isFinite(d.ano) && d.ano >= intervalo[0] && d.ano <= intervalo[1]) : todos;
    return { nome, ...resumoRegistros(recorte), totalOriginal: todos.length, semAnoOriginal: todos.filter((d) => d.ano === null || !Number.isFinite(d.ano)).length };
  });
}
export interface FiltroTrabalhos { busca: string; colecao: string; comResumo: boolean }
export function filtrarTrabalhos(docs: readonly Documento[], filtro: FiltroTrabalhos) {
  const busca = textoBusca(filtro.busca.trim());
  return docs.filter((d) => (!filtro.colecao || d.programa_origem === filtro.colecao) && (!filtro.comResumo || !!d.resumo.trim()) &&
    (!busca || textoBusca([d.titulo, ...d.autores, d.orientador, ...d.palavras_chave, d.resumo].join(' ')).includes(busca)))
    .slice().sort((a, b) => (b.ano ?? -Infinity) - (a.ano ?? -Infinity) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}
/** Once per record: labels may be duplicated in the raw metadata. */
export function relacionados(docs: readonly Documento[], tipo: TipoBusca) {
  const counts = new Map<string, number>();
  for (const d of docs) {
    const labels = tipo === 'Autor' ? d.autores : tipo === 'Orientador' ? [d.orientador] : tipo === 'Co-orientador' ? d.co_orientadores : tipo === 'Palavra-chave' ? d.palavras_chave : tipo === 'Macrotema' ? [d.macrotema] : [d.titulo];
    for (const label of new Set(labels.filter((v) => v.trim()))) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
}
export interface ReferenciaDocumento { indice: number; titulo: string; origem: string; url: string }
export function referenciaDocumento(docs: readonly Documento[], indice: number): ReferenciaDocumento | null {
  const d = Number.isInteger(indice) && indice >= 0 ? docs[indice] : undefined;
  return d ? { indice, titulo: d.titulo, origem: d.programa_origem, url: d.url } : null;
}
export function resolverDocumento(docs: readonly Documento[], titulo: string, referencia: unknown): Documento | null {
  const r = referencia as ReferenciaDocumento | undefined;
  if (r && Number.isInteger(r.indice)) {
    const d = docs[r.indice];
    if (d && d.titulo === titulo && d.titulo === r.titulo && d.programa_origem === r.origem && d.url === r.url) return d;
  }
  const matches = docs.filter((d) => d.titulo === titulo);
  return matches.length === 1 ? matches[0] : null;
}
