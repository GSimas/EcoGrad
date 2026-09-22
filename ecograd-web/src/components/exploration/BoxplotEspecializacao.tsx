import { useMemo } from 'react';
import { Boxes } from 'lucide-react';
import { AnalisesOcultas, Aviso, Card, Expander } from '@/components/ui/primitives';
import type { AnaliseOculta } from '@/lib/relevancia';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { useSessionField } from '@/hooks/useSessionField';
import { formatarNumero } from '@/lib/utils';
import {
  caixasQL,
  entidadesDisponiveis,
  gerarBaseBoxplotQL,
  NIVEIS_QL,
  TIPOS_BOXPLOT,
  type TipoBoxplot,
} from '@/lib/boxplot-ql';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { EChartsOption } from 'echarts';
import type { TipoBusca } from '@/types';

/** Limite do `max_selections=5` do multiselect original. */
const MAXIMO = 5;

/**
 * Boxplot de Especialização (Quociente Locacional por nível acadêmico).
 * Transcrição de `pages/1_Avançado.py:770-838` sobre `gerar_base_boxplot_ql`
 * (backend.py:1862).
 */
export function BoxplotEspecializacao() {
  const docs = useEcoGradStore((s) => s.docs);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const [tipo, setTipo] = useSessionField<TipoBoxplot>('grafico.boxplot-ql.tipo', 'Orientador');
  const [selecionadas, setSelecionadas] = useSessionField<string[]>('grafico.boxplot-ql.entidades', []);

  const opcoes = useMemo(() => entidadesDisponiveis(docs, tipo), [docs, tipo]);
  // A seleção fica guardada na sessão; trocar o tipo ou o recorte pode deixá-la
  // apontando para nomes que não existem mais nesta lista.
  const validas = useMemo(() => selecionadas.filter((e) => opcoes.includes(e)).slice(0, MAXIMO), [selecionadas, opcoes]);
  const efetivas = validas.length > 0 ? validas : opcoes.slice(0, 3);

  const linhas = useMemo(() => gerarBaseBoxplotQL(docs, tipo, efetivas), [docs, tipo, efetivas]);
  const caixas = useMemo(() => caixasQL(linhas), [linhas]);

  const contexto = {
    tipoEntidade: tipo,
    entidades: efetivas,
    observacoesPorCaixa: NIVEIS_QL.length,
    niveis: [...NIVEIS_QL],
    limiteInterpretacao: 'QL é razão de concentração por nível; três observações por caixa não descrevem distribuição.',
  };

  const option = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
    grid: { left: 32, right: 24, top: 24, bottom: 96, containLabel: true },
    xAxis: {
      type: 'category',
      data: caixas.map((c) => c.entidade),
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      axisLabel: { color: TEMA_GRAFICO.texto, fontSize: 11, width: 130, overflow: 'truncate', interval: 0 },
    },
    yAxis: {
      type: 'value',
      name: 'Índice de especialização (QL)',
      nameLocation: 'middle',
      nameGap: 44,
      nameTextStyle: { color: TEMA_GRAFICO.texto },
      splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
    },
    series: [
      {
        name: 'Faixa dos três níveis',
        type: 'boxplot',
        data: caixas.map((c) => c.resumo),
        itemStyle: { color: 'rgba(52, 152, 219, 0.28)', borderColor: '#3498DB' },
        tooltip: {
          // No boxplot do ECharts, `data[0]` é o índice da categoria; os cinco
          // números do resumo vêm de 1 a 5.
          formatter: (p: unknown) => {
            const dado = p as { name: string; data: number[] };
            return [
              dado.name,
              `Máximo: ${dado.data[5].toFixed(2)}`,
              `Q3: ${dado.data[4].toFixed(2)}`,
              `Mediana: ${dado.data[3].toFixed(2)}`,
              `Q1: ${dado.data[2].toFixed(2)}`,
              `Mínimo: ${dado.data[1].toFixed(2)}`,
            ].join('\n');
          },
        },
        // A referência de QL = 1 vive aqui, e não numa série vazia: uma série
        // sem dados não ancora `markLine` em eixo de categoria.
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: true, formatter: 'QL = 1', color: TEMA_GRAFICO.texto, fontSize: 11 },
          lineStyle: { color: '#7F8C8D', type: 'dashed' as const, width: 1 },
          data: [{ yAxis: 1 }],
        },
      },
      // Os três pontos por entidade ficam visíveis, como o `points="all"` do
      // original: com n = 3, eles são a informação; a caixa é só o contorno.
      ...NIVEIS_QL.map((nivel, i) => ({
        name: nivel,
        type: 'scatter' as const,
        symbolSize: 11,
        itemStyle: { color: TEMA_GRAFICO.paleta[i], opacity: 0.9 },
        data: caixas.flatMap((c, indice) => {
          const ponto = c.valores.find((v) => v.Nível === nivel);
          return ponto ? [{ value: [indice, ponto['Valor QL']], ponto }] : [];
        }),
        tooltip: {
          formatter: (p: unknown) => {
            const ponto = (p as { data: { ponto: { Entidade: string; Nível: string; 'Valor QL': number; Documentos: number; 'Total da entidade': number } } }).data.ponto;
            return [
              ponto.Entidade,
              `${ponto.Nível}: QL ${ponto['Valor QL'].toFixed(2)}`,
              `${formatarNumero(ponto.Documentos)} de ${formatarNumero(ponto['Total da entidade'])} documentos da entidade`,
            ].join('\n');
          },
        },
      })),
    ],
  }), [caixas]);

  const ocultas: AnaliseOculta[] = caixas.length === 0 && opcoes.length > 0
    ? [{ nome: 'Boxplot de especialização', motivo: 'nenhuma das entidades escolhidas tem documentos nesta seleção' }]
    : [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Boxes size={18} aria-hidden /> Boxplot de Especialização (QL)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Compara o Quociente Locacional de até {MAXIMO} entidades nos três níveis acadêmicos da seleção.
        </p>
      </div>

      {opcoes.length === 0 ? (
        <Aviso tipo="aviso">Não há entidades do tipo {tipo} na seleção carregada. Escolha outro tipo ou amplie as coleções.</Aviso>
      ) : (
        <>
          <Card className="space-y-4">
            <GrupoOpcoes rotulo="Tipo no eixo X" opcoes={TIPOS_BOXPLOT} valor={tipo} onChange={(v) => { setTipo(v); setSelecionadas([]); }} />
            <MultiSelect
              rotulo={`Entidades a comparar (até ${MAXIMO})`}
              opcoes={opcoes}
              selecionados={validas}
              onChange={(v) => setSelecionadas(v.slice(0, MAXIMO))}
              placeholder={`Pesquise ${tipo.toLowerCase()}...`}
            />
            <p className="text-sm text-slate-300" role="status">
              {validas.length === 0
                ? `Sem escolha própria, a comparação usa ${efetivas.length === 1 ? 'a entidade' : `as ${efetivas.length} entidades`} de maior volume: ${efetivas.join(', ') || '—'}.`
                : `${validas.length} de ${MAXIMO} ${validas.length === 1 ? 'entidade selecionada' : 'entidades selecionadas'}, entre ${formatarNumero(opcoes.length)} disponíveis.`}
              {validas.length < selecionadas.length && ' Nomes que não existem neste recorte foram descartados.'}
            </p>
          </Card>

          <Expander titulo="O que o Quociente Locacional por nível significa">
            <div className="space-y-3 text-sm text-slate-300">
              <p>Para cada entidade e cada nível, QL = (documentos da entidade naquele nível ÷ documentos da entidade) ÷ (documentos do nível na seleção ÷ documentos da seleção). <strong>QL acima de 1</strong> indica concentração naquele nível acima da proporção geral da seleção; abaixo de 1, o contrário. É uma razão relativa ao recorte carregado — não à universidade inteira, nem ao campo.</p>
              <p>Teses e Dissertações são os níveis canônicos; TCC e demais categorias caem em “Outros”, como no modelo original.</p>
              <p><strong>Cada caixa resume exatamente três valores</strong> — um por nível. Três observações não descrevem distribuição: a caixa aqui é uma forma compacta de comparar os três níveis lado a lado, e os quartis são interpolação entre eles, não contagem de casos. Os três pontos estão desenhados por cima justamente para que se leia o que existe. Para a distribuição real por documento, use a tabela.</p>
              <p>Quem tem poucos documentos alcança QL extremo com facilidade: passe o mouse ou abra a tabela para ver quantos documentos sustentam cada ponto antes de comparar entidades de volumes muito diferentes.</p>
            </div>
          </Expander>

          {caixas.length === 0 ? (
            <Aviso>Nenhuma das entidades escolhidas tem documentos na seleção atual.</Aviso>
          ) : (
            <Card>
              <Grafico
                altura={520}
                larguraMinima={Math.max(420, caixas.length * 150)}
                leitura={{
                  titulo: 'Especialização por nível acadêmico (QL)',
                  descricao: 'Uma caixa por entidade, resumindo os três valores de QL — Teses, Dissertações e Outros. Os pontos coloridos são esses três valores. A linha tracejada marca QL = 1, a proporção geral da seleção. QL é razão de concentração, não volume nem qualidade; a tabela traz os documentos por trás de cada ponto e permite abrir a entidade por teclado.',
                  linhas: linhas as unknown as Array<Record<string, unknown>>,
                  colunas: [
                    { chave: 'Entidade', rotulo: 'Entidade', className: 'max-w-xs' },
                    { chave: 'Nível', rotulo: 'Nível acadêmico' },
                    { chave: 'Valor QL', rotulo: 'QL (índice)' },
                    { chave: 'Documentos', rotulo: 'Documentos da entidade no nível (n)' },
                    { chave: 'Total da entidade', rotulo: 'Documentos da entidade na seleção (n)' },
                  ],
                  contexto,
                  onAbrir: (l) => navegarPara(tipo as TipoBusca, String(l.Entidade)),
                }}
                option={option}
              />
            </Card>
          )}
          <AnalisesOcultas itens={ocultas} />
        </>
      )}
    </section>
  );
}
