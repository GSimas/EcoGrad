/// <reference lib="webworker" />
/**
 * Grava o checkpoint da análise no IndexedDB fora da main thread.
 *
 * A transação é a mesma de `session-db` — ler as sessões guardadas, despejar as
 * vencidas e as mais antigas, gravar a nova —, só que aqui. Ler as sessões
 * guardadas traz de volta os textos inteiros (dezenas de MB), e na página esse
 * trecho travava a interface por mais de um segundo a cada checkpoint, logo
 * depois de carregar a coleção e de novo ao fim do cálculo da rede.
 */
import { writeAnalysis, type StoredAnalysis } from '../lib/session-db';

export interface PedidoSessao { id: number; aba: string; valor?: StoredAnalysis }
export interface RespostaSessao { id: number; ok: boolean; mensagem?: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', async (evento: MessageEvent<PedidoSessao>) => {
  const { id, aba, valor } = evento.data;
  try {
    await writeAnalysis(aba, valor);
    ctx.postMessage({ id, ok: true } satisfies RespostaSessao);
  } catch (erro) {
    ctx.postMessage({ id, ok: false, mensagem: erro instanceof Error ? erro.message : String(erro) } satisfies RespostaSessao);
  }
});
