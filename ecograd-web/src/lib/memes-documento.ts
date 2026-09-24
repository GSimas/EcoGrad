/**
 * Extração dos memes de um documento, sem nenhuma dependência de grafo.
 *
 * Mora fora de `memetic-network` para que a página possa usá-la (nuvens e
 * listas de termos) sem arrastar o `graphology` e o Louvain para o bundle
 * inicial: a rede memética em si só é montada no worker de SNA.
 */
import type { Documento } from '@/types';
import { removerAcentos, STOPWORDS_NORMALIZADAS } from './stopwords';
import { parseOntologia } from './foresight-math';
import type { FonteMemes } from './memetics';

/**
 * Equivalente a `str.title()` do Python: a primeira letra de cada sequência de
 * letras vira maiúscula e o resto minúscula (inclusive após apóstrofos, como no
 * original — a chave de agrupamento precisa bater exatamente).
 */
export function tituloPython(texto: string): string {
  let anteriorEhLetra = false;
  let saida = '';
  for (const c of texto) {
    const ehLetra = /\p{L}/u.test(c);
    saida += ehLetra && !anteriorEhLetra ? c.toUpperCase() : c.toLowerCase();
    anteriorEhLetra = ehLetra;
  }
  return saida;
}

/** Memes de um documento, conforme a fonte escolhida. */
export function memesDoDocumento(d: Documento, fonte: FonteMemes): string[] {
  if (fonte === 'Artefatos Extraídos') {
    const onto = parseOntologia(d.ontologia_ia);
    if (!onto) return [];
    const limpar = (lista: string[]) =>
      lista.map((x) => tituloPython(String(x).trim())).filter((x) => x.length > 0);
    return [
      ...new Set([
        ...limpar(onto.teorias_e_modelos),
        ...limpar(onto.ferramentas_e_artefatos),
        ...limpar(onto.metodos_e_tecnicas),
      ]),
    ];
  }

  // Tradicional: palavras-chave + tokens do título sem stopwords
  const memes = new Set<string>();
  for (const p of d.palavras_chave) {
    const v = tituloPython(String(p).trim());
    if (v) memes.add(v);
  }
  const tituloNorm = removerAcentos(String(d.titulo ?? '').toLowerCase());
  for (const p of tituloNorm.match(/\b[a-z]{3,}\b/g) ?? []) {
    if (!STOPWORDS_NORMALIZADAS.has(p)) memes.add(tituloPython(p));
  }
  return [...memes];
}
