import { useSessionField } from '@/hooks/useSessionField';
import { useMemo } from 'react';
import { Check, Cloud, Link2, Orbit, TrendingUp } from 'lucide-react';
import { AnalisesOcultas, Aviso, BotaoEntidade, Card, Expander, Tabela } from '@/components/ui/primitives';
import { relevanciaDossie } from '@/lib/relevancia';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { Tabs, type AbaDef } from '@/components/ui/Tabs';
import { TabelaQL } from './TabelaQL';
import { OrbitaGrafo } from './OrbitaGrafo';
import { evolucaoAnual, fontesValidas, obterFrequenciasTexto, FONTES_NUVEM, type FonteNuvem } from '@/lib/lexicon';
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


/**
 * Os gráficos ficam à vista, logo acima dos trabalhos associados; indicadores e
 * métodos seguem recolhidos em "Análises e métodos do dossiê".
 */
export function Dossie(props: Props) {
  return <div className="space-y-6">
    <VisaoEntidade tipo={props.tipo} docs={props.docsAlvo} termo={props.termo}
      analises={<>
        <GraficosDossie {...props} />
        <Expander titulo="Análises e métodos do dossiê" lazy>
          <MetricasEntidade termo={props.termo} docsAlvo={props.docsAlvo} docs={props.dadosCompletos} snaGlobal={props.snaGlobal} />
        </Expander>
      </>} />
  </div>;
}

