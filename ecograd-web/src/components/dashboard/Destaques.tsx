import { useMemo, type ReactNode } from 'react';
import { ChartColumn, FileText, GraduationCap, Handshake, Radius, School, Sprout, Target, Trophy, User, Waypoints } from 'lucide-react';
import { AnalisesOcultas, Aviso, Card, Chip, Expander } from '@/components/ui/primitives';
import { temLigacaoRadial } from '@/lib/rede-radial';
import { calcularGenealogia, calcularTopologia, topologiaSemSinal } from '@/lib/destaques';
import type { AnaliseOculta } from '@/lib/relevancia';
import { RedeRadial } from './RedeRadial';
import { RankingClicavel, TEMA_GRAFICO } from '@/components/ui/Chart';
import { Tabs, type AbaDef } from '@/components/ui/Tabs';
import { formatarDecimal } from '@/lib/utils';
import { topN } from '@/lib/lexicon';
import { useEcoGradStore, type StatusSNA } from '@/stores/useEcoGradStore';
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
  /**
   * A aba de intermediação e proximidade depende do cálculo SNA, que roda em
   * worker. As demais não dependem: por isso o bloco inteiro é renderizado
   * assim que os documentos chegam, e só ela espera.
   */
  statusSNA: StatusSNA;
}

/**
 * Destaques do Ecossistema: rankings por volume, genealogia acadêmica e
 * liderança topológica (Betweenness/Closeness).
 * Transcrição de Principal.py:432-596.
 */
