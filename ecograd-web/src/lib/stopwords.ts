import listas from '../data/stopwords-nuvem.json';

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
 * Stopwords das nuvens de palavras, em português, inglês e espanhol.
 *
 * As listas moram em `src/data/stopwords-nuvem.json` porque a nuvem do Panorama é
 * montada no build e as do dossiê e do relatório no navegador: duas cópias
 * divergiriam, e a mesma palavra sumiria de uma nuvem e não da outra. JSON, e não
 * um módulo, é o único formato que o TypeScript compilado e os scripts `.mjs`
 * leem do mesmo lugar.
 *
 * Divergiu de `STOPWORDS_ACADEMICAS` de propósito: aquela é transcrição fiel do
 * `backend.py` e tem paridade verificada; esta é do EcoGrad e pode crescer.
 */
export const STOPWORDS_NUVEM: ReadonlySet<string> = new Set([
  ...listas.pt, ...listas.en, ...listas.es, ...listas.academicas,
]);

/**
 * As mesmas listas separadas por idioma, para `detectarIdioma`.
 *
 * São palavras gramaticais de alta frequência: o idioma de um texto é o que mais
 * tiver delas. Reaproveitar o que já filtra as nuvens evita uma segunda lista
 * para dizer a mesma coisa.
 */
export const STOPWORDS_POR_IDIOMA: Readonly<Record<'pt' | 'en' | 'es', ReadonlySet<string>>> = {
  pt: new Set(listas.pt), en: new Set(listas.en), es: new Set(listas.es),
};
