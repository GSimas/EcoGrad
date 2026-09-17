/**
 * Cor por categoria de item — a mesma em todo o EcoGrad.
 *
 * O acervo tem muitos tipos (autor, orientador, coorientador, palavra-chave,
 * macrotema, documento), mas quem lê enxerga três famílias: **documento**,
 * **pessoa** e **tema**. Reduzir a isso é o que torna a cor legível: seis cores
 * viram decoração, três viram código.
 *
 * As classes só existem no CSS (`--tipo-*`, uma por paleta do tema), para que
 * tema claro, escuro e alto contraste continuem passando no teste de contraste.
 */
import type { TipoBusca } from '../types';

export type FamiliaTipo = 'documento' | 'pessoa' | 'tema';

/** Aceita qualquer rótulo de tipo do app; o que não se reconhece fica sem cor. */
export function familiaDoTipo(tipo: string | null | undefined): FamiliaTipo | null {
  switch (tipo) {
    case 'Documento': return 'documento';
    case 'Pessoa': case 'Autor': case 'Orientador': case 'Co-orientador': return 'pessoa';
    case 'Palavra-chave': case 'Macrotema': case 'Conceito': case 'Artefato (Ontologia IA)': return 'tema';
    default: return null;
  }
}

/** Classe de cor para um tipo, ou string vazia quando ele não tem família. */
export const classeDoTipo = (tipo: string | null | undefined): string => {
  const familia = familiaDoTipo(tipo);
  return familia ? `eco-tipo-${familia}` : '';
};

/** Nome da família para leitores de tela e títulos. */
export const rotuloDaFamilia: Record<FamiliaTipo, string> = {
  documento: 'trabalho',
  pessoa: 'pessoa',
  tema: 'tema',
};

export type { TipoBusca };
