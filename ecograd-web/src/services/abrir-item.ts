import { colecoesDoItem, MAX_COLECOES_POR_ITEM, type ResultadoBusca } from '@/lib/busca-global';
import type { Documento, TipoBusca } from '@/types';
import { mesmaSelecao } from '@/lib/selecao';
import { canonizar, grupoDe, usePessoas } from './pessoas';
import { mesmoRecorte, somarAoRecorte, type ItemRecorte } from '@/lib/recorte';
import { referenciaDocumento } from '@/lib/resultados';
import { PAPEIS_PESSOA } from '@/types';
import { carregarDados } from './calculos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

/** O que a busca da apresentação tem selecionado: itens soltos e coleções inteiras. */
export interface EscolhaAcervo {
  itens: readonly ResultadoBusca[];
  colecoes: readonly { nome: string; catalogo: 'ppg' | 'tcc' }[];
}

/**
 * União das coleções a carregar: as escolhidas diretamente mais as de cada item.
 * `limite` vale por item (`Infinity` traz todas as coleções em que ele aparece);
 * `omitidas` soma o que ficou de fora dele.
 */
export function colecoesDaEscolha({ itens, colecoes }: EscolhaAcervo, limite = MAX_COLECOES_POR_ITEM) {
  const programas = new Set<string>();
  const cursosTcc = new Set<string>();
  let omitidas = 0;
  for (const c of colecoes) (c.catalogo === 'ppg' ? programas : cursosTcc).add(c.nome);
  for (const item of itens) {
    const escolha = colecoesDoItem(item, limite);
    escolha.programas.forEach((n) => programas.add(n));
    escolha.cursosTcc.forEach((n) => cursosTcc.add(n));
    omitidas += escolha.omitidas;
  }
  return { programas: [...programas], cursosTcc: [...cursosTcc], omitidas };
}

/**
 * O recorte que a escolha define: a análise fica restrita aos itens pedidos, e
 * não às coleções inteiras que precisaram ser baixadas para alcançá-los. Uma
 * escolha só de coleções não recorta nada — ali o recorte É a coleção.
 *
 * Papéis de pessoa levam junto as outras grafias do grupo unificado: os
 * documentos gravados sob a grafia antiga são da mesma pessoa.
 */
export function recorteDaEscolha({ itens, colecoes }: EscolhaAcervo): ItemRecorte[] {
  if (itens.length === 0) return [];
  const grupos = usePessoas.getState().grupos;
  return [
    ...itens.map((i): ItemRecorte => {
      const grafias = (PAPEIS_PESSOA as readonly string[]).includes(i.tipo) || i.tipo === 'Pessoa' ? grupoDe(grupos, i.nome)?.grafias : undefined;
      return grafias?.length ? { tipo: i.tipo, nome: i.nome, grafias } : { tipo: i.tipo, nome: i.nome };
    }),
    // Coleção escolhida de propósito entra inteira, ao lado dos itens.
    ...colecoes.map((c): ItemRecorte => ({ tipo: 'Coleção', nome: c.nome })),
  ];
}

/**
 * O dossiê que representa a escolha, quando existe um.
 *
 * Um item sozinho abre o próprio dossiê. Vários itens de pessoa que apontam
 * para o mesmo nome canônico — porque têm papéis diferentes, ou porque as
 * grafias foram unificadas — abrem o dossiê de `Pessoa`, que reúne os papéis.
 * Com coleções na escolha, ou com itens que não convergem, nenhum dossiê a
 * representaria: a análise abre no Dashboard.
 */
function alvoUnico({ itens, colecoes }: EscolhaAcervo): { tipo: TipoBusca; nome: string } | null {
  if (colecoes.length > 0 || itens.length === 0) return null;
  if (itens.length === 1) return { tipo: itens[0].tipo, nome: itens[0].nome };
  if (!itens.every((i) => (PAPEIS_PESSOA as readonly string[]).includes(i.tipo))) return null;
  const mapa = usePessoas.getState().mapa;
  const nomes = new Set(itens.map((i) => canonizar(mapa, i.nome)));
  return nomes.size === 1 ? { tipo: 'Pessoa', nome: [...nomes][0] } : null;
}

function abrir(escolha: EscolhaAcervo) {
  const unico = alvoUnico(escolha);
  useEcoGradStore.setState((s) => ({
    apresentacaoVista: true,
    ...(unico
      ? {
        rota: 'busca' as const,
        buscaTipo: unico.tipo,
        buscaTermo: unico.nome,
        ui: { ...s.ui, 'dossie.documento': undefined, 'busca.categoria': 'tudo' },
      }
      : { rota: 'dashboard' as const }),
  }));
}

/**
 * Abre a escolha da apresentação. Se a análise atual não tem exatamente essas
 * coleções, carrega as novas (substituindo a análise) e abre ao terminar.
 * `limite` é o de `colecoesDaEscolha`.
 */
