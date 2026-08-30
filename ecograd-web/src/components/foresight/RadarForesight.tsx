import { useMemo, useState } from 'react';
import { Radar as RadarIcon, RefreshCw } from 'lucide-react';
import { Aviso, Card, Expander, Progresso, Tabela } from '@/components/ui/primitives';
import { CORES_QUADRANTE, Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { GridSearch } from './GridSearch';
import { prepararRadarForesight, segmentarPorKMeans, segmentarPorPercentil } from '@/lib/foresight-math';
import { useSnaWorker } from '@/hooks/useSnaWorker';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { baixarArquivo, paraCSV } from '@/lib/utils';
import type { ForesightRow, Quadrante, TipoForesight } from '@/types';

const TIPOS: TipoForesight[] = ['Palavra-chave', 'Macrotema', 'Artefatos (Ontologia IA)'];
const QUADRANTES: Quadrante[] = ['↗️ Tendência', '↖️ Sinal Fraco', '↘️ Mainstream', '↙️ Base/Declínio'];

/**
 * Radar de Prospecção (Foresight Acadêmico).
 * Eixo X = Momentum Temporal; Eixo Y = Novidade Estrutural (Betweenness × IDF).
 * Transcrição de pages/1_Avançado.py:935-1160.
 */
export function RadarForesight() {
  const docs = useEcoGradStore((s) => s.docs);
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const tipo = useEcoGradStore((s) => s.tipoForesight);
  const setTipo = useEcoGradStore((s) => s.setTipoForesight);
  const janelaRecente = useEcoGradStore((s) => s.janelaRecente);
  const setJanelaRecente = useEcoGradStore((s) => s.setJanelaRecente);
  const metodoCorte = useEcoGradStore((s) => s.metodoCorte);
  const setMetodoCorte = useEcoGradStore((s) => s.setMetodoCorte);
  const percentilCorte = useEcoGradStore((s) => s.percentilCorte);
  const setPercentilCorte = useEcoGradStore((s) => s.setPercentilCorte);
  const bootstrap = useEcoGradStore((s) => s.bootstrap);
  const setBootstrap = useEcoGradStore((s) => s.setBootstrap);

  const { calcularBootstrap } = useSnaWorker();
  const [rodandoBootstrap, setRodandoBootstrap] = useState(false);
  const progressoSNA = useEcoGradStore((s) => s.progressoSNA);
  const textoProgressoSNA = useEcoGradStore((s) => s.textoProgressoSNA);

  const base = useMemo(
    () => prepararRadarForesight(docs, snaGlobal ?? {}, janelaRecente, tipo, bootstrap),
    [docs, snaGlobal, janelaRecente, tipo, bootstrap],
  );

  const segmentado = useMemo(() => {
    if (base.length === 0) return { linhas: [] as ForesightRow[], xMid: 0, yMid: 0 };
    return metodoCorte === 'Percentil fixo'
      ? segmentarPorPercentil(base, percentilCorte)
      : segmentarPorKMeans(base);
  }, [base, metodoCorte, percentilCorte]);

  const executarBootstrap = async () => {
    setRodandoBootstrap(true);
    try {
      setBootstrap(await calcularBootstrap(docs, tipo, 100, 0.85));
    } finally {
      setRodandoBootstrap(false);
    }
  };

  const porQuadrante = useMemo(() => {
    const mapa = new Map<Quadrante, ForesightRow[]>();
    for (const q of QUADRANTES) mapa.set(q, []);
    for (const l of segmentado.linhas) {
      if (l.Quadrante) mapa.get(l.Quadrante)!.push(l);
    }
    return mapa;
  }, [segmentado]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <RadarIcon size={22} /> Radar de Prospecção (Foresight Acadêmico)
        </h1>
        <p className="text-sm text-slate-400">
          Cruza <strong>Momentum Temporal</strong> (burst normalizado por taxa relativa) com{' '}
          <strong>Novidade Estrutural</strong> (Betweenness × IDF).
        </p>
      </header>

      <Expander titulo="📖 Como interpretar o Radar de Foresight (Modelo de Sinais Fracos)?">
        <ul className="space-y-2 text-sm text-slate-300">
          <li>
            <strong style={{ color: CORES_QUADRANTE['↗️ Tendência'] }}>↗️ Tendências</strong> — alto
            momentum e alta novidade: bursts já validados pela rede, o &quot;fogo&quot; do momento.
          </li>
          <li>
            <strong style={{ color: CORES_QUADRANTE['↖️ Sinal Fraco'] }}>↖️ Sinais Fracos</strong> —
            baixo momentum, alta novidade: pivôs raros que conectam áreas distantes. É aqui que a
            prospecção ganha valor.
          </li>
          <li>
            <strong style={{ color: CORES_QUADRANTE['↘️ Mainstream'] }}>↘️ Mainstream</strong> — alto
            momentum, baixa novidade: temas consolidados em expansão de volume.
          </li>
          <li>
            <strong style={{ color: CORES_QUADRANTE['↙️ Base/Declínio'] }}>↙️ Base/Declínio</strong> —
            baixo em ambos: vocabulário estrutural ou em desuso.
          </li>
        </ul>
      </Expander>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold">⚙️ Configurações de Segmentação do Radar</h3>

        <div className="grid gap-4 lg:grid-cols-3">
          <GrupoOpcoes rotulo="Dimensão de análise" opcoes={TIPOS} valor={tipo} onChange={setTipo} />

          <GrupoOpcoes
            rotulo="Método de corte"
            opcoes={['Percentil fixo', 'K-Means adaptativo (4 clusters)'] as const}
            valor={metodoCorte}
            onChange={setMetodoCorte}
          />

          <label className="flex flex-col gap-1.5 text-xs uppercase tracking-wide text-slate-400">
            Janela recente (anos)
            <input
              type="range"
              min={1}
              max={8}
              value={janelaRecente}
              onChange={(e) => setJanelaRecente(Number(e.target.value))}
              className="accent-eco-accent"
            />
            <span className="text-sm normal-case text-eco-accent">{janelaRecente} anos</span>
          </label>
        </div>

        {metodoCorte === 'Percentil fixo' ? (
          <label className="flex flex-col gap-1.5 text-xs uppercase tracking-wide text-slate-400">
            Percentil de corte (quanto maior, mais rigoroso)
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.05}
              value={percentilCorte}
              onChange={(e) => setPercentilCorte(Number(e.target.value))}
              className="accent-eco-accent"
            />
            <span className="text-sm normal-case text-eco-accent">
              {Math.round(percentilCorte * 100)}º percentil
            </span>
          </label>
        ) : (
          <p className="text-xs text-slate-500">
            ℹ️ O K-Means encontra automaticamente 4 clusters no espaço (Momentum × Novidade). As
            fronteiras entre quadrantes são definidas pelos centroides, não por cortes fixos.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-eco-border pt-3">
          <button
            type="button"
            className="btn"
            onClick={executarBootstrap}
            disabled={rodandoBootstrap || docs.length === 0}
          >
            <RefreshCw size={14} className={rodandoBootstrap ? 'animate-spin' : ''} />
            {bootstrap ? 'Recalcular Bootstrap' : 'Ativar Bootstrap (100 reamostragens)'}
          </button>
          <p className="text-xs text-slate-500">
            {bootstrap
              ? `Betweenness robusto ativo para ${Object.keys(bootstrap).length} termos (mediana de 100 reamostragens).`
              : 'Sem bootstrap, a novidade usa o betweenness pontual do grafo global.'}
          </p>
        </div>

        {rodandoBootstrap && <Progresso valor={progressoSNA} texto={textoProgressoSNA} />}
      </Card>

      {segmentado.linhas.length === 0 ? (
        <Aviso tipo="aviso">
          Não há dados recentes ou de rede suficientes para plotar o Radar de Prospecção
          {tipo === 'Artefatos (Ontologia IA)'
            ? ' — processe a Ontologia IA na aba Memética primeiro.'
            : '.'}
        </Aviso>
      ) : (
        <>
          <Card>
            <Grafico
              altura={620}
              option={{
                tooltip: {
                  trigger: 'item',
                  formatter: (p: unknown) => {
                    const dado = (p as { data: { termo: ForesightRow } }).data.termo;
                    return [
                      `<strong>${dado.Termo}</strong>`,
                      `Momentum: ${dado['Momentum (Burst)']}`,
                      `Novidade: ${dado['Novidade (Estrutural * IDF)']}`,
                      `Total: ${dado.Total} · Recentes: ${dado['Aparições Recentes']}`,
                      `Tração: ${dado['Tração (%)']}%`,
                      dado['Bet. Robusto?'] ? `Bet. IQR: ${dado['Bet. IQR']}` : 'Betweenness pontual',
                    ].join('<br/>');
                  },
                },
                legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
                grid: { left: 8, right: 24, top: 40, bottom: 56, containLabel: true },
                xAxis: {
                  type: 'value',
                  name: 'Momentum Temporal (Tração Ponderada pelo Volume)',
                  nameLocation: 'middle',
                  nameGap: 30,
                  nameTextStyle: { color: TEMA_GRAFICO.texto },
                  splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
                  axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                },
                yAxis: {
                  type: 'value',
                  name: 'Novidade Sistêmica (Betweenness × IDF)',
                  nameLocation: 'middle',
                  nameGap: 48,
                  nameTextStyle: { color: TEMA_GRAFICO.texto },
                  splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
                  axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                },
                series: QUADRANTES.map((q, i) => ({
                  name: q,
                  type: 'scatter' as const,
                  data: (porQuadrante.get(q) ?? []).map((l) => ({
                    value: [l['Momentum (Burst)'], l['Novidade (Estrutural * IDF)']],
                    termo: l,
                  })),
                  symbolSize: (valor: unknown, params: unknown) => {
                    const t = (params as { data: { termo: ForesightRow } }).data.termo;
                    void valor;
                    return Math.min(34, 8 + Math.sqrt(t.Total) * 3);
                  },
                  itemStyle: { color: CORES_QUADRANTE[q], opacity: 0.78 },
                  // As linhas divisórias do quadrante entram só uma vez
                  markLine:
                    i === 0
                      ? {
                          silent: true,
                          symbol: 'none',
                          lineStyle: { color: '#7F8C8D', type: 'dashed' as const, width: 1 },
                          data: [{ xAxis: segmentado.xMid }, { yAxis: segmentado.yMid }],
                        }
                      : undefined,
                })),
              }}
            />
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUADRANTES.map((q) => (
              <Card key={q} className="space-y-1">
                <p className="text-sm font-semibold" style={{ color: CORES_QUADRANTE[q] }}>
                  {q}
                </p>
                <p className="text-2xl font-bold tabular-nums">{porQuadrante.get(q)?.length ?? 0}</p>
                <p className="truncate text-xs text-slate-500">
                  {(porQuadrante.get(q) ?? [])
                    .slice()
                    .sort((a, b) => b['Novidade (Estrutural * IDF)'] - a['Novidade (Estrutural * IDF)'])
                    .slice(0, 3)
                    .map((l) => l.Termo)
                    .join(', ') || '—'}
                </p>
              </Card>
            ))}
          </div>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tabela do Radar ({segmentado.linhas.length} termos)</h3>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  baixarArquivo(
                    paraCSV(segmentado.linhas as unknown as Array<Record<string, unknown>>),
                    'radar_foresight.csv',
                  )
                }
              >
                📥 Exportar CSV
              </button>
            </div>
            <Tabela
              altura="max-h-[420px]"
              linhas={
                [...segmentado.linhas].sort(
                  (a, b) => b['Novidade (Estrutural * IDF)'] - a['Novidade (Estrutural * IDF)'],
                ) as unknown as Array<Record<string, unknown>>
              }
              colunas={[
                { chave: 'Termo', rotulo: 'Termo', className: 'max-w-xs truncate' },
                {
                  chave: 'Quadrante',
                  rotulo: 'Quadrante',
                  render: (l) => (
                    <span style={{ color: CORES_QUADRANTE[String(l.Quadrante)] }}>{String(l.Quadrante)}</span>
                  ),
                },
                { chave: 'Total', rotulo: 'Total' },
                { chave: 'Aparições Recentes', rotulo: 'Recentes' },
                { chave: 'Tração (%)', rotulo: 'Tração (%)' },
                { chave: 'Momentum (Burst)', rotulo: 'Momentum' },
                { chave: 'Novidade (Estrutural * IDF)', rotulo: 'Novidade' },
                {
                  chave: 'Bet. Robusto?',
                  rotulo: 'Bet. Robusto?',
                  render: (l) => (l['Bet. Robusto?'] ? '✅' : '—'),
                },
              ]}
            />
          </Card>

          <GridSearch />
        </>
      )}
    </div>
  );
}
