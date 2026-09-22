/**
 * Palavras descartadas nas nuvens de palavras.
 *
 * Fica em `.mjs` porque é o único formato que o app (via `src/lib/stopwords.ts`)
 * e os scripts de build leem sem duplicação. A nuvem do Panorama é montada no
 * build e as do dossiê e do relatório no navegador: listas separadas divergiriam
 * na primeira correção, e a mesma palavra sumiria de uma nuvem e não da outra.
 *
 * Três idiomas porque o acervo tem os três: a UFSC deposita títulos e resumos em
 * português, o resumo em inglês é praxe, e há trabalhos em espanhol. Sem isso a
 * nuvem se enche de artigo e preposição, que dizem do idioma, não do tema.
 *
 * Os termos acadêmicos genéricos ao final ("estudo", "análise", "proposta") não
 * são gramaticais: aparecem em tanto título que descrevem o gênero do documento,
 * e não o assunto dele.
 */

/** Português — artigos, preposições, pronomes e verbos de ligação frequentes. */
const PT = [
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'uma', 'para', 'com',
  'não', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas',
  'ao', 'das', 'à', 'seu', 'sua', 'ou', 'nos', 'já', 'eu', 'também', 'pelo',
  'pela', 'até', 'isso', 'ela', 'ele', 'entre', 'sem', 'mesmo', 'aos', 'nas', 'me',
  'esse', 'essa', 'num', 'nem', 'numa', 'pelos', 'pelas', 'este', 'esta',
  'foi', 'foram', 'são', 'ser', 'através', 'forma', 'sob', 'sobre', 'quando',
  'onde', 'qual', 'quais', 'seus', 'suas', 'ainda', 'após', 'ante', 'cada',
  'toda', 'todo', 'todas', 'todos', 'muito', 'muitos', 'outra', 'outro',
  'outras', 'outros', 'tem', 'têm', 'há', 'está', 'estão', 'foi', 'era',
];

/** Inglês — o resumo em inglês é praxe nos trabalhos da UFSC. */
const EN = [
  'the', 'of', 'and', 'in', 'to', 'a', 'is', 'for', 'by', 'on', 'with', 'an',
  'as', 'this', 'that', 'which', 'from', 'it', 'or', 'be', 'are', 'at', 'has',
  'have', 'was', 'were', 'not', 'but', 'these', 'those', 'their', 'its', 'can',
  'may', 'also', 'than', 'then', 'such', 'been', 'into', 'more', 'most', 'other',
  'between', 'through', 'about', 'over', 'under', 'both', 'each', 'when',
  'where', 'while', 'there', 'here', 'they', 'them', 'we', 'our', 'you', 'your',
  'his', 'her', 'she', 'he', 'who', 'whose', 'will', 'would', 'should', 'could',
];

/** Espanhol — há trabalhos e resumos em espanhol no acervo. */
const ES = [
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'y', 'o',
  'que', 'en', 'para', 'con', 'por', 'como', 'más', 'pero', 'sus', 'su', 'al',
  'lo', 'le', 'ya', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'entre',
  'sin', 'sobre', 'hasta', 'desde', 'cuando', 'donde', 'cual', 'cuales',
  'son', 'ser', 'fue', 'fueron', 'está', 'están', 'hay', 'era', 'muy', 'también',
  'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'cada',
  'ellos', 'ellas', 'nosotros', 'se', 'no', 'sí', 'tiene', 'tienen',
];

/**
 * Gênero do documento, não assunto: estão em tanto título que classificá-los
 * como tema esconderia o que o trabalho de fato investiga.
 */
const ACADEMICAS = [
  'perspectiva', 'frente', 'partir', 'baseado', 'estudo', 'estudos', 'análise',
  'proposta', 'uso', 'aplicação', 'desenvolvimento', 'modelo', 'sistema',
  'avaliação', 'gestão', 'conhecimento', 'objetivo', 'pesquisa', 'trabalho',
  'resultados', 'método', 'métodos', 'apresenta', 'caso', 'casos', 'processo',
  'study', 'analysis', 'research', 'results', 'method', 'methods', 'approach',
  'development', 'evaluation', 'model', 'system', 'case', 'based', 'using',
  'estudio', 'análisis', 'investigación', 'resultados', 'método', 'modelo',
  'sistema', 'desarrollo', 'evaluación', 'caso', 'casos',
];

/** Descartadas em qualquer nuvem, nos três idiomas. */
export const STOPWORDS_NUVEM = new Set([...PT, ...EN, ...ES, ...ACADEMICAS]);
