import { valorNumericoTabela } from '@/lib/visualizacao';
import { coberturaRadar, corteEfetivo, LEITURA_QUADRANTE, motivoRadarVazio } from '@/lib/interpretacao';
import { navigatePage } from '@/services/navigation';
import { useSessionField } from '@/hooks/useSessionField';
import { TrabalhosDoTermo } from '@/components/results/TrabalhosDoTermo';
import { useMemo } from 'react';
import { Radar as RadarIcon, RefreshCw } from 'lucide-react';
import { Aviso, Card, Expander } from '@/components/ui/primitives';
import { CORES_QUADRANTE, Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { GridSearch } from './GridSearch';
import { prepararRadarForesight, segmentarPorKMeans, segmentarPorPercentil } from '@/lib/foresight-math';
import { Atividade } from '@/components/ui/Atividade';
import { useSnaWorker, useAtividade, emExecucao } from '@/hooks/useSnaWorker';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { ForesightRow, Quadrante, TipoForesight } from '@/types';

const TIPOS: TipoForesight[] = ['Palavra-chave', 'Macrotema', 'Artefatos (Ontologia IA)'];
const QUADRANTES: Quadrante[] = ['↗ Tendência', '↖ Sinal Fraco', '↘ Mainstream', '↙ Base/Declínio'];

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
  const idBootstrap = `bootstrap:${tipo}`;
  const task = useAtividade(idBootstrap);
  const bootstrap = task?.resultado?.type === 'bootstrap' ? task.resultado.result : null;
  const { calcularBootstrap } = useSnaWorker();
  const rodandoBootstrap = emExecucao(task);

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

  const [termoVisual, setTermoVisual] = useSessionField<string | null>('grafico.radar.termo', null);
  const abrirTermo = (nome: string) => {
    if (tipo === 'Artefatos (Ontologia IA)') setTermoVisual(nome);
    else useEcoGradStore.getState().navegarPara(tipo, nome);
  };
  const cobertura = useMemo(() => coberturaRadar(docs, janelaRecente, tipo), [docs, janelaRecente, tipo]);
  const efetivo = corteEfetivo(metodoCorte !== 'Percentil fixo', base.length, percentilCorte);
  const contextoRadar = { coberturaTemporal: cobertura, segmentacaoEfetiva: efetivo, interpretacaoCategorias: LEITURA_QUADRANTE, dimensao: tipo, janelaRecenteAnos: janelaRecente, metodoCorte, percentilCorte, bootstrap: bootstrap ? {reamostragens: 100, fracao: 0.85} : false, cortes: {x:segmentado.xMid,y:segmentado.yMid} };
  const colunasRadar = [{chave:'Termo',rotulo:'Termo completo'}, {chave:'Quadrante',rotulo:'Categoria original do modelo'}, {chave:'Total',rotulo:'Ocorrências totais (n)'}, {chave:'Aparições Recentes',rotulo:'Ocorrências recentes (n)'}, {chave:'Tração (%)',rotulo:'Tração (%)'}, {chave:'Momentum (Burst)',rotulo:'Momentum (índice)'}, {chave:'Novidade (Estrutural * IDF)',rotulo:'Novidade (índice)'}, {chave:'Bet. Robusto?',rotulo:'Betweenness robusto'},{chave:'Bet. IQR',rotulo:'Betweenness: intervalo interquartil'},{chave:'cluster_id',rotulo:'Cluster K-Means (identificador)'}];
  const executarBootstrap = () => { calcularBootstrap(docs, tipo, 100, 0.85); };

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

      <Card className="space-y-4">
        <h2 className="text-base font-semibold">1. Escolha o que investigar</h2>
        <p className="text-sm text-slate-300">Compare mudanças no uso dos termos e abra os trabalhos que sustentam cada ponto. Os índices descrevem esta seleção; não comprovam inovação ou crescimento futuro.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <GrupoOpcoes rotulo="Dimensão de análise" opcoes={TIPOS} valor={tipo} onChange={setTipo} />
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Janela recente (anos)
            <input type="range" min={1} max={8} value={janelaRecente} aria-valuetext={`${janelaRecente} ${janelaRecente === 1 ? 'ano' : 'anos'}, terminando em ${cobertura.ultimo ?? 'ano indisponível'}`} onChange={(e)=>setJanelaRecente(Number(e.target.value))} className="w-full accent-eco-accent" />
            <span>{janelaRecente} {janelaRecente === 1 ? 'ano' : 'anos'}</span>
          </label>
        </div>
        <div className="space-y-2 text-sm text-slate-300" role="status">
          <p>{cobertura.ultimo === null ? 'Período indisponível.' : `Base observada: ${cobertura.primeiro}–${cobertura.ultimo}. Passado: até ${cobertura.corte}, inclusive (${cobertura.passado} registros). Recente: ${cobertura.corte! + 1}–${cobertura.ultimo} (${cobertura.recente} registros).`}</p>
          <p>O período termina no último ano da seleção, não no ano atual. {cobertura.semAno} registros sem ano excluídos; {cobertura.comTermosDatados} registros datados têm termos desta dimensão. Anos intermediários podem não ter registros.</p>
          <p>Segmentação: {efetivo.metodo}{efetivo.percentil !== null && ` · percentil ${Math.round(efetivo.percentil * 100)}`}. {efetivo.linhas}</p>
        </div>
      </Card>

      <Expander titulo="Como interpretar períodos, índices e classificações">
        <div className="space-y-3 text-sm text-slate-300">
          <p>Momentum mede variação de taxas de ocorrência entre períodos, com suavização e ponderação pelo volume. Novidade é betweenness × IDF: um índice estrutural, não uma medida de originalidade ou qualidade.</p>
          <p>Entram termos com pelo menos 3 ocorrências totais, 2 recentes e no máximo {Math.floor(cobertura.limiteOcorrencias)} totais (máximo entre 10 e 10% dos registros datados). Registros sem termos ainda entram nos denominadores das taxas.</p>
          <ul className="space-y-2">{QUADRANTES.map((q)=><li key={q}><strong>{LEITURA_QUADRANTE[q]}</strong> — categoria original: {q}.</li>)}</ul>
          <p>No percentil, alto significa estritamente acima do corte; valores iguais ficam em baixo. No K-Means, médias iguais à mediana dos centroides entram em alto. “Sinal Fraco”, “Tendência” e “Base/Declínio” são nomes do modelo; não comprovam emergência, consolidação ou declínio. No K-Means, a categoria é atribuída ao cluster pela média dos índices.</p>
          <p>Ausência de betweenness no grafo global recebe zero no cálculo pontual; zero não prova ausência de conexões. Cobertura incompleta, termos normalizados e diferenças entre coleções afetam a leitura. Abra os trabalhos e verifique resumos e fontes antes de interpretar.</p>
        </div>
      </Expander>

      <Expander titulo="Configurações avançadas do Radar">
        <div className="space-y-4">
        <GrupoOpcoes rotulo="Método de corte" opcoes={['Percentil fixo', 'K-Means adaptativo (4 clusters)'] as const} valor={metodoCorte} onChange={setMetodoCorte} />
        {metodoCorte === 'Percentil fixo' ? (
          <label className="flex flex-col gap-1.5 text-xs uppercase tracking-wide text-slate-400">
            Percentil de corte (posição na distribuição)
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
            O K-Means agrupa os índices padronizados em 4 clusters. As linhas no gráfico são medianas dos centroides, não limites exatos. Com menos de 4 termos, aplica-se percentil 65.
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

        <p className="text-sm text-slate-300">Bootstrap usa 100 reamostragens de 85% dos documentos. A mediana substitui o betweenness quando disponível; o IQR (P75 − P25) mostra dispersão, não intervalo de confiança nem garantia de previsão. Termos sem estimativa mantêm o valor pontual.</p>
        </div>
      </Expander>
      <Atividade id={idBootstrap} />
      <Atividade id={`grid-search:${tipo}`} />

      {segmentado.linhas.length === 0 ? (
        <Aviso tipo="aviso">
          <p>{motivoRadarVazio(cobertura)}</p>
          {tipo !== 'Palavra-chave' && <button type="button" className="btn mt-2" onClick={()=>setTipo('Palavra-chave')}>Explorar palavras-chave</button>}
          {tipo === 'Artefatos (Ontologia IA)' && <button type="button" className="btn mt-2" onClick={()=>navigatePage('memetica')}>Abrir Memética</button>}
        </Aviso>
      ) : (
        <>
          <Card>
            <Grafico
              leitura={{ titulo:'Pontos do Radar de Foresight', descricao:'X: momentum temporal (índice). Y: novidade estrutural, Betweenness × IDF (índice). Cor: quadrante; tamanho: volume total. Linhas tracejadas: cortes por percentil ou referências dos centroides no K-Means. São descrições do recorte, não previsões garantidas. A tabela permite abrir cada termo por teclado.' + ` Cortes: momentum ${valorNumericoTabela(segmentado.xMid)}; novidade ${valorNumericoTabela(segmentado.yMid)}.`, linhas:[...segmentado.linhas].sort((a,b)=>b['Novidade (Estrutural * IDF)']-a['Novidade (Estrutural * IDF)']).map((l)=>({...l})), colunas:colunasRadar, contexto:contextoRadar, onAbrir:(l)=>abrirTermo(String(l.Termo)) }}
              onEvents={{click:(p)=>{const l=(p as {data?:{termo?:ForesightRow}}).data?.termo;if(l) abrirTermo(l.Termo);}}}
              altura={620}
              option={{
                tooltip: {
                  trigger: 'item',
                  formatter: (p: unknown) => {
                    const dado = (p as { data: { termo: ForesightRow } }).data.termo;
                    return [
                      dado.Termo,
                      `Momentum: ${dado['Momentum (Burst)']}`,
                      `Novidade: ${dado['Novidade (Estrutural * IDF)']}`,
                      `Total: ${dado.Total} · Recentes: ${dado['Aparições Recentes']}`,
                      `Tração: ${dado['Tração (%)']}%`,
                      dado['Bet. Robusto?'] ? `Bet. IQR: ${dado['Bet. IQR']}` : 'Betweenness pontual',
                    ].join('\n');
                  },
                },
                legend: { bottom: 0, orient: 'vertical', textStyle: { color: TEMA_GRAFICO.texto } },
                grid: { left: 32, right: 12, top: 40, bottom: 130, containLabel: true },
                xAxis: {
                  type: 'value',
                  name: 'Momentum (índice)',
                  nameLocation: 'middle',
                  nameGap: 30,
                  nameTextStyle: { color: TEMA_GRAFICO.texto },
                  splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
                  axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                },
                yAxis: {
                  type: 'value',
                  name: 'Novidade (índice)',
                  nameLocation: 'middle',
                  nameGap: 40,
                  nameTextStyle: { color: TEMA_GRAFICO.texto },
                  splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
                  axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                },
                series: QUADRANTES.map((q, i) => ({
                  name: LEITURA_QUADRANTE[q],
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
                          label: {show:false},
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
                <p className="flex items-start gap-2 text-sm font-semibold text-slate-200">
                  <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-full border border-slate-500" style={{backgroundColor:CORES_QUADRANTE[q]}} />
                  {LEITURA_QUADRANTE[q]}
                </p>
                <p className="text-2xl font-bold tabular-nums">{porQuadrante.get(q)?.length ?? 0}</p>
                <p className="break-words text-xs text-slate-400">
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

          <TrabalhosDoTermo termo={termoVisual} tipoForesight={tipo} onFechar={()=>setTermoVisual(null)} />

        </>
      )}
      <Expander titulo="Avaliação histórica avançada (Grid Search)">
        <GridSearch mostrarAtividade={false} />
      </Expander>
    </div>
  );
}
