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
import { recortarDocs, resumoRecorte, type ItemRecorte } from '../lib/recorte';

export interface DataWorkerRequest {
  type: 'carregar';
  programas: string[];
  cursosTcc: string[];
  objetivo?: string;
  /** Itens que delimitam a análise. Vazio: as coleções inteiras. */
  recorte?: ItemRecorte[];
}

export type DataWorkerResponse =
  | { type: 'progress'; text: string; value?: number | null }
  | { type: 'pronto'; docs: Documento[]; baseVersion: string }
  | { type: 'error'; message: string };

/** Percentual da barra reservado aos downloads; o restante cobre a consolidação. */
const DOWNLOADS_ATE = 95;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function responder(msg: DataWorkerResponse): void {
  ctx.postMessage(msg);
}

ctx.addEventListener('message', async (evento: MessageEvent<DataWorkerRequest>) => {
  const { programas, cursosTcc, recorte = [] } = evento.data;
  try {
    responder({ type: 'progress', text: 'Lendo o catálogo de coleções...', value: 0 });
    const manifest = await carregarManifestoColecoes();
    const baseVersion = manifest.version;
    const combinados: Documento[] = [];

    // Os downloads ocupam a barra até DOWNLOADS_ATE; o resto fica para a
    // consolidação, que roda depois e não tem progresso próprio. Cada base
    // recebe a fatia proporcional ao número de coleções que ela vai baixar.
    const total = programas.length + cursosTcc.length;
    const fatia = (base: number, peso: number) => (text: string, fracao: number) =>
      responder({ type: 'progress', text, value: Math.round(DOWNLOADS_ATE * (base + peso * fracao)) });
    const pesoPpg = total ? programas.length / total : 0;

    if (programas.length > 0) {
      for (const doc of await carregarBasePPG(programas, undefined, manifest, fatia(0, pesoPpg))) combinados.push(doc);
    }

    if (cursosTcc.length > 0) {
      for (const doc of await carregarBaseTCC(cursosTcc, undefined, manifest, fatia(pesoPpg, 1 - pesoPpg))) combinados.push(doc);
    }

    responder({ type: 'progress', text: `Consolidando ${combinados.length} documentos...`, value: DOWNLOADS_ATE });
    if (!combinados.length) throw new Error('Nenhum documento encontrado para a seleção atual.');
    // O recorte é aplicado aqui, e não na main thread: só os documentos do item
    // escolhido atravessam a fronteira do worker e ocupam memória na página.
    const docs = recortarDocs(combinados, recorte);
    if (!docs.length) throw new Error(`Nenhum documento das coleções corresponde a ${resumoRecorte(recorte)}. A busca usa um catálogo do acervo inteiro; o recorte local pode estar defasado.`);
    if (await versaoPublicada() !== baseVersion) throw new Error('A base foi atualizada durante a leitura. Reinicie o carregamento.');
    responder({ type: 'pronto', docs, baseVersion });
  } catch (erro) {
    responder({ type: 'error', message: erro instanceof Error ? erro.message : String(erro) });
  }
});