export function abrirEscolhaDoAcervo(escolha: EscolhaAcervo, limite = MAX_COLECOES_POR_ITEM): { carregando: boolean; colecoes: number; omitidas: number } {
  const { programas, cursosTcc, omitidas } = colecoesDaEscolha(escolha, limite);
  const colecoes = programas.length + cursosTcc.length;
  if (colecoes === 0) return { carregando: false, colecoes, omitidas };
  const recorte = recorteDaEscolha(escolha);
  const s = useEcoGradStore.getState();
  // Mesmas coleções com outro recorte é outra base: só reaproveita quando os dois batem.
  if (s.dadosCarregados && mesmaSelecao({ programas, cursosTcc }, { programas: s.programasSelecionados, cursosTcc: s.cursosTccSelecionados })
    && mesmoRecorte(recorte, s.recorte)) {
    abrir(escolha);
    return { carregando: false, colecoes, omitidas };
  }
  carregarDados(programas, cursosTcc, alvoUnico(escolha) ? 'trabalhos' : 'panorama', () => {
    if (useEcoGradStore.getState().dadosCarregados) abrir(escolha);
  }, recorte);
  return { carregando: true, colecoes, omitidas };
}

/** O item de recorte de uma entidade do dossiê, com as grafias unificadas da pessoa. */
function itemRecorte(tipo: TipoBusca, nome: string): ItemRecorte {
  const pessoa = tipo === 'Pessoa' || (PAPEIS_PESSOA as readonly string[]).includes(tipo);
  const grafias = pessoa ? grupoDe(usePessoas.getState().grupos, nome)?.grafias : undefined;
  return grafias?.length ? { tipo, nome, grafias } : { tipo, nome };
}

/** Carrega a análise pedida e volta ao dossiê da entidade; se nada muda, só volta. */
function carregarEAbrirDossie(analise: { programas: string[]; cursosTcc: string[]; recorte: ItemRecorte[] }, tipo: TipoBusca, nome: string, mudou: boolean): boolean {
  const irAoDossie = () => useEcoGradStore.setState((s) => ({
    apresentacaoVista: true, rota: 'busca' as const, buscaTipo: tipo, buscaTermo: nome,
    ui: { ...s.ui, 'dossie.documento': undefined },
  }));
  if (!mudou) { irAoDossie(); return false; }
  carregarDados(analise.programas, analise.cursosTcc, 'trabalhos', () => {
    if (useEcoGradStore.getState().dadosCarregados) irAoDossie();
  }, analise.recorte);
  return true;
}

/**
 * Soma à análise ativa tudo o que o acervo tem sobre uma entidade do dossiê:
 * baixa as coleções dela que faltam e a acrescenta ao recorte. Devolve se
 * começou um carregamento.
 */
export function somarEntidadeAAnalise(tipo: TipoBusca, nome: string, colecoes: { programas: string[]; cursosTcc: string[] }): boolean {
  const s = useEcoGradStore.getState();
  const soma = somarAoRecorte({ programas: s.programasSelecionados, cursosTcc: s.cursosTccSelecionados, recorte: s.recorte }, itemRecorte(tipo, nome), colecoes);
  return carregarEAbrirDossie(soma, tipo, nome, soma.mudou);
}

/** Troca a análise ativa por tudo o que o acervo tem sobre uma entidade do dossiê. */
export function analisarSoAEntidade(tipo: TipoBusca, nome: string, colecoes: { programas: string[]; cursosTcc: string[] }): boolean {
  const s = useEcoGradStore.getState();
  const recorte = [itemRecorte(tipo, nome)];
  const mudou = !mesmaSelecao(colecoes, { programas: s.programasSelecionados, cursosTcc: s.cursosTccSelecionados }) || !mesmoRecorte(recorte, s.recorte);
  return carregarEAbrirDossie({ ...colecoes, recorte }, tipo, nome, mudou);
}

/**
 * Abandona o recorte e recarrega as mesmas coleções inteiras — o caminho de
 * volta para quem quer comparar o item com o resto da produção.
 */
export function ampliarParaColecoesInteiras(): void {
  const s = useEcoGradStore.getState();
  if (!s.recorte.length || s.carregando) return;
  carregarDados(s.programasSelecionados, s.cursosTccSelecionados, 'panorama', undefined, []);
}

/**
 * Abre o dossiê de um registro exato numa única mudança de estado, sem entrada
 * a mais no histórico. `indice` é a posição em `docs`: é o que distingue dois
 * registros de mesmo título em coleções diferentes.
 */
export function abrirRegistro(docs: readonly Documento[], indice: number): void {
  const ref = referenciaDocumento(docs, indice);
  if (!ref) return;
  useEcoGradStore.setState((s) => ({
    apresentacaoVista: true,
    rota: 'busca' as const,
    buscaTipo: 'Documento' as const,
    buscaTermo: ref.titulo,
    ui: { ...s.ui, 'dossie.documento': ref },
  }));
}
