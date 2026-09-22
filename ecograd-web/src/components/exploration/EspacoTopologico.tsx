import { useMemo } from 'react';
import { Box } from 'lucide-react';
import { Aviso, Card, Expander } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { useSessionField } from '@/hooks/useSessionField';
import { formatarNumero } from '@/lib/utils';
import {
  agruparPorComunidade,
  ARESTAS_CUBO,
  CAMERA_PADRAO,
  DIMENSOES_3D,
  ESCALAS_3D,
  LIMITE_PONTOS_3D,
  pontosTopologicos,
  projetarEspaco,
  type Camera3D,
  type Dimensao3D,
  type Escala3D,
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

/**
 * Espaço Topológico 3D — Grau × Betweenness × Closeness.
 * Transcrição de `plotar_grafico_3d_sna` (backend.py:1498). A projeção é feita
 * em `lib/espaco-topologico`; aqui ficam só os controles e o desenho.
 */
export function EspacoTopologico() {
  const sna = useEcoGradStore((s) => s.snaGlobal);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const [dimensao, setDimensao] = useSessionField<Dimensao3D>('grafico.espaco3d.dimensao', 'Palavra-chave');
  const [camera, setCamera] = useSessionField<Camera3D>('rede.espaco3d.camera', CAMERA_PADRAO);
  const [escala, setEscala] = useSessionField<Escala3D>('grafico.espaco3d.escala', 'Logarítmica');

  const { pontos, total } = useMemo(() => pontosTopologicos(sna, dimensao, LIMITE_PONTOS_3D), [sna, dimensao]);
  const { projetados, cubo } = useMemo(() => projetarEspaco(pontos, camera, escala), [pontos, camera, escala]);
  const grupos = useMemo(() => agruparPorComunidade(projetados), [projetados]);

  const contexto = {
    dimensao,
    camera,
    escalaDosEixos: escala,
    pontosExibidos: projetados.length,
    pontosNaDimensao: total,
    limiteVisual: LIMITE_PONTOS_3D,
    eixos: 'X: grau absoluto; Y: betweenness; Z: closeness — cada eixo normalizado em 0–1 dentro dos pontos exibidos',
    limiteInterpretacao: 'A escala muda apenas a posição no desenho; os valores das métricas não são transformados.',
  };

  const option = useMemo<EChartsOption>(() => {
    const paleta = TEMA_GRAFICO.paleta;
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const dado = (p as { data?: { ponto?: { Item: string; Grau: number; Betweenness: number; Closeness: number; Comunidade: string } } }).data?.ponto;
          if (!dado) return '';
          return [
            dado.Item,
            `Grau: ${formatarNumero(dado.Grau)}`,
            `Betweenness: ${dado.Betweenness.toFixed(6)}`,
            `Closeness: ${dado.Closeness.toFixed(6)}`,
            `Comunidade: ${dado.Comunidade}`,
          ].join('\n');
        },
      },
      legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
      grid: { left: 8, right: 8, top: 16, bottom: 64 },
      // Eixos escondidos de propósito: as coordenadas da tela são a projeção, e
      // um número nelas não corresponde a nenhuma das três métricas.
      xAxis: { type: 'value', min: -1, max: 1, show: false },
      yAxis: { type: 'value', min: -1, max: 1, show: false },
      series: [
        // Arestas do cubo, para ancorar a leitura do volume.
        ...(cubo.length === 8
          ? ARESTAS_CUBO.map(([a, b]) => ({
              type: 'line' as const,
              silent: true,
              symbol: 'none' as const,
              tooltip: { show: false },
              data: [cubo[a], cubo[b]],
              lineStyle: { color: TEMA_GRAFICO.grade, width: 1, opacity: 0.85 },
              z: 1,
            }))
          : []),
        ...grupos.map((grupo, i) => ({
          name: grupo.nome,
          type: 'scatter' as const,
          z: 2,
          data: grupo.pontos.map((p) => ({ value: [p.x, p.y], ponto: p.ponto, profundidade: p.profundidade })),
          symbolSize: (_v: unknown, params: unknown) => {
            const d = (params as { data: { ponto: { Grau: number }; profundidade: number } }).data;
            // Grau dá o tamanho; a profundidade só o modula, para o que está à
            // frente parecer mais perto sem inventar perspectiva.
            return (4 + Math.sqrt(Math.max(d.ponto.Grau, 1)) * 1.6) * (0.7 + d.profundidade * 0.5);
          },
          itemStyle: {
            color: grupo.nome === 'Demais comunidades' ? '#64748B' : paleta[i % paleta.length],
            opacity: 0.75,
            borderWidth: 0,
          },
          cursor: 'pointer' as const,
        })),
      ],
    };
  }, [grupos, cubo]);

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
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Box size={18} aria-hidden /> Espaço Topológico 3D</h2>
        <p className="mt-1 text-sm text-slate-400">
          Distribui os nós da dimensão escolhida em Grau × Betweenness × Closeness, os três eixos do grafo global.
        </p>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <GrupoOpcoes rotulo="Dimensão no espaço" opcoes={DIMENSOES_3D} valor={dimensao} onChange={setDimensao} />
          <GrupoOpcoes rotulo="Escala dos eixos" opcoes={ESCALAS_3D} valor={escala} onChange={setEscala} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-slate-300">
            Giro horizontal (azimute)
            <input type="range" min={0} max={360} step={1} value={camera.azimute}
              aria-valuetext={`${camera.azimute} graus`}
              onChange={(e) => setCamera({ ...camera, azimute: Number(e.target.value) })}
              className="w-full accent-eco-accent" />
            <span className="text-xs text-eco-accent">{camera.azimute}°</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-300">
            Inclinação (elevação)
            <input type="range" min={-80} max={80} step={1} value={camera.elevacao}
              aria-valuetext={`${camera.elevacao} graus`}
              onChange={(e) => setCamera({ ...camera, elevacao: Number(e.target.value) })}
              className="w-full accent-eco-accent" />
            <span className="text-xs text-eco-accent">{camera.elevacao}°</span>
          </label>
        </div>
        <button type="button" className="btn" onClick={() => setCamera(CAMERA_PADRAO)}>Restaurar o ângulo inicial</button>
        <p className="text-sm text-slate-300" role="status">
          {total === 0
            ? `Nenhum nó do tipo ${dimensao} no grafo global desta seleção.`
            : `${formatarNumero(projetados.length)} de ${formatarNumero(total)} nós em exibição${total > LIMITE_PONTOS_3D ? `, os de maior grau — o modelo original também corta em ${formatarNumero(LIMITE_PONTOS_3D)}` : ''}.`}
        </p>
      </Card>

      <Expander titulo="Como ler o espaço e o que ele não diz">
        <div className="space-y-3 text-sm text-slate-300">
          <p>Cada eixo é normalizado entre o menor e o maior valor <strong>dos pontos exibidos</strong>, para que as três métricas — que vivem em escalas muito diferentes — caibam no mesmo cubo. Por isso a posição é comparativa dentro do desenho, não um valor absoluto: os números exatos estão no passar do mouse e na vista em tabela.</p>
          <p><strong>Escala dos eixos</strong>: as três métricas têm cauda longa — a maioria dos termos aparece uma vez só, e alguns poucos dominam. Em escala linear, que é a do modelo original, essa maioria empilha num canto do cubo. A logarítmica, aplicada como log(1 + valor), espalha a massa sem alterar nenhum valor nem a ordem entre os nós: muda só a posição no desenho. Os números no tooltip e na tabela são sempre os originais.</p>
          <p>O tamanho do ponto segue o grau; a profundidade só o modula um pouco, para dar sensação de volume. A cor é a comunidade detectada pelo Louvain no grafo global — as maiores aparecem nomeadas e o restante fica agrupado, porque uma legenda com centenas de comunidades não ajuda a ler nada.</p>
          <p>Betweenness é aproximado por amostragem de pivôs em redes grandes, e closeness também. Posição alta em qualquer eixo descreve conectividade na rede desta seleção — não mede qualidade, impacto ou mérito.</p>
          <p>A órbita é controlada pelos dois deslizadores. É uma projeção calculada aqui dentro, o que mantém o gráfico com vista em tabela, download de imagem, tema claro e escuro e respeito a “reduzir movimento”.</p>
        </div>
      </Expander>

      {projetados.length === 0 ? (
        <Aviso>Não há nós desta dimensão no grafo global. Escolha outra dimensão ou amplie as coleções carregadas.</Aviso>
      ) : (
        <Card>
          <Grafico
            altura={640}
            leitura={{
              titulo: `Espaço topológico — ${dimensao}`,
              descricao: `Projeção do cubo Grau × Betweenness × Closeness, em escala ${escala.toLowerCase()}. Cada eixo é normalizado em 0–1 entre os pontos exibidos; as coordenadas do desenho são da projeção, não das métricas. Tamanho segue o grau, cor segue a comunidade. A tabela traz os valores originais de cada nó e permite abri-lo por teclado.`,
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
            onEvents={{ click: (p) => { const d = (p as { data?: { ponto?: { Item: string } } }).data?.ponto; if (d) navegarPara(TIPO_BUSCA[dimensao], d.Item); } }}
            option={option}
          />
        </Card>
      )}
    </section>
  );
}
