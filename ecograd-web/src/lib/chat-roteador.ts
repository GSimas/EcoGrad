/**
 * Roteador de intenção: decide o que a pergunta pede e qual ferramenta responde.
 *
 * Na Etapa 1 o roteamento é determinístico, por padrão de linguagem, e não por
 * chamada de ferramenta do modelo. A razão é prática e vale registrar: o chat do
 * EcoGrad é BYOK com nove provedores em três formatos de API, e um laço de
 * `tool calling` compatível com todos eles é obra de outra etapa. Com roteamento
 * determinístico, **o recorte aparece mesmo para quem não configurou chave** — o
 * modelo entra só para escrever a síntese sobre dados já apurados, que é
 * exatamente a ordem que a decisão D7 do ADR pede.
 *
 * O preço é conhecido: padrão de linguagem não cobre toda paráfrase. Quando nada
 * casa, a intenção é `tema`, que busca os termos da pergunta — degrada para algo
 * útil em vez de errar de intenção. O roteador semântico entra quando houver
 * índice para isso.
 *
 * Importa por caminho relativo: os testes compilam sem o atalho `@/`.
 */
import { chaveBusca } from './utils';

export type Intencao =
  | 'panorama' | 'colecao' | 'pessoa' | 'ranking_orientacao' | 'contagem_pessoas'
  | 'macrotemas' | 'origem_termo' | 'serie' | 'ano' | 'tema' | 'existencia' | 'titulo'
  | 'ontologia' | 'acao_carregar' | 'acao_abrir' | 'qualidade' | 'dado_pessoal' | 'fora_do_acervo';

/**
 * Onde a resposta é apurada. `nenhum` é recusa: nada a consultar.
 *
 * `indice` é o Postgres da Etapa 2, que tem o acervo inteiro com o texto dos
 * resumos. Quando ele está no ar, é a melhor apuração disponível sem carregar
 * nada — 79% de revocação contra os 46% do catálogo por rótulo. Quando não
 * está, a conversa cai no catálogo e a resposta declara o limite.
 */
export type Escopo = 'recorte' | 'catalogo' | 'indice' | 'nenhum';

export interface Plano {
  intencao: Intencao;
  /** O assunto extraído da pergunta: nome de pessoa, coleção, tema ou título. */
  alvo: string;
  escopo: Escopo;
  /** Ferramenta de `chat-ferramentas` (recorte) ou `chat-catalogo` (catálogo). */
  ferramenta: string | null;
  argumentos: Record<string, unknown>;
  /** Por que a resposta recusa, quando recusa. */
  recusa?: string;
  /** O que a resposta precisa declarar junto do resultado. */
  declarar: string[];
  /** Exige resumo: na tela inicial, o catálogo não basta e o recorte é oferecido. */
  exigeResumo: boolean;
}

export interface Contexto {
  /** Há base carregada? Sem ela, o índice responde; sem ele, o catálogo. */
  baseCarregada: boolean;
  /** O índice da Etapa 2 respondeu e está na mesma versão da base publicada. */
  indiceDisponivel?: boolean;
}

const DECLARACOES = {
  grafia: 'Conta registros por grafia, não por pessoa unificada.',
  rotulo: 'O catálogo indexa rótulos; o que só está no resumo exige carregar o recorte.',
  automatica: 'Macrotema é classificação automática da base, não categoria oficial do programa.',
  parcial: 'O último ano pode estar em coleta e não representar o ano fechado.',
  duplicata: 'Registros e trabalhos distintos são contagens diferentes: o acervo cataloga a mesma obra em mais de uma coleção.',
  cobertura: 'Parte dos registros não tem resumo utilizável e fica fora de qualquer leitura de texto.',
  ontologia: 'A base publicada não traz teorias, ferramentas e métodos extraídos: o que existe são menções no texto dos resumos, sem campo validado.',
  indice: 'Apurado no índice do acervo inteiro, que lê o texto dos resumos — não só os rótulos.',
  indiceVelho: 'O índice foi gerado de uma versão anterior das bases e pode estar atrás do que a busca mostra.',
  semAnoNoCatalogo: 'O catálogo indexa rótulos — título, pessoa, palavra-chave, macrotema — e não guarda o ano do trabalho.',
  semContagemPorColecao: 'O catálogo identifica a coleção, mas não conta quantos registros ela tem: a contagem sai do recorte carregado.',
};

