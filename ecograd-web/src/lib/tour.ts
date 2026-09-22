/**
 * Roteiro do tour guiado.
 *
 * Só dados e decisões puras: quais passos existem, quais valem para o estado
 * atual e qual coleção serve de exemplo. Quem dirige o navegador é
 * `services/tour`; quem desenha é o Driver.js. Assim o roteiro é revisável e
 * testável sem montar tela nenhuma.
 *
 * Os alvos são `aria-label` e `role`, nunca classe CSS: são os mesmos
 * seletores que a verificação automatizada usa, e não quebram quando o estilo
 * muda.
 */

export type AcaoTour = 'carregar' | 'abrirTema';
export type PaginaDoTour = 'inicio' | 'dashboard' | 'busca';

export interface PassoTour {
  id: string;
  /** Seletor CSS do elemento destacado. */
  alvo: string;
  titulo: string;
  texto: string;
  /**
   * Passo em que o tour para e espera o usuário agir. Nunca trava: o balão
   * oferece pular, e uma ação fora do roteiro não prende ninguém.
   */
  acao?: AcaoTour;
  /** Passos do recorte só fazem sentido para quem ainda não carregou nada. */
  somenteSemAnalise?: boolean;
  /**
   * Alvo que só existe na tela larga. No celular ele mora dentro da gaveta
   * fechada: destacá-lo daria um recorte de tamanho zero, e esperá-lo montar
   * seria tempo parado à toa.
   */
  soDesktop?: boolean;
  /**
   * Passo que só tem alvo na tela depois de uma ação. Quem pula a ação pula
   * junto o que dependia dela — ver `proximoPasso`.
   */
  dependeDe?: AcaoTour;
}

