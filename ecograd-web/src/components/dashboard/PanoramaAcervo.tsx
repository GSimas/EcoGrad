import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Library } from 'lucide-react';
import { Aviso, Card, Carregando, Kpi } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO, barrasHorizontais, useCliqueEmBarra } from '@/components/ui/Chart';
import { AbrirItemDoAcervo, type AlvoDoAcervo } from './AbrirItemDoAcervo';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { useSessionField } from '@/hooks/useSessionField';
import { carregarCobertura, type PanoramaAcervo as Acervo } from '@/lib/colecoes';

const n = (v: number) => v.toLocaleString('pt-BR');
const pct = (parte: number, todo: number) => (todo ? `${Math.round((parte / todo) * 100)}%` : '—');

/**
 * As quatro leituras do mesmo ranking. Cada uma conta uma coisa diferente, e o
 * rótulo do eixo diz qual — "registros" e "ocorrências" não são sinônimos aqui.
 */
const DIMENSOES = ['Coleções', 'Orientadores', 'Coorientadores', 'Palavras-chave'] as const;
type Dimensao = typeof DIMENSOES[number];

const RANKING: Record<Dimensao, {
  dados: (p: Acervo) => Array<[string, number]>;
  titulo: string; unidade: string; coluna: string; descricao: string;
  /** O que cada barra representa, ao ser aberta: entidade de busca ou coleção. */
  abre: AlvoDoAcervo['tipo'];
}> = {
  'Coleções': {
    dados: (p) => p.maioresColecoes,
    titulo: 'Maiores coleções', unidade: 'Registros (n)', coluna: 'Coleção', abre: 'Coleção',
    descricao: 'Barras: número de registros (n) nas 15 coleções com mais registros. Tamanho de coleção não mede qualidade nem atividade atual do programa.',
  },
  'Orientadores': {
    dados: (p) => p.topOrientadores,
    titulo: 'Quem mais orientou', unidade: 'Orientações (n)', coluna: 'Orientador', abre: 'Orientador',
    descricao: 'Barras: número de registros (n) em que cada pessoa consta como orientadora, nas 15 com mais ocorrências. Contagem por grafia do nome, sem unificar variantes: quem aparece escrito de dois jeitos é contado duas vezes. Volume de orientação não mede qualidade nem disponibilidade para orientar.',
  },
  'Coorientadores': {
    dados: (p) => p.topCoorientadores,
    titulo: 'Quem mais coorientou', unidade: 'Coorientações (n)', coluna: 'Coorientador', abre: 'Co-orientador',
    descricao: 'Barras: número de registros (n) em que cada pessoa consta como coorientadora, nas 15 com mais ocorrências. Mesma ressalva da orientação: a contagem é por grafia do nome e não mede qualidade.',
  },
  'Palavras-chave': {
    dados: (p) => p.topPalavrasChave,
    titulo: 'Palavras-chave mais declaradas', unidade: 'Ocorrências (n)', coluna: 'Palavra-chave', abre: 'Palavra-chave',
    descricao: 'Barras: número de registros (n) que declaram cada termo, nos 15 mais frequentes. São as palavras-chave dos próprios autores, normalizadas sem acento e em minúsculas; termos sinônimos não são reunidos. Frequência descreve o acervo, não a importância do tema.',
  },
};

/**
 * O acervo inteiro em números, sem depender do que foi carregado.
 *
 * Os valores vêm prontos do build (`panoramaAcervo`, em scripts/collection-metadata.mjs):
 * contar pessoas ou trabalhos distintos de todo o acervo exigiria as duas bases
 * completas no navegador, 63 MB que ninguém pediu para baixar. As definições são
 * as mesmas do Dashboard, para o mesmo nome significar a mesma coisa nos dois.
 */
