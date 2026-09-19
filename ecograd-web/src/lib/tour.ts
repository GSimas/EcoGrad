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
}

const PASSOS: readonly PassoTour[] = [
  {
    id: 'busca',
    alvo: '[aria-label^="Título, autor, orientador"]',
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
    id: 'cobertura',
    alvo: '[aria-label="Cobertura do recorte"]',
    titulo: 'Leia a cobertura antes dos números',
    texto: 'Este bloco diz quantos registros vieram, que anos aparecem e quanto deles tem resumo, palavras-chave e orientação. É o que separa uma queda real de uma lacuna de metadado — leia sempre antes de interpretar qualquer frequência.',
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
    alvo: '[aria-label="Trabalhos associados"]',
    titulo: 'O dossiê reúne a evidência',
    texto: 'Cada dossiê mostra os trabalhos associados, as pessoas e os temas ligados a eles, e as análises que fazem sentido para aquele item. Abra a fonte original antes de usar qualquer achado: o EcoGrad reorganiza metadados, não confere o texto dos trabalhos.',
  },
  {
    id: 'historico',
    alvo: '[aria-label="Percurso da análise"]',
    titulo: 'O percurso fica guardado',
    texto: 'Voltar, Avançar e o histórico refazem o caminho sem perder o que você já explorou. Daqui em diante, siga as relações que interessarem — e confira sempre nas fontes.',
  },
];

/**
 * Passos válidos para o estado atual.
 *
 * Com análise já aberta, o recorte é pulado: refazê-lo substituiria o trabalho
 * de quem está no meio de uma exploração, e o tour não pode ser destrutivo.
 */
export function passosDoTour({ temAnalise }: { temAnalise: boolean }): PassoTour[] {
  return PASSOS.filter((p) => !(p.somenteSemAnalise && temAnalise));
}

export const TOTAL_PASSOS_COMPLETO = PASSOS.length;

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
