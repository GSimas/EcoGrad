import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DatabaseZap } from 'lucide-react';
import { Janela } from '@/components/layout/Janela';
import { Aviso, Carregando } from '@/components/ui/primitives';
import { carregarIndiceBusca, itensDaEntidade, MAX_COLECOES_POR_ITEM } from '@/lib/busca-global';
import { carregarCobertura } from '@/lib/colecoes';
import { somarAoRecorte } from '@/lib/recorte';
import { analisarSoAEntidade, somarEntidadeAAnalise } from '@/services/abrir-item';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { PAPEIS_PESSOA, type TipoBusca } from '@/types';

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

/**
 * "Carregar tudo do acervo" no dossiê de uma pessoa ou de um tema.
 *
 * O dossiê descreve a entidade dentro do que está carregado: quem carregou
 * "ostras" vê do orientador só os trabalhos sobre ostras. Daqui o usuário puxa
 * o resto — todos os trabalhos da entidade, em todas as coleções do acervo —,
 * somando-os à análise atual ou analisando só a entidade.
 *
 * O índice do acervo (~5 MB) só é consultado quando a janela abre; quem chegou
 * pela busca da apresentação já o tem em cache.
 */
export function CarregarDoAcervo({ tipo, termo, registrosNaAnalise }: { tipo: TipoBusca; termo: string; registrosNaAnalise: number }) {
  const [aberta, setAberta] = useState(false);
  const [pediu, setPediu] = useState(false);
  const carregando = useEcoGradStore((s) => s.carregando);
  const mensagem = useEcoGradStore((s) => s.mensagemCarregamento);
  const erroCarregamento = useEcoGradStore((s) => s.erroCarregamento);
  const programas = useEcoGradStore((s) => s.programasSelecionados);
  const cursosTcc = useEcoGradStore((s) => s.cursosTccSelecionados);
  const recorte = useEcoGradStore((s) => s.recorte);

  const indice = useQuery({ queryKey: ['indice-busca'], queryFn: ({ signal }) => carregarIndiceBusca(signal), enabled: aberta, staleTime: Infinity, gcTime: Infinity, retry: 1 });
  // Mesma chave da busca da apresentação: a prévia das coleções vem uma vez por sessão.
  const cobertura = useQuery({ queryKey: ['colecoes-cobertura', 5], queryFn: ({ signal }) => carregarCobertura(signal), enabled: aberta, staleTime: Infinity, retry: 1 });

  const itens = useMemo(() => (indice.data ? itensDaEntidade(indice.data, tipo, termo) : null), [indice.data, tipo, termo]);
  /** Todas as coleções em que a entidade aparece: "tudo do acervo" não tem limite por item. */
  const colecoes = useMemo(() => {
    if (!itens) return null;
    const p = new Set<string>();
    const t = new Set<string>();
    for (const i of itens) for (const c of i.colecoes) (c.catalogo === 'ppg' ? p : t).add(c.nome);
    return { programas: [...p], cursosTcc: [...t] };
  }, [itens]);
  const soma = useMemo(() => (colecoes ? somarAoRecorte({ programas, cursosTcc, recorte }, { tipo, nome: termo }, colecoes) : null), [colecoes, programas, cursosTcc, recorte, tipo, termo]);

  const mib = (nomes: readonly string[]) => {
    const alvos = new Set(nomes);
    const achadas = (cobertura.data?.colecoes ?? []).filter((c) => alvos.has(c.nome));
    // Sem o tamanho de todas, um total parcial enganaria mais do que ajuda.
    return achadas.length === alvos.size ? achadas.reduce((t, c) => t + c.downloadBytes, 0) / 1024 / 1024 : null;
  };
  const carregadas = new Set([...programas, ...cursosTcc]);
  const todas = colecoes ? [...colecoes.programas, ...colecoes.cursosTcc] : [];
  const novas = todas.filter((c) => !carregadas.has(c));
  const mibNovas = mib(novas);
  const mibTodas = mib(todas);
  const registros = itens?.reduce((t, i) => t + i.registros, 0) ?? 0;
  const ehPessoa = tipo === 'Pessoa' || (PAPEIS_PESSOA as readonly string[]).includes(tipo);
  const rotulo = ehPessoa ? 'esta pessoa' : 'este tema';

  const executar = (acao: typeof somarEntidadeAAnalise) => {
    if (!colecoes) return;
    setPediu(acao(tipo, termo, colecoes));
    setAberta(false);
  };

  const status = !pediu ? ''
    : carregando ? `Carregando do acervo tudo sobre “${termo}”. ${mensagem}`
      : erroCarregamento ? `Não foi possível carregar “${termo}”: ${erroCarregamento}` : '';

  return <div className="card flex flex-wrap items-center justify-between gap-3 border-eco-accent/30">
    <p className="min-w-0 flex-1 text-sm text-slate-300">
      O dossiê mostra {plural(registrosNaAnalise, 'registro', 'registros')} da análise carregada. O acervo pode ter mais trabalhos com {rotulo} em outras coleções.
    </p>
    <Janela aberta={aberta} onOpenChange={setAberta} titulo={`Carregar do acervo: ${termo}`}
      descricao={`Traz todos os trabalhos com ${rotulo} em qualquer coleção do acervo, para somar à análise ou analisar à parte.`}
      trigger={<button type="button" className="btn btn-primary min-h-11 shrink-0" disabled={carregando}>
        <DatabaseZap size={16} className="shrink-0" aria-hidden /> Carregar tudo do acervo
      </button>}>
      <div className="space-y-4 text-sm">
        {(indice.isLoading || (aberta && !indice.data && !indice.isError)) && <Carregando texto="Consultando o acervo inteiro..." />}
        {indice.isError && <Aviso tipo="aviso">Não foi possível consultar o acervo: {indice.error instanceof Error ? indice.error.message : 'erro desconhecido'}.</Aviso>}
        {itens && itens.length === 0 && <Aviso tipo="aviso">“{termo}” não foi encontrado no índice do acervo. Ele pode ter entrado numa coleta mais recente que o índice.</Aviso>}
        {itens && itens.length > 0 && colecoes && soma && <>
          <p className="text-slate-200">
            No acervo inteiro, “{termo}” aparece em <strong>{plural(registros, 'registro', 'registros')}</strong> de <strong>{plural(todas.length, 'coleção', 'coleções')}</strong>.
            {' '}Na análise atual, {plural(registrosNaAnalise, 'registro', 'registros')}.
          </p>
          {tipo === 'Pessoa' && itens.length > 1 && <p className="text-xs text-slate-400">Por papel: {itens.map((i) => `${i.tipo} ${plural(i.registros, 'registro', 'registros')}`).join(' · ')}. Um mesmo trabalho pode contar em mais de um papel.</p>}
          {!soma.mudou
            ? <Aviso tipo="sucesso">Tudo o que o acervo tem sobre “{termo}” já está na análise.</Aviso>
            : <>
              <button type="button" className="btn w-full flex-col items-start gap-1 py-3 text-left" disabled={carregando} onClick={() => executar(somarEntidadeAAnalise)}>
                <span className="font-semibold">Somar à análise atual{novas.length > 0 && ` · +${plural(novas.length, 'coleção', 'coleções')}`}{novas.length > 0 && mibNovas !== null && ` · ~${mibNovas.toFixed(1)} MiB`}</span>
                <span className="block text-left text-xs text-slate-400">Mantém o que está carregado e acrescenta todos os trabalhos de “{termo}”. O recorte passa a incluí-lo ao lado do que já estava.</span>
              </button>
              <button type="button" className="btn w-full flex-col items-start gap-1 py-3 text-left" disabled={carregando} onClick={() => executar(analisarSoAEntidade)}>
                <span className="font-semibold">Analisar só “{termo}” · {plural(todas.length, 'coleção', 'coleções')}{mibTodas !== null && ` · ~${mibTodas.toFixed(1)} MiB`}</span>
                <span className="block text-left text-xs text-slate-400">Substitui a análise atual pelos trabalhos de “{termo}” em todo o acervo.</span>
              </button>
              {todas.length > MAX_COLECOES_POR_ITEM && <p className="text-xs text-slate-400">“{termo}” está espalhado em muitas coleções: o download é maior e a análise pode ficar lenta em celulares.</p>}
              <p className="text-xs text-slate-400">A correspondência é pelo nome, sem diferenciar acentos e maiúsculas. {ehPessoa ? 'Nomes iguais podem representar pessoas diferentes; confira as fontes.' : 'Rótulos iguais podem reunir trabalhos de contextos diferentes.'}</p>
            </>}
        </>}
      </div>
    </Janela>
    {status && <p role="status" className="basis-full text-xs text-slate-300">{status}</p>}
  </div>;
}
