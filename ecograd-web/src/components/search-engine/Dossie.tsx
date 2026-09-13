import { useSessionField } from '@/hooks/useSessionField';
import { useMemo } from 'react';
import { Aviso, Card, Expander, Tabela } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { Tabs } from '@/components/ui/Tabs';
import { TabelaQL } from './TabelaQL';
import { OrbitaGrafo } from './OrbitaGrafo';
import { evolucaoAnual, obterFrequenciasTexto, type FonteNuvem } from '@/lib/lexicon';
import { gerarTabelaQLCruzado } from '@/lib/ql';
import { calcularSimilaresRede } from '@/lib/similarity';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { useGrafoHistorico, usePerfisSimilaridade } from '@/hooks/useDadosDerivados';
import { VisaoEntidade } from './VisaoEntidade';
import { MetricasEntidade } from './MetricasEntidade';
import type { Documento, SnaGlobal, TipoBusca } from '@/types';

interface Props {
  termo: string;
  tipo: TipoBusca;
  docsAlvo: readonly Documento[];
  dadosCompletos: readonly Documento[];
  snaGlobal: SnaGlobal | null;
}

const FONTES_NUVEM: FonteNuvem[] = ['Conceitos (Palavras-chave)', 'Títulos', 'Resumos (Abstracts)'];

/** Reading and sources remain above the optional scientific methods. */
export function Dossie(props: Props) {
  return <div className="space-y-6">
    <VisaoEntidade tipo={props.tipo} docs={props.docsAlvo} termo={props.termo} />
    <Expander titulo="Análises e métodos do dossiê" lazy><AnalisesDossie {...props} /></Expander>
  </div>;
}

