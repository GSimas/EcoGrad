/**
 * Padrões da varredura léxica que produz os CONJUNTOS CANDIDATOS das perguntas
 * temáticas da aferição (docs/AFERICAO-ETAPA-0.md).
 *
 * Vive à parte, sem nenhum efeito colateral, porque dois programas precisam dos
 * mesmos padrões: `afericao-gabaritos.mjs`, que conta, e `afericao-executar.mjs`,
 * que mede quanto das ferramentas do chat alcança esse conjunto. Duplicar os
 * padrões faria os dois divergirem em silêncio.
 *
 * Isto não é gabarito fechado: inclui falso positivo e perde trabalho escrito
 * com vocabulário diverso. Fechar exige triagem humana.
 */

/** Separa os campos para que um padrão não case atravessando a fronteira entre eles. */
export const SENTINELA = '\u0001';

export const chave = (s) => String(s ?? '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();

/** Título, resumo, palavras-chave e macrotema — tudo em que o tema pode aparecer. */
export const textoDoDoc = (d) => chave([d.titulo, d.resumo, (d.palavras_chave || []).join(' '), d.macrotema].join(SENTINELA));

/** Só os rótulos: o que a busca atual do EcoGrad consegue alcançar hoje. */
export const rotulosDoDoc = (d) => chave([d.titulo, (d.palavras_chave || []).join(' '), d.macrotema].join(SENTINELA));

export const PADROES = {
  empreendedorismoFeminino: [
    /empreendedor\w*\s+(feminin\w*|de mulher\w*|por mulher\w*)/,
    /(mulher\w*|feminin\w*)[^\u0001]{0,60}empreendedor/,
    /empreendedor[^\u0001]{0,60}(mulher\w*|feminin\w*|genero)/,
    /empreendedorismo\s+de\s+genero/,
  ],
  psicologiaPositiva: [/psicologia positiva/, /bem-estar subjetivo/, /florescimento humano/, /forcas de carater/, /\bperma\b/],
  blockchainQuantico: [/blockchain quantic\w*/, /criptografia post-quantica em blockchain/],
};

export const casaTema = (d, padroes) => padroes.some((p) => p.test(textoDoDoc(d)));
export const casaTemaPorRotulo = (d, padroes) => padroes.some((p) => p.test(rotulosDoDoc(d)));