function GraficosDossie({
  termo,
  tipo,
  docsAlvo,
  dadosCompletos,
  snaGlobal,
}: Props) {
  const [cumulativo, setCumulativo] = useSessionField('dossie.cumulativo', false);
  // Chave nova de propósito: a antiga guardava uma fonte só, em string, e
  // voltaria da sessão como um valor que não é lista. `fontesValidas` ainda
  // filtra o que chega, porque a sessão restaura `ui` sem validar item a item.
  const [fontesSalvas, setFontesNuvem] = useSessionField<FonteNuvem[]>('dossie.nuvem.fontes', ['Conceitos (Palavras-chave)']);
  const fontesNuvem = useMemo(() => fontesValidas(fontesSalvas), [fontesSalvas]);
  // Atualização funcional, e não a lista deste render: dois cliques no mesmo
  // tick (teclado repetido, duplo toque) partiriam os dois da mesma lista
  // antiga e o segundo desfaria o primeiro.
  const alternarFonte = (f: FonteNuvem) => setFontesNuvem((atuais) => {
    const lista = fontesValidas(atuais);
    return lista.includes(f) ? lista.filter((x) => x !== f) : [...lista, f];
  });
  const todasAsFontes = fontesNuvem.length === FONTES_NUVEM.length;

  const serie = useMemo(() => evolucaoAnual(docsAlvo, cumulativo), [docsAlvo, cumulativo]);
  const nuvem = useMemo(() => obterFrequenciasTexto(docsAlvo, fontesNuvem), [docsAlvo, fontesNuvem]);

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

  // A série cumulativa não muda quantos anos existem, só o valor de cada um.
  const { mostrar, ocultas } = relevanciaDossie({ tipo, docsAlvo, anosNaSerie: serie.length, linhasQL: tabelaQL.length });
  const abas: AbaDef[] = [];

  if (mostrar.has('evolucao')) {
    abas.push({
          valor: 'evolucao',
          rotulo: <><TrendingUp size={15} aria-hidden /> Evolução Histórica</>,
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
    });
  }

  if (mostrar.has('lexicometria')) {
    abas.push({
          valor: 'lexicometria',
          rotulo: <><Cloud size={15} aria-hidden /> Lexicometria</>,
          conteudo: (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p id="rotulo-fontes-nuvem" className="text-xs uppercase tracking-wide text-slate-400">Fontes do texto</p>
                <div role="group" aria-labelledby="rotulo-fontes-nuvem" className="flex flex-wrap gap-1 rounded-lg border border-eco-border bg-eco-panel/60 p-1">
                  <button
                    type="button"
                    aria-pressed={todasAsFontes}
                    onClick={() => setFontesNuvem([...FONTES_NUVEM])}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                      todasAsFontes ? 'bg-eco-action text-black' : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <Check size={13} aria-hidden className={todasAsFontes ? '' : 'opacity-0'} />
                    Todos
                  </button>
                  {FONTES_NUVEM.map((f) => {
                    const ativo = fontesNuvem.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => alternarFonte(f)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                          ativo ? 'bg-eco-action text-black' : 'text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        <Check size={13} aria-hidden className={ativo ? '' : 'opacity-0'} />
                        {f}
                      </button>
                    );
                  })}
                </div>
                {fontesNuvem.length > 1 && <p className="text-xs text-slate-400">
                  Fontes somadas. Palavras-chave contam a expressão inteira; títulos e resumos contam palavra a palavra. Um termo presente em mais de uma fonte soma as contagens.
                </p>}
              </div>
              <Card>
                {fontesNuvem.length === 0 ? (
                  <div className="space-y-2 py-8 text-center text-sm text-slate-300">
                    <p>Nenhuma fonte selecionada, então não há texto a contar.</p>
                    <button type="button" className="btn" onClick={() => setFontesNuvem([...FONTES_NUVEM])}>Usar todas as fontes</button>
                  </div>
                ) : nuvem.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Sem texto suficiente para gerar a nuvem {fontesNuvem.length === 1 ? 'nesta fonte' : 'nestas fontes'}.
                  </p>
                ) : (
                  <Grafico
                    leitura={{ titulo: 'Frequências da nuvem de palavras', descricao: `Tamanho da palavra: frequência nas fontes selecionadas (ocorrências). Cor e rotação são decorativas. Leia todos os termos e valores na tabela.${fontesNuvem.length > 1 ? ' As fontes são somadas e misturam unidades: palavras-chave contam a expressão inteira, títulos e resumos contam palavra a palavra.' : ''}`, linhas: nuvem.map((l) => ({...l})), colunas: [{chave:'name',rotulo:'Termo completo'}, {chave:'value',rotulo:'Ocorrências (n)'}], contexto: {fontes:fontesNuvem} }}
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
    });
  }

  if (mostrar.has('orbita')) {
    abas.push({
          valor: 'orbita',
          rotulo: <><Orbit size={15} aria-hidden /> Órbita de Relacionamentos</>,
          conteudo: <OrbitaAba termo={termo} dadosCompletos={dadosCompletos} snaGlobal={snaGlobal} />,
    });
  }

  if (mostrar.has('perfil')) {
    abas.push({
          valor: 'perfil',
          rotulo: 'Frequências e relações (QL)',
          conteudo: <><p className="mb-3 text-xs text-slate-400">Frequências dentro do recorte e especialização relativa. TCCs são incluídos em “Outros” pelo algoritmo original. QL não avalia a qualidade nem a disponibilidade de orientação.</p><TabelaQL linhas={tabelaQL} titulo="Frequência e especialização relativa" /></>,
    });
  }

  if (mostrar.has('similares')) {
    abas.push({
          valor: 'similares',
          rotulo: <><Link2 size={15} aria-hidden /> Itens Semelhantes</>,
          conteudo: <ItensSemelhantes termo={termo} tipo={tipo} dadosCompletos={dadosCompletos} />,
    });
  }

  return (
    <section aria-label="Gráficos do dossiê" className="space-y-3">
      {abas.length > 0
        ? <Tabs chaveSessao="dossie" abas={abas} />
        : <Aviso>Nenhuma das análises gráficas descreve este item. Os metadados, os trabalhos e as relações continuam abaixo.</Aviso>}
      <AnalisesOcultas itens={ocultas} />
    </section>
  );
}

/** Só monta com a aba ativa, então o grafo histórico não é calculado à toa. */
function OrbitaAba({ termo, dadosCompletos, snaGlobal }: Pick<Props, 'termo' | 'dadosCompletos' | 'snaGlobal'>) {
  const grafoHistorico = useGrafoHistorico(dadosCompletos);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  return (
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
  );
}

/** Só monta com a aba ativa, então os perfis de similaridade não são calculados à toa. */
function ItensSemelhantes({ termo, tipo, dadosCompletos }: Pick<Props, 'termo' | 'tipo' | 'dadosCompletos'>) {
  const perfis = usePerfisSimilaridade(dadosCompletos);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const similares = useMemo(() => calcularSimilaresRede(termo, tipo, perfis), [termo, tipo, perfis]);
  return (
            <div className="space-y-4">
              <Aviso>
                Recomendação topológica por <strong>Índice de Jaccard</strong>: mede a sobreposição
                do &quot;DNA acadêmico&quot; (vizinhança na rede) entre entidades do mesmo tipo.
              </Aviso>
              {/* Contar grupos não serve: um documento sem semelhantes devolve
                  Teses e Dissertações vazias, duas chaves que renderizariam
                  duas tabelas vazias no lugar desta mensagem. */}
              {Object.values(similares).every((itens) => itens.length === 0) ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Nenhum item semelhante encontrado para esta entidade.
                </p>
              ) : (
                Object.entries(similares).filter(([, itens]) => itens.length > 0).map(([grupo, itens]) => (
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
                            <BotaoEntidade tipo={tipo} nome={String(l.Item)} onClick={() => navegarPara(tipo, String(l.Item))} />
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
  );
}
