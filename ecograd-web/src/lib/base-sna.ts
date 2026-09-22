/**
 * Base de dados completa com métricas SNA por documento.
 * Transcrição do bloco final de `Principal.py:1195-1239`.
 *
 * As métricas são as do nó do *documento* no grafo global: grau é o número de
 * autores, orientadores, palavras-chave e macrotemas ligados àquele registro, e
 * betweenness e closeness são a posição dele na rede inteira. São descrições
 * estruturais da seleção carregada — mudam quando o recorte muda, e não medem
 * impacto, qualidade nem relevância do trabalho.
 */
import type { Documento, SnaGlobal } from '@/types';

export interface LinhaBaseSNA extends Record<string, unknown> {
  Título: string;
  Ano: number | null;
  Nível: string;
  Autores: string;
  Orientador: string;
  'Co-orientadores': string;
  'Palavras-chave': string;
  Macrotema: string;
  Coleção: string;
  'Grau (SNA)': number;
  'Betweenness (SNA)': number;
  'Closeness (SNA)': number;
  'Comunidade (SNA)': number | 'N/A';
  'Ranking Global (SNA)': number | 'N/A';
  Resumo: string;
  Fonte: string;
}

export function linhasBaseSNA(docs: readonly Documento[], sna: SnaGlobal | null): LinhaBaseSNA[] {
  return docs.map((d) => {
    const m = sna?.[d.titulo];
    return {
      Título: d.titulo,
      Ano: typeof d.ano === 'number' && Number.isFinite(d.ano) ? d.ano : null,
      Nível: d.nivel_academico || 'Não informado',
      Autores: d.autores.join(', '),
      Orientador: d.orientador || '',
      'Co-orientadores': d.co_orientadores.join(', '),
      'Palavras-chave': d.palavras_chave.join(', '),
      Macrotema: d.macrotema || '',
      Coleção: d.programa_origem,
      // Arredondamentos idênticos aos do `st.dataframe` original.
      'Grau (SNA)': m?.['Grau Absoluto'] ?? 0,
      'Betweenness (SNA)': Math.round((m?.Betweenness ?? 0) * 1e4) / 1e4,
      'Closeness (SNA)': Math.round((m?.Closeness ?? 0) * 1e4) / 1e4,
      'Comunidade (SNA)': m?.Comunidade ?? 'N/A',
      'Ranking Global (SNA)': m?.['Ranking Global'] ?? 'N/A',
      Resumo: d.resumo || '',
      Fonte: d.url || '',
    };
  });
}

/** Máximos de cada métrica, usados pelas barras da tabela. */
export function maximosBaseSNA(linhas: readonly LinhaBaseSNA[]) {
  const maior = (chave: 'Grau (SNA)' | 'Betweenness (SNA)' | 'Closeness (SNA)') =>
    linhas.reduce((acc, l) => Math.max(acc, Number(l[chave]) || 0), 0);
  return {
    grau: maior('Grau (SNA)') || 1,
    betweenness: maior('Betweenness (SNA)') || 1,
    closeness: maior('Closeness (SNA)') || 1,
  };
}
