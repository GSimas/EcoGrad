import { useEffect, useMemo } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import { Aviso, Card, Kpi, Progresso } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { Destaques } from './Destaques';
import { FichaTecnica } from './FichaTecnica';
import { useDadosDerivados } from '@/hooks/useDadosDerivados';
import { useSnaWorker } from '@/hooks/useSnaWorker';
import { normalizarNivel } from '@/lib/entities';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { formatarDecimal } from '@/lib/utils';

/** Dashboard principal: KPIs, comparativo entre PPGs, ficha CAPES e destaques SNA. */
export function Dashboard() {
  const { docs, conjuntos, contagens, niveis, programas } = useDadosDerivados();
  const snaGlobal = useEcoGradStore((s) => s.snaGlobal);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const progressoSNA = useEcoGradStore((s) => s.progressoSNA);
  const textoProgressoSNA = useEcoGradStore((s) => s.textoProgressoSNA);
  const maturidade = useEcoGradStore((s) => s.maturidade);
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);

  const { calcularSna } = useSnaWorker();

  // A rede é calculada uma única vez por base carregada
  useEffect(() => {
    if (docs.length > 0 && statusSNA === 'ocioso') void calcularSna(docs);
  }, [docs, statusSNA, calcularSna]);

  const comparativo = useMemo(() => {
    if (programas.length <= 1) return [];
    const porPpg = new Map<string, typeof docs>();
    for (const d of docs) {
      const ppg = d.programa_origem || 'Desconhecido';
      const lista = porPpg.get(ppg);
      if (lista) (lista as (typeof docs)[number][]).push(d);
      else porPpg.set(ppg, [d]);
    }
    return [...porPpg.entries()].map(([ppg, lista]) => ({
      PPG: ppg,
      Documentos: lista.length,
      Teses: lista.filter((d) => normalizarNivel(d.nivel_academico) === 'Teses').length,
      Dissertações: lista.filter((d) => normalizarNivel(d.nivel_academico) === 'Dissertações').length,
      Autores: new Set(lista.flatMap((d) => d.autores)).size,
      Orientadores: new Set(lista.map((d) => d.orientador).filter(Boolean)).size,
      Coorientadores: new Set(lista.flatMap((d) => d.co_orientadores)).size,
      Conceitos: new Set(lista.flatMap((d) => d.palavras_chave)).size,
    }));
  }, [docs, programas]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">🌌 Ecologia do Conhecimento</h1>
        <p className="text-sm text-slate-400">Base: {rotulo}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi rotulo="📄 Documentos Totais" valor={docs.length} />
        <Kpi rotulo="🎓 Teses (Doutorado)" valor={niveis.teses} />
        <Kpi rotulo="📜 Dissertações" valor={niveis.dissertacoes} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="✍️ Autores Únicos" valor={conjuntos.autores.size} />
        <Kpi rotulo="🏫 Orientadores" valor={conjuntos.orientadores.size} />
        <Kpi rotulo="🤝 Co-orientadores" valor={conjuntos.coorientadores.size} />
        <Kpi rotulo="💡 Conceitos (Keywords)" valor={conjuntos.keywords.size} />
      </div>

      {comparativo.length > 1 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 size={18} /> Comparativo entre PPGs
          </h3>
          <Card>
            <Grafico
              altura={420}
              option={{
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
                grid: { left: 8, right: 8, top: 24, bottom: 60, containLabel: true },
                xAxis: {
                  type: 'category',
                  data: comparativo.map((c) => c.PPG),
                  axisLabel: { show: false },
                  axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                },
                yAxis: {
                  type: 'value',
                  splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
                  axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                },
                series: (
                  ['Documentos', 'Teses', 'Dissertações', 'Autores', 'Orientadores', 'Coorientadores', 'Conceitos'] as const
                ).map((chave) => ({
                  name: chave,
                  type: 'bar',
                  data: comparativo.map((c) => c[chave]),
                  itemStyle: { borderRadius: [3, 3, 0, 0] },
                })),
              }}
            />
          </Card>
        </section>
      )}

      <FichaTecnica docs={docs} programas={programas} />

      {statusSNA === 'calculando' && (
        <Card>
          <Progresso valor={progressoSNA} texto={textoProgressoSNA || 'Calculando rede complexa...'} />
        </Card>
      )}
      {statusSNA === 'erro' && (
        <Aviso tipo="erro">Falha ao calcular a rede complexa. Recarregue a base para tentar novamente.</Aviso>
      )}

      {statusSNA === 'pronto' && (
        <>
          {maturidade && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Activity size={18} /> Maturidade e Robustez Topológica
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  rotulo="Assortatividade"
                  valor={formatarDecimal(maturidade.Assortatividade, 3)}
                  detalhe={maturidade.Assortatividade < 0 ? 'Rede disassortativa (hubs ligam periferia)' : 'Hubs se conectam entre si'}
                />
                <Kpi
                  rotulo="Rich-Club (top 20%)"
                  valor={formatarDecimal(maturidade.Rich_Club, 3)}
                  detalhe="Probabilidade de conexão entre os maiores hubs"
                />
                <Kpi
                  rotulo="Expoente γ"
                  valor={formatarDecimal(maturidade.Gamma, 3)}
                  detalhe={maturidade.Gamma >= 2 && maturidade.Gamma <= 3 ? 'Regime livre de escala' : 'Fora da faixa livre de escala'}
                />
                <Kpi
                  rotulo="Spearman (Grau × Bet.)"
                  valor={formatarDecimal(maturidade.Spearman, 3)}
                  detalhe="Correlação entre hubs e brokers"
                />
              </div>
            </section>
          )}

          <Destaques
            docs={docs}
            snaGlobal={snaGlobal}
            contagens={contagens}
            conjuntos={conjuntos}
            niveis={niveis}
          />
        </>
      )}
    </div>
  );
}
