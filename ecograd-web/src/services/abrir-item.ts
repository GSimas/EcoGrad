import { colecoesDoItem, type ResultadoBusca } from '@/lib/busca-global';
import { mesmaSelecao } from '@/lib/selecao';
import { carregarDados } from './calculos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

/** O que a busca da apresentação tem selecionado: itens soltos e coleções inteiras. */
export interface EscolhaAcervo {
  itens: readonly ResultadoBusca[];
  colecoes: readonly { nome: string; catalogo: 'ppg' | 'tcc' }[];
}

/**
 * União das coleções a carregar: as escolhidas diretamente mais as de cada item.
 * `omitidas` soma o que ficou de fora do limite por item.
 */
export function colecoesDaEscolha({ itens, colecoes }: EscolhaAcervo) {
  const programas = new Set<string>();
  const cursosTcc = new Set<string>();
  let omitidas = 0;
  for (const c of colecoes) (c.catalogo === 'ppg' ? programas : cursosTcc).add(c.nome);
  for (const item of itens) {
    const escolha = colecoesDoItem(item);
    escolha.programas.forEach((n) => programas.add(n));
    escolha.cursosTcc.forEach((n) => cursosTcc.add(n));
    omitidas += escolha.omitidas;
  }
  return { programas: [...programas], cursosTcc: [...cursosTcc], omitidas };
}

/**
 * Um item escolhido sozinho abre o próprio dossiê, já no modo "Todos" do Motor
 * de Busca. Com vários itens, ou com qualquer coleção junto, nenhum dossiê
 * único representaria a escolha — aí a análise abre no Dashboard.
 */
const itemUnico = ({ itens, colecoes }: EscolhaAcervo) => (itens.length === 1 && colecoes.length === 0 ? itens[0] : null);

function abrir(escolha: EscolhaAcervo) {
  const unico = itemUnico(escolha);
  useEcoGradStore.setState((s) => ({
    apresentacaoVista: true,
    ...(unico
      ? {
        rota: 'busca' as const,
        buscaTipo: unico.tipo,
        buscaTermo: unico.nome,
        ui: { ...s.ui, 'dossie.documento': undefined, 'busca.todos': true },
      }
      : { rota: 'dashboard' as const }),
  }));
}

/**
 * Abre a escolha da apresentação. Se a análise atual não tem exatamente essas
 * coleções, carrega as novas (substituindo a análise) e abre ao terminar.
 */
export function abrirEscolhaDoAcervo(escolha: EscolhaAcervo): { carregando: boolean; colecoes: number; omitidas: number } {
  const { programas, cursosTcc, omitidas } = colecoesDaEscolha(escolha);
  const colecoes = programas.length + cursosTcc.length;
  if (colecoes === 0) return { carregando: false, colecoes, omitidas };
  const s = useEcoGradStore.getState();
  if (s.dadosCarregados && mesmaSelecao({ programas, cursosTcc }, { programas: s.programasSelecionados, cursosTcc: s.cursosTccSelecionados })) {
    abrir(escolha);
    return { carregando: false, colecoes, omitidas };
  }
  carregarDados(programas, cursosTcc, itemUnico(escolha) ? 'trabalhos' : 'panorama', () => {
    if (useEcoGradStore.getState().dadosCarregados) abrir(escolha);
  });
  return { carregando: true, colecoes, omitidas };
}
