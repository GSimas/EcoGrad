import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, RefreshCw } from 'lucide-react';
import { Aviso, Card, Expander, Kpi, Progresso, Tabela } from '@/components/ui/primitives';
import { useSnaWorker } from '@/hooks/useSnaWorker';
import { baixarArquivo, formatarNumero, paraCSV } from '@/lib/utils';
import type { EcologiaMemetica } from '@/lib/memetic-network';
import type { FonteMemes } from '@/lib/memetics';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { GraphNode } from '@/types';

/** Leituras qualitativas dos indicadores, iguais às do app original. */
function statusGamma(v: number) {
  if (v >= 2 && v <= 3) return { texto: '🟢 Saudável', cor: 'text-emerald-400' };
  if (v < 2) return { texto: '🔴 Monopolizada', cor: 'text-red-400' };
  return { texto: '🟡 Fragmentada', cor: 'text-yellow-400' };
}
function statusSpearman(v: number) {
  if (v > 0.95) return { texto: '🔴 Hierarquia Rígida', cor: 'text-red-400' };
  if (v < 0.85) return { texto: '🟢 Inovação (Brokers)', cor: 'text-emerald-400' };
  return { texto: '🟡 Equilíbrio', cor: 'text-yellow-400' };
}
function statusAssortatividade(v: number) {
  if (v > 0.1) return { texto: '🟡 Endogâmica', cor: 'text-yellow-400' };
  if (v < -0.1) return { texto: '🟢 Expansiva', cor: 'text-emerald-400' };
  return { texto: '⚪ Neutra', cor: 'text-slate-400' };
}
function statusRichClub(v: number) {
  if (v > 0.3) return { texto: '🟢 Elite Coesa', cor: 'text-emerald-400' };
  if (v < 0.1) return { texto: '🔴 Hubs Isolados', cor: 'text-red-400' };
  return { texto: '🟡 Moderada', cor: 'text-yellow-400' };
}

/**
 * Ecologia Memética (SNA) — rede de coocorrência entre memes.
 * Transcrição do bloco de `pages/1_Avançado.py:1485-1565`: métricas de redes
 * complexas, ecologia profunda, grafo interativo e tabela de centralidade.
 */
