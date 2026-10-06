/**
 * Genealogia acadêmica e liderança topológica.
 *
 * Cálculos puros, fora do componente, porque os Destaques do Ecossistema na
 * tela e o relatório em PDF precisam dos mesmos números. Duplicá-los faria o
 * papel divergir da tela na primeira correção.
 */
import type { Documento, SnaGlobal } from '@/types';

export interface Genealogia {
  /**
   * Quem orientou, no recorte, a autoria de alguém que também aparece como
   * (co)orientador — com os orientadores que formou, em ordem alfabética.
   */
  formadores: Array<[formador: string, orientadoresFormados: string[]]>;
  /** Autores com dissertação E tese na mesma coleção, com as coleções. */
  mestreDoutor: Array<[string, string[]]>;
}

export function calcularGenealogia(
  docs: readonly Documento[],
  conjuntos: { orientadores: ReadonlySet<string>; coorientadores: ReadonlySet<string> },
): Genealogia {
  const orientadoresAtivos = new Set([...conjuntos.orientadores, ...conjuntos.coorientadores]);
  // formador -> orientadores que ele orientou na autoria
  const formadores = new Map<string, Set<string>>();
  // autor -> programa -> níveis cursados
  const autorProgramas = new Map<string, Map<string, Set<string>>>();

  for (const d of docs) {
    for (const autor of d.autores) {
      if (!orientadoresAtivos.has(autor) || !d.orientador || d.orientador === autor) continue;
      let formados = formadores.get(d.orientador);
      if (!formados) formadores.set(d.orientador, (formados = new Set()));
      formados.add(autor);
    }

    const nivel = d.nivel_academico ?? '';
    if (!nivel.includes('Tese') && !nivel.includes('Disserta')) continue;
    const programa = d.programa_origem || 'Programa Desconhecido';
    const categoria = nivel.includes('Tese') ? 'Tese' : 'Dissertação';

    for (const autor of d.autores) {
      if (!autor) continue;
      let porPrograma = autorProgramas.get(autor);
      if (!porPrograma) {
        porPrograma = new Map();
        autorProgramas.set(autor, porPrograma);
      }
      let niveisSet = porPrograma.get(programa);
      if (!niveisSet) {
        niveisSet = new Set();
        porPrograma.set(programa, niveisSet);
      }
      niveisSet.add(categoria);
    }
  }

  const mestreDoutor: Array<[string, string[]]> = [];
  for (const [autor, porPrograma] of autorProgramas) {
    const programasDuplos = [...porPrograma.entries()]
      .filter(([, n]) => n.has('Tese') && n.has('Dissertação'))
      .map(([p]) => p)
      .sort();
    if (programasDuplos.length > 0) mestreDoutor.push([autor, programasDuplos]);
  }

  return {
    formadores: [...formadores]
      .map(([f, formados]): [string, string[]] => [f, [...formados].sort((a, b) => a.localeCompare(b, 'pt-BR'))])
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')),
    mestreDoutor: mestreDoutor.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')),
  };
}

/** `['Nenhum', 0]` quando não há SNA ou nenhuma entidade tem a métrica. */
export type LiderTopologico = [nome: string, valor: number];

export interface TopologiaDestaques {
  oriBet: LiderTopologico; oriClose: LiderTopologico;
  cooriBet: LiderTopologico; cooriClose: LiderTopologico;
  teseBet: LiderTopologico; teseClose: LiderTopologico;
  dissBet: LiderTopologico; dissClose: LiderTopologico;
}

export function calcularTopologia(
  snaGlobal: SnaGlobal | null,
  conjuntos: { orientadores: Iterable<string>; coorientadores: Iterable<string> },
  niveis: { titulosTeses: Iterable<string>; titulosDissertacoes: Iterable<string> },
): TopologiaDestaques {
  const melhor = (entidades: Iterable<string>, metrica: 'Betweenness' | 'Closeness'): LiderTopologico => {
    if (!snaGlobal) return ['Nenhum', 0];
    let nome = 'Nenhum';
    let valor = -Infinity;
    for (const e of entidades) {
      const v = snaGlobal[e]?.[metrica];
      if (typeof v === 'number' && v > valor) {
        valor = v;
        nome = e;
      }
    }
    return valor === -Infinity ? ['Nenhum', 0] : [nome, valor];
  };
  return {
    oriBet: melhor(conjuntos.orientadores, 'Betweenness'),
    oriClose: melhor(conjuntos.orientadores, 'Closeness'),
    cooriBet: melhor(conjuntos.coorientadores, 'Betweenness'),
    cooriClose: melhor(conjuntos.coorientadores, 'Closeness'),
    teseBet: melhor(niveis.titulosTeses, 'Betweenness'),
    teseClose: melhor(niveis.titulosTeses, 'Closeness'),
    dissBet: melhor(niveis.titulosDissertacoes, 'Betweenness'),
    dissClose: melhor(niveis.titulosDissertacoes, 'Closeness'),
  };
}

/** A rede não tem caminho algum: toda intermediação e proximidade é zero. */
export const topologiaSemSinal = (t: TopologiaDestaques) =>
  Object.values(t).every(([nome, valor]) => nome === 'Nenhum' || valor === 0);