export function PanoramaAcervo({ aoNavegar }: { aoNavegar: () => void }) {
  const [dimensao, setDimensao] = useSessionField<Dimensao>('panorama.ranking', 'Coleções');
  const [alvo, setAlvo] = useState<AlvoDoAcervo | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['colecoes-cobertura', 4],
    queryFn: ({ signal }) => carregarCobertura(signal),
    staleTime: Infinity,
  });

  if (isLoading) return <Carregando texto="Carregando o panorama do acervo..." />;
  if (!data) {
    return <Aviso tipo="aviso">
      Panorama do acervo indisponível
      {error instanceof Error ? `: ${error.message}` : '. A prévia das coleções ainda não está disponível.'}
    </Aviso>;
  }

  const p = data.panorama;
  const periodo = p.inicio !== null && p.fim !== null ? `${p.inicio}–${p.fim}` : 'não informado';
  const contexto = {
    fonte: 'Repositório Institucional da UFSC (recorte local do EcoGrad)',
    baseVersao: data.version, colecoes: p.colecoes, registrosCarregados: p.registros,
    periodoObservado: periodo, entidade: null, pagina: 'Panorama UFSC — acervo', filtros: null,
    limites: 'Todo o acervo coletado, não apenas as coleções carregadas na análise. Um trabalho depositado em duas coleções conta um registro em cada uma; "trabalhos únicos" reúne por link do repositório. Nomes de pessoa são contados como aparecem nos metadados, sem unificação de grafias.',
  };

  const ranking = RANKING[DIMENSOES.includes(dimensao) ? dimensao : 'Coleções'];
  const dados = ranking.dados(p);
  // O catálogo ('ppg' ou 'tcc') não está no ranking, e é o que diz de onde baixar
  // a coleção. A prévia por coleção tem, e já está carregada aqui.
  const escolher = (nome: string) => setAlvo(ranking.abre === 'Coleção'
    ? { tipo: 'Coleção', nome, catalogo: data.colecoes.find((c) => c.nome === nome)?.tipo }
    : { tipo: ranking.abre, nome });

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Library size={20} aria-hidden /> O acervo em números
        </h2>
        <p className="text-sm text-slate-400">
          Todo o acervo coletado do Repositório Institucional, e não apenas as coleções da sua análise.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Registros" valor={p.registros} ajuda="Um trabalho depositado em duas coleções conta uma vez em cada." />
        <Kpi rotulo="Trabalhos únicos" valor={p.trabalhosUnicos} ajuda="Links distintos do repositório, mais os registros sem link, que nunca se fundem." />
        <Kpi rotulo="Coleções" valor={p.colecoes} ajuda={`${n(p.colecoesPpg)} de pós-graduação e ${n(p.colecoesTcc)} de graduação e especialização.`} />
        <Kpi rotulo="Período observado" valor={periodo} ajuda={`${n(p.semAno)} registros sem ano informado.`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Autores" valor={p.autores} ajuda="Nomes distintos na autoria, como aparecem nos metadados." />
        <Kpi rotulo="Orientadores" valor={p.orientadores} ajuda="Nomes distintos na orientação." />
        <Kpi rotulo="Coorientadores" valor={p.coorientadores} ajuda="Nomes distintos na coorientação." />
        <Kpi rotulo="Palavras-chave" valor={p.palavrasChave} ajuda={`Termos distintos declarados pelos autores. ${n(p.macrotemas)} macrotemas atribuídos pelo pipeline.`} />
      </div>

      <p className="text-xs text-slate-400">
        As mesmas pessoas podem aparecer sob grafias diferentes: a contagem reproduz os metadados do
        repositório, sem unificar nomes. Ela não mede produtividade nem vínculo institucional atual.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Grafico
            altura={340}
            larguraMinima={420}
            leitura={{
              titulo: 'Registros por ano',
              descricao: 'Linha: número de registros (n) por ano de publicação, em todo o acervo. Registros sem ano ficam fora. Os anos mais recentes costumam estar incompletos, porque o depósito no repositório é posterior à defesa.',
              linhas: p.porAno.map(([ano, total]) => ({ ano, total })),
              colunas: [{ chave: 'ano', rotulo: 'Ano' }, { chave: 'total', rotulo: 'Registros (n)' }],
              contexto,
            }}
            option={{
              title: { text: 'Registros por ano', left: 'center', textStyle: { fontSize: 13, color: TEMA_GRAFICO.texto } },
              grid: { left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: p.porAno.map(([ano]) => String(ano)), axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } }, axisLabel: { color: TEMA_GRAFICO.texto, fontSize: 11 } },
              yAxis: { type: 'value', name: 'Registros (n)', minInterval: 1, axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } }, splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } }, axisLabel: { color: TEMA_GRAFICO.texto } },
              series: [{ type: 'line', smooth: true, showSymbol: false, areaStyle: { opacity: 0.18 }, itemStyle: { color: TEMA_GRAFICO.paleta[0] }, data: p.porAno.map(([, total]) => total) }],
            }}
          />
        </Card>

        <Card>
          <Grafico
            altura={340}
            leitura={{
              titulo: 'Registros por tipo de trabalho',
              descricao: 'Setores: número de registros (n) por tipo acadêmico declarado no metadado. O tipo reproduz a base, inclusive inconsistências; não foi inferido pelo nome da coleção.',
              linhas: p.porNivel.map(([nivel, total]) => ({ nivel, total })),
              colunas: [{ chave: 'nivel', rotulo: 'Tipo' }, { chave: 'total', rotulo: 'Registros (n)' }],
              contexto,
            }}
            option={{
              title: { text: 'Tipo de trabalho', left: 'center', textStyle: { fontSize: 13, color: TEMA_GRAFICO.texto } },
              tooltip: { trigger: 'item' },
              legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
              series: [{
                type: 'pie', radius: ['40%', '65%'], center: ['50%', '46%'],
                data: p.porNivel.map(([nome, valor]) => ({ name: nome, value: valor })),
                label: { color: '#FFFFFF', backgroundColor: '#0E1117', padding: [3, 5], borderRadius: 3, position: 'inside', formatter: '{d}%' },
                labelLayout: { hideOverlap: true },
                itemStyle: { borderColor: '#0E1117', borderWidth: 2 },
              }],
            }}
          />
        </Card>

      </div>

      <Card className="space-y-4">
        <GrupoOpcoes rotulo="Ranking do acervo" opcoes={DIMENSOES} valor={dimensao} onChange={setDimensao} />
        <RankingDoAcervo dados={dados} ranking={ranking} contexto={contexto} aoEscolher={escolher} />
      </Card>

      <p className="text-xs text-slate-400">
        Cobertura de metadados no acervo: {pct(p.comResumo, p.registros)} com resumo,
        {' '}{pct(p.comPalavras, p.registros)} com palavras-chave, {pct(p.comOrientador, p.registros)} com orientação,
        {' '}{pct(p.comFonte, p.registros)} com link da fonte e {pct(p.comPdf, p.registros)} com PDF aberto no
        repositório. Campo preenchido não comprova qualidade nem acesso ao texto completo, e o acesso
        continua sendo decidido pelo repositório.
      </p>
      <AbrirItemDoAcervo alvo={alvo} aoFechar={() => setAlvo(null)} aoNavegar={aoNavegar} cobertura={data.colecoes} />
    </section>
  );
}

