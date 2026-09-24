import type { Documento, IndicesInvertidos } from '@/types';
import { conjuntosGlobais, construirIndicesInvertidos, normalizarNivel } from '@/lib/entities';
import { construirPerfisSimilaridade } from '@/lib/similarity';
import { construirGrafoHistorico } from '@/lib/orbit';
import { contar } from '@/lib/foresight-math';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

/**
 * Estruturas derivadas de uma base, calculadas uma vez por base e compartilhadas
 * por todas as páginas. Substitui os `@st.cache_data` do Streamlit.
 *
 * O cache é por identidade do array `docs`, que nunca é alterado no lugar: nova
 * seleção, ontologia ou fusão de pessoas trocam o array inteiro. Antes cada
 * página mantinha o próprio `useMemo`, e voltar ao Dashboard ou ao Motor de
 * Busca refazia índices e contagens a cada montagem. Cada campo só é calculado
 * quando alguém o lê.
 */
class Derivados {
  #indices?: IndicesInvertidos;
  #conjuntos?: ReturnType<typeof conjuntosGlobais>;
  #contagens?: { orientadores: Map<string, number>; coorientadores: Map<string, number>; keywords: Map<string, number>; macrotemas: Map<string, number> };
  #niveis?: { teses: number; dissertacoes: number; tcc: number; titulosTeses: string[]; titulosDissertacoes: string[] };
  #programas?: string[];

  constructor(readonly docs: Documento[]) {}

  get indices() { return this.#indices ??= construirIndicesInvertidos(this.docs); }
  get conjuntos() { return this.#conjuntos ??= conjuntosGlobais(this.docs); }

  get contagens() {
    return this.#contagens ??= {
      orientadores: contar(this.docs.map((d) => d.orientador).filter(Boolean)),
      coorientadores: contar(this.docs.flatMap((d) => d.co_orientadores).filter(Boolean)),
      keywords: contar(this.docs.flatMap((d) => d.palavras_chave).filter(Boolean)),
      macrotemas: contar(this.docs.map((d) => d.macrotema).filter(Boolean)),
    };
  }

  get niveis() {
    if (this.#niveis) return this.#niveis;
    let teses = 0;
    let dissertacoes = 0;
    let tcc = 0;
    const titulosTeses: string[] = [];
    const titulosDissertacoes: string[] = [];
    for (const d of this.docs) {
      const n = normalizarNivel(d.nivel_academico);
      if (n === 'Teses') {
        teses += 1;
        titulosTeses.push(d.titulo);
      } else if (n === 'Dissertações') {
        dissertacoes += 1;
        titulosDissertacoes.push(d.titulo);
      } else if (n === 'TCC') tcc += 1;
    }
    return this.#niveis = { teses, dissertacoes, tcc, titulosTeses, titulosDissertacoes };
  }

  get programas() {
    return this.#programas ??= [...new Set(this.docs.map((d) => d.programa_origem).filter(Boolean))].sort();
  }
}

const derivadosPorBase = new WeakMap<Documento[], Derivados>();

/** As estruturas derivadas de `docs`, as mesmas para quem pedir a mesma base. */
export function derivadosDe(docs: Documento[]): Derivados {
  let d = derivadosPorBase.get(docs);
  if (!d) { d = new Derivados(docs); derivadosPorBase.set(docs, d); }
  return d;
}

export function useDadosDerivados() {
  return derivadosDe(useEcoGradStore((s) => s.docs));
}

/** Uma função pura de uma base, calculada uma vez por identidade do array. */
function porBase<R>(calcular: (docs: readonly Documento[]) => R): (docs: readonly Documento[]) => R {
  const cache = new WeakMap<readonly Documento[], R>();
  return (docs) => {
    if (cache.has(docs)) return cache.get(docs)!;
    const r = calcular(docs);
    cache.set(docs, r);
    return r;
  };
}

const perfisDe = porBase(construirPerfisSimilaridade);
const grafoHistoricoDe = porBase(construirGrafoHistorico);

/**
 * Perfis Jaccard e grafo histórico são caros (O(n · features)); só são montados
 * quando o dossiê realmente precisa deles — e uma vez por base, não a cada
 * dossiê aberto.
 */
export function usePerfisSimilaridade(docs: readonly Documento[]) {
  return perfisDe(docs);
}

export function useGrafoHistorico(docs: readonly Documento[]) {
  return grafoHistoricoDe(docs);
}
