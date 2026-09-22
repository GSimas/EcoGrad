import vinculos from '../data/vinculos-capes.json';
import type { CatalogoCapes } from '../types';
export interface ColecaoCobertura {
  nome: string; tipo: 'ppg' | 'tcc'; setSpecs: string[]; total: number;
  niveis: Record<string, number>; inicio: number | null; fim: number | null; semAno: number;
  comResumo: number; comPalavras: number; comOrientador: number; comFonte: number; fontesDistintas: number; downloadBytes: number;
}
/**
 * O acervo inteiro em números, calculado no build (`panoramaAcervo`).
 *
 * Não dá para derivar isto no navegador: ele carrega só as coleções escolhidas,
 * e contagens distintas — pessoas, trabalhos únicos — exigem as duas bases.
 */
export interface PanoramaAcervo {
  registros: number; trabalhosUnicos: number;
  colecoes: number; colecoesPpg: number; colecoesTcc: number;
  autores: number; orientadores: number; coorientadores: number;
  palavrasChave: number; macrotemas: number;
  comResumo: number; comPalavras: number; comOrientador: number; comFonte: number; comPdf: number;
  inicio: number | null; fim: number | null; semAno: number;
  porNivel: Array<[string, number]>;
  porAno: Array<[number, number]>;
  maioresColecoes: Array<[string, number]>;
}
export interface CatalogoCobertura { schema: 3; version: string; bytes: { ppg: number; tcc: number }; colecoes: ColecaoCobertura[]; panorama: PanoramaAcervo }
function panoramaValido(p: PanoramaAcervo | undefined, count: (n: unknown) => boolean): boolean {
  if (!p || !count(p.registros)) return false;
  const escalares: unknown[] = [p.trabalhosUnicos, p.colecoes, p.colecoesPpg, p.colecoesTcc, p.autores, p.orientadores,
    p.coorientadores, p.palavrasChave, p.macrotemas, p.comResumo, p.comPalavras, p.comOrientador, p.comFonte, p.comPdf, p.semAno];
  const par = (v: unknown, rotuloNumerico: boolean) => Array.isArray(v) && v.length === 2
    && (rotuloNumerico ? Number.isSafeInteger(v[0]) : typeof v[0] === 'string') && count(v[1]);
  // Nenhuma contagem por registro pode passar do total: um panorama que se
  // contradiz é melhor recusado do que exibido.
  return escalares.every(count)
    && [p.comResumo, p.comPalavras, p.comOrientador, p.comFonte, p.comPdf, p.semAno, p.trabalhosUnicos].every((n) => n <= p.registros)
    && (p.inicio === null || Number.isSafeInteger(p.inicio)) && (p.fim === null || Number.isSafeInteger(p.fim))
    && Array.isArray(p.porNivel) && p.porNivel.every((v) => par(v, false))
    && Array.isArray(p.porAno) && p.porAno.every((v) => par(v, true))
    && Array.isArray(p.maioresColecoes) && p.maioresColecoes.every((v) => par(v, false));
}
export function validarCobertura(value: unknown, version: string): CatalogoCobertura {
  const c = value as CatalogoCobertura | null;
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  if (!c || c.schema !== 3 || c.version !== version || !/^[a-f0-9]{64}$/.test(version) || !c.bytes || !count(c.bytes.ppg) || !count(c.bytes.tcc) || !Array.isArray(c.colecoes) ||
    !panoramaValido(c.panorama, count) ||
    !c.colecoes.every((e) => e && typeof e.nome === 'string' && ['ppg', 'tcc'].includes(e.tipo) && Array.isArray(e.setSpecs) && e.setSpecs.every((s) => typeof s === 'string' && /^col_\d+_\d+$/.test(s)) &&
      count(e.total) && count(e.downloadBytes) && [e.semAno, e.comResumo, e.comPalavras, e.comOrientador, e.comFonte, e.fontesDistintas].every((n) => count(n) && n <= e.total) &&
      (e.inicio === null || Number.isSafeInteger(e.inicio)) && (e.fim === null || Number.isSafeInteger(e.fim)) &&
      e.niveis && Object.values(e.niveis).every(count) && Object.values(e.niveis).reduce((a, b) => a + b, 0) === e.total)) throw new Error('A prévia está indisponível ou pertence a outra versão da base.');
  return c;
}
export async function carregarCobertura(signal?: AbortSignal): Promise<CatalogoCobertura> {
  const boundedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  const json = async (url: string) => {
    const r = await fetch(url, { cache: 'no-store', signal: boundedSignal });
    if (!r.ok) throw new Error('Não foi possível obter a prévia das coleções.');
    return r.json();
  };
  const before = await json('/data/manifest.json');
  const data = await json('/data/colecoes-cobertura.json');
  const after = await json('/data/manifest.json');
  if (before.version !== after.version) throw new Error('A base foi atualizada durante a consulta. Atualize a prévia.');
  return validarCobertura(data, after.version);
}
export function urlColecao(setSpec: string) {
  const match = /^col_(\d+)_(\d+)$/.exec(setSpec);
  return match ? `https://repositorio.ufsc.br/handle/${match[1]}/${match[2]}` : null;
}
/** Grouping only alerts users; it NEVER merges records or identifies a CAPES program. */
export function nomeParaComparar(nome: string) {
  return nome.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, ' ');
}
export function vinculoDocumentado(nome: string, specs: readonly string[], tipo = 'ppg') {
  return tipo === 'ppg' && specs.length === 1 ? vinculos.find((v) => v.nomeColecao === nome && v.setSpec === specs[0]) : undefined;
}
export function fichaDocumentada(nome: string, specs: readonly string[], catalogo: CatalogoCapes) {
  const vinculo = vinculoDocumentado(nome, specs);
  const programa = vinculo ? catalogo.programas[vinculo.codigo] : undefined;
  // A changed institution/name/modality requires review, never a replacement by similarity.
  return vinculo && programa && catalogo.fonte.idIes === vinculo.idIes && programa.Código === vinculo.codigo && programa.Nome === vinculo.nomeCapes && programa.Modalidade === vinculo.modalidade ? { vinculo, programa } : null;
}
