import { useMemo } from 'react';
import { Box } from 'lucide-react';
import { Aviso, Card, Expander } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { useSessionField } from '@/hooks/useSessionField';
import { useAparencia } from '@/services/aparencia';
import { formatarNumero } from '@/lib/utils';
import {
  agruparPorComunidade,
  DIMENSOES_3D,
  ESCALAS_3D,
  LIMITE_PONTOS_3D,
  pontosTopologicos,
  posicaoNoEixo,
  type Dimensao3D,
  type Escala3D,
  type PontoTopologico,
} from '@/lib/espaco-topologico';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { EChartsOption } from 'echarts';
import type { TipoBusca } from '@/types';

/** A dimensão do espaço vira a categoria correspondente do Motor de Busca. */
const TIPO_BUSCA: Record<Dimensao3D, TipoBusca> = {
  Documento: 'Documento',
  Autor: 'Autor',
  Orientador: 'Orientador',
  'Palavra-chave': 'Palavra-chave',
  Macrotema: 'Macrotema',
};

/** Os três eixos, na ordem X, Y, Z. */
const EIXOS = [
  { chave: 'Grau', rotulo: 'Grau', unidade: 'conexões' },
  { chave: 'Betweenness', rotulo: 'Betweenness', unidade: 'índice' },
  { chave: 'Closeness', rotulo: 'Closeness', unidade: 'índice' },
] as const;

/**
 * Espaço Topológico 3D — Grau × Betweenness × Closeness.
 * Transcrição de `plotar_grafico_3d_sna` (backend.py:1498), que usava o
 * `scatter_3d` do Plotly.
 *
 * O desenho é WebGL de verdade, pelo `echarts-gl`: arrastar gira, a roda
 * aproxima, e o botão direito desloca — sem controle nenhum na tela para isso,
 * como em qualquer visualizador tridimensional. O preço é que a tela é uma
 * superfície própria e o download de imagem não a alcança; a vista em tabela
 * continua entregando todos os valores.
 *
 * Os eixos mostram os valores originais das métricas. A escala logarítmica
 * transforma a posição, não o dado: o nome do eixo diz quando isso acontece, e
 * o passar do mouse e a tabela sempre trazem o número como ele é.
 */