/**
 * O ranking em si, num componente próprio: o gancho de clique é um hook e não
 * pode ficar depois dos `return` de carregamento do painel.
 *
 * Clicar numa barra não abre nada direto — pergunta antes, porque abrir troca a
 * análise ativa e baixa coleções. A tabela oferece o mesmo caminho pelo teclado.
 */
function RankingDoAcervo({ dados, ranking, contexto, aoEscolher }: {
  dados: Array<[string, number]>;
  ranking: typeof RANKING[Dimensao];
  contexto: Record<string, unknown>;
  aoEscolher: (nome: string) => void;
}) {
  const aoCriar = useCliqueEmBarra(dados, aoEscolher);
  const titulo = `${ranking.titulo} (top 15)`;
  const base = barrasHorizontais(dados, titulo, undefined, ranking.unidade);
  return <Grafico
    altura={440}
    larguraMinima={520}
    onReady={aoCriar}
    leitura={{
      titulo,
      descricao: `${ranking.descricao} Clique numa barra — ou use "Explorar" na tabela — para abrir o item no EcoGrad.`,
      linhas: dados.map(([item, total]) => ({ item, total })),
      colunas: [{ chave: 'item', rotulo: ranking.coluna }, { chave: 'total', rotulo: ranking.unidade }],
      contexto,
      onAbrir: (l) => aoEscolher(String(l.item)),
      rotuloAbrir: (l) => String(l.item),
    }}
    // O cursor avisa que a barra leva a algum lugar.
    option={{ ...base, series: [{ ...((base.series as unknown[])[0] as object), cursor: 'pointer' }] }}
  />;
}
