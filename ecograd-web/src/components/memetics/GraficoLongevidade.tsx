import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { useSessionField } from '@/hooks/useSessionField';
import { useMemo } from 'react';
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
export function GraficoLongevidade({ longevidade, onSelecionar }: { longevidade: readonly LongevidadeRow[]; onSelecionar: (termo: string) => void }) {
  const fonte = useEcoGradStore((s)=>s.fonteMemes);
  const [minReplicacoes, setMinReplicacoes] = useSessionField('memes.replicacoes', 2);

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
          Intervalos de ocorrência dos termos
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Distância entre o primeiro e o último ano observado, para termos com mais de um título e ao menos um ano válido. Não mede vida útil ou importância.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Mínimo de títulos distintos associados:</span>
        <span className="block text-xs font-semibold text-red-400 tabular-nums">
          {minReplicacoes}
        </span>
        <input
          type="range"
          min={2}
          max={Math.max(3, Math.min(maxReplicacoes, 50), minReplicacoes)}
          value={minReplicacoes}
          onChange={(e) => setMinReplicacoes(Number(e.target.value))}
          className="w-full accent-red-400"
        />
      </label>

      {pontos.length === 0 ? (
        <div className="space-y-2 py-6 text-sm text-slate-300">
          <p>{longevidade.length === 0 ? 'Não há termos com mais de um título e ano válido para calcular intervalos. Verifique a cobertura e explore os títulos nas tabelas de propagação.' : `Nenhum termo atinge o filtro de ${minReplicacoes} títulos. A configuração anterior foi preservada.`}</p>
          {longevidade.length > 0 && <button type="button" className="btn" onClick={()=>setMinReplicacoes(2)}>Mostrar a partir de 2 títulos</button>}
        </div>
      ) : (
        <Grafico
          leitura={{titulo:'Longevidade dos termos', descricao:'X: ano da primeira aparição. Y: anos entre primeira e última aparição. Cor: ano da última aparição; tamanho: títulos distintos associados. Ausência recente não comprova extinção. O filtro exige o mínimo de replicações indicado.', linhas:longevidade.filter((l)=>l.total_aparicoes>=minReplicacoes).map((l)=>({...l})), colunas:[{chave:'meme',rotulo:'Termo completo'},{chave:'ano_nascimento',rotulo:'Primeira aparição (ano)',render:(l)=>String(l.ano_nascimento)},{chave:'ano_extincao',rotulo:'Última aparição (ano)',render:(l)=>String(l.ano_extincao)},{chave:'tempo_vida_anos',rotulo:'Intervalo (anos)'},{chave:'total_aparicoes',rotulo:'Títulos distintos (n)'}], contexto:{fonteMemes:fonte,minimoReplicacoes:minReplicacoes}, onAbrir:(l)=>onSelecionar(String(l.meme))}}
          onEvents={{click:(p)=>{const nome=(p as {name?:string}).name;if(nome) onSelecionar(nome);}}}
          altura={480}
          option={{
            tooltip: {
              trigger: 'item',
              formatter: (p: unknown) => {
                const d = p as { name: string; value: number[] };
                return [
                  d.name,
                  `Primeiro ano: ${d.value[0]}`,
                  `Última aparição: ${d.value[2]}`,
                  `Intervalo observado: ${d.value[1]} anos`,
                  `Títulos distintos: ${d.value[3]}`,
                ].join('\n');
              },
            },
            grid: { left: 32, right: 12, top: 24, bottom: 95, containLabel: true },
            xAxis: {
              type: 'value',
              name: 'Primeira aparição (ano)',
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
              name: 'Intervalo observado (anos)',
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
                calculable: false,
                left: 'center',
                bottom: 0,
                orient: 'horizontal',
                itemHeight: 100,
                itemWidth: 10,
                text: ['Último ano', 'Primeiro ano'],
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
        {pontos.length} termos com ao menos {minReplicacoes} títulos distintos · eixo horizontal = ano da
        1ª aparição · eixo vertical = anos entre a primeira e a última aparição.
      </p>
    </Card>
  );
}
