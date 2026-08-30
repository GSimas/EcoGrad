/**
 * Quociente Locacional (QL), raridade semântica e Raio-X de Especialização.
 * Transcrição de `gerar_tabela_ql_cruzado_perfil` (backend.py:1807) e
 * `calcular_raridade_semantica` (backend.py:2554).
 */
import type { Documento, LinhaQL } from '@/types';
import { extrairEntidadesPorTipo, normalizarNivel } from './entities';

/**
 * QL = (freq. local da entidade / docs do perfil) ÷ (freq. global / docs totais).
 * QL > 1 indica especialização acima da média global da base.
 */
export function gerarTabelaQLCruzado(
  docsPerfil: readonly Documento[],
  dadosTotais: readonly Documento[],
  tiposAlvo: readonly string[],
): LinhaQL[] {
  if (docsPerfil.length === 0 || dadosTotais.length === 0 || tiposAlvo.length === 0) return [];

  const totalDocsGlobal = dadosTotais.length;
  const totalDocsPerfil = docsPerfil.length;

  const contagensGlobais = new Map<string, Map<string, number>>();
  for (const tipo of tiposAlvo) {
    const c = new Map<string, number>();
    for (const d of dadosTotais) {
      for (const entidade of extrairEntidadesPorTipo(d, tipo)) {
        c.set(entidade, (c.get(entidade) ?? 0) + 1);
      }
    }
    contagensGlobais.set(tipo, c);
  }

  const linhas: LinhaQL[] = [];

  for (const tipo of tiposAlvo) {
    const agregados = new Map<string, { Teses: number; Dissertações: number; Outros: number }>();
    for (const d of docsPerfil) {
      const nivel = normalizarNivel(d.nivel_academico);
      // TCC e demais níveis caem na coluna "Outros", como no Python
      const coluna = nivel === 'Teses' || nivel === 'Dissertações' ? nivel : 'Outros';
      for (const entidade of extrairEntidadesPorTipo(d, tipo)) {
        let alvo = agregados.get(entidade);
        if (!alvo) {
          alvo = { Teses: 0, Dissertações: 0, Outros: 0 };
          agregados.set(entidade, alvo);
        }
        alvo[coluna] += 1;
      }
    }

    const globais = contagensGlobais.get(tipo)!;
    for (const [entidade, conts] of agregados) {
      // Documentos sem macrotema geram uma entidade de nome vazio; ela é
      // contabilizada normalmente (paridade com o Python) mas não vai à tabela.
      if (entidade === '') continue;
      const totalLocal = conts.Teses + conts.Dissertações + conts.Outros;
      const totalGlobalEntidade = globais.get(entidade) ?? 0;
      const ql = totalGlobalEntidade === 0
        ? 0
        : (totalLocal / totalDocsPerfil) / (totalGlobalEntidade / totalDocsGlobal);

      linhas.push({
        Entidade: entidade,
        Tipo: tipo,
        Teses: conts.Teses,
        Dissertações: conts.Dissertações,
        Outros: conts.Outros,
        Total: totalLocal,
        'Valor QL': Math.round(ql * 100) / 100,
      });
    }
  }

  return linhas.sort(
    (a, b) =>
      a.Tipo.localeCompare(b.Tipo, 'pt-BR') ||
      b['Valor QL'] - a['Valor QL'] ||
      b.Total - a.Total,
  );
}

/** IDF médio das palavras-chave de um documento (backend.py:2554). */
export function calcularRaridadeSemantica(
  docPks: readonly string[],
  contagemGlobal: Map<string, number>,
  totalDocs: number,
): number {
  if (docPks.length === 0 || totalDocs === 0) return 0;
  let soma = 0;
  for (const pk of docPks) {
    const freq = contagemGlobal.get(pk) ?? 1; // mínimo 1 evita divisão por zero
    soma += Math.log10(totalDocs / freq);
  }
  return soma / docPks.length;
}

export interface RaioX {
  purezaMedia: number;
  perfil: string;
  densidade: number;
  raridadePct: number;
  amostraMultipla: boolean;
}

/** Raio-X de Especialização do dossiê (Principal.py:637). */
export function calcularRaioX(
  docsAlvo: readonly Documento[],
  dadosCompletos: readonly Documento[],
  clusteringLocal: number,
  contagemPks: Map<string, number>,
): RaioX | null {
  if (docsAlvo.length === 0) return null;

  const purezas = docsAlvo
    .map((d) => d.pureza_nmf)
    .filter((p): p is number => typeof p === 'number');
  const purezaMedia = purezas.length ? purezas.reduce((a, b) => a + b, 0) / purezas.length : 0;

  let perfil: string;
  if (purezaMedia >= 85) perfil = 'Altamente Especializado';
  else if (purezaMedia >= 60) perfil = 'Especialista';
  else if (purezaMedia >= 40) perfil = 'Híbrido / Fronteira';
  else perfil = 'Generalista / Transversal';

  const raridades = docsAlvo.map((d) =>
    calcularRaridadeSemantica(d.palavras_chave, contagemPks, dadosCompletos.length),
  );
  const raridadeMedia = raridades.length ? raridades.reduce((a, b) => a + b, 0) / raridades.length : 0;
  // Normalização para percentual, idêntica ao Python (teto empírico de IDF = 3.5)
  const raridadePct = Math.min((raridadeMedia / 3.5) * 100, 100);

  return {
    purezaMedia,
    perfil,
    densidade: clusteringLocal,
    raridadePct,
    amostraMultipla: docsAlvo.length > 1,
  };
}
