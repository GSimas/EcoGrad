// O `echarts-gl` se registra no echarts ao ser importado, e pesa perto de meio
// megabyte. Fica neste módulo próprio para entrar só no pedaço carregado quando
// um gráfico 3D aparece na tela — quem nunca abre a aba de estrutura da rede não
// paga por ele.
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
export default ReactECharts;