export function EcologiaSNA({ fonte }: { fonte: FonteMemes }) {
  const docs = useEcoGradStore((s) => s.docs);
  const progresso = useEcoGradStore((s) => s.progressoSNA);
  const textoProgresso = useEcoGradStore((s) => s.textoProgressoSNA);
  const { calcularEcologiaMemes } = useSnaWorker();

  const [minCoocorrencia, setMinCoocorrencia] = useState(3);
  const [dados, setDados] = useState<EcologiaMemetica | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(900);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Trocar a fonte invalida o resultado: são redes diferentes
  useEffect(() => setDados(null), [fonte]);

  const calcular = useCallback(async () => {
    setCalculando(true);
    setErro(null);
    try {
      const r = await calcularEcologiaMemes(docs, minCoocorrencia, fonte);
      if (r && r.centralidade.length > 0) setDados(r);
      else {
        setDados(null);
        setErro('Não há conexões suficientes neste conjunto de dados.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCalculando(false);
    }
  }, [calcularEcologiaMemes, docs, minCoocorrencia, fonte]);

  const dadosGrafo = useMemo(
    () =>
      dados
        ? { nodes: dados.nodes.map((n) => ({ ...n })), links: dados.links.map((l) => ({ ...l })) }
        : { nodes: [], links: [] },
    [dados],
  );

  const linhasTabela = useMemo(
    () =>
      (dados?.centralidade ?? []).slice(0, 500).map((l) => ({
        Termo: l.Termo,
        'Grau Absoluto': l['Grau Absoluto'],
        'Grau (Degree)': l['Grau (Degree)'].toFixed(4),
        Betweenness: l.Betweenness.toFixed(4),
        Closeness: l.Closeness.toFixed(4),
        'Documentos Associados': l['Documentos Associados'],
      })),
    [dados],
  );

  const ehIA = fonte === 'Artefatos Extraídos';

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Network size={18} />
          {ehIA ? 'Ecologia dos Artefatos Ontológicos (SNA)' : 'Ecologia Memética Tradicional (SNA)'}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {ehIA
            ? 'Conexões e maturidade da rede formada exclusivamente pelos artefatos extraídos pela IA.'
            : 'Conexões e maturidade da rede formada pelas palavras-chave e pelos termos isolados dos títulos.'}
        </p>
      </div>

      <Card className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            Filtro de coocorrência mínima (remove ruído visual)
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={minCoocorrencia}
            onChange={(e) => setMinCoocorrencia(Number(e.target.value))}
            className="w-full accent-eco-accent"
          />
          <span className="text-sm text-eco-accent">
            {minCoocorrencia} {minCoocorrencia === 1 ? 'coocorrência' : 'coocorrências'}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void calcular()}
            disabled={calculando || docs.length === 0}
          >
            <RefreshCw size={14} className={calculando ? 'animate-spin' : ''} />
            {dados ? 'Recalcular rede' : 'Construir rede memética'}
          </button>
          <p className="text-xs text-slate-500">
            A rede de coocorrência é densa e roda em um Web Worker — a interface continua
            responsiva durante o cálculo.
          </p>
        </div>

        {calculando && <Progresso valor={progresso} texto={textoProgresso} />}
        {erro && <Aviso tipo="aviso">{erro}</Aviso>}
      </Card>

      {dados && (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">🧬 Métricas de Redes Complexas</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi rotulo="Densidade da Rede" valor={dados.metricas.densidade.toFixed(5)} />
              <Kpi rotulo="Eficiência Global" valor={dados.metricas.eficiencia.toFixed(4)} />
              <Kpi rotulo="Entropia (H)" valor={`${dados.metricas.entropia.toFixed(2)} bits`} />
              <Kpi rotulo="Clustering Médio" valor={dados.metricas.clustering.toFixed(4)} />
            </div>

            <Expander titulo="📊 Estatísticas de Conectividade e Influência (médias)">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-200">Conectividade (links por nó)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Kpi rotulo="Média de Links" valor={dados.metricas.links_mean.toFixed(2)} />
                    <Kpi rotulo="Desvio Padrão" valor={dados.metricas.links_std.toFixed(2)} />
                    <Kpi rotulo="Mínimo" valor={dados.metricas.links_min} />
                    <Kpi rotulo="Máximo" valor={dados.metricas.links_max} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-200">Influência estrutural</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Kpi rotulo="PageRank Médio" valor={dados.metricas.pr_avg.toFixed(6)} />
                    <Kpi rotulo="Eigenvector Médio" valor={dados.metricas.ev_avg.toFixed(6)} />
                    <Kpi rotulo="Restrição (Burt)" valor={dados.metricas.constraint_avg.toFixed(4)} />
                    <Kpi rotulo="Redundância" valor={dados.metricas.redundancia.toFixed(4)} />
                  </div>
                </div>
              </div>
            </Expander>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">
              🧬 Métricas de Ecologia Profunda (SNA Avançado)
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                rotulo="Lei de Potência (γ)"
                valor={dados.maturidade.gamma.toFixed(2)}
                detalhe={statusGamma(dados.maturidade.gamma).texto}
              />
              <Kpi
                rotulo="Correlação de Spearman (ρ)"
                valor={dados.maturidade.spearman.toFixed(2)}
                detalhe={statusSpearman(dados.maturidade.spearman).texto}
              />
              <Kpi
                rotulo="Assortatividade (r)"
                valor={dados.maturidade.assortatividade.toFixed(2)}
                detalhe={statusAssortatividade(dados.maturidade.assortatividade).texto}
              />
              <Kpi
                rotulo="Coeficiente Rich-Club (Φ)"
                valor={`${(dados.maturidade.rich_club * 100).toFixed(2)}%`}
                detalhe={statusRichClub(dados.maturidade.rich_club).texto}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">🌌 Grafo Interativo</h3>
            <p className="text-xs text-slate-500">
              {formatarNumero(dados.nodes.length)} de {formatarNumero(dados.totalNos)} memes e{' '}
              {formatarNumero(dados.links.length)} conexões em exibição. As métricas acima usam a
              rede completa; o recorte visual aplica o filtro de coocorrência e mantém os memes de
              maior grau.
            </p>
            <div
              ref={containerRef}
              className="overflow-hidden rounded-xl border border-eco-border bg-black/30"
            >
              {dados.nodes.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-500">
                  Nenhuma conexão sobrevive ao filtro de {minCoocorrencia} coocorrências. Reduza o
                  filtro.
                </p>
              ) : (
                <ForceGraph2D
                  graphData={dadosGrafo}
                  width={largura}
                  height={620}
                  backgroundColor="rgba(0,0,0,0)"
                  nodeRelSize={4}
                  nodeVal={(n) => Math.max(1, (n as GraphNode).size / 8)}
                  nodeColor={(n) => (n as GraphNode).color}
                  nodeLabel={(n) => (n as GraphNode).title}
                  linkColor={() => 'rgba(127,140,141,0.22)'}
                  linkWidth={(l) => (l as { width?: number }).width ?? 1}
                  cooldownTicks={140}
                  d3VelocityDecay={0.4}
                  nodeCanvasObjectMode={() => 'after'}
                  nodeCanvasObject={(no, ctx, escala) => {
                    if (escala < 1.6) return;
                    const n = no as GraphNode & { x?: number; y?: number };
                    ctx.font = `${11 / escala}px Inter, sans-serif`;
                    ctx.fillStyle = '#E2E8F0';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(n.label, n.x ?? 0, (n.y ?? 0) + n.size / 10 + 2);
                  }}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  📊 Tabela de Centralidade Global
                </h3>
                <p className="text-xs text-slate-500">
                  Poder de influência e intermediação de cada termo no ecossistema completo
                  {dados.centralidade.length > 500 && ' (500 primeiros por grau)'}.
                </p>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  baixarArquivo(
                    paraCSV(dados.centralidade as unknown as Array<Record<string, unknown>>),
                    'centralidade_memetica.csv',
                  )
                }
              >
                📥 Exportar CSV
              </button>
            </div>
            <Tabela
              altura="max-h-[420px]"
              linhas={linhasTabela}
              colunas={[
                { chave: 'Termo', rotulo: dados.rotuloTermo, className: 'max-w-xs truncate' },
                { chave: 'Grau Absoluto', rotulo: 'Grau Absoluto' },
                { chave: 'Grau (Degree)', rotulo: 'Grau (Degree)' },
                { chave: 'Betweenness', rotulo: 'Betweenness' },
                { chave: 'Closeness', rotulo: 'Closeness' },
                {
                  chave: 'Documentos Associados',
                  rotulo: 'Documentos Associados',
                  className: 'max-w-md truncate',
                },
              ]}
            />
          </div>
        </>
      )}
    </section>
  );
}
