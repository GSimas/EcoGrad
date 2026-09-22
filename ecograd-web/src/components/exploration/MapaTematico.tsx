import { useMemo } from 'react';
import { Compass } from 'lucide-react';
import { AnalisesOcultas, Aviso, Card, Expander, Tabela } from '@/components/ui/primitives';
import type { AnaliseOculta } from '@/lib/relevancia';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { Tabs } from '@/components/ui/Tabs';
import { valorNumericoTabela } from '@/lib/visualizacao';
import {
  CORES_QUADRANTE_TEMATICO,
  LEITURA_QUADRANTE_TEMATICO,
  linhasMacrotemas,
  linhasPalavrasChave,
  QUADRANTES_TEMATICOS,
  quadrantesTematicos,
  type QuadranteTematico,
} from '@/lib/mapa-tematico';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { EChartsOption } from 'echarts';

const COLUNAS_MACROTEMA = [
  { chave: 'Macrotema', rotulo: 'Macrotema', className: 'max-w-xs' },
  { chave: 'Docs', rotulo: 'Documentos (n)' },
  { chave: 'Teses', rotulo: 'Teses (n)' },
  { chave: 'Dissertações', rotulo: 'Dissertações (n)' },
  { chave: 'Grau', rotulo: 'Grau absoluto (conexões)' },
  { chave: 'Betweenness', rotulo: 'Betweenness (índice)' },
  { chave: 'Closeness', rotulo: 'Closeness (índice)' },
  { chave: 'Especialista (Orientador)', rotulo: 'Orientador de maior QL', className: 'max-w-xs' },
  { chave: 'QL do orientador', rotulo: 'QL do orientador (índice)' },
  { chave: 'Especialista (Co-orientador)', rotulo: 'Co-orientador de maior QL', className: 'max-w-xs' },
  { chave: 'QL do co-orientador', rotulo: 'QL do co-orientador (índice)' },
  // Anos são identificadores, não quantidades: sem separador de milhar.
  { chave: 'Início', rotulo: 'Primeiro ano', render: (l: Record<string, unknown>) => l.Início === null ? 'Sem ano' : String(l.Início) },
  { chave: 'Pico Modal', rotulo: 'Ano mais frequente', render: (l: Record<string, unknown>) => l['Pico Modal'] === null ? 'Sem ano' : String(l['Pico Modal']) },
  { chave: 'Recente', rotulo: 'Último ano', render: (l: Record<string, unknown>) => l.Recente === null ? 'Sem ano' : String(l.Recente) },
];

/**
 * Dispersograma de quadrantes comum aos dois mapas. `chaveRotulo` identifica a
 * linha; `chaveTamanho` dá o volume que dimensiona a bolha.
 */
function opcaoMapa(
  linhas: ReadonlyArray<Record<string, unknown> & { Quadrante: QuadranteTematico }>,
  chaveRotulo: string,
  chaveTamanho: string,
  xMid: number,
  yMid: number,
): EChartsOption {
  const tamanhos = linhas.map((l) => Number(l[chaveTamanho]) || 0);
  const maxTamanho = Math.max(...tamanhos, 1);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const l = (p as { data: { linha: Record<string, unknown> } }).data.linha;
        return [
          String(l[chaveRotulo]),
          `Quadrante: ${LEITURA_QUADRANTE_TEMATICO[l.Quadrante as QuadranteTematico]}`,
          `Betweenness: ${valorNumericoTabela(Number(l.Betweenness))}`,
          `Grau: ${valorNumericoTabela(Number(l.Grau))}`,
          `${chaveTamanho}: ${valorNumericoTabela(Number(l[chaveTamanho]))}`,
        ].join('\n');
      },
    },
    legend: { bottom: 0, textStyle: { color: TEMA_GRAFICO.texto } },
    grid: { left: 32, right: 24, top: 24, bottom: 80, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'Betweenness no grafo global (índice)',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: TEMA_GRAFICO.texto },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
    },
    yAxis: {
      type: 'value',
      name: 'Grau absoluto (conexões)',
      nameLocation: 'middle',
      nameGap: 44,
      nameTextStyle: { color: TEMA_GRAFICO.texto },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
    },
    series: QUADRANTES_TEMATICOS.map((q, i) => ({
      name: LEITURA_QUADRANTE_TEMATICO[q],
      type: 'scatter' as const,
      data: linhas
        .filter((l) => l.Quadrante === q)
        .map((linha) => ({ value: [Number(linha.Betweenness) || 0, Number(linha.Grau) || 0], linha })),
      symbolSize: (_valor: unknown, params: unknown) => {
        const l = (params as { data: { linha: Record<string, unknown> } }).data.linha;
        return 10 + Math.sqrt((Number(l[chaveTamanho]) || 0) / maxTamanho) * 34;
      },
      itemStyle: { color: CORES_QUADRANTE_TEMATICO[q], opacity: 0.72 },
      // As duas linhas divisórias entram uma vez só, na primeira série.
      markLine: i === 0
        ? {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: '#7F8C8D', type: 'dashed' as const, width: 1 },
            data: [{ xAxis: xMid }, { yAxis: yMid }],
          }
        : undefined,
    })),
  };
}

