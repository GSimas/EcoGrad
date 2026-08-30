import { useCallback, useEffect, useRef } from 'react';
import type {
  BacktestRow,
  BootstrapMap,
  Documento,
  GridSearchRow,
  MetricasComplexas,
  SnaWorkerRequest,
  SnaWorkerResponse,
  TipoForesight,
} from '@/types';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

type Resolver = (r: SnaWorkerResponse) => void;

/**
 * Ponte com o worker de redes complexas. Uma única instância por sessão,
 * com fila de promessas para as chamadas sob demanda (bootstrap, maturidade,
 * métricas complexas) e progresso publicado direto no store.
 */
export function useSnaWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendenteRef = useRef<Resolver | null>(null);

  const setProgressoSNA = useEcoGradStore((s) => s.setProgressoSNA);
  const setSnaGlobal = useEcoGradStore((s) => s.setSnaGlobal);
  const setStatusSNA = useEcoGradStore((s) => s.setStatusSNA);
  const setMaturidade = useEcoGradStore((s) => s.setMaturidade);

  const obterWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/sna.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current.addEventListener('message', (e: MessageEvent<SnaWorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          setProgressoSNA(msg.value, msg.text);
          return;
        }
        const resolver = pendenteRef.current;
        pendenteRef.current = null;
        resolver?.(msg);
      });
    }
    return workerRef.current;
  }, [setProgressoSNA]);

  const enviar = useCallback(
    (pedido: SnaWorkerRequest): Promise<SnaWorkerResponse> =>
      new Promise((resolve) => {
        pendenteRef.current = resolve;
        obterWorker().postMessage(pedido);
      }),
    [obterWorker],
  );

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const calcularSna = useCallback(
    async (docs: Documento[]) => {
      setStatusSNA('calculando');
      setProgressoSNA(0, 'Iniciando análise de rede complexa...');
      const resposta = await enviar({ type: 'sna-global', docs });
      if (resposta.type === 'sna-global') {
        setSnaGlobal(resposta.result);
        // A maturidade topológica reaproveita o resultado recém-calculado
        const mat = await enviar({ type: 'maturidade', docs, sna: resposta.result });
        setMaturidade(mat.type === 'maturidade' ? mat.result : null);
      } else {
        setStatusSNA('erro');
      }
    },
    [enviar, setMaturidade, setProgressoSNA, setSnaGlobal, setStatusSNA],
  );

  const calcularBootstrap = useCallback(
    async (docs: Documento[], tipo: TipoForesight, nBootstrap = 100, fracaoAmostra = 0.85) => {
      const r = await enviar({ type: 'bootstrap', docs, tipo, nBootstrap, fracaoAmostra });
      return r.type === 'bootstrap' ? r.result : ({} as BootstrapMap);
    },
    [enviar],
  );

  const calcularMetricasComplexas = useCallback(
    async (docs: Documento[]): Promise<MetricasComplexas | null> => {
      const r = await enviar({ type: 'metricas-complexas', docs });
      return r.type === 'metricas-complexas' ? r.result : null;
    },
    [enviar],
  );

  const executarGridSearch = useCallback(
    async (
      docs: Documento[],
      tipo: TipoForesight,
    ): Promise<{ grid: GridSearchRow[]; backtest: BacktestRow[] }> => {
      const r = await enviar({ type: 'grid-search', docs, tipo });
      return r.type === 'grid-search' ? { grid: r.grid, backtest: r.backtest } : { grid: [], backtest: [] };
    },
    [enviar],
  );

  return { calcularSna, calcularBootstrap, calcularMetricasComplexas, executarGridSearch };
}
