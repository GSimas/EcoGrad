import { useCallback, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import 'echarts-wordcloud';

/** Tokens visuais compartilhados por todos os gráficos (tema escuro do EcoGrad). */
export const TEMA_GRAFICO = {
  texto: '#CBD5E1',
  eixo: '#475569',
  grade: '#1E293B',
  fundoTooltip: '#161B22',
  paleta: ['#F39C12', '#3498DB', '#2ECC71', '#E74C3C', '#9B59B6', '#1ABC9C', '#E67E22', '#F1C40F'],
};

/** Cores semânticas dos quadrantes do Radar (idênticas ao Plotly do Streamlit). */
export const CORES_QUADRANTE: Record<string, string> = {
  '↗️ Tendência': '#2ECC71',
  '↖️ Sinal Fraco': '#F1C40F',
  '↘️ Mainstream': '#3498DB',
  '↙️ Base/Declínio': '#E74C3C',
};

export function Grafico({
  option,
  altura = 360,
  onEvents,
  onReady,
}: {
  option: EChartsOption;
  altura?: number;
  onEvents?: Record<string, (params: unknown) => void>;
  onReady?: (instancia: unknown) => void;
}) {
  const opcaoFinal = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      textStyle: { color: TEMA_GRAFICO.texto, fontFamily: 'Inter, system-ui, sans-serif' },
      color: TEMA_GRAFICO.paleta,
      tooltip: {
        backgroundColor: TEMA_GRAFICO.fundoTooltip,
        borderColor: '#26303B',
        textStyle: { color: TEMA_GRAFICO.texto },
        ...(option.tooltip as object),
      },
      ...option,
    }),
    [option],
  );

  return (
    <ReactECharts
      option={opcaoFinal}
      style={{ height: altura, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
      onEvents={onEvents}
      onChartReady={onReady}
    />
  );
}

/** Ordena um ranking para exibição (menor embaixo, maior no topo). */
function ordenarRanking(dados: ReadonlyArray<[string, number]>): Array<[string, number]> {
  return [...dados].sort((a, b) => a[1] - b[1]);
}

/** Barras horizontais para os rankings Top-10 do Dashboard. */
export function barrasHorizontais(
  dados: ReadonlyArray<[string, number]>,
  titulo: string,
  cor = TEMA_GRAFICO.paleta[0],
): EChartsOption {
  const ordenado = ordenarRanking(dados);
  return {
    title: { text: titulo, left: 'center', textStyle: { fontSize: 13, color: TEMA_GRAFICO.texto } },
    grid: { left: 8, right: 48, top: 40, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
    },
    yAxis: {
      type: 'category',
      data: ordenado.map(([nome]) => (nome.length > 34 ? `${nome.slice(0, 34)}…` : nome)),
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      axisLabel: { color: TEMA_GRAFICO.texto, fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: ordenado.map(([, v]) => v),
        itemStyle: { color: cor, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', color: TEMA_GRAFICO.texto, fontSize: 11 },
      },
    ],
  };
}


/** Superfície mínima da instância ECharts usada pelo ranking clicável. */
interface InstanciaECharts {
  getZr: () => { on: (evento: string, handler: (e: { offsetX: number; offsetY: number }) => void) => void };
  convertFromPixel: (alvo: { gridIndex: number }, pixel: [number, number]) => number[] | null;
  containPixel: (alvo: { gridIndex: number }, pixel: [number, number]) => boolean;
}

/**
 * Ranking Top-N clicável.
 *
 * O clique é resolvido no nível do zrender e convertido de pixel para índice de
 * categoria, em vez de depender do evento `click` de série do ECharts: com
 * `tooltip.trigger: 'axis'` o hit-test da barra não dispara, e o clique se
 * perderia silenciosamente. Assim qualquer ponto dentro do grid — barra, rótulo
 * ou o espaço da linha — leva à entidade correta.
 *
 * A correspondência é sempre por índice: os rótulos exibidos são truncados e não
 * servem para identificar a entidade.
 */
export function RankingClicavel({
  dados,
  titulo,
  cor,
  onSelecionar,
  altura = 330,
}: {
  dados: ReadonlyArray<[string, number]>;
  titulo: string;
  cor?: string;
  onSelecionar: (nome: string) => void;
  altura?: number;
}) {
  const ordenado = useMemo(() => ordenarRanking(dados), [dados]);

  // Handlers e dados atuais ficam em refs: o zrender é registrado uma única vez,
  // na criação do gráfico, e precisa enxergar sempre a versão mais recente.
  const ordenadoRef = useRef(ordenado);
  ordenadoRef.current = ordenado;
  const onSelecionarRef = useRef(onSelecionar);
  onSelecionarRef.current = onSelecionar;

  const option = useMemo<EChartsOption>(() => {
    const base = barrasHorizontais(ordenado, titulo, cor);
    return {
      ...base,
      // O cursor sinaliza que o gráfico é navegável
      series: [{ ...((base.series as unknown[])[0] as object), cursor: 'pointer' }],
    } as EChartsOption;
  }, [ordenado, titulo, cor]);

  const aoCriar = useCallback((instancia: unknown) => {
    const inst = instancia as InstanciaECharts;
    inst.getZr().on('click', (evento) => {
      const pixel: [number, number] = [evento.offsetX, evento.offsetY];
      // Ignora cliques fora da área de plotagem (título, margens)
      if (!inst.containPixel({ gridIndex: 0 }, pixel)) return;
      const convertido = inst.convertFromPixel({ gridIndex: 0 }, pixel);
      const indice = Math.round(convertido?.[1] ?? -1);
      const alvo = ordenadoRef.current[indice];
      if (alvo) onSelecionarRef.current(alvo[0]);
    });
  }, []);

  return <Grafico option={option} altura={altura} onReady={aoCriar} />;
}
