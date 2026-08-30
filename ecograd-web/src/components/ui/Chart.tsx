import { useMemo } from 'react';
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
}: {
  option: EChartsOption;
  altura?: number;
  onEvents?: Record<string, (params: unknown) => void>;
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
    />
  );
}

/** Barras horizontais para os rankings Top-10 do Dashboard. */
export function barrasHorizontais(
  dados: ReadonlyArray<[string, number]>,
  titulo: string,
  cor = TEMA_GRAFICO.paleta[0],
): EChartsOption {
  const ordenado = [...dados].sort((a, b) => a[1] - b[1]);
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