/** Texto sem acento, caixa nem pontuação de borda, para casar padrão. */
const limpar = (p: string) => chaveBusca(p).replace(/[¿?!.;]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Primeiro trecho entre aspas — quem cita título costuma usá-las. */
function entreAspas(pergunta: string): string | null {
  const m = pergunta.match(/["“”'']([^"“”'']{6,})["“”'']/);
  return m ? m[1].trim() : null;
}

/**
 * O assunto depois de uma preposição de tema. Corta a cauda de pergunta
 * ("... no acervo", "... na ufsc") que não faz parte do assunto.
 *
 * Vale o marcador que aparece **primeiro na frase**, não o primeiro da lista:
 * em "abra o dossiê da Patricia de Sá Freire" o ` de ` do meio do nome vinha
 * antes na lista e devolvia "sa freire", abrindo o dossiê de outra pessoa.
 * Empate de posição fica com o marcador mais longo, que é o mais específico.
 */
function depoisDe(limpa: string, marcadores: readonly string[]): string {
  let melhor: { i: number; m: string } | null = null;
  for (const m of marcadores) {
    const i = limpa.indexOf(` ${m} `);
    if (i < 0) continue;
    if (!melhor || i < melhor.i || (i === melhor.i && m.length > melhor.m.length)) melhor = { i, m };
  }
  return melhor ? cortarCauda(limpa.slice(melhor.i + melhor.m.length + 2)) : '';
}

const CAUDA = /\s+(no|na|em|do|da|de)\s+(acervo|ufsc|base|catalogo)\b.*$/;
const VERBO_FINAL = /\s+(tem|possui|orientou|publicou|produziu|escreveu|aparece|existe|existem)\s*$/;
/** O recorte temporal é a intenção da pergunta, não parte do assunto. */
const CAUDA_SERIE = /\s+(ano a ano|por ano|ao longo do tempo|na linha do tempo|em cada ano)\s*$/;
const cortarCauda = (s: string) => s.replace(CAUDA, '').replace(/\s+(e|em)\s+(quais|que)\s+.*$/, '').replace(/[,;]+.*$/, '').replace(CAUDA_SERIE, '').replace(VERBO_FINAL, '').trim();

interface Regra {
  intencao: Intencao;
  padrao: RegExp;
  alvo?: (limpa: string, pergunta: string) => string;
  escopo?: Escopo;
  ferramenta?: string;
  argumentos?: (alvo: string) => Record<string, unknown>;
  recusa?: string;
  declarar?: string[];
  exigeResumo?: boolean;
}

/**
 * Ordem importa: recusa antes de consulta, específico antes de genérico. `tema`
 * não está aqui — é o destino de quem não casa com nada.
 */
const REGRAS: readonly Regra[] = [
  {
    intencao: 'qualidade',
    padrao: /\b(melhor|pior|mais relevante|mais importante|mais forte|qualidade d)\b/,
    escopo: 'nenhum',
    recusa: 'Os indicadores do EcoGrad não medem qualidade. Posso ordenar por critérios verificáveis: mais recente, mais trabalhos na coleção ou mais central na rede.',
  },
  {
    intencao: 'dado_pessoal',
    padrao: /\b(e-?mail|telefone|celular|contato|endereco|cpf|curriculo|lattes)\b/,
    escopo: 'nenhum',
    recusa: 'O acervo guarda título, autoria, orientação, palavras-chave, resumo e o link da fonte. Dado de contato não está aqui, e não vou procurar fora.',
  },
  {
    intencao: 'fora_do_acervo',
    padrao: /\b(escreva|redija|produza|faca|elabore|monte)\b.*\b(revisao|artigo|texto|tcc|dissertacao|tese|resumo|introducao)\b/,
    alvo: (l) => depoisDe(l, ['sobre', 'a respeito de']),
    escopo: 'recorte',
    ferramenta: 'buscar_no_texto',
    argumentos: (alvo) => ({ consulta: alvo, frase: true }),
    recusa: 'Não escrevo o trabalho em seu nome. Posso entregar o recorte, os agrupamentos e as citações para você escrever.',
    exigeResumo: true,
  },
  {
    intencao: 'acao_carregar',
    padrao: /\b(carregue|carregar|carrega|abra as colecoes|baixe)\b/,
    alvo: (l) => depoisDe(l, ['sobre', 'de', 'do', 'da']),
    escopo: 'catalogo',
    ferramenta: 'tema_no_catalogo',
    argumentos: (alvo) => ({ consulta: alvo }),
    // Pedir para carregar é o pedido de carregar: sem isto, a única pergunta
    // que pede o recorte era a única sem o botão que o carrega.
    exigeResumo: true,
    declarar: [DECLARACOES.rotulo],
  },
  {
    intencao: 'acao_abrir',
    padrao: /\b(abra|abrir|mostre) (o |a )?(dossie|perfil|pagina)\b/,
    alvo: (l) => depoisDe(l, ['de', 'do', 'da', 'dossie de', 'dossie do', 'dossie da']),
    escopo: 'catalogo',
    ferramenta: 'pessoa_no_catalogo',
    argumentos: (alvo) => ({ nome: alvo }),
    declarar: [DECLARACOES.grafia],
  },
  {
    intencao: 'ontologia',
    padrao: /\b(ferramentas|instrumentos|artefatos|metodos|metodologias|tecnicas|teorias|modelos teoricos)\b/,
    alvo: (l) => depoisDe(l, ['sobre', 'no contexto de', 'em', 'de']),
    escopo: 'recorte',
    ferramenta: 'buscar_no_texto',
    argumentos: (alvo) => ({ consulta: alvo, frase: true }),
    declarar: [DECLARACOES.ontologia, DECLARACOES.cobertura],
    exigeResumo: true,
  },
  {
    intencao: 'origem_termo',
    padrao: /\b(palavra-?chave ou macrotema|macrotema ou palavra-?chave)\b/,
    alvo: (l) => cortarCauda(l.replace(/\b(e|eh) (palavra-?chave ou macrotema|macrotema ou palavra-?chave)\b.*$/, '')),
    escopo: 'recorte',
    ferramenta: 'origem_do_termo',
    argumentos: (alvo) => ({ termo: alvo }),
    declarar: [DECLARACOES.automatica],
  },
  {
    intencao: 'macrotemas',
    padrao: /\bmacrotemas?\b/,
    escopo: 'recorte',
    ferramenta: 'top_macrotemas',
    argumentos: () => ({ limite: 10 }),
    declarar: [DECLARACOES.automatica],
  },
  {
    intencao: 'ranking_orientacao',
    padrao: /\bquem\b.*\b(orienta|orientou|orientam)\b/,
    escopo: 'catalogo',
    ferramenta: 'top_do_tipo',
    argumentos: () => ({ tipo: 'Orientador', limite: 10 }),
    declarar: [DECLARACOES.grafia],
  },
  {
    intencao: 'contagem_pessoas',
    padrao: /\bquant[ao]s (pessoas|orientadores|autores|professores)\b/,
    escopo: 'recorte',
    ferramenta: 'grafias_do_papel',
    argumentos: () => ({ papel: 'Orientador' }),
    declarar: [DECLARACOES.grafia],
  },
  {
    intencao: 'titulo',
    padrao: /\b(aparece|repete|repetido|quantas vezes|duplicad)\b/,
    alvo: (l, p) => entreAspas(p) ?? depoisDe(l, ['trabalho', 'titulo']),
    escopo: 'recorte',
    ferramenta: 'registros_do_titulo',
    argumentos: (alvo) => ({ titulo: alvo }),
    declarar: [DECLARACOES.duplicata],
  },
  {
    intencao: 'existencia',
    padrao: /\bexiste (algum|alguma|algo|trabalho|pessoa|autor|orientador)\b|\btem (algum|alguma) trabalho\b/,
    alvo: (l, p) => entreAspas(p) ?? depoisDe(l, ['sobre', 'chamad[oa]', 'com o titulo']),
    escopo: 'catalogo',
    ferramenta: 'existe_no_catalogo',
    argumentos: (alvo) => ({ consulta: alvo }),
    declarar: [DECLARACOES.rotulo, DECLARACOES.duplicata],
  },
  {
    intencao: 'ano',
    padrao: /\b(de|em|do ano de) (19|20)\d\d\b/,
    alvo: (l) => (l.match(/\b((19|20)\d\d)\b/) ?? [''])[1],
    escopo: 'recorte',
    ferramenta: 'serie_anual',
    argumentos: () => ({}),
    declarar: [DECLARACOES.parcial],
  },
  {
    intencao: 'serie',
    padrao: /\b(ano a ano|por ano|evolucao|serie (temporal|anual)|ao longo do tempo)\b/,
    alvo: (l) => depoisDe(l, ['producao do', 'producao da', 'do', 'da']),
    escopo: 'recorte',
    ferramenta: 'serie_anual',
    argumentos: () => ({}),
    declarar: [DECLARACOES.parcial],
  },
  {
    intencao: 'colecao',
    padrao: /\b(programa de pos-?graduacao|ppg|colecao|curso de)\b/,
    alvo: (l) => cortarCauda(depoisDe(l, ['o', 'a', 'do', 'da', 'no', 'na']) || l),
    escopo: 'recorte',
    ferramenta: 'recorte_da_colecao',
    argumentos: (alvo) => ({ nome: alvo }),
    declarar: [DECLARACOES.cobertura],
  },
  {
    intencao: 'panorama',
    padrao: /\b(tamanho do acervo|quantos (trabalhos|registros|documentos) (existem|tem|ha) no acervo|o que (tem|existe) no acervo)\b/,
    escopo: 'recorte',
    ferramenta: 'contar_acervo',
    argumentos: () => ({}),
    declarar: [DECLARACOES.cobertura, DECLARACOES.duplicata],
  },
  {
    intencao: 'pessoa',
    // A preposição vem logo depois do substantivo: "trabalhos da Patricia", não
    // "trabalhos distintos ... sobre gestão do conhecimento", que é tema.
    padrao: /\bquant[ao]s (trabalhos|orientacoes|teses|dissertacoes) (a|o|d[aoe]|do|da) \S|\bquem (e|eh) \b|\bem quais papeis\b/,
    alvo: (l) => depoisDe(l, ['trabalhos da', 'trabalhos do', 'trabalhos de', 'trabalhos a', 'trabalhos o', 'orientacoes da', 'orientacoes do', 'quem e', 'quem eh']),
    escopo: 'catalogo',
    ferramenta: 'pessoa_no_catalogo',
    argumentos: (alvo) => ({ nome: alvo }),
    declarar: [DECLARACOES.grafia, DECLARACOES.duplicata],
  },
];

/** Assunto de uma pergunta de tema, quando nenhuma regra específica casou. */
function alvoDeTema(limpa: string, pergunta: string): string {
  const citado = entreAspas(pergunta);
  if (citado) return citado;
  const apos = depoisDe(limpa, ['sobre', 'a respeito de', 'tratando', 'falam de', 'falam sobre', 'produziu sobre', 'no contexto de']);
  if (apos) return apos;
  // Sem marcador, remove a moldura da pergunta e fica com o miolo.
  return cortarCauda(limpa
    .replace(/^(quais|qual|quantos|quantas|como|onde|quem|o que|existe|existem|tem|ha|me diga|liste|mostre)\b\s*/g, '')
    .replace(/^(sao|e|eh|os|as|o|a|um|uma)\s+/g, '')
    .replace(/\b(trabalhos|trabalho|pesquisas|pesquisa|teses|dissertacoes|artigos|registros)\b\s*/g, '')
    .replace(/^(estao|esta|foram|foi|existem|existe)\s+/g, '')
    .trim());
}

/**
 * Plano de resposta. Uma intenção apurada no recorte cai para o catálogo quando
 * não há base carregada: na tela inicial, responde-se com rótulos, declara-se o
 * limite e oferece-se carregar o recorte.
 */
export function planejar(pergunta: string, ctx: Contexto): Plano {
  const limpa = limpar(pergunta);
  const regra = REGRAS.find((r) => r.padrao.test(limpa));

  const intencao = regra?.intencao ?? 'tema';
  const alvo = regra ? (regra.alvo?.(limpa, pergunta) ?? '').trim() : alvoDeTema(limpa, pergunta);
  const declarar = [...(regra?.declarar ?? [])];
  let escopo: Escopo = regra?.escopo ?? 'recorte';
  let ferramenta = regra?.ferramenta ?? 'buscar_no_texto';
  let argumentos = regra?.argumentos?.(alvo) ?? { consulta: alvo, frase: true };
  const exigeResumo = regra?.exigeResumo ?? intencao === 'tema';

  let recusa = regra?.recusa;

  // Sem base carregada, o índice responde primeiro: ele tem o acervo inteiro
  // com o texto dos resumos, que é justamente o que o catálogo não tem. O
  // catálogo continua sendo a rede de segurança quando o índice não está no ar.
  if (escopo === 'recorte' && !ctx.baseCarregada && ctx.indiceDisponivel) {
    const noIndice = NO_INDICE[ferramenta];
    if (noIndice) {
      escopo = 'indice';
      declarar.push(DECLARACOES.indice);
      ferramenta = noIndice.nome;
      // "Trabalhos de 2026" e "produção do EGC ano a ano" caem na mesma
      // ferramenta, mas o alvo de uma é um ano e o da outra é uma coleção.
      // Passar o ano como filtro de coleção devolvia lista vazia.
      argumentos = intencao === 'ano' ? { colecao_filtro: null } : noIndice.argumentos(alvo);
      return {
        intencao, alvo, escopo, ferramenta, argumentos, recusa,
        declarar,
        // O índice já leu o resumo: não há o que carregar para responder melhor.
        exigeResumo: false,
      };
    }
  }

  // Sem base carregada, o que dependia do recorte passa pelo catálogo.
  //
  // Nem tudo tem equivalente, e é aqui que a resposta pode mentir: o ano não é
  // rótulo do catálogo, e cair numa busca por texto devolvia os trabalhos com
  // o ano no título como se fossem a produção daquele ano. Quando o catálogo
  // não tem como responder, a resposta declara isso e não mostra número.
  if (escopo === 'recorte' && !ctx.baseCarregada) {
    escopo = 'catalogo';
    declarar.push(DECLARACOES.rotulo);
    if (intencao === 'ano') {
      escopo = 'nenhum';
      recusa = `${DECLARACOES.semAnoNoCatalogo} Para contar por ano eu preciso do recorte carregado: escolha a coleção na busca e refaça a pergunta.`;
    } else if (intencao === 'serie') {
      // A série exige o recorte, mas a coleção da pergunta pode ser carregada.
      ferramenta = 'colecao_no_catalogo';
      argumentos = { nome: alvo };
      declarar.push(DECLARACOES.semAnoNoCatalogo);
    } else {
      const equivalente = EQUIVALENTE_NO_CATALOGO[ferramenta];
      if (equivalente) {
        if (ferramenta === 'recorte_da_colecao') declarar.push(DECLARACOES.semContagemPorColecao);
        ferramenta = equivalente.nome;
        argumentos = equivalente.argumentos(alvo);
      } else {
        ferramenta = 'tema_no_catalogo';
        argumentos = { consulta: alvo };
      }
    }
  }

  return {
    intencao, alvo, escopo,
    ferramenta: escopo === 'nenhum' ? null : ferramenta,
    argumentos: escopo === 'nenhum' ? {} : argumentos,
    recusa,
    declarar,
    // Coleção e série só respondem de verdade com o recorte carregado.
    exigeResumo: exigeResumo || (escopo === 'catalogo' && (intencao === 'colecao' || intencao === 'serie')),
  };
}

/**
 * O que cada ferramenta do recorte tem no índice da Etapa 2.
 *
 * Diferente do mapa do catálogo, aqui não há degradação: as funções do índice
 * respondem a mesma pergunta sobre o acervo inteiro. O que não está neste mapa
 * simplesmente não foi construído ainda, e cai no catálogo com a ressalva de
 * rótulo — nunca em uma resposta que finge ser outra.
 */
const NO_INDICE: Record<string, { nome: string; argumentos: (alvo: string) => Record<string, unknown> }> = {
  buscar_no_texto: { nome: 'buscar_texto', argumentos: (alvo) => ({ consulta: alvo, limite: 25 }) },
  contar_acervo: { nome: 'contar_acervo', argumentos: () => ({}) },
  recorte_da_colecao: { nome: 'recorte_da_colecao', argumentos: (alvo) => ({ nome: alvo }) },
  serie_anual: { nome: 'serie_anual', argumentos: (alvo) => ({ colecao_filtro: alvo || null }) },
  registros_do_titulo: { nome: 'registros_do_titulo', argumentos: (alvo) => ({ titulo_busca: alvo }) },
  top_macrotemas: { nome: 'top_macrotemas', argumentos: () => ({ limite: 10 }) },
};

/** O que cada ferramenta do recorte tem de mais próximo no catálogo. */
const EQUIVALENTE_NO_CATALOGO: Record<string, { nome: string; argumentos: (alvo: string) => Record<string, unknown> }> = {
  contar_acervo: { nome: 'panorama_do_catalogo', argumentos: () => ({}) },
  recorte_da_colecao: { nome: 'colecao_no_catalogo', argumentos: (alvo) => ({ nome: alvo }) },
  top_macrotemas: { nome: 'top_do_tipo', argumentos: () => ({ tipo: 'Macrotema', limite: 10 }) },
  // Quantas grafias existem é contagem, não ranking: o panorama traz o total
  // por tipo, enquanto `top_do_tipo` respondia quem mais orienta — outra pergunta.
  grafias_do_papel: { nome: 'panorama_do_catalogo', argumentos: () => ({}) },
  origem_do_termo: { nome: 'tema_no_catalogo', argumentos: (alvo) => ({ consulta: alvo }) },
  registros_do_titulo: { nome: 'existe_no_catalogo', argumentos: (alvo) => ({ consulta: alvo }) },
  buscar_no_texto: { nome: 'tema_no_catalogo', argumentos: (alvo) => ({ consulta: alvo }) },
};