export function Destaques({ docs, snaGlobal, contagens, conjuntos, niveis, statusSNA }: Props) {
  const navegarPara = useEcoGradStore((s) => s.navegarPara);

  const genealogia = useMemo(() => calcularGenealogia(docs, conjuntos), [docs, conjuntos]);
  const topSna = useMemo(() => calcularTopologia(snaGlobal, conjuntos, niveis), [snaGlobal, conjuntos, niveis]);

  const topOriVol = topN(contagens.orientadores, 1)[0];
  const topCooriVol = topN(contagens.coorientadores, 1)[0];

  /**
   * Um "Top 10" com uma barra só não é um ranking: é um nome desenhado como
   * gráfico. Cada ranking degenerado sai da grade, e se todos saírem a aba
   * inteira some — com o motivo declarado na nota abaixo das abas.
   */
  const rankings = ([
    { chave: 'orientadores', titulo: 'Top 10 Orientadores', cor: TEMA_GRAFICO.paleta[0], tipo: 'Orientador', dados: contagens.orientadores },
    { chave: 'keywords', titulo: 'Top 10 Palavras-chave', cor: TEMA_GRAFICO.paleta[2], tipo: 'Palavra-chave', dados: contagens.keywords },
    { chave: 'coorientadores', titulo: 'Top 10 Coorientadores', cor: TEMA_GRAFICO.paleta[1], tipo: 'Co-orientador', dados: contagens.coorientadores },
    { chave: 'macrotemas', titulo: 'Top 10 Macrotemas', cor: TEMA_GRAFICO.paleta[4], tipo: 'Macrotema', dados: contagens.macrotemas },
  ] as const satisfies readonly { chave: string; titulo: string; cor: string; tipo: TipoBusca; dados: Map<string, number> }[])
    .filter((r) => r.dados.size > 1);

  const temVolumes = !!topOriVol || !!topCooriVol;
  const temGenealogia = genealogia.formadores.length > 0 || genealogia.mestreDoutor.length > 0;
  // Enquanto o SNA não termina, a aba precisa existir para explicar a espera.
  // Pronta e com tudo zerado, ela mostraria 0,000000 como se fosse medida.
  const semSinalTopologico = statusSNA === 'pronto' && !!snaGlobal && topologiaSemSinal(topSna);
  const temRadial = temLigacaoRadial(docs);

  const abas: AbaDef[] = [];
  const ocultas: AnaliseOculta[] = [];

  /**
   * Intermediação e Proximidade só existem depois do SNA. Em vez de esconder o
   * bloco inteiro até o worker terminar, cada aba declara o próprio estado.
   */
  const comSna = (conteudo: ReactNode) => {
    if (statusSNA === 'pronto' && snaGlobal) return conteudo;
    const mensagem = statusSNA === 'calculando'
      ? 'Calculando as métricas da rede. Os valores aparecem aqui assim que o cálculo terminar.'
      : statusSNA === 'erro'
        ? 'O cálculo das métricas da rede falhou. Recarregue a análise para tentar de novo.'
        : statusSNA === 'cancelado'
          ? 'O cálculo das métricas da rede foi cancelado. Reinicie-o no bloco Indicadores e métodos da rede.'
          : 'Estas métricas dependem do cálculo da rede, que ainda não foi executado para este recorte. Abra o bloco Indicadores e métodos da rede para acompanhá-lo.';
    return <Aviso>{mensagem}</Aviso>;
  };

  const botaoSna = (rotulo: string, par: [string, number], tipo: TipoBusca, icone: ReactNode) =>
    par[0] === 'Nenhum' ? null : (
      <div className="space-y-1">
        <p className="text-xs text-slate-400">{rotulo}</p>
        <Chip tipo={tipo} onClick={() => navegarPara(tipo, par[0])} title={par[0]}>
          {icone} {par[0].length > 60 ? `${par[0].slice(0, 60)}…` : par[0]} ·{' '}
          <span className="tabular-nums text-slate-500">{formatarDecimal(par[1])}</span>
        </Chip>
      </div>
    );

  if (rankings.length > 0) {
    abas.push({
      valor: 'graficos',
      rotulo: <><ChartColumn size={15} aria-hidden /> Top 10</>,
      conteudo: (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Clique em qualquer barra para abrir o dossiê da entidade no Motor de Busca.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {rankings.map((r) => (
              <Card key={r.chave}>
                <RankingClicavel
                  dados={topN(r.dados, 10)}
                  titulo={r.titulo}
                  cor={r.cor}
                  onSelecionar={(nome) => navegarPara(r.tipo, nome)}
                />
              </Card>
            ))}
          </div>
        </div>
      ),
    });
  } else {
    ocultas.push({ nome: 'Top 10', motivo: 'nenhum ranking do recorte tem mais de um nome a ordenar' });
  }

  if (temVolumes || temGenealogia) {
    abas.push({
      valor: 'volumes',
      rotulo: <><GraduationCap size={15} aria-hidden /> Volumes e Genealogia</>,
      conteudo: (
        <div className="grid gap-4 lg:grid-cols-2">
          {temVolumes && (
            <Card className="space-y-3">
              {topOriVol && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Orientador com maior número de orientações:</p>
                  <Chip tipo="Orientador" onClick={() => navegarPara('Orientador', topOriVol[0])}>
                    <School size={14} aria-hidden /> {topOriVol[0]} ({topOriVol[1]} orientações)
                  </Chip>
                </div>
              )}
              {topCooriVol && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Coorientador com maior número de coorientações:</p>
                  <Chip tipo="Co-orientador" onClick={() => navegarPara('Co-orientador', topCooriVol[0])}>
                    <Handshake size={14} aria-hidden /> {topCooriVol[0]} ({topCooriVol[1]} coorientações)
                  </Chip>
                </div>
              )}
            </Card>
          )}

          <Card className="space-y-3">
            {genealogia.formadores.length > 0 ? (
                <Expander titulo={`Formadores de Professores (${genealogia.formadores.length})`} icone={<Sprout size={16} aria-hidden />} persistir={false}>
                  <p className="mb-3 text-xs leading-relaxed text-slate-400">
                    Nomes que aparecem na autoria e na orientação de registros do recorte. Isso não confirma identidade, sequência temporal ou atuação atual.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {genealogia.formadores.map((f) => (
                      <Chip key={f} tipo="Orientador" onClick={() => navegarPara('Orientador', f)}>
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
                      <Chip key={autor} tipo="Autor" onClick={() => navegarPara('Autor', autor)} title={progs.join(', ')}>
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
    });
  } else {
    ocultas.push({ nome: 'Volumes e Genealogia', motivo: 'o recorte não tem orientação registrada nem ciclo genealógico' });
  }

  if (!semSinalTopologico) {
    abas.push({
      valor: 'topologia',
      rotulo: <><Waypoints size={15} aria-hidden /> Intermediação e proximidade</>,
      conteudo: (comSna(
        <div className="space-y-8">
          <section className="space-y-4" aria-label="Intermediação">
            <h3 className="flex items-center gap-2 text-base font-semibold"><Waypoints size={17} aria-hidden /> Intermediação (Betweenness)</h3>
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
          </section>

          <section className="space-y-4 border-t border-eco-border pt-6" aria-label="Proximidade">
            <h3 className="flex items-center gap-2 text-base font-semibold"><Target size={17} aria-hidden /> Proximidade (Closeness)</h3>
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
          </section>
        </div>
      )
      ),
    });
  } else {
    ocultas.push({ nome: 'Intermediação e proximidade', motivo: 'a rede do recorte não tem caminhos: toda intermediação e proximidade é zero' });
  }

  if (temRadial) {
    abas.push({
      valor: 'radial',
      rotulo: <><Radius size={15} aria-hidden /> Diagrama radial</>,
      conteudo: <RedeRadial docs={docs} />,
    });
  } else {
    ocultas.push({ nome: 'Diagrama radial', motivo: 'nenhum registro tem orientação conjunta, duas palavras-chave ou pessoa entre dois macrotemas' });
  }

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Trophy size={18} /> Destaques do Ecossistema
      </h3>

      {abas.length > 0
        ? <Tabs chaveSessao="destaques" abas={abas} />
        : <Aviso>Nenhum destaque descreve este recorte: ele não tem ranking, orientação, rede nem ligação a desenhar.</Aviso>}
      <AnalisesOcultas itens={ocultas} />
    </section>
  );
}
