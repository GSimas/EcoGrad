import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AbrirItemDoAcervo } from '@/components/dashboard/AbrirItemDoAcervo';
import { carregarCobertura } from '@/lib/colecoes';

/**
 * O convite que uma nuvem de palavras faz ao ser clicada.
 *
 * Toda nuvem do EcoGrad passa por aqui, para o clique significar a mesma coisa
 * em qualquer uma delas. Um termo de nuvem não é necessariamente uma entidade do
 * acervo — a nuvem conta palavras de títulos e resumos, não só palavras-chave
 * declaradas —, então o clique não age: ele pergunta. O modal diz antes quantas
 * coleções viriam e quanto pesam, oferece abrir no recorte já carregado quando o
 * termo aparece nele, e avisa quando o termo não é uma entidade que se possa
 * abrir.
 *
 * Este componente existe só para trazer a prévia das coleções junto: quem tem a
 * prévia à mão pode usar o `AbrirItemDoAcervo` direto, com `tipo: 'Termo'`.
 */
export function useTermoDaNuvem() {
  const [termo, setTermo] = useState<string | null>(null);
  return { termo, abrir: setTermo, fechar: () => setTermo(null) };
}

export function AbrirTermoDaNuvem({ termo, aoFechar, aoNavegar }: {
  termo: string | null;
  aoFechar: () => void;
  /** Chamado quando a análise começa a trocar, para o painel de origem sair da frente. */
  aoNavegar?: () => void;
}) {
  // O mesmo `queryKey` do painel do acervo: a prévia das coleções é baixada uma
  // vez por sessão, e não uma vez por nuvem.
  const { data } = useQuery({
    queryKey: ['colecoes-cobertura', 5],
    queryFn: ({ signal }) => carregarCobertura(signal),
    staleTime: Infinity,
    enabled: termo !== null,
  });

  return (
    <AbrirItemDoAcervo
      alvo={termo === null ? null : { tipo: 'Termo', nome: termo }}
      aoFechar={aoFechar}
      aoNavegar={aoNavegar ?? (() => {})}
      cobertura={data?.colecoes ?? []}
    />
  );
}
