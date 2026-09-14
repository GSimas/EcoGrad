import { useMemo, type ReactNode } from 'react';
import { ChartColumn, FileText, GraduationCap, Handshake, School, Sprout, Target, Trophy, User, Waypoints } from 'lucide-react';
import { Aviso, Card, Chip, Expander } from '@/components/ui/primitives';
import { RankingClicavel, TEMA_GRAFICO } from '@/components/ui/Chart';
import { Tabs } from '@/components/ui/Tabs';
import { formatarDecimal } from '@/lib/utils';
import { topN } from '@/lib/lexicon';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Documento, SnaGlobal, TipoBusca } from '@/types';

interface Props {
  docs: readonly Documento[];
  snaGlobal: SnaGlobal | null;
  contagens: {
    orientadores: Map<string, number>;
    coorientadores: Map<string, number>;
    keywords: Map<string, number>;
    macrotemas: Map<string, number>;
  };
  conjuntos: {
    orientadores: Set<string>;
    coorientadores: Set<string>;
  };
  niveis: { titulosTeses: string[]; titulosDissertacoes: string[] };
}

/**
 * Destaques do Ecossistema: rankings por volume, genealogia acadêmica e
 * liderança topológica (Betweenness/Closeness).
 * Transcrição de Principal.py:432-596.
 */
