import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Aviso, Card, Chip, Expander, Kpi, Tabela } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { Tabs } from '@/components/ui/Tabs';
import { TabelaQL } from './TabelaQL';
import { OrbitaGrafo } from './OrbitaGrafo';
import { evolucaoAnual, obterFrequenciasTexto, type FonteNuvem } from '@/lib/lexicon';
import { gerarTabelaQLCruzado } from '@/lib/ql';
import { calcularSimilaresRede, type PerfisSimilaridade } from '@/lib/similarity';
import type { GrafoHistorico } from '@/lib/orbit';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Documento, SnaGlobal, TipoBusca } from '@/types';

interface Props {
  termo: string;
  tipo: TipoBusca;
  docsAlvo: readonly Documento[];
  dadosCompletos: readonly Documento[];
  snaGlobal: SnaGlobal | null;
  perfis: PerfisSimilaridade;
  grafoHistorico: GrafoHistorico;
}

const FONTES_NUVEM: FonteNuvem[] = ['Conceitos (Palavras-chave)', 'Títulos', 'Resumos (Abstracts)'];

/** Dossiê individual com as 4 abas analíticas. */
export function Dossie({
  termo,
  tipo,
  docsAlvo,
  dadosCompletos,
  snaGlobal,
  perfis,
  grafoHistorico,
}: Props) {
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const [cumulativo, setCumulativo] = useState(false);
  const [fonteNuvem, setFonteNuvem] = useState<FonteNuvem>('Conceitos (Palavras-chave)');

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
    <Tabs
      abas={[
        {
          valor: 'perfil',
          rotulo: '🗂️ Perfil',
          conteudo: (
            <PerfilEntidade
              termo={termo}
              tipo={tipo}
              docsAlvo={docsAlvo}
              tabelaQL={tabelaQL}
              onNavegar={navegarPara}
            />
          ),
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
                      f === fonteNuvem ? 'bg-eco-accent text-black' : 'text-slate-400 hover:bg-white/5'
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
                          rotulo: 'Similaridade',
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
    />
  );
}

/** Conteúdo do perfil, específico por tipo de entidade (Principal.py:684-1190). */
function PerfilEntidade({
  termo,
  tipo,
  docsAlvo,
  tabelaQL,
  onNavegar,
}: {
  termo: string;
  tipo: TipoBusca;
  docsAlvo: readonly Documento[];
  tabelaQL: ReturnType<typeof gerarTabelaQLCruzado>;
  onNavegar: (tipo: TipoBusca, termo: string) => void;
}) {
  if (tipo === 'Documento') {
    const doc = docsAlvo[0];
    if (!doc) return <p className="text-sm text-slate-500">Documento não encontrado.</p>;
    return (
      <div className="space-y-4">
        <Card className="space-y-3">
          <p className="text-sm text-slate-400">
            <strong>Ano:</strong> {doc.ano ?? 'N/A'} · <strong>Nível:</strong>{' '}
            {doc.nivel_academico || 'N/A'} · <strong>Programa:</strong> {doc.programa_origem || 'N/A'}
          </p>
          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-eco-accent hover:underline"
            >
              <ExternalLink size={14} /> Link oficial no repositório da UFSC
            </a>
          )}
          {doc.macrotema && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Macrotema Classificado:</p>
              <Chip onClick={() => onNavegar('Macrotema', doc.macrotema)}>🏷️ {doc.macrotema}</Chip>
            </div>
          )}
          <ListaChips
            titulo="Rede de Autoria e Orientação"
            itens={[
              ...doc.autores.map((a) => ({ rotulo: `👤 ${a}`, tipo: 'Autor' as TipoBusca, termo: a })),
              ...(doc.orientador
                ? [{ rotulo: `🏫 ${doc.orientador}`, tipo: 'Orientador' as TipoBusca, termo: doc.orientador }]
                : []),
              ...doc.co_orientadores.map((c) => ({
                rotulo: `🤝 ${c}`,
                tipo: 'Co-orientador' as TipoBusca,
                termo: c,
              })),
            ]}
            onNavegar={onNavegar}
          />
          <ListaChips
            titulo="Palavras-chave"
            itens={doc.palavras_chave.map((pk) => ({
              rotulo: `💡 ${pk}`,
              tipo: 'Palavra-chave' as TipoBusca,
              termo: pk,
            }))}
            onNavegar={onNavegar}
          />
        </Card>
        <Expander titulo="Ler Resumo (Abstract)">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {doc.resumo || 'Resumo não disponível.'}
          </p>
        </Expander>
      </div>
    );
  }

  const programas = [...new Set(docsAlvo.map((d) => d.programa_origem).filter(Boolean))].sort();
  const orientadores = new Set<string>();
  const coorientadores = new Set<string>();
  const alunos = new Set<string>();
  for (const d of docsAlvo) {
    if (d.orientador) orientadores.add(d.orientador);
    for (const co of d.co_orientadores) coorientadores.add(co);
    for (const a of d.autores) alunos.add(a);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi rotulo="Documentos" valor={docsAlvo.length} />
        <Kpi rotulo="Programas (PPG)" valor={programas.length} />
        <Kpi
          rotulo={tipo === 'Autor' ? 'Orientadores' : 'Pessoas na rede'}
          valor={tipo === 'Autor' ? orientadores.size + coorientadores.size : alunos.size}
        />
      </div>

      {programas.length > 0 && (
        <Card>
          <p className="text-sm text-slate-400">
            <strong>🏛️ Programas (PPG):</strong> {programas.join(', ')}
          </p>
        </Card>
      )}

      {tabelaQL.length > 0 && (
        <Card>
          <TabelaQL linhas={tabelaQL} titulo="📊 Frequência Temática e Especialização (QL)" />
        </Card>
      )}

      {tipo === 'Autor' && (orientadores.size > 0 || coorientadores.size > 0) && (
        <Card>
          <ListaChips
            titulo="👨‍🏫 Orientadores e Co-orientadores"
            itens={[
              ...[...orientadores].sort().map((o) => ({
                rotulo: `🏫 ${o}`,
                tipo: 'Orientador' as TipoBusca,
                termo: o,
              })),
              ...[...coorientadores].sort().map((c) => ({
                rotulo: `🤝 ${c}`,
                tipo: 'Co-orientador' as TipoBusca,
                termo: c,
              })),
            ]}
            onNavegar={onNavegar}
          />
        </Card>
      )}

      {(tipo === 'Orientador' || tipo === 'Co-orientador') && alunos.size > 0 && (
        <Expander titulo={`🎓 Alunos ${tipo === 'Orientador' ? 'orientados' : 'co-orientados'} (${alunos.size})`}>
          <div className="flex flex-wrap gap-1.5">
            {[...alunos].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((a) => (
              <Chip key={a} onClick={() => onNavegar('Autor', a)}>
                👤 {a}
              </Chip>
            ))}
          </div>
        </Expander>
      )}

      <Expander titulo={`📚 Documentos associados (${docsAlvo.length})`}>
        <div className="flex flex-col gap-1.5">
          {docsAlvo.map((d) => (
            <Chip key={d.titulo} onClick={() => onNavegar('Documento', d.titulo)} title={d.titulo}>
              📄 {d.titulo}
            </Chip>
          ))}
        </div>
      </Expander>

      <p className="text-xs text-slate-600">Entidade em foco: {termo}</p>
    </div>
  );
}

function ListaChips({
  titulo,
  itens,
  onNavegar,
}: {
  titulo: string;
  itens: Array<{ rotulo: string; tipo: TipoBusca; termo: string }>;
  onNavegar: (tipo: TipoBusca, termo: string) => void;
}) {
  if (itens.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((i) => (
          <Chip key={`${i.tipo}-${i.termo}`} onClick={() => onNavegar(i.tipo, i.termo)}>
            {i.rotulo}
          </Chip>
        ))}
      </div>
    </div>
  );
}
