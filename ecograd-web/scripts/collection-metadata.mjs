/** Read-only preview of the exact records used by data-loader; no scientific transformation. */
export const COVERAGE_SCHEMA = 2;
export function summarizeCollections(entries, records) {
  const buckets = new Map(entries.map((e) => [e.nome, { ...e, total: 0, niveis: {}, inicio: null, fim: null, semAno: 0, comResumo: 0, comPalavras: 0, comOrientador: 0, comFonte: 0, urls: new Set() }]));
  for (const d of records) {
    if (!d || typeof d !== 'object') continue;
    const c = buckets.get(String(d.programa_origem ?? ''));
    if (!c) continue;
    c.total++;
    const nivel = String(d.nivel_academico ?? '').trim() || 'Não informado';
    c.niveis[nivel] = (c.niveis[nivel] ?? 0) + 1;
    const year = Number.parseInt(String(d.ano ?? '').trim(), 10);
    if (Number.isFinite(year)) { c.inicio = Math.min(c.inicio ?? year, year); c.fim = Math.max(c.fim ?? year, year); } else c.semAno++;
    if (String(d.resumo ?? '').trim()) c.comResumo++;
    if (Array.isArray(d.palavras_chave) && d.palavras_chave.some((p) => String(p).trim())) c.comPalavras++;
    if (String(d.orientador ?? '').trim()) c.comOrientador++;
    if (/^https?:\/\//i.test(String(d.url ?? '').trim())) { c.comFonte++; c.urls.add(String(d.url).trim().replace('/xmlui/handle/', '/handle/')); }
  }
  return [...buckets.values()].map(({ urls, ...c }) => ({ ...c, fontesDistintas: urls.size }));
}
export function catalogEntries(ppg, tcc) {
  const entries = Object.entries(ppg).map(([nome, setSpec]) => ({ nome, tipo: 'ppg', setSpecs: [setSpec] }));
  const courses = new Map();
  for (const c of tcc) {
    if (!c.curso) continue;
    const specs = courses.get(c.curso) ?? new Set();
    specs.add(c.setSpec); courses.set(c.curso, specs);
  }
  return [...entries, ...[...courses].map(([nome, specs]) => ({ nome, tipo: 'tcc', setSpecs: [...specs] }))];
}
