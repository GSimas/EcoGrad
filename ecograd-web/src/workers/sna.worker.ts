/// <reference lib="webworker" />
/**
 * Worker de redes complexas. Mantém o Brandes, o Louvain e o bootstrap fora da
 * main thread — sem isso, uma base de dezenas de milhares de documentos
 * congelaria a UI durante os minutos de cálculo.
 */
import type { SnaWorkerRequest, SnaWorkerResponse } from '@/types';
import {
  calcularBetweennessBootstrap,
  otimizarParametrosForesight,
  validarForesightHistorico,
} from '@/lib/foresight-grafo';
import {
  calcularMaturidadeRede,
  calcularMetricasComplexas,
  calcularSnaGlobal,
  construirGrafoGlobal,
} from '@/lib/sna-engine';
import { gerarEcologiaMemes } from '@/lib/memetic-network';
import { calcularFurosEstruturais } from '@/lib/burt-furos';
import { serializarGrafo } from '@/lib/exportar-grafo';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function responder(msg: SnaWorkerResponse): void {
  ctx.postMessage(msg);
}

ctx.addEventListener('message', (evento: MessageEvent<SnaWorkerRequest>) => {
  const pedido = evento.data;
  try {
    switch (pedido.type) {
      case 'sna-global': {
        const result = calcularSnaGlobal(pedido.docs, (_value, text) =>
          responder({ type: 'progress', value: null, text }),
        );
        responder({ type: 'sna-global', result });
        break;
      }
      case 'maturidade': {
        responder({ type: 'progress', value: null, text: 'Avaliando maturidade topológica...' });
        responder({ type: 'maturidade', result: calcularMaturidadeRede(pedido.docs, pedido.sna) });
        break;
      }
      case 'metricas-complexas': {
        responder({ type: 'progress', value: null, text: 'Calculando métricas de complexidade...' });
        responder({ type: 'metricas-complexas', result: calcularMetricasComplexas(pedido.docs) });
        break;
      }
      case 'bootstrap': {
        const result = calcularBetweennessBootstrap(
          pedido.docs,
          pedido.tipo,
          pedido.nBootstrap,
          pedido.fracaoAmostra,
          (feito, total) =>
            responder({
              type: 'progress',
              value: Math.round((feito / total) * 100),
              text: `Reamostragem bootstrap ${feito}/${total}...`,
            }),
        );
        responder({ type: 'bootstrap', result });
        break;
      }
      case 'grid-search': {
        // A varredura de 108 combinações leva dezenas de segundos: rodá-la aqui
        // mantém a UI responsiva e permite reportar progresso de verdade.
        const grid = otimizarParametrosForesight(pedido.docs, pedido.tipo, (feito, total) =>
          responder({
            type: 'progress',
            value: Math.round((feito / total) * 100),
            text: `Avaliando combinação ${feito}/${total}...`,
          }),
        );
        responder({ type: 'progress', value: null, text: 'Validando a melhor configuração...' });
        const melhor = grid[0];
        const backtest = melhor
          ? validarForesightHistorico(
              pedido.docs,
              melhor['Ano Corte'],
              melhor['Passado (Burst)'],
              melhor['Futuro (Previsão)'],
              melhor['Corte (%)'] / 100,
              pedido.tipo,
            )
          : [];
        responder({ type: 'grid-search', grid, backtest });
        break;
      }
      case 'ecologia-memes': {
        // A rede de coocorrência de memes é densa (milhares de nós, dezenas de
        // milhares de arestas); calcular no main thread congelaria a página.
        const result = gerarEcologiaMemes(
          pedido.docs,
          pedido.minCoocorrencia,
          pedido.fonte,
          (_value, text) => responder({ type: 'progress', value: null, text }),
        );
        responder({ type: 'ecologia-memes', result });
        break;
      }
      case 'furos-estruturais': {
        // Constraint é O(Σ d²) e betweenness é Brandes: a rede de orientadores
        // e palavras-chave é pequena perto da global, mas ainda trava a página.
        const result = calcularFurosEstruturais(pedido.docs, (_value, text) =>
          responder({ type: 'progress', value: null, text }),
        );
        responder({ type: 'furos-estruturais', result });
        break;
      }
      case 'exportar-grafo': {
        responder({ type: 'progress', value: null, text: 'Montando a rede global para exportação...' });
        const g = construirGrafoGlobal(pedido.docs);
        responder({ type: 'progress', value: null, text: `Serializando ${g.order} nós em ${pedido.formato}...` });
        responder({
          type: 'exportar-grafo',
          formato: pedido.formato,
          conteudo: serializarGrafo(g, pedido.formato),
          nos: g.order,
          arestas: g.size,
        });
        break;
      }
      default:
        responder({ type: 'error', message: 'Pedido desconhecido enviado ao worker de SNA.' });
    }
  } catch (erro) {
    responder({ type: 'error', message: erro instanceof Error ? erro.message : String(erro) });
  }
});
