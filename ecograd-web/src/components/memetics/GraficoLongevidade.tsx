import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import type { LongevidadeRow } from '@/types';

/** Escala perceptual (roxo → magenta → laranja → amarelo) do ano de extinção. */
const ESCALA_ANO = ['#3B0F70', '#8C2981', '#DE4968', '#FE9F6D', '#FCFDBF'];

/**
 * Tempo de Meia-Vida do Conhecimento.
 *
 * Cada meme é um ponto: o ano em que nasceu (1ª aparição) no eixo X, quantos
 * anos sobreviveu no eixo Y. A cor marca o ano da última aparição e o tamanho,
 * o número de replicações — assim dá para separar de relance os pilares
 * estruturais (alto, à esquerda, claro) dos que morreram cedo.
 */
export function GraficoLongevidade({ longevidade }: { longevidade: readonly LongevidadeRow[] }) {
  const [minReplicacoes, setMinReplicacoes] = useState(2);

  const maxReplicacoes = useMemo(
    () => Math.max(2, ...longevidade.map((l) => l.total_aparicoes)),
    [longevidade],
  );

  const pontos = useMemo(
    () =>
      longevidade
        .filter((l) => l.total_aparicoes >= minReplicacoes)
        // Os maiores por último: ficam desenhados por cima dos pontos menores
        .sort((a, b) => a.total_aparicoes - b.total_aparicoes)
        .map((l) => ({
          value: [l.ano_nascimento, l.tempo_vida_anos, l.ano_extincao, l.total_aparicoes],
          name: l.meme,
        })),
    [longevidade, minReplicacoes],
  );

  const faixaAnos = useMemo(() => {
    if (longevidade.length === 0) return { min: 2000, max: 2025 };
    const anos = longevidade.map((l) => l.ano_extincao);
    return { min: Math.min(...anos), max: Math.max(...anos) };
  }, [longevidade]);

  const faixaReplicacoes = useMemo(() => {
    if (pontos.length === 0) return { min: 1, max: 2 };
    const reps = pontos.map((p) => p.value[3]);
    return { min: Math.min(...reps), max: Math.max(...reps) };
  }, [pontos]);

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-100">
          Tempo de Meia-Vida do Conhecimento (Longevidade)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Analisa a &quot;idade&quot; de sobrevivência. Memes com vida longa indicam pilares
          estruturais.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Filtrar por nº mínimo de replicações:</span>
        <span className="block text-xs font-semibold text-red-400 tabular-nums">
          {minReplicacoes}
        </span>
        <input
          type="range"
          min={2}
          max={Math.max(3, Math.min(maxReplicacoes, 50))}
          value={minReplicacoes}
          onChange={(e) => setMinReplicacoes(Number(e.target.value))}
          className="w-full accent-red-400"
        />
      </label>

      {pontos.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Nenhum meme atinge {minReplicacoes} replicações.
        </p>
      ) : (
        <Grafico
          altura={480}
          option={{
            tooltip: {
              trigger: 'item',
              formatter: (p: unknown) => {
                const d = p as { name: string; value: number[] };
                return [
                  `<strong>${d.name}</strong>`,
                  `Nascimento: ${d.value[0]}`,
                  `Última aparição: ${d.value[2]}`,
                  `Sobrevivência: ${d.value[1]} anos`,
                  `Replicações: ${d.value[3]}`,
                ].join('<br/>');
              },
            },
            grid: { left: 8, right: 24, top: 24, bottom: 56, containLabel: true },
            xAxis: {
              type: 'value',
              name: 'Ano de Nascimento (1ª Aparição)',
              nameLocation: 'middle',
              nameGap: 32,
              nameTextStyle: { color: TEMA_GRAFICO.texto },
              scale: true,
              minInterval: 1,
              axisLabel: { formatter: (v: number) => String(v) },
              axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
              splitLine: { show: false },
            },
            yAxis: {
              type: 'value',
              name: 'Longevidade (Anos de Sobrevivência)',
              nameLocation: 'middle',
              nameGap: 40,
              nameTextStyle: { color: TEMA_GRAFICO.texto },
              minInterval: 1,
              axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
              splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
            },
            visualMap: [
              {
                // Cor = ano da última aparição
                type: 'continuous',
                dimension: 2,
                min: faixaAnos.min,
                max: faixaAnos.max,
                calculable: true,
                right: 0,
                top: 'middle',
                itemHeight: 220,
                text: ['Ano da Última Aparição', ''],
                textStyle: { color: TEMA_GRAFICO.texto, fontSize: 11 },
                inRange: { color: ESCALA_ANO },
              },
              {
                // Tamanho = número de replicações
                type: 'continuous',
                dimension: 3,
                min: faixaReplicacoes.min,
                max: faixaReplicacoes.max,
                show: false,
                inRange: { symbolSize: [4, 26] },
              },
            ],
            series: [
              {
                type: 'scatter',
                data: pontos,
                itemStyle: { borderColor: 'rgba(255,255,255,0.35)', borderWidth: 0.5 },
                emphasis: { focus: 'self', itemStyle: { borderColor: '#fff', borderWidth: 1.5 } },
              },
            ],
          }}
        />
      )}

      <p className="text-xs text-slate-500">
        {pontos.length} memes com ao menos {minReplicacoes} replicações · eixo horizontal = ano da
        1ª aparição · eixo vertical = anos entre a primeira e a última aparição.
      </p>
    </Card>
  );
}