export function Destaques({ docs, snaGlobal, contagens, conjuntos, niveis }: Props) {
  const navegarPara = useEcoGradStore((s) => s.navegarPara);

  const genealogia = useMemo(() => {
    const professoresAtivos = new Set([...conjuntos.orientadores, ...conjuntos.coorientadores]);
    const formadores = new Set<string>();
    // autor -> programa -> níveis cursados
    const autorProgramas = new Map<string, Map<string, Set<string>>>();

    for (const d of docs) {
      for (const autor of d.autores) {
        if (professoresAtivos.has(autor) && d.orientador) formadores.add(d.orientador);
      }

      const nivel = d.nivel_academico ?? '';
      if (!nivel.includes('Tese') && !nivel.includes('Disserta')) continue;
      const programa = d.programa_origem || 'Programa Desconhecido';
      const categoria = nivel.includes('Tese') ? 'Tese' : 'Dissertação';

      for (const autor of d.autores) {
        if (!autor) continue;
        let porPrograma = autorProgramas.get(autor);
        if (!porPrograma) {
          porPrograma = new Map();
          autorProgramas.set(autor, porPrograma);
        }
        let niveisSet = porPrograma.get(programa);
        if (!niveisSet) {
          niveisSet = new Set();
          porPrograma.set(programa, niveisSet);
        }
        niveisSet.add(categoria);
      }
    }

    // Autores que fizeram Dissertação E Tese no mesmo programa
    const mestreDoutor: Array<[string, string[]]> = [];
    for (const [autor, porPrograma] of autorProgramas) {
      const programasDuplos = [...porPrograma.entries()]
        .filter(([, n]) => n.has('Tese') && n.has('Dissertação'))
        .map(([p]) => p)
        .sort();
      if (programasDuplos.length > 0) mestreDoutor.push([autor, programasDuplos]);
    }

    return {
      formadores: [...formadores].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      mestreDoutor: mestreDoutor.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')),
    };
  }, [docs, conjuntos]);

  const topSna = useMemo(() => {
    const melhor = (entidades: Iterable<string>, metrica: 'Betweenness' | 'Closeness'): [string, number] => {
      if (!snaGlobal) return ['Nenhum', 0];
      let nome = 'Nenhum';
      let valor = -Infinity;
      for (const e of entidades) {
        const v = snaGlobal[e]?.[metrica];
        if (typeof v === 'number' && v > valor) {
          valor = v;
          nome = e;
        }
      }
      return valor === -Infinity ? ['Nenhum', 0] : [nome, valor];
    };
    return {
      oriBet: melhor(conjuntos.orientadores, 'Betweenness'),
      oriClose: melhor(conjuntos.orientadores, 'Closeness'),
      cooriBet: melhor(conjuntos.coorientadores, 'Betweenness'),
      cooriClose: melhor(conjuntos.coorientadores, 'Closeness'),
      teseBet: melhor(niveis.titulosTeses, 'Betweenness'),
      teseClose: melhor(niveis.titulosTeses, 'Closeness'),
      dissBet: melhor(niveis.titulosDissertacoes, 'Betweenness'),
      dissClose: melhor(niveis.titulosDissertacoes, 'Closeness'),
    };
  }, [snaGlobal, conjuntos, niveis]);

  const topOriVol = topN(contagens.orientadores, 1)[0];
  const topCooriVol = topN(contagens.coorientadores, 1)[0];

  const botaoSna = (rotulo: string, par: [string, number], tipo: TipoBusca, icone: ReactNode) =>
    par[0] === 'Nenhum' ? null : (
      <div className="space-y-1">
        <p className="text-xs text-slate-400">{rotulo}</p>
        <Chip onClick={() => navegarPara(tipo, par[0])} title={par[0]}>
          {icone} {par[0].length > 60 ? `${par[0].slice(0, 60)}…` : par[0]} ·{' '}
          <span className="tabular-nums text-slate-500">{formatarDecimal(par[1])}</span>
        </Chip>
      </div>
    );

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Trophy size={18} /> Destaques do Ecossistema
      </h3>

      <Tabs
        abas={[
          {
            valor: 'graficos',
            rotulo: <><ChartColumn size={15} aria-hidden /> Top 10 (Gráficos)</>,
            conteudo: (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Clique em qualquer barra para abrir o dossiê da entidade no Motor de Busca.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <RankingClicavel
                      dados={topN(contagens.orientadores, 10)}
                      titulo="Top 10 Orientadores"
                      cor={TEMA_GRAFICO.paleta[0]}
                      onSelecionar={(nome) => navegarPara('Orientador', nome)}
                    />
                  </Card>
                  <Card>
                    <RankingClicavel
                      dados={topN(contagens.keywords, 10)}
                      titulo="Top 10 Palavras-chave"
                      cor={TEMA_GRAFICO.paleta[2]}
                      onSelecionar={(nome) => navegarPara('Palavra-chave', nome)}
                    />
                  </Card>
                  <Card>
                    <RankingClicavel
                      dados={topN(contagens.coorientadores, 10)}
                      titulo="Top 10 Coorientadores"
                      cor={TEMA_GRAFICO.paleta[1]}
                      onSelecionar={(nome) => navegarPara('Co-orientador', nome)}
                    />
                  </Card>
                  <Card>
                    <RankingClicavel
                      dados={topN(contagens.macrotemas, 10)}
                      titulo="Top 10 Macrotemas"
                      cor={TEMA_GRAFICO.paleta[4]}
                      onSelecionar={(nome) => navegarPara('Macrotema', nome)}
                    />
                  </Card>
                </div>
              </div>
            ),
          },
          {
            valor: 'volumes',
            rotulo: <><GraduationCap size={15} aria-hidden /> Volumes e Genealogia</>,
            conteudo: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Orientador com maior número de orientações:</p>
                    {topOriVol && (
                      <Chip onClick={() => navegarPara('Orientador', topOriVol[0])}>
                        <School size={14} aria-hidden /> {topOriVol[0]} ({topOriVol[1]} orientações)
                      </Chip>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Coorientador com maior número de coorientações:</p>
                    {topCooriVol && (
                      <Chip onClick={() => navegarPara('Co-orientador', topCooriVol[0])}>
                        <Handshake size={14} aria-hidden /> {topCooriVol[0]} ({topCooriVol[1]} coorientações)
                      </Chip>
                    )}
                  </div>
                </Card>

                <Card className="space-y-3">
                  {genealogia.formadores.length > 0 ? (
                      <Expander titulo={`Formadores de Professores (${genealogia.formadores.length})`} icone={<Sprout size={16} aria-hidden />} persistir={false}>
                        <p className="mb-3 text-xs leading-relaxed text-slate-400">
                          Nomes que aparecem na autoria e na orientação de registros do recorte. Isso não confirma identidade, sequência temporal ou atuação atual.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {genealogia.formadores.map((f) => (
                            <Chip key={f} onClick={() => navegarPara('Orientador', f)}>
                              <GraduationCap size={14} aria-hidden /> {f}
                            </Chip>
                          ))}
                        </div>
                      </Expander>
                    ) : (
                      <div className="space-y-2"><p className="flex items-center gap-1.5 text-sm font-medium text-slate-200"><Sprout size={15} aria-hidden /> Formadores de Professores</p><Aviso>Nenhum ciclo genealógico detectado nesta amostra.</Aviso></div>
                    )}
                  {genealogia.mestreDoutor.length > 0 ? (
                      <Expander titulo={`Autores com dissertação e tese na mesma coleção (${genealogia.mestreDoutor.length})`} icone={<User size={16} aria-hidden />} persistir={false}>
                        <div className="flex flex-wrap gap-1.5">
                          {genealogia.mestreDoutor.map(([autor, progs]) => (
                            <Chip key={autor} onClick={() => navegarPara('Autor', autor)} title={progs.join(', ')}>
                              <User size={14} aria-hidden /> {autor}
                            </Chip>
                          ))}
                        </div>
                      </Expander>
                    ) : (
                      <div className="space-y-2"><p className="flex items-center gap-1.5 text-sm font-medium text-slate-200"><User size={15} aria-hidden /> Autores com dissertação e tese na mesma coleção</p><Aviso>
                        Nenhum autor com Dissertação + Tese no mesmo programa foi encontrado.
                      </Aviso></div>
                    )}
                </Card>
              </div>
            ),
          },
          {
            valor: 'betweenness',
            rotulo: <><Waypoints size={15} aria-hidden /> Intermediação</>,
            conteudo: (
              <div className="space-y-4">
                <Aviso>
                  <strong>O que é Betweenness (Intermediação)?</strong> Mede quantas vezes um nó
                  atua como &quot;ponte&quot; no caminho mais curto entre outros nós. Alto
                  Betweenness = elo que conecta bolhas de conhecimento diferentes nos caminhos calculados. Isso não comprova controle real do fluxo
                  de informação ou interdisciplinaridade.
                </Aviso>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="space-y-3">
                    {botaoSna('Orientador (Maior Betweenness):', topSna.oriBet, 'Orientador', <School size={14} aria-hidden />)}
                    {botaoSna('Coorientador (Maior Betweenness):', topSna.cooriBet, 'Co-orientador', <Handshake size={14} aria-hidden />)}
                  </Card>
                  <Card className="space-y-3">
                    {botaoSna('Registro classificado como tese (maior intermediação):', topSna.teseBet, 'Documento', <FileText size={14} aria-hidden />)}
                    {botaoSna('Registro classificado como dissertação (maior intermediação):', topSna.dissBet, 'Documento', <FileText size={14} aria-hidden />)}
                  </Card>
                </div>
              </div>
            ),
          },
          {
            valor: 'closeness',
            rotulo: <><Target size={15} aria-hidden /> Proximidade</>,
            conteudo: (
              <div className="space-y-4">
                <Aviso>
                  <strong>O que é Closeness (Proximidade)?</strong> Mede a distância média de um nó
                  para todos os outros. Alto Closeness = estar no &quot;centro nervoso&quot; do
                  ecossistema, acessando ou disseminando conhecimento com menos saltos.
                </Aviso>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="space-y-3">
                    {botaoSna('Orientador Mais Central:', topSna.oriClose, 'Orientador', <School size={14} aria-hidden />)}
                    {botaoSna('Coorientador Mais Central:', topSna.cooriClose, 'Co-orientador', <Handshake size={14} aria-hidden />)}
                  </Card>
                  <Card className="space-y-3">
                    {botaoSna('Registro classificado como tese (maior proximidade):', topSna.teseClose, 'Documento', <FileText size={14} aria-hidden />)}
                    {botaoSna('Registro classificado como dissertação (maior proximidade):', topSna.dissClose, 'Documento', <FileText size={14} aria-hidden />)}
                  </Card>
                </div>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
