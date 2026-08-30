/**
 * Lexicometria: frequências para a nuvem de palavras e séries históricas.
 * Transcrição de `obter_frequencias_texto` (backend.py:1303).
 */
import type { Documento } from '@/types';
import { STOPWORDS_NUVEM_PT } from './stopwords';

export type FonteNuvem = 'Conceitos (Palavras-chave)' | 'Resumos (Abstracts)' | 'Títulos';

export interface PalavraFreq {
  name: string;
  value: number;
}

export function obterFrequenciasTexto(
  docs: readonly Documento[],
  fonte: FonteNuvem,
  topN = 100,
): PalavraFreq[] {
  const contagem = new Map<string, number>();

  if (fonte === 'Conceitos (Palavras-chave)') {
    for (const d of docs) {
      for (const pk of d.palavras_chave) {
        if (!pk) continue;
        contagem.set(pk, (contagem.get(pk) ?? 0) + 1);
      }
    }
  } else {
    const textos = fonte === 'Resumos (Abstracts)'
      ? docs.map((d) => d.resumo).filter(Boolean)
      : docs.map((d) => d.titulo).filter(Boolean);

    // Equivalente a re.sub(r'[^\w\s]', '', texto.lower()) e split()
    const textoCompleto = textos.join(' ').toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, '');
    for (const palavra of textoCompleto.split(/\s+/)) {
      if (palavra.length <= 2 || STOPWORDS_NUVEM_PT.has(palavra)) continue;
      contagem.set(palavra, (contagem.get(palavra) ?? 0) + 1);
    }
  }

  return [...contagem.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

/** Série anual (opcionalmente cumulativa) para a aba de Evolução Histórica. */
export function evolucaoAnual(
  docs: readonly Documento[],
  cumulativo = false,
): Array<{ ano: number; total: number }> {
  const porAno = new Map<number, number>();
  for (const d of docs) {
    if (d.ano === null || !Number.isFinite(d.ano)) continue;
    porAno.set(d.ano, (porAno.get(d.ano) ?? 0) + 1);
  }
  const anos = [...porAno.keys()].sort((a, b) => a - b);
  let acc = 0;
  return anos.map((ano) => {
    const total = porAno.get(ano)!;
    acc += total;
    return { ano, total: cumulativo ? acc : total };
  });
}

/** Top-N de um contador, para os rankings do Dashboard. */
export function topN(contagem: Map<string, number>, n: number): Array<[string, number]> {
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
