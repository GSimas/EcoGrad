/// <reference lib="webworker" />
/**
 * Worker do catálogo de busca do acervo inteiro.
 *
 * O catálogo tem ~5 MB comprimidos e centenas de milhares de nomes. Baixar,
 * descomprimir, fazer o parse e normalizar cada nome na main thread travava a
 * página por segundos ao focar a busca, e varrer todos os nomes a cada tecla
 * atrasava a digitação. Aqui o catálogo é preparado uma vez e responde às
 * consultas; a página só recebe as dezenas de resultados que vai mostrar.
 *
 * Quem precisa do índice inteiro na página (conversa, dossiê, nuvens) o recebe
 * em lotes pequenos, cada um processado numa tarefa curta, junto das chaves já
 * normalizadas — ninguém normaliza de novo.
 */
import { calcularChaves, carregarIndiceBusca, casarNoAcervo, ordenarAchados, type IndiceBusca } from '../lib/busca-global';
import { termosBusca } from '../lib/utils';

export type PedidoBusca =
  | { tipo: 'preparar'; id: number }
  | { tipo: 'buscar'; id: number; consulta: string; limite: number }
  | { tipo: 'exportar'; id: number };

export type RespostaBusca =
  | { tipo: 'pronto'; id: number; total: number }
  | { tipo: 'achados'; id: number; itens: ReturnType<typeof ordenarAchados> }
  | { tipo: 'lote'; id: number; itens: IndiceBusca['itens']; chaves: string[]; excecoes: Array<[number, string]> }
  | { tipo: 'fim'; id: number; schema: 1; tipos: IndiceBusca['tipos']; colecoes: IndiceBusca['colecoes'] }
  | { tipo: 'erro'; id: number; mensagem: string };

/** Itens por mensagem: pequeno o bastante para a página desserializar cada lote sem tarefa longa. */
const LOTE = 5000;

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const responder = (msg: RespostaBusca) => ctx.postMessage(msg);

/**
 * `chaveBusca` passa por `normalize('NFD')`, e no V8 a chave de um nome
 * acentuado fica com dois bytes por caractere mesmo depois de perder os
 * acentos. Uma volta pelo JSON devolve as mesmas chaves com um byte por
 * caractere — cerca de 6 MB a menos no catálogo inteiro. Vai em lotes, depois
 * que a busca já responde, e cada lote devolve a vez às consultas: trocar uma
 * chave pela cópia compacta não muda resultado nenhum.
 */
const COMPACTAR = 20000;
function compactarAosPoucos(chaves: string[], inicio = 0) {
  if (inicio >= chaves.length) return;
  const fim = Math.min(chaves.length, inicio + COMPACTAR);
  const compactas = JSON.parse(JSON.stringify(chaves.slice(inicio, fim))) as string[];
  for (let i = inicio; i < fim; i++) chaves[i] = compactas[i - inicio];
  setTimeout(() => compactarAosPoucos(chaves, fim), 0);
}

let carga: Promise<{ indice: IndiceBusca } & ReturnType<typeof calcularChaves>> | null = null;
function preparar() {
  carga ??= carregarIndiceBusca().then((indice) => {
    const prontas = calcularChaves(indice);
    setTimeout(() => compactarAosPoucos(prontas.chaves), 0);
    return { indice, ...prontas };
  });
  // Uma falha de rede não pode ficar guardada: a próxima tentativa baixa de novo.
  carga.catch(() => { carga = null; });
  return carga;
}

/**
 * A última consulta e as posições que ela casou. Quando a nova consulta só
 * acrescenta ao que já foi digitado — cada termo antigo continua contido no
 * termo novo da mesma posição —, toda resposta nova está entre as antigas, e a
 * varredura se restringe a elas. É o caso comum de quem digita letra a letra.
 */
let ultima: { termos: string[]; posicoes: number[] } | null = null;
const refina = (novos: readonly string[], antigos: readonly string[]) =>
  antigos.length <= novos.length && antigos.every((t, j) => novos[j].includes(t));

ctx.addEventListener('message', async (evento: MessageEvent<PedidoBusca>) => {
  const pedido = evento.data;
  try {
    const { indice, chaves, excecoes } = await preparar();
    if (pedido.tipo === 'preparar') {
      responder({ tipo: 'pronto', id: pedido.id, total: indice.itens.length });
    } else if (pedido.tipo === 'buscar') {
      const termos = termosBusca(pedido.consulta);
      if (termos.join('').length < 2) {
        responder({ tipo: 'achados', id: pedido.id, itens: [] });
        return;
      }
      const candidatos = ultima && refina(termos, ultima.termos) ? ultima.posicoes : undefined;
      const achados = casarNoAcervo(chaves, termos, candidatos);
      ultima = { termos, posicoes: achados.map(([, i]) => i) };
      responder({ tipo: 'achados', id: pedido.id, itens: ordenarAchados(indice, achados, pedido.limite) });
    } else {
      for (let inicio = 0; inicio < indice.itens.length; inicio += LOTE) {
        const fim = Math.min(indice.itens.length, inicio + LOTE);
        const lote: Array<[number, string]> = [];
        for (let i = inicio; i < fim; i++) { const c = excecoes.get(i); if (c !== undefined) lote.push([i, c]); }
        responder({ tipo: 'lote', id: pedido.id, itens: indice.itens.slice(inicio, fim), chaves: chaves.slice(inicio, fim), excecoes: lote });
      }
      responder({ tipo: 'fim', id: pedido.id, schema: 1, tipos: indice.tipos, colecoes: indice.colecoes });
    }
  } catch (erro) {
    responder({ tipo: 'erro', id: pedido.id, mensagem: erro instanceof Error ? erro.message : String(erro) });
  }
});
