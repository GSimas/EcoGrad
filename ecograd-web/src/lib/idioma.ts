import { STOPWORDS_POR_IDIOMA } from './stopwords';

/**
 * Em que idioma está um texto do acervo, para marcá-lo com `lang`.
 *
 * Sem isso o leitor de tela lê o resumo em inglês com fonemas portugueses, o que
 * é praticamente ininteligível — e resumo em inglês é praxe nas teses da UFSC
 * (WCAG 3.1.2, Idioma de partes).
 *
 * A detecção conta palavras gramaticais de cada idioma, reaproveitando as listas
 * das nuvens. Não é classificador de língua: é o suficiente para separar os três
 * idiomas que o acervo tem, e desiste quando não tem certeza. Desistir devolve
 * `null` e nenhum `lang` é emitido — um `lang` errado é pior que nenhum, porque
 * o leitor troca de voz com confiança para a pronúncia errada.
 */
export type Idioma = 'pt' | 'en' | 'es';

/** Abaixo disto a amostra é curta demais para a contagem significar algo. */
const MINIMO_PALAVRAS = 8;
/** O vencedor precisa estar à frente por esta margem; senão, é empate e desistimos. */
const MARGEM = 1.5;

export function detectarIdioma(texto: string): Idioma | null {
  const palavras = texto.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (palavras.length < MINIMO_PALAVRAS) return null;
  const placar = (Object.keys(STOPWORDS_POR_IDIOMA) as Idioma[]).map((idioma) => {
    const lista = STOPWORDS_POR_IDIOMA[idioma];
    return [idioma, palavras.filter((p) => lista.has(p)).length] as const;
  }).sort((a, b) => b[1] - a[1]);
  const [primeiro, segundo] = placar;
  if (primeiro[1] === 0) return null;
  // Português e espanhol compartilham muita palavra ("de", "que", "en"): sem a
  // margem, um resumo em espanhol viraria português com frequência.
  return primeiro[1] >= (segundo?.[1] ?? 0) * MARGEM ? primeiro[0] : null;
}

export interface BlocoDeTexto {
  texto: string;
  idioma: Idioma | null;
}

/**
 * O texto partido nos blocos de idioma que o compõem.
 *
 * O campo `resumo` do acervo costuma trazer o resumo em português e o abstract em
 * inglês emendados, separados por quebra de linha. Marcar o conjunto com um só
 * `lang` erraria metade; marcar cada bloco acerta os dois.
 *
 * Blocos vizinhos de mesmo idioma voltam a ser um só, para o resultado não virar
 * uma sopa de elementos quando o texto é uniforme — que é o caso comum.
 */
export function blocosPorIdioma(texto: string): BlocoDeTexto[] {
  const partes = texto.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
  if (partes.length <= 1) return texto.trim() ? [{ texto: texto.trim(), idioma: detectarIdioma(texto) }] : [];
  const blocos: BlocoDeTexto[] = [];
  for (const parte of partes) {
    const idioma = detectarIdioma(parte);
    const anterior = blocos.at(-1);
    // Um bloco curto demais para detectar herda o idioma do vizinho: um parágrafo
    // solto no meio do abstract está no idioma do abstract, não em nenhum.
    if (anterior && (anterior.idioma === idioma || idioma === null)) anterior.texto += `\n\n${parte}`;
    else blocos.push({ texto: parte, idioma });
  }
  return blocos;
}