const PASSOS: readonly PassoTour[] = [
  {
    id: 'busca',
    // O bloco inteiro, e não só o campo: durante o tour apenas o que está
    // dentro do recorte aceita clique, e escolher uma coleção exige a lista de
    // sugestões, que aparece abaixo do campo.
    alvo: '[aria-label="Busca no acervo"]',
    titulo: 'Comece pelo recorte',
    texto: 'Tudo no EcoGrad descreve o recorte que você escolhe. Aqui você busca em todo o acervo — um documento, uma pessoa, um tema ou uma coleção inteira — e nada é baixado até você confirmar.',
    somenteSemAnalise: true,
  },
  {
    id: 'carregar',
    alvo: '[aria-label^="Carregar "]',
    titulo: 'Sua vez: carregue a seleção',
    texto: 'Cada item escolhido vira uma etiqueta, e o rodapé mostra quantas coleções serão baixadas e o tamanho. Clique em Carregar para seguir — o tour continua assim que a análise abrir.',
    acao: 'carregar',
    somenteSemAnalise: true,
  },
  {
    id: 'indicadores',
    alvo: '[aria-label="Indicadores do recorte"]',
    titulo: 'Os números contam o recorte, não a universidade',
    texto: 'Cada cartão descreve o que você carregou. Autores, Orientadores e Palavras-chave contam nomes distintos, não pessoas: homônimos viram um nome só e grafias diferentes contam separado. O ⓘ de cada cartão diz exatamente o que entra na conta.',
  },
  {
    id: 'cobertura',
    alvo: '[aria-label="Cobertura do recorte"]',
    titulo: 'Leia a cobertura antes dos números',
    texto: 'Este bloco diz quantos registros vieram, que anos aparecem e quanto deles tem resumo, palavras-chave e orientação. É o que separa uma queda real de uma lacuna de metadado — leia sempre antes de interpretar qualquer frequência.',
  },
  {
    id: 'destaques',
    alvo: '[aria-label="Destaques do Ecossistema"]',
    titulo: 'Quatro leituras do mesmo recorte',
    texto: 'Top 10 ordena por volume. Volumes e Genealogia mostra quem orientou quem. Intermediação e proximidade descreve a posição de cada pessoa na rede — quem liga grupos, não quem é melhor. Diagrama radial desenha as ligações. O que não descreveria nada neste recorte — uma rede sem ligação, uma série de um ano só — não aparece, e uma nota diz o que sumiu e por quê: ocultar é decisão de exibição, nenhum registro saiu dos cálculos.',
  },
  {
    id: 'verGrafico',
    alvo: '[aria-label^="Visualização de "]',
    titulo: 'Todo gráfico também é tabela',
    texto: 'Este par de botões troca entre o gráfico e os dados. A tabela mostra nomes completos, exporta e abre uma entidade pelo teclado; o gráfico baixa em JPG ou PNG. As barras são ocorrências no recorte carregado — frequência descreve o que foi coletado, não mede mérito.',
  },
  {
    id: 'coberturaAno',
    alvo: '[aria-label="Cobertura de metadados por ano"]',
    titulo: 'O mapa de lacunas, ano a ano',
    texto: 'Cada célula é a porcentagem dos registros daquele ano com o campo preenchido, e as barras abaixo dizem quantos registros o ano tem. Um tema que some em 2010 pode ter sumido — ou 2010 pode ser o ano que veio sem palavras-chave. Este mapa distingue os dois casos.',
  },
  {
    id: 'filtros',
    alvo: '[aria-label="Filtros dos trabalhos"]',
    titulo: 'Filtrar a lista não muda a conta',
    texto: 'Toda lista de trabalhos filtra por texto, por coleção e por ter resumo, e o aviso abaixo diz quantos registros sobraram. Estes filtros recortam o que você lê, e não o que foi calculado: os indicadores e os gráficos continuam descrevendo o recorte inteiro.',
  },
  {
    id: 'tema',
    alvo: '[aria-label="Temas para começar a exploração"]',
    titulo: 'Sua vez: abra um tema',
    texto: 'Estes são os temas mais frequentes no recorte. Frequência descreve o que foi carregado; não mede qualidade nem tendência. Clique em um deles para abrir o dossiê.',
    acao: 'abrirTema',
  },
  {
    id: 'dossie',
    // O título, e não a seção inteira: a lista de trabalhos passa de mil pixels
    // de altura, e um recorte maior que a tela não destaca coisa alguma.
    alvo: '[aria-label="Trabalhos associados"] > h2',
    dependeDe: 'abrirTema',
    titulo: 'O dossiê reúne a evidência',
    texto: 'Cada dossiê mostra os trabalhos associados, as pessoas e os temas ligados a eles, e as análises que fazem sentido para aquele item. Abra a fonte original antes de usar qualquer achado: o EcoGrad reorganiza metadados, não confere o texto dos trabalhos.',
  },
  {
    id: 'analises',
    alvo: '[aria-label="Gráficos do dossiê"]',
    dependeDe: 'abrirTema',
    titulo: 'Cinco perguntas sobre o mesmo item',
    texto: 'Evolução Histórica mostra o item ao longo dos anos. Lexicometria conta palavras — e deixa escolher a fonte: palavras-chave, títulos, resumos ou tudo. Órbita de Relacionamentos desenha a vizinhança. Frequências e relações (QL) cruza quantidade com qualidade declarada. Itens Semelhantes aproxima por metadado compartilhado.',
  },
  {
    id: 'relacionados',
    alvo: '[aria-label="Orientadores dos trabalhos associados"]',
    dependeDe: 'abrirTema',
    titulo: 'Seguir uma relação',
    texto: 'As pessoas e os temas ligados a estes trabalhos aparecem aqui. Clicar em qualquer um abre o dossiê dele, e o percurso guarda de onde você veio. Aparecer junto significa constar dos mesmos registros — não comprova vínculo atual, especialização nem causa.',
  },
  {
    id: 'escolherItem',
    alvo: '[aria-label="Escolha do item"]',
    titulo: 'Trocar de item sem voltar ao Dashboard',
    texto: 'A categoria recorta o catálogo: Documentos, Pessoas ou Temas. Em Pessoas dá para filtrar por papel — autoria, orientação, coorientação —, e em Temas por origem: palavra-chave é declaração do autor, macrotema é classificação da base, e rótulos iguais nas duas origens reúnem trabalhos diferentes.',
  },
  {
    id: 'historico',
    alvo: '[aria-label="Percurso da análise"]',
    titulo: 'O percurso fica guardado',
    texto: 'Voltar, Avançar e o histórico refazem o caminho sem perder o que você já explorou, e a sessão sobrevive a recarregar a página.',
  },
  {
    id: 'panorama',
    alvo: '[aria-label="Abrir Panorama UFSC"]',
    titulo: 'Contexto institucional, à parte',
    texto: 'O Panorama UFSC reúne duas leituras da universidade: o acervo inteiro em números — registros, coleções, pessoas, cobertura de metadados — e os dados oficiais dos programas na CAPES. Nenhuma das duas entra nos cálculos do seu recorte: elas servem para situar o que você está lendo.',
  },
  {
    id: 'relatorio',
    alvo: '[aria-label="Exportar relatório em PDF"]',
    soDesktop: true,
    titulo: 'Levar o recorte embora',
    texto: 'O relatório em PDF monta o que você escolher do Dashboard e do Motor de Busca, com os gráficos como imagem e as ressalvas junto. É gerado inteiro no seu navegador — nada do seu recorte sai daqui. Daqui em diante, siga as relações que interessarem e confira sempre nas fontes.',
  },
];

