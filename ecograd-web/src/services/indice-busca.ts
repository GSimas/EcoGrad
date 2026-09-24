/**
 * O catálogo de busca do acervo, servido pelo `busca.worker`.
 *
 * `buscarNoIndice` responde à digitação sem varrer nada na main thread.
 * `carregarIndiceBusca` entrega o índice inteiro a quem o consulta de forma
 * síncrona (conversa, dossiê, nuvens): o mesmo objeto de sempre, montado a
 * partir de lotes pequenos e já com as chaves normalizadas registradas.
 *
 * Sem suporte a workers, tudo cai no caminho antigo, na própria página.
 */
import {
  buscarNoAcervo,
  carregarIndiceBusca as lerIndiceBusca,
  prepararBusca,
  registrarChaves,
  type BuscaPreparada,
  type IndiceBusca,
  type ResultadoBusca,
} from '@/lib/busca-global';
import type { PedidoBusca, RespostaBusca } from '@/workers/busca.worker';

/** `Omit` que respeita cada membro da união de pedidos. */
type SemId<T> = T extends unknown ? Omit<T, 'id'> : never;

interface Pendente {
  resolver: (valor: RespostaBusca) => void;
  rejeitar: (erro: Error) => void;
  aoReceber?: (msg: RespostaBusca) => boolean;
}

let worker: Worker | null = null;
let semWorker = false;
let sequencia = 0;
const pendentes = new Map<number, Pendente>();

function falharTodos(mensagem: string) {
  for (const p of pendentes.values()) p.rejeitar(new Error(mensagem));
  pendentes.clear();
}

function obterWorker(): Worker | null {
  if (worker || semWorker) return worker;
  try {
    worker = new Worker(new URL('../workers/busca.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    semWorker = true;
    return null;
  }
  worker.onmessage = (evento: MessageEvent<RespostaBusca>) => {
    const msg = evento.data;
    const p = pendentes.get(msg.id);
    if (!p) return;
    if (msg.tipo === 'erro') { pendentes.delete(msg.id); p.rejeitar(new Error(msg.mensagem)); return; }
    // Lotes do índice vão sendo recebidos; só o fim encerra o pedido.
    if (p.aoReceber?.(msg)) return;
    pendentes.delete(msg.id);
    p.resolver(msg);
  };
  // Um worker que caiu é recriado no próximo pedido; os pendentes falham agora.
  worker.onerror = (evento) => {
    evento.preventDefault();
    worker?.terminate();
    worker = null;
    falharTodos('A busca no acervo foi interrompida. Tente novamente.');
  };
  return worker;
}

function pedir(pedido: SemId<PedidoBusca>, signal?: AbortSignal, aoReceber?: Pendente['aoReceber']): Promise<RespostaBusca> {
  const w = obterWorker();
  if (!w) return Promise.reject(new Error('sem-worker'));
  const id = ++sequencia;
  return new Promise((resolver, rejeitar) => {
    if (signal?.aborted) { rejeitar(signal.reason); return; }
    pendentes.set(id, { resolver, rejeitar, aoReceber });
    signal?.addEventListener('abort', () => { if (pendentes.delete(id)) rejeitar(signal.reason); }, { once: true });
    w.postMessage({ ...pedido, id } as PedidoBusca);
  });
}

/** Caminho sem worker: o índice preparado na própria página, como antes. */
let local: Promise<BuscaPreparada> | null = null;
function preparadaLocal(signal?: AbortSignal) {
  local ??= lerIndiceBusca(signal).then(prepararBusca);
  local.catch(() => { local = null; });
  return local;
}

/** Baixa e prepara o catálogo fora da página. Resolve quando a busca está pronta. */
export async function prepararIndiceDeBusca(signal?: AbortSignal): Promise<true> {
  if (obterWorker()) {
    await pedir({ tipo: 'preparar' }, signal);
    return true;
  }
  await preparadaLocal(signal);
  return true;
}

/** Os mesmos resultados de `buscarNoAcervo`, calculados no worker. */
export async function buscarNoIndice(consulta: string, limite = 50, signal?: AbortSignal): Promise<ResultadoBusca[]> {
  if (obterWorker()) {
    const r = await pedir({ tipo: 'buscar', consulta, limite }, signal);
    return r.tipo === 'achados' ? r.itens : [];
  }
  return buscarNoAcervo(await preparadaLocal(signal), consulta, limite);
}

/** O índice inteiro, para quem o consulta de forma síncrona. Mesma forma de `lib/busca-global`. */
export async function carregarIndiceBusca(signal?: AbortSignal): Promise<IndiceBusca> {
  if (!obterWorker()) return (await preparadaLocal(signal)).indice;
  const itens: IndiceBusca['itens'] = [];
  const chaves: string[] = [];
  const excecoes = new Map<number, string>();
  const fim = await pedir({ tipo: 'exportar' }, signal, (msg) => {
    if (msg.tipo !== 'lote') return false;
    for (let k = 0; k < msg.itens.length; k++) { itens.push(msg.itens[k]); chaves.push(msg.chaves[k]); }
    for (const [i, chave] of msg.excecoes) excecoes.set(i, chave);
    return true;
  });
  if (fim.tipo !== 'fim') throw new Error('Catálogo de busca inválido.');
  const indice: IndiceBusca = { schema: fim.schema, tipos: fim.tipos, colecoes: fim.colecoes, itens };
  registrarChaves(indice, { chaves, excecoes });
  return indice;
}
