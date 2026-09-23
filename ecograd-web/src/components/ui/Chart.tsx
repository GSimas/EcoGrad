import { useAparencia } from '@/services/aparencia';
import { adaptarGrafico } from '@/lib/aparencia-graficos';
import { lazy, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { CanvasBoundary } from './CanvasBoundary';
const ReactECharts = lazy(() => import('./EChartsCanvas'));
// O 3D mora noutro pedaço: o `echarts-gl` só é baixado por quem abre um gráfico
// tridimensional, e não por todo mundo que abre um gráfico qualquer.
const ReactEChartsGL = lazy(() => import('./EChartsCanvas3D'));
import type { EChartsOption } from 'echarts';
import { useSessionField } from '@/hooks/useSessionField';
import { Tabela, type LeituraDados } from './Tabela';
import { baixarGraficoECharts, ehExportavel, type FormatoImagem } from '@/lib/exportar-imagem';
import { BaixarImagem } from './BaixarImagem';
import { Dica } from './primitives';
import { useEmJanela } from './contexto-janela';
import { TEMA_GRAFICO } from '@/lib/tema-grafico';

// Os tokens moram em `lib/tema-grafico`, para que os construtores de opção
// puros possam usá-los sem depender de um componente. Reexportados aqui
// porque metade da aplicação já os importa deste módulo.
export { TEMA_GRAFICO, CORES_QUADRANTE } from '@/lib/tema-grafico';

export function Grafico({
  option,
  leitura,
  altura = 360,
  larguraMinima = 0,
  onEvents,
  onReady,
  rodape,
  mesclar = false,
  tridimensional = false,
  descricaoEmDica: descricaoEmDicaPedida,
  dicaExtra,
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
  /**
   * Usa o renderizador WebGL do `echarts-gl`, que traz órbita e zoom do mouse
   * embutidos. A imagem exportada é o enquadramento atual da órbita, na
   * resolução da tela (ver `baixarGraficoECharts`).
   */
  tridimensional?: boolean;
  /** Mostra a descrição numa dica "i" ao lado do título, em vez do parágrafo. */
  descricaoEmDica?: boolean;
  /** Instruções a mais, na mesma dica da descrição (só com `descricaoEmDica`). */
  dicaExtra?: ReactNode;
}) {
  const { claro, reduzir } = useAparencia();
  // Dentro de uma janela de bloco, a descrição vai para a dica mesmo sem pedido.
  const emJanela = useEmJanela();
  const descricaoEmDica = descricaoEmDicaPedida ?? emJanela;
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
    if (ehExportavel(eci)) baixarGraficoECharts(eci, leitura.titulo, formato, { webgl: tridimensional });
  }, [leitura.titulo, tridimensional]);
  const opcaoFinal = useMemo<EChartsOption>(
    () => adaptarGrafico({
      backgroundColor: 'transparent',
      textStyle: { color: TEMA_GRAFICO.texto, fontFamily: '"Manrope Variable", Manrope, system-ui, sans-serif' },
      color: TEMA_GRAFICO.paleta,
      ...option,
      animation: !reduzir,
      aria: { enabled: true, label: { description: `${leitura.titulo}. ${leitura.descricao ?? ''} Dados completos disponíveis na vista em tabela.` } },
      legend: { ...(option.legend as object), selectedMode: false },
      tooltip: {
        backgroundColor: TEMA_GRAFICO.fundoTooltip,
        borderColor: '#2C3834',
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
      {descricaoEmDica && leitura.descricao
        ? <div className="flex items-center gap-2"><p className="text-sm font-medium">{leitura.titulo}</p><Dica rotulo={`Como ler: ${leitura.titulo}`}><p>{leitura.descricao}</p>{dicaExtra}</Dica></div>
        : <><p className="text-sm font-medium">{leitura.titulo}</p>
          <p className="text-xs leading-relaxed text-slate-300">{leitura.descricao}</p></>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Visualização de ${leitura.titulo}`}>
        <button type="button" className="btn" aria-pressed={vista !== 'tabela'} onClick={() => setVista('grafico')}>Ver gráfico</button>
        <button type="button" className="btn" aria-pressed={vista === 'tabela'} onClick={() => setVista('tabela')}>Ver dados em tabela</button>
        {vista !== 'tabela' && <BaixarImagem titulo={leitura.titulo} onBaixar={baixar} />}
      </div>
      {/* `descricao` fica de fora: o Grafico já a mostra acima, nas duas vistas. */}
      {vista === 'tabela' ? <Tabela {...leitura} descricao={undefined} aninhada /> : <><div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Gráfico ${leitura.titulo}; alternativa disponível no botão Ver dados em tabela`}><div style={{minWidth:larguraMinima}}>
    <CanvasBoundary>{tridimensional ? <ReactEChartsGL
      option={opcaoFinal}
      style={{ height: altura, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge={!mesclar}
      lazyUpdate
      onEvents={onEvents}
      onChartReady={aoMontar}
    /> : <ReactECharts
      option={opcaoFinal}
      style={{ height: altura, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge={!mesclar}
      lazyUpdate
      onEvents={onEvents}
      onChartReady={aoMontar}
    />}</CanvasBoundary></div></div>{rodape}</>}
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
/**
 * `onReady` que transforma clique numa barra horizontal em seleção do item.
 *
 * O ECharts não entrega o índice da categoria num clique fora da barra desenhada,
 * então a conversão é por pixel: a linha do cursor no eixo Y é o índice na lista
 * já ordenada. Handlers e dados ficam em refs porque o zrender é registrado uma
 * única vez, na criação do gráfico, e precisa enxergar sempre a versão atual.
 */
export function useCliqueEmBarra(dados: ReadonlyArray<[string, number]>, onSelecionar: (nome: string) => void) {
  const ordenadoRef = useRef<Array<[string, number]>>([]);
  ordenadoRef.current = ordenarRanking(dados);
  const onSelecionarRef = useRef(onSelecionar);
  onSelecionarRef.current = onSelecionar;
  return useCallback((instancia: unknown) => {
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
}

export function RankingClicavel({
  dados,
  titulo,
  cor,
  onSelecionar,
  descricaoEmDica: descricaoEmDicaPedida,
  altura = 330,
}: {
  dados: ReadonlyArray<[string, number]>;
  titulo: string;
  cor?: string;
  onSelecionar: (nome: string) => void;
  altura?: number;
  /** Descrição e convite ao clique numa dica "i", em vez de letra miúda. */
  descricaoEmDica?: boolean;
}) {
  const ordenado = useMemo(() => ordenarRanking(dados), [dados]);
  const aoCriar = useCliqueEmBarra(dados, onSelecionar);
  const emJanela = useEmJanela();
  const descricaoEmDica = descricaoEmDicaPedida ?? emJanela;

  const option = useMemo<EChartsOption>(() => {
    const base = barrasHorizontais(ordenado, titulo, cor);
    return {
      ...base,
      // O cursor sinaliza que o gráfico é navegável
      series: [{ ...((base.series as unknown[])[0] as object), cursor: 'pointer' }],
    } as EChartsOption;
  }, [ordenado, titulo, cor]);

  const descricao = 'Barras: ocorrências no recorte carregado (n). Frequência não mede mérito. Use a tabela para ler nomes completos, exportar ou abrir uma entidade por teclado.'
    + (descricaoEmDica ? ' Clique em qualquer barra para abrir o dossiê da entidade no Motor de Busca.' : '');
  return <Grafico descricaoEmDica={descricaoEmDica} leitura={{ titulo, descricao, linhas: [...dados].map(([nome, valor]) => ({ nome, valor })), colunas: [{ chave: 'nome', rotulo: 'Nome completo' }, { chave: 'valor', rotulo: 'Ocorrências (n)' }], onAbrir: (l) => onSelecionar(String(l.nome)) }} option={option} altura={altura} larguraMinima={460} onReady={aoCriar} />;
}
