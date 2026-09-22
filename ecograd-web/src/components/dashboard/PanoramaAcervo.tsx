import { useQuery } from '@tanstack/react-query';
import { Library } from 'lucide-react';
import { Aviso, Card, Carregando, Kpi } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO, barrasHorizontais } from '@/components/ui/Chart';
import { carregarCobertura } from '@/lib/colecoes';

const n = (v: number) => v.toLocaleString('pt-BR');
const pct = (parte: number, todo: number) => (todo ? `${Math.round((parte / todo) * 100)}%` : '—');

/**
 * O acervo inteiro em números, sem depender do que foi carregado.
 *
 * Os valores vêm prontos do build (`panoramaAcervo`, em scripts/collection-metadata.mjs):
 * contar pessoas ou trabalhos distintos de todo o acervo exigiria as duas bases
 * completas no navegador, 63 MB que ninguém pediu para baixar. As definições são
 * as mesmas do Dashboard, para o mesmo nome significar a mesma coisa nos dois.
 */
export function PanoramaAcervo() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['colecoes-cobertura', 3],
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

  const cobertura: Array<[string, number]> = [
    ['Com resumo', p.comResumo],
    ['Com palavras-chave', p.comPalavras],
    ['Com orientação', p.comOrientador],
    ['Com link da fonte', p.comFonte],
    ['Com PDF aberto', p.comPdf],
  ];

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

        <Card>
          <Grafico
            altura={400}
            larguraMinima={460}
            leitura={{
              titulo: 'Maiores coleções do acervo',
              descricao: 'Barras: número de registros (n) nas 15 coleções com mais registros. Tamanho de coleção não mede qualidade nem atividade atual do programa.',
              linhas: p.maioresColecoes.map(([colecao, total]) => ({ colecao, total })),
              colunas: [{ chave: 'colecao', rotulo: 'Coleção' }, { chave: 'total', rotulo: 'Registros (n)' }],
              contexto,
            }}
            option={barrasHorizontais(p.maioresColecoes, 'Maiores coleções (top 15)', undefined, 'Registros (n)')}
          />
        </Card>

        <Card>
          <Grafico
            altura={400}
            larguraMinima={460}
            leitura={{
              titulo: 'Cobertura de metadados',
              descricao: 'Barras: quantos dos registros do acervo trazem cada campo. Presença de metadado não comprova qualidade nem acesso ao texto completo — só diz que o campo está preenchido.',
              linhas: cobertura.map(([campo, total]) => ({ campo, total, proporcao: pct(total, p.registros) })),
              colunas: [{ chave: 'campo', rotulo: 'Campo' }, { chave: 'total', rotulo: 'Registros (n)' }, { chave: 'proporcao', rotulo: 'Do acervo' }],
              contexto,
            }}
            option={barrasHorizontais(cobertura, `Cobertura de metadados (de ${n(p.registros)} registros)`, undefined, 'Registros (n)')}
          />
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Presença de metadado não comprova qualidade nem acesso ao texto completo. “Com PDF aberto”
        conta os registros em que o repositório serve ao menos um PDF publicamente
        ({pct(p.comPdf, p.registros)} do acervo); o acesso continua sendo decidido pelo repositório.
      </p>
    </section>
  );
}
