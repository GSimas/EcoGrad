import { useAparencia } from '@/services/aparencia';
import { adaptarGrafico } from '@/lib/aparencia-graficos';
import { lazy, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { CanvasBoundary } from './CanvasBoundary';
const ReactECharts = lazy(() => import('./EChartsCanvas'));
import type { EChartsOption } from 'echarts';
import { useSessionField } from '@/hooks/useSessionField';
import { Tabela, type LeituraDados } from './Tabela';
import { baixarGraficoECharts, ehExportavel, type FormatoImagem } from '@/lib/exportar-imagem';
import { ImageDown } from 'lucide-react';

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
  '↗ Tendência': '#2ECC71',
  '↖ Sinal Fraco': '#F1C40F',
  '↘ Mainstream': '#3498DB',
  '↙ Base/Declínio': '#E74C3C',
};

export function Grafico({
  option,
  leitura,
  altura = 360,
  larguraMinima = 0,
  onEvents,
  onReady,
  rodape,
  mesclar = false,
}: {
  option: EChartsOption;
  leitura: LeituraDados;
  altura?: number;
  larguraMinima?: number;
  onEvents?: Record<string, (params: unknown) => void>;
  onReady?: (instancia: unknown) => void;
  /**
   * Conteúdo abaixo do desenho — tipicamente uma legenda em HTML, que não é
   * sobreposta pelo gráfico nem cortada como a legenda interna do ECharts.
   * Só aparece na vista de gráfico: na tabela não haveria a que se referir.
   */
  rodape?: ReactNode;
  /**
   * Mescla a nova opção na anterior em vez de substituí-la. Preserva o zoom e o
   * arrasto (`roam`) quando só o estilo muda, como no destaque de um nó.
   */
  mesclar?: boolean;
}) {
  const { claro, reduzir } = useAparencia();
  const [vista, setVista] = useSessionField('grafico.' + leitura.titulo, 'grafico');
  // Instância do ECharts, guardada para exportar a imagem. O `onReady` do
  // chamador continua sendo chamado: a exportação não toma o lugar dele.
  const instancia = useRef<unknown>(null);
  const aoMontar = useCallback((eci: unknown) => {
    instancia.current = eci;
    onReady?.(eci);
  }, [onReady]);
  const baixar = useCallback((formato: FormatoImagem) => {
    const eci = instancia.current;
    if (ehExportavel(eci)) baixarGraficoECharts(eci, leitura.titulo, formato);
  }, [leitura.titulo]);
  const opcaoFinal = useMemo<EChartsOption>(
    () => adaptarGrafico({
      backgroundColor: 'transparent',
      textStyle: { color: TEMA_GRAFICO.texto, fontFamily: 'Inter, system-ui, sans-serif' },
      color: TEMA_GRAFICO.paleta,
      ...option,
      animation: !reduzir,
      aria: { enabled: true, label: { description: `${leitura.titulo}. ${leitura.descricao ?? ''} Dados completos disponíveis na vista em tabela.` } },
      legend: { ...(option.legend as object), selectedMode: false },
      tooltip: {
        backgroundColor: TEMA_GRAFICO.fundoTooltip,
        borderColor: '#26303B',
        textStyle: { color: TEMA_GRAFICO.texto },
        ...(option.tooltip as object),
        renderMode: 'richText',
        confine: true,
      },
    }, claro, reduzir),
    [option, leitura.titulo, leitura.descricao, claro, reduzir],
  );

  return (
    <section className="min-w-0 space-y-3" aria-label={leitura.titulo}>
      <p className="text-sm font-medium">{leitura.titulo}</p>
      <p className="text-xs leading-relaxed text-slate-300">{leitura.descricao}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Visualização de ${leitura.titulo}`}>
        <button type="button" className="btn" aria-pressed={vista !== 'tabela'} onClick={() => setVista('grafico')}>Ver gráfico</button>
        <button type="button" className="btn" aria-pressed={vista === 'tabela'} onClick={() => setVista('tabela')}>Ver dados em tabela</button>
        {vista !== 'tabela' && (
          <>
            <button type="button" className="btn" onClick={() => baixar('jpg')} title={`Baixar ${leitura.titulo} em JPG, com o fundo do tema atual`}>
              <ImageDown size={16} aria-hidden="true" />Baixar JPG (com fundo)
            </button>
            <button type="button" className="btn" onClick={() => baixar('png')} title={`Baixar ${leitura.titulo} em PNG, com fundo transparente`}>
              <ImageDown size={16} aria-hidden="true" />Baixar PNG (sem fundo)
            </button>
          </>
        )}
      </div>
      {vista === 'tabela' ? <Tabela {...leitura} /> : <><div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Gráfico ${leitura.titulo}; alternativa disponível no botão Ver dados em tabela`}><div style={{minWidth:larguraMinima}}>
    <CanvasBoundary><ReactECharts
      option={opcaoFinal}
      style={{ height: altura, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge={!mesclar}
      lazyUpdate
      onEvents={onEvents}
      onChartReady={aoMontar}
    /></CanvasBoundary></div></div>{rodape}</>}
    </section>
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
  unidade = 'Ocorrências (n)',
): EChartsOption {
  const ordenado = ordenarRanking(dados);
  return {
    title: { text: titulo, left: 'center', textStyle: { fontSize: 13, color: TEMA_GRAFICO.texto } },
    grid: { left: 8, right: 48, top: 40, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value',
      name: unidade,
      minInterval: 1,
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
    },
    yAxis: {
      type: 'category',
      data: ordenado.map(([nome]) => nome),
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      axisLabel: { color: TEMA_GRAFICO.texto, fontSize: 11, width: 190, overflow: 'truncate' },
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

  return <Grafico leitura={{ titulo, descricao: 'Barras: ocorrências no recorte carregado (n). Frequência não mede mérito. Use a tabela para ler nomes completos, exportar ou abrir uma entidade por teclado.', linhas: [...dados].map(([nome, valor]) => ({ nome, valor })), colunas: [{ chave: 'nome', rotulo: 'Nome completo' }, { chave: 'valor', rotulo: 'Ocorrências (n)' }], onAbrir: (l) => onSelecionar(String(l.nome)) }} option={option} altura={altura} larguraMinima={460} onReady={aoCriar} />;
}