/** Página em que cada passo acontece; ausente quer dizer "onde o usuário estiver". */
const ROTAS: Record<string, PaginaDoTour> = {
  busca: 'inicio', carregar: 'inicio',
  indicadores: 'dashboard', cobertura: 'dashboard', destaques: 'dashboard',
  verGrafico: 'dashboard', coberturaAno: 'dashboard', filtros: 'dashboard', tema: 'dashboard',
  // A troca de item existe com ou sem dossiê aberto: quem pulou o passo do
  // tema chega aqui pelo Dashboard, e a página da busca ainda faz sentido.
  escolherItem: 'busca',
};

/**
 * Página do passo, ou `null` para o que fica onde o usuário estiver.
 *
 * O dossiê e o histórico chegam pela ação dele; navegar por conta própria
 * atropelaria o item que ele acabou de abrir. O Panorama e o relatório moram
 * no painel lateral, presente em qualquer página.
 */
export function rotaDoPasso(passo: PassoTour): PaginaDoTour | null {
  return ROTAS[passo.id] ?? null;
}

/**
 * Passos válidos para o estado atual.
 *
 * Com análise já aberta, o recorte é pulado: refazê-lo substituiria o trabalho
 * de quem está no meio de uma exploração, e o tour não pode ser destrutivo.
 */
export function passosDoTour({ temAnalise, estreito = false }: { temAnalise: boolean; estreito?: boolean }): PassoTour[] {
  return PASSOS.filter((p) => !(p.somenteSemAnalise && temAnalise) && !(p.soDesktop && estreito));
}

export const TOTAL_PASSOS_COMPLETO = PASSOS.length;

/**
 * Índice do próximo passo depois de `i`.
 *
 * Pular um passo de ação deixa a tela exatamente onde estava, e o passo que só
 * existe depois daquela ação não tem alvo nenhum para destacar: o tour ficaria
 * parado esperando um elemento que ninguém vai montar. Quem pula a ação pula
 * junto o que dependia dela.
 */
export function proximoPasso(passos: readonly PassoTour[], i: number, { pulou }: { pulou: boolean }): number {
  const acao = passos[i]?.acao;
  let n = i + 1;
  if (pulou && acao) while (passos[n]?.dependeDe === acao) n += 1;
  return n;
}

/** Marca de "já viu", no armazenamento que sobrevive ao fechar a aba. */
export const CHAVE_TOUR = 'ecograd-tour-v1';

export function tourJaVisto(ler: (k: string) => string | null): boolean {
  try {
    return JSON.parse(ler(CHAVE_TOUR) ?? 'null')?.visto === true;
  } catch {
    return false;
  }
}

export interface ColecaoCandidata {
  nome: string;
  tipo: string;
  total: number;
  inicio: number | null;
  fim: number | null;
  comOrientador: number;
  comPalavras: number;
  downloadBytes?: number;
}

/**
 * Coleção de exemplo para quem chega sem análise nenhuma.
 *
 * O critério é declarado, e não um nome fixo no código: a base muda a cada
 * coleta, e uma coleção escolhida à mão hoje pode sumir ou encolher amanhã.
 * Procura-se a menor que ainda encha todas as telas do roteiro — registros
 * suficientes para haver ranking, orientação e temas quase completos, e
 * período longo o bastante para a série anual não ser uma barra só.
 */
export function escolherColecaoDemo(colecoes: readonly ColecaoCandidata[]): ColecaoCandidata | null {
  const aptas = colecoes.filter((c) =>
    c.total >= 60 && c.total <= 200
    && c.comOrientador / c.total > 0.9
    && c.comPalavras / c.total > 0.9
    && c.inicio !== null && c.fim !== null && c.fim - c.inicio >= 8);
  if (aptas.length === 0) return null;
  // Menor download primeiro; o nome desempata para a escolha não variar entre
  // execuções quando dois arquivos têm o mesmo tamanho.
  return [...aptas].sort((a, b) =>
    (a.downloadBytes ?? Infinity) - (b.downloadBytes ?? Infinity)
    || a.nome.localeCompare(b.nome, 'pt-BR'))[0];
}

/** Tamanho legível do download da coleção de exemplo, para a oferta ser honesta. */
export const tamanhoLegivel = (bytes: number | undefined) =>
  bytes === undefined ? 'tamanho não informado'
    : bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
      : `${Math.round(bytes / 1024)} KiB`;
