import { useMemo } from 'react';
import { Microscope } from 'lucide-react';
import { Card, Kpi } from '@/components/ui/primitives';
import { calcularRaioX } from '@/lib/ql';
import { contar } from '@/lib/foresight-math';
import { formatarDecimal } from '@/lib/utils';
import type { Documento, SnaGlobal } from '@/types';
export function MetricasEntidade({ termo, docsAlvo, docs, snaGlobal }: { termo: string; docsAlvo: readonly Documento[]; docs: readonly Documento[]; snaGlobal: SnaGlobal | null }) {
  const metricas = snaGlobal?.[termo];
  const contagemPks = useMemo(() => contar(docs.flatMap((d) => d.palavras_chave).filter(Boolean)), [docs]);
  const raioX = useMemo(() => calcularRaioX(docsAlvo, docs, metricas?.Clustering ?? 0, contagemPks), [docsAlvo, docs, metricas, contagemPks]);
  return <div className="space-y-3">
    {docs.filter((d) => d.titulo === termo).length > 1 && <p className="text-sm text-amber-200">As métricas da rede usam o título como identificador e podem combinar registros homônimos. Os metadados acima são do registro escolhido; a posição estrutural não distingue esses registros.</p>}
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="space-y-4">
              <p className="text-sm text-slate-400">Indicadores da entidade no conjunto carregado. Não são medidas de mérito ou qualidade.</p>

              {raioX && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Microscope size={16} /> Raio-X de Especialização
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Kpi
                      rotulo={`Peculiaridade NMF${raioX.amostraMultipla ? ' (Média)' : ''}`}
                      valor={`${raioX.purezaMedia.toFixed(1)}%`}
                      detalhe={`Perfil: ${raioX.perfil}`}
                    />
                    <Kpi
                      rotulo="Densidade Local (SNA)"
                      valor={raioX.densidade.toFixed(2)}
                      detalhe="Coeficiente de agrupamento na rede"
                    />
                    <Kpi
                      rotulo={`Raridade IDF${raioX.amostraMultipla ? ' (Média)' : ''}`}
                      valor={`${raioX.raridadePct.toFixed(1)}%`}
                      detalhe={raioX.raridadePct > 60 ? 'Vocabulário raro / nicho' : 'Vocabulário comum'}
                    />
                  </div>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <p className="text-sm font-medium text-slate-200">Posição na Rede</p>
              {metricas ? (
                <>
                  <div className="sucesso text-xs">
                    Cluster {String(metricas.Comunidade)} · Rank #{String(metricas['Ranking Global'])}
                  </div>
                  <div className="grid gap-2">
                    <Kpi rotulo="Grau (Conexões)" valor={metricas['Grau Absoluto']} />
                    <Kpi rotulo="Betweenness" valor={formatarDecimal(metricas.Betweenness)} />
                    <Kpi rotulo="Closeness" valor={formatarDecimal(metricas.Closeness)} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Métricas SNA ainda não disponíveis — consulte o painel de atividades para acompanhar ou reiniciar o cálculo.
                </p>
              )}
            </Card>
          </div>

</div>;
}
