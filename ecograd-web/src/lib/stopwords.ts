/**
 * Dicionário acadêmico bilíngue (PT/EN).
 * Transcrição fiel de STOPWORDS_ACADEMICAS (backend.py:33).
 */
export const STOPWORDS_ACADEMICAS: ReadonlySet<string> = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'uma', 'para', 'com',
  'não', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas',
  'ao', 'das', 'à', 'seu', 'sua', 'ou', 'nos', 'já', 'eu', 'também', 'pelo',
  'pela', 'até', 'isso', 'ela', 'entre', 'sem', 'mesmo', 'aos', 'nas', 'me',
  'esse', 'essa', 'num', 'nem', 'numa', 'pelos', 'pelas', 'este', 'esta',
  'sob', 'perspectiva', 'frente', 'partir', 'baseado',
  'sobre', 'estudo', 'análise', 'proposta', 'uso', 'aplicação', 'desenvolvimento',
  'modelo', 'sistema', 'avaliação', 'gestão', 'conhecimento', 'engenharia',
  'objetivo', 'pesquisa', 'trabalho', 'resultados', 'método', 'foi', 'foram',
  'são', 'ser', 'através', 'forma', 'apresenta',
  'the', 'of', 'and', 'in', 'to', 'a', 'is', 'for', 'by', 'on', 'with', 'an',
  'as', 'this', 'that', 'which', 'from', 'it', 'or', 'be', 'are', 'at', 'has',
  'have', 'was', 'were', 'not', 'but',
]);

/** Equivalente a `unicodedata.normalize('NFD', s)` + descarte de marcas (Mn). */
export function removerAcentos(texto: unknown): string {
  if (typeof texto !== 'string') return '';
  return texto.normalize('NFD').replace(/\p{Mn}/gu, '');
}

/** Versão sem acentos das stopwords, usada pela memética (backend.py:1021). */
export const STOPWORDS_NORMALIZADAS: ReadonlySet<string> = new Set(
  [...STOPWORDS_ACADEMICAS].map(removerAcentos),
);

/**
 * Stopwords estritamente PT usadas por `obter_frequencias_texto` (backend.py:1303)
 * na nuvem de palavras de títulos/resumos. Mantida separada porque a lista original
 * do Python é um subconjunto (sem os termos em inglês).
 */
export const STOPWORDS_NUVEM_PT: ReadonlySet<string> = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'uma', 'para', 'com',
  'não', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas',
  'ao', 'das', 'à', 'seu', 'sua', 'ou', 'nos', 'já', 'eu', 'também', 'pelo',
  'pela', 'até', 'isso', 'ela', 'entre', 'sem', 'mesmo', 'aos', 'nas', 'me',
  'esse', 'essa', 'num', 'nem', 'numa', 'pelos', 'pelas', 'este', 'esta',
  'sobre', 'estudo', 'análise', 'proposta', 'uso', 'aplicação', 'desenvolvimento',
  'modelo', 'sistema', 'avaliação', 'gestão', 'conhecimento', 'engenharia',
  'objetivo', 'pesquisa', 'trabalho', 'resultados', 'método', 'foi', 'foram',
  'são', 'ser', 'através', 'forma', 'apresenta',
]);
