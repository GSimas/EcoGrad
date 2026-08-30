import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plug, Rocket } from 'lucide-react';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Aviso, Carregando, Progresso } from '@/components/ui/primitives';
import { PanoramaCapes } from '@/components/dashboard/PanoramaCapes';
import { carregarCatalogoProgramas, carregarCatalogoTCC } from '@/lib/data-loader';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { DataWorkerRequest, DataWorkerResponse } from '@/workers/data.worker';

/**
 * Tela de seleção de coleções.
 * O Panorama Global da CAPES é independente da seleção e carrega sozinho,
 * exatamente como no Streamlit (Principal.py:167).
 */
export function SelecaoInicial() {
  const programas = useEcoGradStore((s) => s.programasSelecionados);
  const cursosTcc = useEcoGradStore((s) => s.cursosTccSelecionados);
  const setProgramas = useEcoGradStore((s) => s.setProgramas);
  const setCursosTcc = useEcoGradStore((s) => s.setCursosTcc);
  const carregando = useEcoGradStore((s) => s.carregando);
  const mensagem = useEcoGradStore((s) => s.mensagemCarregamento);
  const erro = useEcoGradStore((s) => s.erroCarregamento);
  const iniciarCarregamento = useEcoGradStore((s) => s.iniciarCarregamento);
  const setMensagem = useEcoGradStore((s) => s.setMensagemCarregamento);
  const concluirCarregamento = useEcoGradStore((s) => s.concluirCarregamento);
  const falharCarregamento = useEcoGradStore((s) => s.falharCarregamento);

  const workerRef = useRef<Worker | null>(null);
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const catalogoPPG = useQuery({
    queryKey: ['catalogo-programas'],
    queryFn: ({ signal }) => carregarCatalogoProgramas(signal),
  });

  const catalogoTCC = useQuery({
    queryKey: ['catalogo-tcc'],
    queryFn: ({ signal }) => carregarCatalogoTCC(signal),
  });

  const opcoesPPG = catalogoPPG.data ? Object.keys(catalogoPPG.data).sort((a, b) => a.localeCompare(b, 'pt-BR')) : [];
  const opcoesTCC = catalogoTCC.data
    ? [...new Set(catalogoTCC.data.map((t) => t.curso).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    : [];

  const carregar = () => {
    iniciarCarregamento();
    const worker = new Worker(new URL('../../workers/data.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.addEventListener('message', (e: MessageEvent<DataWorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') setMensagem(msg.text);
      else if (msg.type === 'pronto') {
        concluirCarregamento(msg.docs);
        worker.terminate();
        workerRef.current = null;
      } else {
        falharCarregamento(msg.message);
        worker.terminate();
        workerRef.current = null;
      }
    });

    const pedido: DataWorkerRequest = {
      type: 'carregar',
      programas: [...programas],
      cursosTcc: [...cursosTcc],
    };
    worker.postMessage(pedido);
  };

  const temSelecao = programas.length > 0 || cursosTcc.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-10">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Plug size={22} /> Seleção de Coleções (Teses, Dissertações e TCCs)
        </h1>
        <p className="text-sm text-slate-400">
          Selecione as coleções que deseja analisar para ativar o Dashboard do Ecossistema.
        </p>
      </header>

      {(catalogoPPG.isError || catalogoTCC.isError) && (
        <Aviso tipo="erro">
          Não foi possível carregar os catálogos locais. Confirme que{' '}
          <code>public/data/programas_ufsc.json</code> e{' '}
          <code>public/data/mapa_colecoes_tcc.json</code> foram publicados.
        </Aviso>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {catalogoPPG.isLoading ? (
          <Carregando texto="Carregando catálogo de Pós-Graduação..." />
        ) : (
          <MultiSelect
            rotulo="Pós-Graduação (Teses e Dissertações)"
            opcoes={opcoesPPG}
            selecionados={programas}
            onChange={setProgramas}
          />
        )}
        {catalogoTCC.isLoading ? (
          <Carregando texto="Carregando catálogo de Graduação..." />
        ) : (
          <MultiSelect
            rotulo="Graduação (TCC)"
            opcoes={opcoesTCC}
            selecionados={cursosTcc}
            onChange={setCursosTcc}
          />
        )}
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {temSelecao ? (
        carregando ? (
          <div className="card space-y-3">
            <Progresso valor={70} texto={mensagem || 'Preparando ecossistema...'} />
            <p className="text-xs text-slate-500">
              A descompressão roda em um Web Worker — a interface permanece responsiva.
            </p>
          </div>
        ) : (
          <button type="button" className="btn btn-primary w-full py-3" onClick={carregar}>
            <Rocket size={16} /> Carregar Ecossistema de Conhecimento
          </button>
        )
      ) : (
        <Aviso>💡 Aguardando seleção de coleções acima para habilitar a análise detalhada.</Aviso>
      )}

      <hr className="border-eco-border" />

      <PanoramaCapes />
    </div>
  );
}
