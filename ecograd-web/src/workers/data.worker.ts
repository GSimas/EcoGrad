/// <reference lib="webworker" />
/**
 * Worker de ingestão. Baixa, descomprime e filtra as bases `.json.gz` fora da
 * main thread — o `JSON.parse` de centenas de MB bloquearia a UI por segundos.
 * Só os documentos já filtrados atravessam a fronteira do worker.
 */
import { versaoPublicada } from '../lib/base-version';
import { carregarManifestoColecoes } from '../lib/collection-loader';
import type { Documento } from '@/types';
import { carregarBasePPG, carregarBaseTCC } from '../lib/data-loader';

export interface DataWorkerRequest {
  type: 'carregar';
  programas: string[];
  cursosTcc: string[];
  objetivo?: string;
}

export type DataWorkerResponse =
  | { type: 'progress'; text: string }
  | { type: 'pronto'; docs: Documento[]; baseVersion: string }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function responder(msg: DataWorkerResponse): void {
  ctx.postMessage(msg);
}

ctx.addEventListener('message', async (evento: MessageEvent<DataWorkerRequest>) => {
  const { programas, cursosTcc } = evento.data;
  try {
    const manifest = await carregarManifestoColecoes();
    const baseVersion = manifest.version;
    const progress = (text: string) => responder({ type: 'progress', text });
    const combinados: Documento[] = [];

    if (programas.length > 0) {
      for (const doc of await carregarBasePPG(programas, undefined, manifest, progress)) combinados.push(doc);
    }

    if (cursosTcc.length > 0) {
      for (const doc of await carregarBaseTCC(cursosTcc, undefined, manifest, progress)) combinados.push(doc);
    }

    responder({ type: 'progress', text: `Consolidando ${combinados.length} documentos...` });
    if (!combinados.length) throw new Error('Nenhum documento encontrado para a seleção atual.');
    if (await versaoPublicada() !== baseVersion) throw new Error('A base foi atualizada durante a leitura. Reinicie o carregamento.');
    responder({ type: 'pronto', docs: combinados, baseVersion });
  } catch (erro) {
    responder({ type: 'error', message: erro instanceof Error ? erro.message : String(erro) });
  }
});