export function EspacoTopologico() {
  const sna = useEcoGradStore((s) => s.snaGlobal);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const { claro, reduzir } = useAparencia();
  const [dimensao, setDimensao] = useSessionField<Dimensao3D>('grafico.espaco3d.dimensao', 'Palavra-chave');
  const [escala, setEscala] = useSessionField<Escala3D>('grafico.espaco3d.escala', 'Logarítmica');

  const { pontos, total } = useMemo(() => pontosTopologicos(sna, dimensao, LIMITE_PONTOS_3D), [sna, dimensao]);
  const grupos = useMemo(() => agruparPorComunidade(pontos), [pontos]);

  const ehLog = escala === 'Logarítmica';
  const posicao = (v: number) => posicaoNoEixo(v, escala);
  const nomeDoEixo = (i: number) =>
    ehLog ? `log(1 + ${EIXOS[i].rotulo})` : `${EIXOS[i].rotulo} (${EIXOS[i].unidade})`;

  const contexto = {
    dimensao,
    escalaDosEixos: escala,
    pontosExibidos: pontos.length,
    pontosNaDimensao: total,
    limiteVisual: LIMITE_PONTOS_3D,
    eixos: 'X: grau absoluto; Y: betweenness; Z: closeness',
    limiteInterpretacao: 'A escala muda apenas a posição no desenho; os valores das métricas não são transformados.',
  };

  const option = useMemo<EChartsOption>(() => {
    const paleta = TEMA_GRAFICO.paleta;
    const corDoEixo = claro ? '#64748B' : '#475569';
    const corDoTexto = claro ? '#334155' : '#CBD5E1';
    const eixo = (i: number) => ({
      type: 'value' as const,
      name: nomeDoEixo(i),
      nameTextStyle: { color: corDoTexto },
      axisLine: { lineStyle: { color: corDoEixo } },
      axisLabel: { color: corDoTexto, fontSize: 10 },
      splitLine: { lineStyle: { color: claro ? '#CBD5E1' : '#1E293B' } },
      axisPointer: { show: false },
    });
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const d = (p as { data?: { ponto?: PontoTopologico } }).data?.ponto;
          if (!d) return '';
          return [
            d.Item,
            `Grau: ${formatarNumero(d.Grau)} conexões`,
            `Betweenness: ${d.Betweenness.toFixed(6)}`,
            `Closeness: ${d.Closeness.toFixed(6)}`,
            `Comunidade: ${d.Comunidade}`,
          ].join('\n');
        },
      },
      legend: { bottom: 0, textStyle: { color: corDoTexto } },
      xAxis3D: eixo(0),
      yAxis3D: eixo(1),
      zAxis3D: eixo(2),
      grid3D: {
        boxWidth: 100,
        boxDepth: 100,
        boxHeight: 90,
        top: -20,
        axisLine: { lineStyle: { color: corDoEixo } },
        axisPointer: { lineStyle: { color: corDoTexto } },
        splitLine: { lineStyle: { color: claro ? '#E2E8F0' : '#1E293B' } },
        // O `echarts-gl` pinta o fundo da cena, e não herda o `backgroundColor`
        // transparente do gráfico: sem uma cor aqui, o cubo sai sobre preto
        // dentro de um cartão branco no tema claro. É a cor do cartão que ele
        // ocupa, para a tela do WebGL desaparecer na página.
        environment: claro ? '#FFFFFF' : '#0E1117',
        // É daqui que sai o movimento pelo mouse: arrastar gira, a roda
        // aproxima, o botão direito desloca. `autoRotate` fica desligado —
        // um cubo girando sozinho é exatamente o que "reduzir movimento" pede
        // para não existir, e atrapalha mirar um ponto.
        viewControl: {
          projection: 'perspective',
          autoRotate: false,
          rotateSensitivity: 1.4,
          zoomSensitivity: 1.2,
          panSensitivity: 1,
          distance: 220,
          alpha: 22,
          beta: 35,
          animation: !reduzir,
        },
      },
      series: grupos.map((grupo, i) => ({
        name: grupo.nome,
        type: 'scatter3D' as const,
        symbolSize: 8,
        data: grupo.pontos.map((ponto) => ({
          value: [posicao(ponto.Grau), posicao(ponto.Betweenness), posicao(ponto.Closeness)],
          ponto,
          // O grau modula o tamanho sem deixar o ponto sumir nem virar bola.
          symbolSize: Math.min(26, 5 + Math.sqrt(Math.max(ponto.Grau, 1)) * 1.6),
        })),
        itemStyle: {
          color: grupo.nome === 'Demais comunidades' ? '#64748B' : paleta[i % paleta.length],
          opacity: 0.85,
        },
        emphasis: { itemStyle: { color: '#F39C12' }, label: { show: true, formatter: (p: unknown) => (p as { data: { ponto: PontoTopologico } }).data.ponto.Item, color: corDoTexto } },
      })),
    } as EChartsOption;
  }, [grupos, claro, reduzir, ehLog]);

  if (!sna) {
    return (
      <Card>
        <Aviso tipo="aviso">
          {statusSNA === 'calculando'
            ? 'O espaço topológico depende da rede global, que ainda está sendo calculada. Acompanhe o progresso no painel de atividades.'
            : 'O espaço topológico depende da rede global, que não está disponível nesta sessão.'}
        </Aviso>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><Box size={20} aria-hidden /> Espaço Topológico 3D</h2>
        <p className="mt-1 text-sm text-slate-400">
          Distribui os nós da dimensão escolhida em Grau × Betweenness × Closeness, os três eixos do grafo global.
        </p>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <GrupoOpcoes rotulo="Dimensão no espaço" opcoes={DIMENSOES_3D} valor={dimensao} onChange={setDimensao} />
          <GrupoOpcoes rotulo="Escala dos eixos" opcoes={ESCALAS_3D} valor={escala} onChange={setEscala} />
        </div>
        <p className="text-sm text-slate-300">
          <strong>Arraste para girar</strong>, use a roda do mouse para aproximar e o botão direito para deslocar.
          Passe o mouse sobre um ponto para ler os valores, e clique para abrir a entidade no Motor de Busca.
        </p>
        <p className="text-sm text-slate-300" role="status">
          {total === 0
            ? `Nenhum nó do tipo ${dimensao} no grafo global desta seleção.`
            : `${formatarNumero(pontos.length)} de ${formatarNumero(total)} nós em exibição${total > LIMITE_PONTOS_3D ? `, os de maior grau — o modelo original também corta em ${formatarNumero(LIMITE_PONTOS_3D)}` : ''}.`}
        </p>
      </Card>

      <Expander titulo="Como ler o espaço e o que ele não diz">
        <div className="space-y-3 text-sm text-slate-300">
          <p>Os eixos trazem os valores originais das três métricas do grafo global. <strong>Escala dos eixos</strong>: elas têm cauda longa — a maioria dos termos aparece uma vez só, e alguns poucos dominam. Em escala linear, que é a do modelo original, essa maioria empilha num canto. A logarítmica, aplicada como log(1 + valor), espalha a massa sem alterar nenhum valor nem a ordem entre os nós: muda só a posição, e o nome do eixo avisa quando está em uso. Os números no passar do mouse e na tabela são sempre os originais.</p>
          <p>O tamanho do ponto segue o grau. A cor é a comunidade detectada pelo Louvain no grafo global — as maiores aparecem nomeadas e o restante fica agrupado, porque uma legenda com centenas de comunidades não ajuda a ler nada.</p>
          <p>Betweenness é aproximado por amostragem de pivôs em redes grandes, e closeness também. Posição alta em qualquer eixo descreve conectividade na rede desta seleção — não mede qualidade, impacto ou mérito.</p>
          <p>O desenho é WebGL e não entra no download de imagem, que alcança só os gráficos comuns. Para levar os dados embora, use <strong>Ver dados em tabela</strong>: ela exporta em CSV e JSON, com todos os valores e o contexto da análise. A tabela também é o caminho pelo teclado, já que a órbita é um gesto de mouse.</p>
        </div>
      </Expander>

      {pontos.length === 0 ? (
        <Aviso>Não há nós desta dimensão no grafo global. Escolha outra dimensão ou amplie as coleções carregadas.</Aviso>
      ) : (
        <Card>
          <Grafico
            tridimensional
            altura={620}
            leitura={{
              titulo: `Espaço topológico — ${dimensao}`,
              descricao: `Nuvem tridimensional de Grau × Betweenness × Closeness, em escala ${escala.toLowerCase()}. Arraste para girar, use a roda para aproximar e o botão direito para deslocar. Tamanho segue o grau, cor segue a comunidade. A tabela traz os valores originais de cada nó e permite abri-lo por teclado.`,
              linhas: pontos as unknown as Array<Record<string, unknown>>,
              colunas: [
                { chave: 'Item', rotulo: 'Nome completo', className: 'max-w-md' },
                { chave: 'Grau', rotulo: 'Grau absoluto (conexões)' },
                { chave: 'Betweenness', rotulo: 'Betweenness (índice)' },
                { chave: 'Closeness', rotulo: 'Closeness (índice)' },
                { chave: 'Comunidade', rotulo: 'Comunidade (identificador)' },
              ],
              contexto,
              onAbrir: (l) => navegarPara(TIPO_BUSCA[dimensao], String(l.Item)),
            }}
            onEvents={{ click: (p) => { const d = (p as { data?: { ponto?: PontoTopologico } }).data?.ponto; if (d) navegarPara(TIPO_BUSCA[dimensao], d.Item); } }}
            option={option}
          />
        </Card>
      )}
    </section>
  );
}
