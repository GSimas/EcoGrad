import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { Aviso, Card } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { calcularCoberturaTemporal, SEM_ANO } from '@/lib/cobertura-temporal';
import type { Documento } from '@/types';

/**
 * Escala de cobertura: vermelho (lacuna) → âmbar → verde (completo). São as
 * mesmas famílias de cor já usadas nos quadrantes do Foresight, então a leitura
 * "vermelho é problema" já está estabelecida na ferramenta.
 *
 * A escala é redundante de propósito: o percentual é impresso dentro de cada
 * célula e repetido no tooltip e na tabela. Quem não distingue vermelho de
 * verde lê o número, não a cor.
 */
const ESCALA_COBERTURA = ['#E74C3C', '#E67E22', '#F1C40F', '#9BC53D', '#2ECC71'];

/** Largura mínima por coluna de ano, para as células não virarem tiras. */
const LARGURA_POR_ANO = 46;

interface Props {
  docs: readonly Documento[];
}

/**
 * Heatmap ano × campo: quanto de cada metadado existe em cada ano do recorte.
 *
 * Serve de leitura prévia para todo o resto da ferramenta — uma queda temática
 * num ano pode ser queda real ou pode ser o ano em que os metadados faltam.
 */
export function CoberturaTemporal({ docs }: Props) {
  const cobertura = useMemo(() => calcularCoberturaTemporal(docs), [docs]);

  const option = useMemo<EChartsOption>(() => {
    // O eixo Y do ECharts cresce de baixo para cima; invertendo a lista, os
    // campos aparecem na mesma ordem em que estão declarados.
    const rotulosCampos = cobertura.campos.map((c) => c.rotulo).reverse();
    const indiceAno = new Map(cobertura.anos.map((a, i) => [a, i]));
    const indiceCampo = new Map(rotulosCampos.map((c, i) => [c, i]));

    const dados = cobertura.celulas.map((c) => [
      indiceAno.get(c.ano) ?? 0,
      indiceCampo.get(c.campo) ?? 0,
      // Sem registros no ano não existe percentual: `null` deixa a célula vazia
      // em vez de pintá-la de vermelho como se fosse lacuna de metadado.
      c.total === 0 ? null : Math.round(c.percentual),
      c.preenchidos,
      c.total,
    ]);

    const eixoAnos = {
      type: 'category' as const,
      data: cobertura.anos,
      axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      axisTick: { show: false },
      splitArea: { show: false },
    };

    return {
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { seriesIndex: number; data: unknown };
          if (p.seriesIndex === 1) {
            const d = p.data as [string, number];
            return `${d[0]}\n${d[1]} ${d[1] === 1 ? 'registro' : 'registros'}`;
          }
          const d = p.data as [number, number, number | null, number, number];
          const ano = cobertura.anos[d[0]];
          const campo = [...indiceCampo.entries()].find(([, i]) => i === d[1])?.[0] ?? '';
          if (d[2] === null) return `${ano}\n${campo}\nNenhum registro neste ano`;
          return `${ano}\n${campo}\n${d[3]} de ${d[4]} ${d[4] === 1 ? 'registro' : 'registros'} (${d[2]}%)`;
        },
      },
      // Dois grids empilhados sobre o mesmo eixo de anos: em cima a cobertura,
      // embaixo o volume. Um percentual alto num ano de 2 registros não vale o
      // mesmo que num ano de 200, e separar as duas leituras é o que permite
      // ver isso sem misturar escalas no mesmo mapa de cor.
      grid: [
        { left: 130, right: 24, top: 16, height: 26 * cobertura.campos.length },
        { left: 130, right: 24, top: 26 * cobertura.campos.length + 56, height: 64 },
      ],
      xAxis: [
        { ...eixoAnos, gridIndex: 0, axisLabel: { show: false } },
        {
          ...eixoAnos,
          gridIndex: 1,
          axisLabel: { color: TEMA_GRAFICO.texto, fontSize: 10, rotate: 45, interval: 0 },
        },
      ],
      yAxis: [
        {
          type: 'category',
          data: rotulosCampos,
          gridIndex: 0,
          axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
          axisTick: { show: false },
          axisLabel: { color: TEMA_GRAFICO.texto, fontSize: 11 },
        },
        {
          type: 'value',
          gridIndex: 1,
          name: 'Registros',
          nameTextStyle: { color: TEMA_GRAFICO.texto, fontSize: 10 },
          minInterval: 1,
          axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
          axisLabel: { color: TEMA_GRAFICO.texto, fontSize: 10 },
          splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
        },
      ],
      visualMap: [{
        type: 'continuous',
        min: 0,
        max: 100,
        seriesIndex: 0,
        // Obrigatório: cada linha de dado carrega [x, y, percentual, preenchidos,
        // total] para alimentar o tooltip, e o ECharts mapeia a cor pela ÚLTIMA
        // dimensão quando nenhuma é indicada. Sem isto, a cor sairia do volume
        // de registros — justamente a confusão que este gráfico existe para
        // desfazer — e todas as células marcariam 100% em cores diferentes.
        dimension: 2,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 90,
        itemWidth: 10,
        text: ['100% preenchido', '0%'],
        textStyle: { color: TEMA_GRAFICO.texto, fontSize: 10 },
        inRange: { color: ESCALA_COBERTURA },
      }],
      series: [
        {
          type: 'heatmap',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: dados,
          label: {
            show: true,
            fontSize: 9,
            color: '#0E1117',
            formatter: (p: unknown) => {
              const v = (p as { data: [number, number, number | null] }).data[2];
              return v === null ? '' : String(v);
            },
          },
          itemStyle: { borderColor: TEMA_GRAFICO.grade, borderWidth: 1 },
        },
        {
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: cobertura.totaisPorAno.map((t) => [t.ano, t.total]),
          itemStyle: { color: TEMA_GRAFICO.paleta[1] },
          barMaxWidth: 28,
        },
      ],
    };
  }, [cobertura]);

  if (cobertura.anos.length === 0) {
    return <Aviso>Nenhum registro no recorte, então não há cobertura de metadados para mapear.</Aviso>;
  }

  const criterios = cobertura.campos.map((c) => `${c.rotulo}: ${c.criterio}`).join(' ');

  return (
    <Card className="space-y-3">
      <Grafico
        altura={26 * cobertura.campos.length + 190}
        larguraMinima={Math.max(520, cobertura.anos.length * LARGURA_POR_ANO + 160)}
        option={option}
        leitura={{
          titulo: 'Cobertura de metadados por ano',
          descricao:
            'Cada célula é a porcentagem dos registros daquele ano que têm o campo preenchido; '
            + 'as barras abaixo mostram quantos registros existem no ano. '
            + 'Serve para separar queda real de lacuna de metadado: um tema que some num ano pode ter sumido, '
            + 'ou aquele ano pode ser o que veio sem palavras-chave. '
            + 'Presença de metadado não comprova qualidade nem acesso ao texto completo, e a data da coleta não está informada. '
            + `Critérios — ${criterios}`,
          linhas: cobertura.celulas.map((c) => ({
            ano: c.ano,
            campo: c.campo,
            preenchidos: c.preenchidos,
            total: c.total,
            percentual: c.total === 0 ? '—' : `${Math.round(c.percentual)}%`,
          })),
          colunas: [
            { chave: 'ano', rotulo: 'Ano' },
            { chave: 'campo', rotulo: 'Campo' },
            { chave: 'preenchidos', rotulo: 'Registros com o campo (n)' },
            { chave: 'total', rotulo: 'Registros no ano (n)' },
            { chave: 'percentual', rotulo: 'Cobertura' },
          ],
          contexto: {
            totalRegistros: cobertura.totalRegistros,
            registrosSemAno: cobertura.semAno,
            anosNoEixo: cobertura.anos.filter((a) => a !== SEM_ANO).length,
            anosSemNenhumRegistro: cobertura.anosVazios,
            eixoContinuo: cobertura.intervaloContinuo
              ? 'O eixo cobre o intervalo inteiro; anos sem registro aparecem em branco.'
              : 'O intervalo era largo demais para o eixo: só os anos observados são listados, e a série não deve ser lida como contínua.',
            campos: cobertura.campos.map((c) => c.rotulo),
            coorientacaoNaoAvaliada: 'Ausência de coorientador é característica do trabalho, não lacuna de metadado.',
          },
        }}
      />
      {cobertura.anosVazios.length > 0 && (
        <p className="text-xs text-amber-200">
          {cobertura.anosVazios.length === 1
            ? `${cobertura.anosVazios[0]} não tem nenhum registro no recorte e aparece como coluna em branco.`
            : `${cobertura.anosVazios.length} anos do intervalo não têm nenhum registro e aparecem como colunas em branco: ${cobertura.anosVazios.join(', ')}.`}
          {' '}Ausência de registro no recorte local não comprova ausência de produção no repositório.
        </p>
      )}
      {!cobertura.intervaloContinuo && cobertura.anos.length > 2 && (
        <p className="text-xs text-amber-200">
          O intervalo entre o primeiro e o último ano é largo demais para caber no eixo, provavelmente por um ano
          fora de escala nos metadados. Só os anos observados estão listados, então os espaçamentos do eixo não
          representam distância no tempo.
        </p>
      )}
      {cobertura.semAno > 0 && (
        <p className="text-xs text-slate-400">
          {cobertura.semAno} {cobertura.semAno === 1 ? 'registro não tem ano' : 'registros não têm ano'} e
          {' '}{cobertura.semAno === 1 ? 'aparece' : 'aparecem'} na coluna “{SEM_ANO}”, no fim do eixo. Eles entram
          em todos os totais do recorte, mas não podem ser situados em nenhuma série temporal.
        </p>
      )}
      {cobertura.pior && cobertura.pior.percentual < 90 && (
        <p className="text-xs text-amber-200">
          Menor cobertura entre os anos com ao menos 5 registros: {cobertura.pior.campo.toLowerCase()} em{' '}
          {cobertura.pior.ano}, com {cobertura.pior.preenchidos} de {cobertura.pior.total}{' '}
          ({Math.round(cobertura.pior.percentual)}%). Considere esse ponto antes de comparar volumes ou temas ao longo do tempo.
        </p>
      )}
    </Card>
  );
}
