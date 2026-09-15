import { colecoesDoItem, type ResultadoBusca } from '@/lib/busca-global';
import { carregarDados } from './calculos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

const mesmas = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((n) => b.includes(n));

/** Abre o dossiê do item, já no modo "Todos" do Motor de Busca. */
function abrirDossie(item: ResultadoBusca) {
  useEcoGradStore.setState((s) => ({
    apresentacaoVista: true,
    rota: 'busca',
    buscaTipo: item.tipo,
    buscaTermo: item.nome,
    ui: { ...s.ui, 'dossie.documento': undefined, 'busca.todos': true },
  }));
}

/**
 * Abre um item do catálogo do acervo. Se a análise atual não tem exatamente as
 * coleções dele, carrega só essas coleções (substituindo a análise) e abre o
 * dossiê ao terminar.
 */
export function abrirItemDoAcervo(item: ResultadoBusca): { carregando: boolean; colecoes: number; omitidas: number } {
  const { programas, cursosTcc, omitidas } = colecoesDoItem(item);
  const colecoes = programas.length + cursosTcc.length;
  const s = useEcoGradStore.getState();
  if (s.dadosCarregados && mesmas(programas, s.programasSelecionados) && mesmas(cursosTcc, s.cursosTccSelecionados)) {
    abrirDossie(item);
    return { carregando: false, colecoes, omitidas };
  }
  carregarDados(programas, cursosTcc, 'trabalhos', () => {
    if (useEcoGradStore.getState().dadosCarregados) abrirDossie(item);
  });
  return { carregando: true, colecoes, omitidas };
}
