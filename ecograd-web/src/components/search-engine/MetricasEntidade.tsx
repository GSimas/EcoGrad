import { useMemo } from 'react';
import { Microscope, Network } from 'lucide-react';
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
          <Card className="space-y-5">
            <header className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent"><Microscope size={20} aria-hidden="true" /></span>
              <div><h3 className="text-base font-semibold text-slate-100">Indicadores da entidade</h3><p className="mt-1 text-sm text-slate-400">Medidas descritivas do conjunto carregado. Não representam mérito ou qualidade.</p></div>
            </header>

            {raioX && (
                <section className="space-y-3" aria-labelledby="titulo-especializacao">
                  <p id="titulo-especializacao" className="text-sm font-semibold text-slate-200">Raio-X de especialização</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Kpi
                      rotulo={`Peculiaridade NMF${raioX.amostraMultipla ? ' (Média)' : ''}`}
                      valor={`${raioX.purezaMedia.toFixed(1)}%`}
                      detalhe={`Perfil: ${raioX.perfil}`}
                      ajuda="Estima quanto o vocabulário associado se concentra em componentes temáticos do modelo NMF. Valores maiores indicam um perfil mais específico dentro deste recorte."
                      className="h-full"
                    />
                    <Kpi
                      rotulo="Densidade Local (SNA)"
                      valor={raioX.densidade.toFixed(2)}
                      detalhe="Coeficiente de agrupamento na rede"
                      ajuda="Mede quanto os vizinhos imediatos desta entidade também se conectam entre si. Valores maiores indicam uma vizinhança mais agrupada."
                      className="h-full"
                    />
                    <Kpi
                      rotulo={`Raridade IDF${raioX.amostraMultipla ? ' (Média)' : ''}`}
                      valor={`${raioX.raridadePct.toFixed(1)}%`}
                      detalhe={raioX.raridadePct > 60 ? 'Vocabulário raro / nicho' : 'Vocabulário comum'}
                      ajuda="Estima quanto os termos associados são raros no conjunto carregado. Valores maiores indicam vocabulário menos frequente neste recorte."
                      className="h-full sm:col-span-2 xl:col-span-1"
                    />
                  </div>
                </section>
              )}

            <section className="space-y-3 border-t border-eco-border pt-5" aria-labelledby="titulo-posicao-rede">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p id="titulo-posicao-rede" className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Network size={17} className="text-eco-accent" aria-hidden="true" />Posição na rede</p>
                {metricas && <div className="sucesso px-3 py-2 text-xs">Cluster {String(metricas.Comunidade)} · Rank #{String(metricas['Ranking Global'])}</div>}
              </div>
              {metricas ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Kpi rotulo="Grau (Conexões)" valor={metricas['Grau Absoluto']} ajuda="Número de conexões diretas desta entidade na rede do conjunto carregado." className="h-full" />
                    <Kpi rotulo="Betweenness" valor={formatarDecimal(metricas.Betweenness)} ajuda="Fração dos caminhos mínimos da rede que passa por esta entidade. Valores maiores sugerem um papel de ponte estrutural no recorte." className="h-full" />
                    <Kpi rotulo="Closeness" valor={formatarDecimal(metricas.Closeness)} ajuda="Proximidade média desta entidade aos demais nós alcançáveis. Valores maiores indicam menor distância estrutural média no recorte." className="h-full sm:col-span-2 xl:col-span-1" />
                  </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Métricas SNA ainda não disponíveis — consulte o painel de atividades para acompanhar ou reiniciar o cálculo.
                </p>
              )}
            </section>
          </Card>

</div>;
}
