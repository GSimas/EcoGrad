/**
 * Cruzamento entre o nome do programa no repositório e a ficha oficial da CAPES.
 * Transcrição da cascata de matching do Principal.py:365-405
 * (exato → difflib fuzzy 0.65 → interseção de palavras).
 */
import type { CatalogoCapes, ProgramaCapes } from '@/types';

/** Normaliza o nome do PPG como no Python: remove prefixos, acentos e caixa. */
export function normalizarNomePPG(nome: string): string {
  const limpo = nome
    .replace('Programa de Pós-Graduação em ', '')
    .replace('Programa de Pós-Graduação ', '')
    .replace('PPG em ', '')
    .trim()
    .toUpperCase();
  return limpo.normalize('NFD').replace(/\p{Mn}/gu, '');
}

/**
 * Ratcliff-Obershelp — mesma métrica de `difflib.SequenceMatcher.ratio()`.
 * ratio = 2 * caracteres casados / (len(a) + len(b)).
 */
export function razaoSimilaridade(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 1;
  return (2 * casamentosRecursivos(a, b)) / total;
}

function casamentosRecursivos(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  // Maior bloco comum (equivalente a find_longest_match)
  let melhorA = 0;
  let melhorB = 0;
  let melhorTam = 0;
  let anterior = new Int32Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    const atual = new Int32Array(b.length + 1);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        atual[j] = anterior[j - 1] + 1;
        if (atual[j] > melhorTam) {
          melhorTam = atual[j];
          melhorA = i - atual[j];
          melhorB = j - atual[j];
        }
      }
    }
    anterior = atual;
  }

  if (melhorTam === 0) return 0;

  return (
    melhorTam +
    casamentosRecursivos(a.slice(0, melhorA), b.slice(0, melhorB)) +
    casamentosRecursivos(a.slice(melhorA + melhorTam), b.slice(melhorB + melhorTam))
  );
}

/** Equivalente a `difflib.get_close_matches(alvo, candidatos, n=1, cutoff)`. */
export function melhorCorrespondencia(
  alvo: string,
  candidatos: readonly string[],
  cutoff = 0.65,
): string | null {
  let melhor: string | null = null;
  let melhorRazao = cutoff;
  for (const c of candidatos) {
    const r = razaoSimilaridade(alvo, c);
    if (r >= melhorRazao) {
      melhorRazao = r;
      melhor = c;
    }
  }
  return melhor;
}

/**
 * Localiza a ficha CAPES de um programa aplicando, em ordem:
 * 1) match exato pelo nome normalizado;
 * 2) fuzzy matching com 65% de similaridade estrutural;
 * 3) interseção de palavras-chave principais (ignorando termos com ≤2 letras).
 */
export function encontrarFichaCapes(
  nomePPG: string,
  catalogo: CatalogoCapes,
): ProgramaCapes | null {
  const alvo = normalizarNomePPG(nomePPG);

  const exato = catalogo[alvo];
  if (exato) return exato;

  const chaves = Object.keys(catalogo);
  const fuzzy = melhorCorrespondencia(alvo, chaves, 0.65);
  if (fuzzy) return catalogo[fuzzy];

  const palavrasBusca = new Set(alvo.split(/\s+/).filter((p) => p.length > 2));
  for (const chave of chaves) {
    const palavrasCapes = new Set(chave.split(/\s+/).filter((p) => p.length > 2));
    let intersecao = 0;
    for (const p of palavrasBusca) if (palavrasCapes.has(p)) intersecao += 1;
    if (intersecao >= Math.max(1, palavrasBusca.size - 1)) return catalogo[chave];
  }

  return null;
}

/** Busca o catálogo institucional da CAPES via Netlify Function (sem CORS). */
export async function carregarCatalogoCapes(signal?: AbortSignal): Promise<CatalogoCapes> {
  const r = await fetch('/api/capes-proxy', { signal });
  if (!r.ok) throw new Error(`Panorama CAPES indisponível (HTTP ${r.status}).`);
  return (await r.json()) as CatalogoCapes;
}
