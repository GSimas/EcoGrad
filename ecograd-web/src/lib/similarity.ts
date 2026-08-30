/**
 * Recomendação topológica por Índice de Jaccard.
 * Transcrição de `construir_perfis_similaridade` (backend.py:1552) e
 * `calcular_similares_rede` (backend.py:1628).
 */
import type { Documento, SimilaresAgrupados, SimilarItem, TipoBusca } from '@/types';

export interface PerfisSimilaridade {
  perfis: Map<string, Set<string>>;
  tipos: Map<string, string>;
  niveisDocs: Map<string, string>;
}

/** Pré-computa o "DNA acadêmico" de cada entidade (features compartilhadas). */
export function construirPerfisSimilaridade(docs: readonly Documento[]): PerfisSimilaridade {
  const perfis = new Map<string, Set<string>>();
  const tipos = new Map<string, string>();
  const niveisDocs = new Map<string, string>();

  const addFeature = (entidade: string, feature: string, tipoEntidade: string) => {
    let s = perfis.get(entidade);
    if (!s) {
      s = new Set<string>();
      perfis.set(entidade, s);
      tipos.set(entidade, tipoEntidade);
    }
    s.add(feature);
  };

  for (const d of docs) {
    const doc = d.titulo;
    if (!doc) continue;

    niveisDocs.set(doc, d.nivel_academico || 'Outros');

    const autores = d.autores;
    const ori = d.orientador;
    const cooris = d.co_orientadores;
    const pks = d.palavras_chave;
    const mt = d.macrotema;

    const todasEntidades = [...autores, ...(ori ? [ori] : []), ...cooris, ...pks, ...(mt ? [mt] : [])];
    for (const ent of todasEntidades) if (ent) addFeature(doc, ent, 'Documento');

    for (const a of autores) {
      if (ori) addFeature(a, ori, 'Autor');
      for (const pk of pks) addFeature(a, pk, 'Autor');
      if (mt) addFeature(a, mt, 'Autor');
    }

    if (ori) {
      for (const pk of pks) addFeature(ori, pk, 'Orientador');
      if (mt) addFeature(ori, mt, 'Orientador');
      for (const co of cooris) addFeature(ori, co, 'Orientador');
    }

    for (const co of cooris) {
      for (const pk of pks) addFeature(co, pk, 'Co-orientador');
      if (mt) addFeature(co, mt, 'Co-orientador');
      if (ori) addFeature(co, ori, 'Co-orientador');
    }

    for (const pk of pks) {
      if (mt) addFeature(pk, mt, 'Palavra-chave');
      for (const pk2 of pks) if (pk !== pk2) addFeature(pk, pk2, 'Palavra-chave');
    }

    if (mt) {
      for (const pk of pks) addFeature(mt, pk, 'Macrotema');
      if (ori) addFeature(mt, ori, 'Macrotema');
    }
  }

  return { perfis, tipos, niveisDocs };
}

/**
 * Top 5 itens mais próximos por Jaccard = |A ∩ B| / |A ∪ B|,
 * restrito à mesma categoria da entidade em foco.
 */
export function calcularSimilaresRede(
  termoFoco: string,
  tipoBusca: TipoBusca,
  perfisPre: PerfisSimilaridade,
): SimilaresAgrupados {
  const { perfis, tipos, niveisDocs } = perfisPre;
  const perfilFoco = perfis.get(termoFoco);
  if (!perfilFoco) return {};

  const resultados: SimilarItem[] = [];

  for (const [node, features] of perfis) {
    if (node === termoFoco) continue;
    const tipoNode = tipos.get(node)!;

    // Só compara maçã com maçã (filtros de performance do original)
    if (tipoBusca === 'Documento' && tipoNode !== 'Documento') continue;
    if (tipoBusca === 'Autor' && tipoNode !== 'Autor') continue;
    if (
      (tipoBusca === 'Orientador' || tipoBusca === 'Co-orientador') &&
      tipoNode !== 'Orientador' &&
      tipoNode !== 'Co-orientador'
    ) continue;
    if (tipoBusca === 'Palavra-chave' && tipoNode !== 'Palavra-chave') continue;
    if (tipoBusca === 'Macrotema' && tipoNode !== 'Macrotema') continue;

    // Itera o menor conjunto para manter a interseção barata
    const [menor, maior] = perfilFoco.size <= features.size ? [perfilFoco, features] : [features, perfilFoco];
    const comuns: string[] = [];
    for (const f of menor) if (maior.has(f)) comuns.push(f);
    if (comuns.length === 0) continue;

    const uniao = perfilFoco.size + features.size - comuns.length;
    const jaccard = comuns.length / uniao;

    resultados.push({
      Item: node,
      'Similaridade (%)': Math.round(jaccard * 10000) / 100,
      'Qtd. Traços': comuns.length,
      'Traços em Comum': comuns.sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', '),
      Nível: tipoNode === 'Documento' ? (niveisDocs.get(node) ?? 'Outros') : null,
      Tipo: tipoNode,
    });
  }

  const ordenar = (arr: SimilarItem[]) =>
    [...arr].sort((a, b) => b['Similaridade (%)'] - a['Similaridade (%)']).slice(0, 5);

  const retorno: SimilaresAgrupados = {};
  if (tipoBusca === 'Documento') {
    retorno.Teses = ordenar(resultados.filter((x) => String(x.Nível).includes('Tese')));
    retorno['Dissertações'] = ordenar(resultados.filter((x) => String(x.Nível).includes('Disserta')));
  } else if (tipoBusca === 'Autor') {
    retorno.Autores = ordenar(resultados);
  } else if (tipoBusca === 'Orientador' || tipoBusca === 'Co-orientador') {
    retorno.Professores = ordenar(resultados);
  } else if (tipoBusca === 'Palavra-chave') {
    retorno['Palavras-chave'] = ordenar(resultados);
  } else if (tipoBusca === 'Macrotema') {
    retorno.Macrotemas = ordenar(resultados);
  }

  return retorno;
}
