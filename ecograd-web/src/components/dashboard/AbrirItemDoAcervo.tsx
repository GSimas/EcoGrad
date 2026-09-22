import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Aviso, Carregando } from '@/components/ui/primitives';
import { Janela } from '@/components/layout/Janela';
import { carregarIndiceBusca, itemDoAcervo } from '@/lib/busca-global';
import { abrirEscolhaDoAcervo, colecoesDaEscolha, type EscolhaAcervo } from '@/services/abrir-item';
import type { ColecaoCobertura } from '@/lib/colecoes';
import type { TipoBusca } from '@/types';

/**
 * O que foi clicado no ranking.
 *
 * Coleção fica fora de `TipoBusca` porque não é entidade de busca: ela não tem
 * dossiê, é o que se baixa. O que ela precisa é do catálogo de origem.
 */
export type AlvoDoAcervo =
  | { tipo: 'Coleção'; nome: string; catalogo?: 'ppg' | 'tcc' }
  | { tipo: TipoBusca; nome: string; catalogo?: undefined };

const plural = (n: number, um: string, muitos: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : muitos}`;

/**
 * Convida a sair do panorama e abrir o item no EcoGrad.
 *
 * O panorama descreve o acervo inteiro; abrir um item dele significa baixar as
 * coleções onde ele aparece e trocar a análise ativa. Isso custa rede e descarta
 * o recorte atual, então não acontece no clique: o clique pergunta, e diz antes
 * quantas coleções virão e quanto pesam.
 */
export function AbrirItemDoAcervo({ alvo, aoFechar, aoNavegar, cobertura }: {
  alvo: AlvoDoAcervo | null;
  aoFechar: () => void;
  /** Chamado quando a análise começa a carregar, para o panorama sair da frente. */
  aoNavegar: () => void;
  cobertura: readonly ColecaoCobertura[];
}) {
  const ehColecao = alvo?.tipo === 'Coleção';
  // Uma coleção já se basta: o nome e o catálogo dizem o que baixar. Para pessoa
  // ou palavra-chave é o índice de busca que sabe em que coleções elas aparecem.
  const { data: indice, isLoading, error } = useQuery({
    queryKey: ['indice-busca'],
    queryFn: ({ signal }) => carregarIndiceBusca(signal),
    staleTime: Infinity,
    enabled: !!alvo && !ehColecao,
  });

  const escolha = useMemo<EscolhaAcervo | null>(() => {
    if (!alvo) return null;
    if (alvo.tipo === 'Coleção') return alvo.catalogo ? { itens: [], colecoes: [{ nome: alvo.nome, catalogo: alvo.catalogo }] } : null;
    if (!indice) return null;
    const item = itemDoAcervo(indice, alvo.tipo, alvo.nome);
    return item ? { itens: [item], colecoes: [] } : null;
  }, [alvo, ehColecao, indice]);

  const previa = useMemo(() => (escolha ? colecoesDaEscolha(escolha) : null), [escolha]);
  const mib = useMemo(() => {
    if (!previa) return null;
    const alvos = new Set([...previa.programas, ...previa.cursosTcc]);
    const encontradas = cobertura.filter((c) => alvos.has(c.nome));
    // Sem o tamanho de todas, um total parcial enganaria mais do que ajuda.
    return encontradas.length === alvos.size ? encontradas.reduce((t, c) => t + c.downloadBytes, 0) / 1024 / 1024 : null;
  }, [previa, cobertura]);

  const total = previa ? previa.programas.length + previa.cursosTcc.length : 0;

  return (
    <Janela
      aberta={!!alvo}
      onOpenChange={(v) => { if (!v) aoFechar(); }}
      titulo={`Abrir ${alvo?.nome ?? ''} no EcoGrad`}
      descricao="O panorama descreve o acervo inteiro. Para explorar um item é preciso carregar as coleções em que ele aparece, o que substitui a análise ativa."
    >
      <div className="space-y-4">
        {isLoading && <Carregando texto="Consultando em que coleções o item aparece..." />}
        {!isLoading && !escolha && (
          <Aviso tipo="aviso">
            {error instanceof Error
              ? `Não foi possível consultar o acervo: ${error.message}`
              : 'Este item não foi encontrado no índice de busca do acervo. Ele pode ter saído numa coleta mais recente que o panorama.'}
          </Aviso>
        )}
        {escolha && previa && (
          <>
            <p className="text-sm text-slate-200">
              Serão carregadas <strong>{plural(total, 'coleção', 'coleções')}</strong>
              {mib !== null && <> · ~{mib.toFixed(1)} MiB comprimidos</>}.
              {' '}A análise atual é substituída.
            </p>
            {previa.omitidas > 0 && (
              <p className="text-xs text-slate-400">
                O item aparece em {plural(previa.omitidas, 'coleção a mais', 'coleções a mais')}, que ficam de fora:
                o EcoGrad carrega as maiores. O recorte cobre a maior parte dos registros, não todos.
              </p>
            )}
            <p className="text-xs text-slate-400">
              A análise fica restrita a este item, e não às coleções inteiras que precisaram ser baixadas
              para alcançá-lo. Dentro dela é possível ampliar para as coleções completas.
            </p>
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!escolha || total === 0}
            onClick={() => { if (escolha) { abrirEscolhaDoAcervo(escolha); aoFechar(); aoNavegar(); } }}
          >
            Abrir no EcoGrad
          </button>
        </div>
      </div>
    </Janela>
  );
}