/**
 * Análise Temática Estrutural — tabela geral de macrotemas e os dois mapas de
 * quadrantes. Transcrição de `pages/1_Avançado.py:283-400` e de
 * `plotar_mapa_tematico` (backend.py:2486).
 */
export function MapaTematico() {
  const docs = useEcoGradStore((s) => s.docs);
  const sna = useEcoGradStore((s) => s.snaGlobal);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);

  const macrotemas = useMemo(() => linhasMacrotemas(docs, sna), [docs, sna]);
  const palavras = useMemo(() => linhasPalavrasChave(docs, sna, 40), [docs, sna]);
  const quadMacro = useMemo(() => quadrantesTematicos(macrotemas, 'Betweenness', 'Grau'), [macrotemas]);
  const quadPk = useMemo(() => quadrantesTematicos(palavras, 'Betweenness', 'Grau'), [palavras]);

  const contexto = {
    eixos: 'X: betweenness no grafo global; Y: grau absoluto',
    corte: 'Média de cada eixo; valor igual à média fica no lado baixo',
    interpretacaoCategorias: LEITURA_QUADRANTE_TEMATICO,
    redeCalculada: statusSNA === 'pronto',
  };

  const semRede = !sna;
  /** Um único ponto não tem média a dividir: os quadrantes seriam decorativos. */
  const poucosMacrotemas = macrotemas.length > 0 && macrotemas.length < 3;
  const poucasPalavras = palavras.length > 0 && palavras.length < 3;
  const ocultas: AnaliseOculta[] = [
    ...(poucosMacrotemas ? [{ nome: 'Mapa de quadrantes dos macrotemas', motivo: `${macrotemas.length} ${macrotemas.length === 1 ? 'macrotema' : 'macrotemas'} na seleção, insuficientes para dividir pela média` }] : []),
    ...(poucasPalavras ? [{ nome: 'Mapa de quadrantes das palavras-chave', motivo: `${palavras.length} ${palavras.length === 1 ? 'palavra-chave' : 'palavras-chave'} na seleção, insuficientes para dividir pela média` }] : []),
  ];

  const avisoRede = semRede ? (
    <Aviso tipo="aviso">
      {statusSNA === 'calculando'
        ? 'A rede global ainda está sendo calculada. Betweenness, grau e closeness aparecem como zero até ela terminar; os volumes e os anos já estão corretos.'
        : 'A rede global não está disponível nesta sessão. Betweenness, grau e closeness aparecem como zero; os volumes, os anos e os especialistas por QL não dependem dela.'}
    </Aviso>
  ) : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Compass size={18} aria-hidden /> Análise Temática Estrutural</h2>
        <p className="mt-1 text-sm text-slate-400">
          Consolida cada macrotema em volumes, anos e posição na rede, e situa macrotemas e palavras-chave nos quadrantes do modelo original.
        </p>
      </div>

      {avisoRede}

      <Expander titulo="Como ler os quadrantes temáticos">
        <div className="space-y-3 text-sm text-slate-300">
          <p>Os eixos são <strong>betweenness</strong> (posição de ponte no grafo global) e <strong>grau absoluto</strong> (conexões diretas do termo). A cruz tracejada é a média de cada eixo entre os pontos exibidos — muda quando o recorte muda, então a posição de um tema é relativa a esta seleção, não absoluta.</p>
          <p>Os nomes “Temas Motores”, “Temas de Nicho”, “Temas Básicos” e “Temas Emergentes / Declínio” vêm do modelo original, inspirado na tradição bibliométrica de Callon. Aqui eles rotulam apenas a combinação alto/baixo dos dois eixos: <strong>não</strong> são centralidade e densidade calculadas dentro de clusters temáticos, e não comprovam maturidade, isolamento ou emergência de um tema.</p>
          <ul className="space-y-1">{QUADRANTES_TEMATICOS.map((q) => <li key={q}><strong>{q}</strong> — {LEITURA_QUADRANTE_TEMATICO[q]}.</li>)}</ul>
          <p>Na tabela geral, o “especialista” é a entidade de maior Quociente Locacional dentro do macrotema: QL = (documentos da entidade no tema ÷ documentos da entidade) ÷ (documentos do tema ÷ documentos da seleção). QL alto significa concentração relativa, não produtividade nem autoridade sobre o assunto. Quem tem pouquíssimos trabalhos alcança QL alto com facilidade — confira a coluna de documentos antes de ler o índice.</p>
        </div>
      </Expander>

      <Tabs
        chaveSessao="exploracao.mapa-tematico"
        abas={[
          {
            valor: 'tabela',
            rotulo: 'Tabela geral por macrotema',
            conteudo: (
              <Card>
                <Tabela
                  titulo="Macrotemas da seleção"
                  descricao="Uma linha por macrotema. Contagens em documentos; betweenness e closeness são índices adimensionais do grafo global; QL é razão de concentração. Abrir leva o macrotema ao Motor de Busca."
                  contexto={contexto}
                  altura="max-h-[520px]"
                  onAbrir={(l) => navegarPara('Macrotema', String(l.Macrotema))}
                  linhas={macrotemas as unknown as Array<Record<string, unknown>>}
                  colunas={COLUNAS_MACROTEMA}
                />
              </Card>
            ),
          },
          {
            valor: 'macrotemas',
            rotulo: 'Mapa dos macrotemas',
            conteudo: poucosMacrotemas || macrotemas.length === 0 ? (
              <Aviso>{macrotemas.length === 0 ? 'Não há macrotemas na seleção carregada.' : 'A seleção tem poucos macrotemas para um mapa de quadrantes. A tabela geral acima descreve todos eles.'}</Aviso>
            ) : (
              <Card>
                <Grafico
                  altura={620}
                  leitura={{
                    titulo: 'Mapa temático dos macrotemas',
                    descricao: `X: betweenness no grafo global (índice). Y: grau absoluto (conexões). Tamanho: documentos do macrotema. Cor: quadrante do modelo original. Linhas tracejadas: médias de cada eixo — betweenness ${valorNumericoTabela(quadMacro.xMid)}; grau ${valorNumericoTabela(quadMacro.yMid)}. São descrições da posição na rede desta seleção, não juízo sobre os temas. A tabela permite abrir cada macrotema por teclado.`,
                    linhas: quadMacro.linhas as unknown as Array<Record<string, unknown>>,
                    colunas: [{ chave: 'Macrotema', rotulo: 'Macrotema' }, { chave: 'Quadrante', rotulo: 'Quadrante do modelo original' }, { chave: 'Docs', rotulo: 'Documentos (n)' }, { chave: 'Betweenness', rotulo: 'Betweenness (índice)' }, { chave: 'Grau', rotulo: 'Grau absoluto (conexões)' }],
                    contexto,
                    onAbrir: (l) => navegarPara('Macrotema', String(l.Macrotema)),
                  }}
                  onEvents={{ click: (p) => { const l = (p as { data?: { linha?: Record<string, unknown> } }).data?.linha; if (l) navegarPara('Macrotema', String(l.Macrotema)); } }}
                  option={opcaoMapa(quadMacro.linhas, 'Macrotema', 'Docs', quadMacro.xMid, quadMacro.yMid)}
                />
              </Card>
            ),
          },
          {
            valor: 'palavras',
            rotulo: 'Mapa das palavras-chave',
            conteudo: poucasPalavras || palavras.length === 0 ? (
              <Aviso>{palavras.length === 0 ? 'Não há palavras-chave registradas na seleção carregada.' : 'A seleção tem poucas palavras-chave para um mapa de quadrantes.'}</Aviso>
            ) : (
              <Card className="space-y-3">
                <p className="text-sm text-slate-300">As 40 palavras-chave mais frequentes da seleção. Frequência conta documentos que citam o termo, uma vez por documento; não mede importância nem qualidade.</p>
                <Grafico
                  altura={620}
                  leitura={{
                    titulo: 'Mapa temático das palavras-chave',
                    descricao: `X: betweenness no grafo global (índice). Y: grau absoluto (conexões). Tamanho: documentos que citam o termo. Cor: quadrante do modelo original. Linhas tracejadas: médias de cada eixo — betweenness ${valorNumericoTabela(quadPk.xMid)}; grau ${valorNumericoTabela(quadPk.yMid)}. A tabela permite abrir cada termo por teclado.`,
                    linhas: quadPk.linhas as unknown as Array<Record<string, unknown>>,
                    colunas: [{ chave: 'Palavra-chave', rotulo: 'Palavra-chave' }, { chave: 'Quadrante', rotulo: 'Quadrante do modelo original' }, { chave: 'Frequência', rotulo: 'Documentos (n)' }, { chave: 'Betweenness', rotulo: 'Betweenness (índice)' }, { chave: 'Grau', rotulo: 'Grau absoluto (conexões)' }],
                    contexto: { ...contexto, limite: 40 },
                    onAbrir: (l) => navegarPara('Palavra-chave', String(l['Palavra-chave'])),
                  }}
                  onEvents={{ click: (p) => { const l = (p as { data?: { linha?: Record<string, unknown> } }).data?.linha; if (l) navegarPara('Palavra-chave', String(l['Palavra-chave'])); } }}
                  option={opcaoMapa(quadPk.linhas, 'Palavra-chave', 'Frequência', quadPk.xMid, quadPk.yMid)}
                />
              </Card>
            ),
          },
        ]}
      />
      <AnalisesOcultas itens={ocultas} />
    </section>
  );
}
