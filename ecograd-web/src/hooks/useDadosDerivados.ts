import { useMemo } from 'react';
import type { Documento } from '@/types';
import { conjuntosGlobais, construirIndicesInvertidos, normalizarNivel } from '@/lib/entities';
import { construirPerfisSimilaridade } from '@/lib/similarity';
import { construirGrafoHistorico } from '@/lib/orbit';
import { contar } from '@/lib/foresight-math';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

/**
 * Estruturas derivadas da base ativa, memoizadas por identidade do array `docs`.
 * Substitui os `@st.cache_data` do Streamlit — recalculam apenas quando a base
 * muda (nova seleção ou injeção de ontologia).
 */
export function useDadosDerivados() {
  const docs = useEcoGradStore((s) => s.docs);

  const indices = useMemo(() => construirIndicesInvertidos(docs), [docs]);
  const conjuntos = useMemo(() => conjuntosGlobais(docs), [docs]);

  const contagens = useMemo(() => {
    const orientadores = contar(docs.map((d) => d.orientador).filter(Boolean));
    const coorientadores = contar(docs.flatMap((d) => d.co_orientadores).filter(Boolean));
    const keywords = contar(docs.flatMap((d) => d.palavras_chave).filter(Boolean));
    const macrotemas = contar(docs.map((d) => d.macrotema).filter(Boolean));
    return { orientadores, coorientadores, keywords, macrotemas };
  }, [docs]);

  const niveis = useMemo(() => {
    let teses = 0;
    let dissertacoes = 0;
    let tcc = 0;
    const titulosTeses: string[] = [];
    const titulosDissertacoes: string[] = [];
    for (const d of docs) {
      const n = normalizarNivel(d.nivel_academico);
      if (n === 'Teses') {
        teses += 1;
        titulosTeses.push(d.titulo);
      } else if (n === 'Dissertações') {
        dissertacoes += 1;
        titulosDissertacoes.push(d.titulo);
      } else if (n === 'TCC') tcc += 1;
    }
    return { teses, dissertacoes, tcc, titulosTeses, titulosDissertacoes };
  }, [docs]);

  const programas = useMemo(
    () => [...new Set(docs.map((d) => d.programa_origem).filter(Boolean))].sort(),
    [docs],
  );

  return { docs, indices, conjuntos, contagens, niveis, programas };
}

/**
 * Perfis Jaccard e grafo histórico são caros (O(n · features)); só são montados
 * quando o dossiê realmente precisa deles.
 */
export function usePerfisSimilaridade(docs: readonly Documento[]) {
  return useMemo(() => construirPerfisSimilaridade(docs), [docs]);
}

export function useGrafoHistorico(docs: readonly Documento[]) {
  return useMemo(() => construirGrafoHistorico(docs), [docs]);
}
