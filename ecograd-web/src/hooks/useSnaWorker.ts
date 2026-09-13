import { useSyncExternalStore } from 'react';
import { atividades, calcularSna, calcularBootstrap, calcularMetricasComplexas, executarGridSearch, calcularEcologiaMemes } from '../services/calculos';

const acoes = { calcularSna, calcularBootstrap, calcularMetricasComplexas, executarGridSearch, calcularEcologiaMemes };
/** A desmontagem de uma página remove apenas a assinatura, nunca a atividade. */
export function useSnaWorker() { return acoes; }
export function useAtividades() {
  return useSyncExternalStore(atividades.subscribe, atividades.getSnapshot, atividades.getSnapshot);
}
export function useAtividade(id: string) { return useAtividades().find((a) => a.id === id); }
export const emExecucao = (task?: { status: string }) => task?.status === 'executando' || task?.status === 'fila';
