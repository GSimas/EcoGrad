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

/**
 * Identidade de obra: a mesma regra das ferramentas do chat (sem acento, sem
 * caixa, espaços colapsados). Registros da mesma obra em coleções diferentes
 * contam uma vez.
 */
export const identidadeObra = (titulo) => chave(titulo).replace(/\s+/g, ' ').trim();

/**
 * Id curto e estável da obra, que liga as decisões da triagem aos registros.
 * FNV-1a de 32 bits: colisão é irrelevante nas centenas de obras de uma triagem.
 */
export const idObra = (titulo) => {
  let h = 0x811c9dc5;
  for (const c of identidadeObra(titulo)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `o-${h.toString(16).padStart(8, '0')}`;
};

/** Dois vocabulários a até 80 caracteres, sem atravessar a fronteira entre campos. */
const perto = (a, b) => new RegExp(`${a}[^${SENTINELA}]{0,80}${b}`);
/** Palavra inteira: nenhuma letra imediatamente antes nem depois. */
const palavra = (p) => new RegExp(`(?<![a-z])${p}(?![a-z])`);

/**
 * Vocabulário vizinho que `PADROES` não cobre. Só traz candidatos para a
 * triagem humana — quem decide se pertencem é quem tria —, por isso não entra
 * em `casaTema` nem nos gabaritos.
 */
export const EXPANSAO = {
  empreendedorismoFeminino: [
    palavra('empreendedoras?'),
    palavra('empresarias?'),
    perto('(mulher\\w*|feminin\\w*|genero)', '(negocio\\w*|microempre\\w*|pequenas? empresas?|autonomia economica|geracao de renda)'),
    perto('(negocio\\w*|microempre\\w*|geracao de renda)', '(mulher\\w*|feminin\\w*)'),
  ],
  psicologiaPositiva: [
    /bem-estar (no trabalho|psicologico|laboral)/,
    /satisfacao com a vida/,
    /afetos? positivos?/,
    /capital psicologico/,
    /florescimento/,
    /gratidao/,
    /otimismo/,
    /autoeficacia/,
    /engajamento no trabalho/,
    palavra('panas'),
    /mindfulness/,
    /forcas pessoais/,
  ],
};
