/** Read-only preview of the exact records used by data-loader; no scientific transformation. */
export const COVERAGE_SCHEMA = 4;
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

/**
 * O acervo inteiro em números, para o Panorama UFSC.
 *
 * O app carrega só as coleções escolhidas, então um número sobre "todo o acervo"
 * não pode ser calculado no navegador: contagens distintas (pessoas, trabalhos
 * únicos) exigem varrer as duas bases inteiras. Aqui, no build, isso custa uma
 * passada; lá custaria baixar 63 MB.
 *
 * As definições acompanham as de `resumoRegistros` (src/lib/resultados.ts), para
 * o número do panorama e o do Dashboard significarem a mesma coisa.
 */
export function panoramaAcervo(bases) {
  /** As 15 mais frequentes; empate desempatado pelo nome, para o ranking não oscilar entre builds. */
  const maiores = (mapa) => [...mapa].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 15);
  // Mapa, e não conjunto, para orientação, coorientação e palavra-chave: o
  // panorama mostra tanto quantas são distintas (`.size`) quanto as 15 mais
  // frequentes, e uma segunda passada só para o ranking seria desperdício.
  const autores = new Set();
  const orientadores = new Map(), coorientadores = new Map(), palavras = new Map();
  const macrotemas = new Set(), fontes = new Set(), colecoes = { ppg: new Set(), tcc: new Set() };
  const somar = (mapa, chave) => mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  const niveis = new Map(), anos = new Map(), porColecao = new Map();
  let registros = 0, semFonte = 0, semAno = 0;
  const com = { resumo: 0, palavras: 0, orientador: 0, fonte: 0, pdf: 0 };
  for (const tipo of ['ppg', 'tcc']) {
    for (const d of bases[tipo]) {
      if (!d || typeof d !== 'object') continue;
      registros++;
      const colecao = String(d.programa_origem ?? '').trim();
      if (colecao) { colecoes[tipo].add(colecao); porColecao.set(colecao, (porColecao.get(colecao) ?? 0) + 1); }
      const nivel = String(d.nivel_academico ?? '').trim() || 'Não informado';
      niveis.set(nivel, (niveis.get(nivel) ?? 0) + 1);
      const ano = Number.parseInt(String(d.ano ?? '').trim(), 10);
      if (Number.isFinite(ano)) anos.set(ano, (anos.get(ano) ?? 0) + 1); else semAno++;
      for (const a of d.autores ?? []) if (String(a).trim()) autores.add(String(a).trim());
      if (String(d.orientador ?? '').trim()) { somar(orientadores, String(d.orientador).trim()); com.orientador++; }
      for (const c of d.co_orientadores ?? []) if (String(c).trim()) somar(coorientadores, String(c).trim());
      for (const p of d.palavras_chave ?? []) if (String(p).trim()) somar(palavras, String(p).trim());
      if (String(d.macrotema ?? '').trim()) macrotemas.add(String(d.macrotema).trim());
      if (String(d.resumo ?? '').trim()) com.resumo++;
      if ((d.palavras_chave ?? []).some((p) => String(p).trim())) com.palavras++;
      if ((d.arquivos ?? []).length) com.pdf++;
      const url = String(d.url ?? '').trim();
      // Mesma chave de `chaveFonte`: a forma antiga com /xmlui/ é o mesmo trabalho.
      if (/^https?:\/\//i.test(url)) { com.fonte++; fontes.add(url.replace('/xmlui/handle/', '/handle/')); } else semFonte++;
    }
  }
  const ordenados = [...anos.keys()].sort((a, b) => a - b);
  return {
    registros,
    // Mesma definição do Dashboard: links distintos + registros sem link (que
    // nunca se fundem). Não é deduplicação científica.
    trabalhosUnicos: fontes.size + semFonte,
    colecoes: colecoes.ppg.size + colecoes.tcc.size,
    colecoesPpg: colecoes.ppg.size,
    colecoesTcc: colecoes.tcc.size,
    autores: autores.size,
    orientadores: orientadores.size,
    coorientadores: coorientadores.size,
    palavrasChave: palavras.size,
    macrotemas: macrotemas.size,
    comResumo: com.resumo, comPalavras: com.palavras, comOrientador: com.orientador, comFonte: com.fonte, comPdf: com.pdf,
    inicio: ordenados[0] ?? null,
    fim: ordenados.at(-1) ?? null,
    semAno,
    porNivel: [...niveis].sort((a, b) => b[1] - a[1]),
    porAno: ordenados.map((ano) => [ano, anos.get(ano)]),
    maioresColecoes: maiores(porColecao),
    topOrientadores: maiores(orientadores),
    topCoorientadores: maiores(coorientadores),
    topPalavrasChave: maiores(palavras),
  };
}
