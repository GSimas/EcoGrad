/**
 * Normalização de níveis acadêmicos, extração de entidades e índices invertidos.
 * Transcrição de `_normalizar_nivel` (backend.py:1743),
 * `_extrair_entidades_por_tipo` (backend.py:1760) e
 * `construir_indices_invertidos` (Principal.py:247).
 */
import type { Documento, IndicesInvertidos, NivelCanonico, TipoBusca } from '@/types';

/** Transcrição de `_normalizar_nivel` (backend.py:1743). */
export function normalizarNivel(nivel: unknown): NivelCanonico {
  if (!nivel) return 'Outros';
  const s = String(nivel).toLowerCase().trim();
  if (s.includes('tese') || s.includes('doutor') || s.includes('thesis')) return 'Teses';
  if (s.includes('disserta') || s.includes('mestrado') || s.includes('dissertation') || s.includes('master')) {
    return 'Dissertações';
  }
  if (s.includes('tcc') || s.includes('conclus') || s.includes('gradua')) return 'TCC';
  return 'Outros';
}

/** Transcrição de `_extrair_entidades_por_tipo` (backend.py:1760). */
export function extrairEntidadesPorTipo(doc: Documento, tipo: string): string[] {
  if (tipo === 'Orientador') return doc.orientador ? [doc.orientador] : [];
  if (tipo === 'Co-orientador') return [...new Set(doc.co_orientadores.filter(Boolean))];
  if (tipo === 'Palavra-chave') return [...new Set(doc.palavras_chave.filter(Boolean))];
  // Fiel ao Python: `doc.get("macrotema", default)` só usa o default quando a
  // CHAVE não existe. Após a normalização a chave sempre existe, então um
  // macrotema vazio é devolvido como string vazia (e filtrado na tabela de QL).
  if (tipo === 'Macrotema') {
    return [doc.macrotema === undefined ? 'Multidisciplinar / Transversal' : doc.macrotema];
  }
  return [];
}

/** Índices invertidos para busca O(1) (Principal.py:247). */
export function construirIndicesInvertidos(docs: readonly Documento[]): IndicesInvertidos {
  const idx: IndicesInvertidos = {
    por_titulo: new Map(),
    por_autor: new Map(),
    por_orientador: new Map(),
    por_coorientador: new Map(),
    por_palavra_chave: new Map(),
    por_macrotema: new Map(),
  };

  const push = (m: Map<string, Documento[]>, chave: string, d: Documento) => {
    const lista = m.get(chave);
    if (lista) lista.push(d);
    else m.set(chave, [d]);
  };

  for (const d of docs) {
    if (d.titulo) idx.por_titulo.set(d.titulo, d);
    for (const a of d.autores) if (a) push(idx.por_autor, a, d);
    if (d.orientador) push(idx.por_orientador, d.orientador, d);
    for (const co of d.co_orientadores) if (co) push(idx.por_coorientador, co, d);
    for (const pk of d.palavras_chave) if (pk) push(idx.por_palavra_chave, pk, d);
    if (d.macrotema) push(idx.por_macrotema, d.macrotema, d);
  }

  return idx;
}

/** Documentos associados a um termo, conforme o tipo de busca ativo. */
export function docsDoTermo(indices: IndicesInvertidos, tipo: TipoBusca, termo: string): Documento[] {
  switch (tipo) {
    case 'Documento': {
      const d = indices.por_titulo.get(termo);
      return d ? [d] : [];
    }
    case 'Autor':
      return indices.por_autor.get(termo) ?? [];
    case 'Orientador':
      return indices.por_orientador.get(termo) ?? [];
    case 'Co-orientador':
      return indices.por_coorientador.get(termo) ?? [];
    case 'Palavra-chave':
      return indices.por_palavra_chave.get(termo) ?? [];
    case 'Macrotema':
      return indices.por_macrotema.get(termo) ?? [];
    default:
      return [];
  }
}

/** Opções do seletor do Motor de Busca para cada tipo de entidade. */
export function opcoesPorTipo(indices: IndicesInvertidos, tipo: TipoBusca): string[] {
  const mapa: Record<TipoBusca, Iterable<string>> = {
    Documento: indices.por_titulo.keys(),
    Autor: indices.por_autor.keys(),
    Orientador: indices.por_orientador.keys(),
    'Co-orientador': indices.por_coorientador.keys(),
    'Palavra-chave': indices.por_palavra_chave.keys(),
    Macrotema: indices.por_macrotema.keys(),
  };
  return [...mapa[tipo]].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Conjuntos globais usados pelos KPIs do Dashboard (Principal.py:283). */
export function conjuntosGlobais(docs: readonly Documento[]) {
  const autores = new Set<string>();
  const orientadores = new Set<string>();
  const coorientadores = new Set<string>();
  const keywords = new Set<string>();
  for (const d of docs) {
    for (const a of d.autores) if (a) autores.add(a);
    if (d.orientador) orientadores.add(d.orientador);
    for (const co of d.co_orientadores) if (co) coorientadores.add(co);
    for (const kw of d.palavras_chave) if (kw) keywords.add(kw);
  }
  return { autores, orientadores, coorientadores, keywords };
}
