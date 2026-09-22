/**
 * Lexicometria: frequências para a nuvem de palavras e séries históricas.
 * Transcrição de `obter_frequencias_texto` (backend.py:1303).
 */
import type { Documento } from '@/types';
import { STOPWORDS_NUVEM } from './stopwords';

export type FonteNuvem = 'Conceitos (Palavras-chave)' | 'Resumos (Abstracts)' | 'Títulos';

export const FONTES_NUVEM: readonly FonteNuvem[] = ['Conceitos (Palavras-chave)', 'Títulos', 'Resumos (Abstracts)'];

/** Só o que é fonte de verdade sobrevive: a seleção volta da sessão como `unknown`. */
export function fontesValidas(valor: unknown): FonteNuvem[] {
  if (!Array.isArray(valor)) return [];
  return FONTES_NUVEM.filter((f) => valor.includes(f));
}

export interface PalavraFreq {
  name: string;
  value: number;
}

/** Contagem de uma fonte isolada, como no Python. */
function contarFonte(docs: readonly Documento[], fonte: FonteNuvem, contagem: Map<string, number>): void {
  if (fonte === 'Conceitos (Palavras-chave)') {
    for (const d of docs) {
      for (const pk of d.palavras_chave) {
        if (!pk) continue;
        contagem.set(pk, (contagem.get(pk) ?? 0) + 1);
      }
    }
    return;
  }

  const textos = fonte === 'Resumos (Abstracts)'
    ? docs.map((d) => d.resumo).filter(Boolean)
    : docs.map((d) => d.titulo).filter(Boolean);

  // Equivalente a re.sub(r'[^\w\s]', '', texto.lower()) e split()
  const textoCompleto = textos.join(' ').toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, '');
  for (const palavra of textoCompleto.split(/\s+/)) {
    if (palavra.length <= 2 || STOPWORDS_NUVEM.has(palavra)) continue;
    contagem.set(palavra, (contagem.get(palavra) ?? 0) + 1);
  }
}

/**
 * Frequências das fontes escolhidas, somadas num único ranking.
 *
 * Cada fonte é contada como no Python (`obter_frequencias_texto`, backend.py:1303);
 * combinar várias é adição do EcoGrad, e mistura unidades de propósito: uma
 * palavra-chave conta como expressão inteira ("mudanças climáticas" = 1), e
 * títulos e resumos contam palavra a palavra. Um termo presente em duas fontes
 * soma as duas contagens. Por isso o corte em `topN` é aplicado só no fim,
 * sobre o ranking já somado, e a interface declara a mistura quando ela ocorre.
 */
export function obterFrequenciasTexto(
  docs: readonly Documento[],
  fontes: readonly FonteNuvem[],
  topN = 100,
): PalavraFreq[] {
  const contagem = new Map<string, number>();
  for (const fonte of fontes) contarFonte(docs, fonte, contagem);

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
