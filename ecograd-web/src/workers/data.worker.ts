/// <reference lib="webworker" />
/**
 * Worker de ingestão. Baixa, descomprime e filtra as bases `.json.gz` fora da
 * main thread — o `JSON.parse` de centenas de MB bloquearia a UI por segundos.
 * Só os documentos já filtrados atravessam a fronteira do worker.
 */
import type { Documento } from '@/types';
import { carregarBasePPG, carregarBaseTCC } from '@/lib/data-loader';

export interface DataWorkerRequest {
  type: 'carregar';
  programas: string[];
  cursosTcc: string[];
}

export type DataWorkerResponse =
  | { type: 'progress'; text: string }
  | { type: 'pronto'; docs: Documento[] }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function responder(msg: DataWorkerResponse): void {
  ctx.postMessage(msg);
}

ctx.addEventListener('message', async (evento: MessageEvent<DataWorkerRequest>) => {
  const { programas, cursosTcc } = evento.data;
  try {
    const combinados: Documento[] = [];

    if (programas.length > 0) {
      responder({ type: 'progress', text: 'Descomprimindo base de Teses e Dissertações...' });
      combinados.push(...(await carregarBasePPG(programas)));
    }

    if (cursosTcc.length > 0) {
      responder({ type: 'progress', text: 'Descomprimindo base de TCCs...' });
      combinados.push(...(await carregarBaseTCC(cursosTcc)));
    }

    responder({ type: 'progress', text: `Consolidando ${combinados.length} documentos...` });
    responder({ type: 'pronto', docs: combinados });
  } catch (erro) {
    responder({ type: 'error', message: erro instanceof Error ? erro.message : String(erro) });
  }
});