function AnalisesDossie({
  termo,
  tipo,
  docsAlvo,
  dadosCompletos,
  snaGlobal,
}: Props) {
  const perfis = usePerfisSimilaridade(dadosCompletos);
  const grafoHistorico = useGrafoHistorico(dadosCompletos);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const [cumulativo, setCumulativo] = useSessionField('dossie.cumulativo', false);
  const [fonteNuvem, setFonteNuvem] = useSessionField<FonteNuvem>('dossie.nuvem', 'Conceitos (Palavras-chave)');

  const serie = useMemo(() => evolucaoAnual(docsAlvo, cumulativo), [docsAlvo, cumulativo]);
  const nuvem = useMemo(() => obterFrequenciasTexto(docsAlvo, fonteNuvem), [docsAlvo, fonteNuvem]);
  const similares = useMemo(() => calcularSimilaresRede(termo, tipo, perfis), [termo, tipo, perfis]);

  const tabelaQL = useMemo(() => {
    if (tipo === 'Orientador' || tipo === 'Co-orientador') {
      return gerarTabelaQLCruzado(docsAlvo, dadosCompletos, ['Macrotema', 'Palavra-chave']);
    }
    if (tipo === 'Palavra-chave') {
      return gerarTabelaQLCruzado(docsAlvo, dadosCompletos, ['Orientador', 'Co-orientador', 'Macrotema']);
    }
    if (tipo === 'Macrotema') {
      return gerarTabelaQLCruzado(docsAlvo, dadosCompletos, ['Orientador', 'Co-orientador', 'Palavra-chave']);
    }
    return [];
  }, [tipo, docsAlvo, dadosCompletos]);

  return (
    <div className="space-y-5"><MetricasEntidade termo={termo} docsAlvo={docsAlvo} docs={dadosCompletos} snaGlobal={snaGlobal} /><Tabs
      abas={[
        {
          valor: 'perfil',
          rotulo: 'Frequências e relações (QL)',
          conteudo: tabelaQL.length ? <><p className="mb-3 text-xs text-slate-400">Frequências dentro do recorte e especialização relativa. TCCs são incluídos em “Outros” pelo algoritmo original. QL não avalia a qualidade nem a disponibilidade de orientação.</p><TabelaQL linhas={tabelaQL} titulo="Frequência e especialização relativa" /></> : <p className="text-sm text-slate-300">QL cruzado não se aplica a este tipo de entidade. Consulte os trabalhos e relações acima ou as outras análises.</p>,
        },
        {
          valor: 'evolucao',
          rotulo: '📈 Evolução Histórica',
          conteudo: (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={cumulativo}
                  onChange={(e) => setCumulativo(e.target.checked)}
                  className="accent-eco-accent"
                />
                Exibir série cumulativa
              </label>
              <Card>
                <Grafico
                  leitura={{ titulo: 'Evolução anual da entidade', descricao: `Eixo X: ano. Eixo Y: registros (n), ${cumulativo ? 'acumulados até cada ano' : 'em cada ano'}. A ausência de registros não comprova ausência de produção.`, linhas: serie.map((l) => ({...l})), colunas: [{chave:'ano',rotulo:'Ano',render:(l)=>String(l.ano)}, {chave:'total',rotulo: cumulativo ? 'Registros acumulados (n)' : 'Registros no ano (n)'}], contexto: {cumulativo} }}
                  altura={340}
                  option={{
                    tooltip: { trigger: 'axis' },
                    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
                    xAxis: {
                      type: 'category',
                      data: serie.map((s) => String(s.ano)),
                      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                    },
                    yAxis: {
                      type: 'value',
                      splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
                      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
                    },
                    series: [
                      {
                        type: cumulativo ? 'line' : 'bar',
                        data: serie.map((s) => s.total),
                        smooth: cumulativo,
                        areaStyle: cumulativo ? { opacity: 0.15 } : undefined,
                        itemStyle: { color: TEMA_GRAFICO.paleta[0], borderRadius: [3, 3, 0, 0] },
                      },
                    ],
                  }}
                />
              </Card>
            </div>
          ),
        },
        {
          valor: 'lexicometria',
          rotulo: '☁️ Lexicometria',
          conteudo: (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1 rounded-lg border border-eco-border bg-eco-panel/60 p-1">
                {FONTES_NUVEM.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFonteNuvem(f)}
                    className={`rounded-md px-3 py-1.5 text-sm transition ${
                      f === fonteNuvem ? 'bg-eco-action text-black' : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <Card>
                {nuvem.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Sem texto suficiente para gerar a nuvem.
                  </p>
                ) : (
                  <Grafico
                    leitura={{ titulo: 'Frequências da nuvem de palavras', descricao: 'Tamanho da palavra: frequência no texto selecionado (ocorrências). Cor e rotação são decorativas. Leia todos os termos e valores na tabela.', linhas: nuvem.map((l) => ({...l})), colunas: [{chave:'name',rotulo:'Termo completo'}, {chave:'value',rotulo:'Ocorrências (n)'}], contexto: {fonte:fonteNuvem} }}
                    altura={420}
                    option={{
                      tooltip: { show: true },
                      series: [
                        {
                          type: 'wordCloud',
                          shape: 'circle',
                          gridSize: 6,
                          sizeRange: [12, 58],
                          rotationRange: [-45, 45],
                          width: '100%',
                          height: '100%',
                          drawOutOfBound: false,
                          textStyle: {
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 600,
                            color: () =>
                              TEMA_GRAFICO.paleta[Math.floor(Math.random() * TEMA_GRAFICO.paleta.length)],
                          },
                          emphasis: { textStyle: { textShadowBlur: 8, textShadowColor: '#F39C12' } },
                          data: nuvem,
                        },
                      ],
                    }}
                  />
                )}
              </Card>
            </div>
          ),
        },
        {
          valor: 'orbita',
          rotulo: '🪐 Órbita de Relacionamentos',
          conteudo: (
            <OrbitaGrafo
              grafo={grafoHistorico}
              termoFoco={termo}
              snaGlobal={snaGlobal}
              onSelecionarNo={(id, tipoNo) => {
                const mapa: Record<string, TipoBusca> = {
                  Documento: 'Documento',
                  Autor: 'Autor',
                  Orientador: 'Orientador',
                  'Co-orientador': 'Co-orientador',
                  Conceito: 'Palavra-chave',
                  Macrotema: 'Macrotema',
                };
                const destino = mapa[tipoNo];
                if (destino) navegarPara(destino, id);
              }}
            />
          ),
        },
        {
          valor: 'similares',
          rotulo: '🔗 Itens Semelhantes',
          conteudo: (
            <div className="space-y-4">
              <Aviso>
                Recomendação topológica por <strong>Índice de Jaccard</strong>: mede a sobreposição
                do &quot;DNA acadêmico&quot; (vizinhança na rede) entre entidades do mesmo tipo.
              </Aviso>
              {Object.keys(similares).length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Nenhum item semelhante encontrado para esta entidade.
                </p>
              ) : (
                Object.entries(similares).map(([grupo, itens]) => (
                  <div key={grupo} className="space-y-2">
                    <p className="text-sm font-medium text-slate-200">{grupo}</p>
                    <Tabela
                      titulo={`Itens semelhantes: ${grupo}`}
                      altura="max-h-72"
                      linhas={itens as unknown as Array<Record<string, unknown>>}
                      colunas={[
                        {
                          chave: 'Item',
                          rotulo: 'Item',
                          render: (l) => (
                            <button
                              type="button"
                              className="text-left text-eco-accent hover:underline"
                              onClick={() => navegarPara(tipo, String(l.Item))}
                            >
                              {String(l.Item)}
                            </button>
                          ),
                        },
                        {
                          chave: 'Similaridade (%)',
                          rotulo: 'Similaridade Jaccard (%)',
                          render: (l) => (
                            <span className="tabular-nums">{Number(l['Similaridade (%)']).toFixed(2)}%</span>
                          ),
                        },
                        { chave: 'Qtd. Traços', rotulo: 'Traços' },
                        {
                          chave: 'Traços em Comum',
                          rotulo: 'Traços em Comum',
                          className: 'max-w-md truncate',
                        },
                      ]}
                    />
                  </div>
                ))
              )}
            </div>
          ),
        },
      ]}
    /></div>
  );
}
