import { colecoesDoItem, type ResultadoBusca } from '@/lib/busca-global';
import type { TipoBusca } from '@/types';
import { mesmaSelecao } from '@/lib/selecao';
import { canonizar, usePessoas } from './pessoas';
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
  carregarDados(programas, cursosTcc, alvoUnico(escolha) ? 'trabalhos' : 'panorama', () => {
    if (useEcoGradStore.getState().dadosCarregados) abrir(escolha);
  });
  return { carregando: true, colecoes, omitidas };
}
