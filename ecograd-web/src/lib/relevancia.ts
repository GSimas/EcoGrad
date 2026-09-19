/**
 * Quais análises descrevem alguma coisa neste recorte.
 *
 * Um gráfico degenerado — uma barra só, uma fatia de 100%, uma nuvem em que
 * todo termo vale 1 — não é um gráfico vazio: ele desenha uma forma e sugere
 * uma leitura que o dado não sustenta. Aqui fica a decisão de escondê-lo, com
 * o motivo junto, porque esconder em silêncio parece defeito.
 *
 * A decisão é pura e fica fora dos componentes de propósito: é ela que o teste
 * exercita, e é ela que garante que os motivos sejam os mesmos em toda a tela.
 */
import type { Documento, TipoBusca } from '@/types';

export interface AnaliseOculta {
  nome: string;
  motivo: string;
}

export type AnaliseDossie = 'evolucao' | 'lexicometria' | 'orbita' | 'perfil' | 'similares';

/** Tipos para os quais `gerarTabelaQLCruzado` tem entidades a cruzar. */
export function tipoTemQL(tipo: TipoBusca): boolean {
  return tipo === 'Orientador' || tipo === 'Co-orientador' || tipo === 'Palavra-chave' || tipo === 'Macrotema';
}

/**
 * O item tem vizinhança no grafo histórico?
 *
 * A órbita monta o grafo só quando a aba abre, então a decisão de exibi-la não
 * pode depender dele. Este é o mesmo critério por outro caminho:
 * `construirGrafoHistorico` só registra um registro que tenha título, e só cria
 * arestas dele para autoria, orientação e temas. Sem nada disso o item fica
 * isolado e a órbita sai num canvas vazio, sem sequer uma mensagem.
 */
export function temVizinhancaNoGrafo(docsAlvo: readonly Documento[]): boolean {
  return docsAlvo.some((d) => !!d.titulo && (
    d.autores.some(Boolean) || !!d.orientador || d.co_orientadores.some(Boolean)
    || d.palavras_chave.some(Boolean) || !!d.macrotema
  ));
}

export interface EntradaDossie {
  tipo: TipoBusca;
  docsAlvo: readonly Documento[];
  /** Pontos de `evolucaoAnual`: anos distintos com registro. */
  anosNaSerie: number;
  /** Linhas de `gerarTabelaQLCruzado`. */
  linhasQL: number;
}

/**
 * Quais abas do dossiê aparecem, e por que as outras não.
 *
 * Nada aqui exclui registro de cálculo algum: é decisão de exibição.
 */
export function relevanciaDossie({ tipo, docsAlvo, anosNaSerie, linhasQL }: EntradaDossie): {
  mostrar: ReadonlySet<AnaliseDossie>;
  ocultas: AnaliseOculta[];
} {
  const mostrar = new Set<AnaliseDossie>();
  const ocultas: AnaliseOculta[] = [];
  const umRegistro = docsAlvo.length === 1;

  if (anosNaSerie > 1) mostrar.add('evolucao');
  else ocultas.push({
    nome: 'Evolução Histórica',
    motivo: anosNaSerie === 0
      ? 'nenhum registro com ano informado'
      : 'todos os registros estão em um único ano',
  });

  if (!umRegistro) mostrar.add('lexicometria');
  else ocultas.push({
    nome: 'Lexicometria',
    motivo: 'um único registro, em que cada termo ocorre uma vez e a nuvem não compara frequência alguma',
  });

  if (temVizinhancaNoGrafo(docsAlvo)) mostrar.add('orbita');
  else ocultas.push({
    nome: 'Órbita de Relacionamentos',
    motivo: 'o item não tem autoria, orientação nem tema registrado para ligar a nada',
  });

  if (tipoTemQL(tipo) && !umRegistro && linhasQL > 0) mostrar.add('perfil');
  else ocultas.push({
    nome: 'Frequências e relações (QL)',
    motivo: !tipoTemQL(tipo)
      ? 'o QL cruzado não se aplica a este tipo de entidade'
      // Com um registro, QL = 1 ÷ (frequência global do termo): é a raridade
      // global reescrita, não a especialização deste item.
      : umRegistro
        ? 'um único registro, sem proporção local a comparar com a base'
        : 'os registros deste item não trazem as entidades cruzadas pelo QL',
  });

  // `calcularSimilaresRede` não tem grupo de retorno para `Pessoa`: o dossiê
  // que reúne os papéis não tem categoria própria a comparar, e a aba viria
  // sempre vazia — depois de percorrer todos os perfis à toa.
  if (tipo !== 'Pessoa') mostrar.add('similares');
  else ocultas.push({
    nome: 'Itens Semelhantes',
    motivo: 'o dossiê de Pessoa reúne os papéis; abra um papel para comparar com seus pares',
  });

  return { mostrar, ocultas };
}
