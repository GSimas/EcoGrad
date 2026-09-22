import { useMemo } from 'react';
import { RefreshCw, Waypoints } from 'lucide-react';
import { Aviso, Card, Expander, Kpi, Tabela } from '@/components/ui/primitives';
import { Atividade } from '@/components/ui/Atividade';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { emExecucao, useAtividade, useSnaWorker } from '@/hooks/useSnaWorker';
import { formatarNumero } from '@/lib/utils';
import { mean } from '@/lib/stats';
import type { LinhaFuroEstrutural } from '@/lib/burt-furos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { EChartsOption } from 'echarts';

const COLUNAS = [
  { chave: 'Orientador', rotulo: 'Orientador', className: 'max-w-xs' },
  { chave: 'Diversidade', rotulo: 'Diversidade: palavras-chave distintas (n)' },
  { chave: 'Restrição (Constraint)', rotulo: 'Restrição de Burt (índice)' },
  { chave: 'Intermediação (Betweenness)', rotulo: 'Betweenness na rede de conceitos (índice)' },
];

/**
 * Furos Estruturais (Burt) — seção dedicada.
 * Transcrição de `pages/1_Avançado.py:736-765` sobre `calcular_burt`
 * (backend.py:964). O cálculo roda no worker; ver `lib/burt-furos`.
 */
export function FurosEstruturais() {
  const docs = useEcoGradStore((s) => s.docs);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);
  const { calcularFuros } = useSnaWorker();
  const task = useAtividade('furos-estruturais');
  const calculando = emExecucao(task);
  const dados = task?.resultado?.type === 'furos-estruturais' ? task.resultado.result : null;
  const pedido = task?.pedidoResultado;
  // Um resultado calculado para outra base descreve outra rede; o vínculo é a
  // identidade do array de documentos, trocado a cada nova análise.
  const corresponde = pedido?.type === 'furos-estruturais' && pedido.docs === docs;
  const linhas = corresponde ? dados?.linhas ?? [] : [];

  const resumo = useMemo(() => {
    if (linhas.length === 0) return null;
    const restricoes = linhas.map((l) => l['Restrição (Constraint)']);
    const ordenadas = [...linhas].sort((a, b) => a['Restrição (Constraint)'] - b['Restrição (Constraint)']);
    return {
      media: mean(restricoes),
      // "Menor restrição" é o que o modelo chama de broker; com diversidade
      // 0 ou 1 a restrição também é baixa, e isso não descreve ponte nenhuma.
      menores: ordenadas.filter((l) => l.Diversidade >= 2).slice(0, 5),
      isolados: linhas.filter((l) => l.Diversidade < 2).length,
    };
  }, [linhas]);

  const option = useMemo<EChartsOption>(() => {
    const maxBet = Math.max(...linhas.map((l) => l['Intermediação (Betweenness)']), 1e-9);
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const l = (p as { data: { linha: LinhaFuroEstrutural } }).data.linha;
          return [
            l.Orientador,
            `Diversidade: ${formatarNumero(l.Diversidade)} palavras-chave`,
            `Restrição: ${l['Restrição (Constraint)'].toFixed(4)}`,
            `Betweenness: ${l['Intermediação (Betweenness)'].toFixed(6)}`,
          ].join('\n');
        },
      },
      grid: { left: 32, right: 24, top: 24, bottom: 56, containLabel: true },
      xAxis: {
        type: 'value',
        name: 'Diversidade: palavras-chave distintas (n)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: TEMA_GRAFICO.texto },
        splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
        axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      },
      yAxis: {
        type: 'value',
        name: 'Restrição de Burt (índice)',
        nameLocation: 'middle',
        nameGap: 44,
        nameTextStyle: { color: TEMA_GRAFICO.texto },
        splitLine: { lineStyle: { color: TEMA_GRAFICO.grade } },
        axisLine: { lineStyle: { color: TEMA_GRAFICO.eixo } },
      },
      series: [{
        type: 'scatter',
        cursor: 'pointer',
        data: linhas.map((linha) => ({
          value: [linha.Diversidade, linha['Restrição (Constraint)']],
          linha,
        })),
        symbolSize: (_v: unknown, params: unknown) => {
          const l = (params as { data: { linha: LinhaFuroEstrutural } }).data.linha;
          return 6 + Math.sqrt(l['Intermediação (Betweenness)'] / maxBet) * 26;
        },
        itemStyle: {
          // Verde = pouca restrição, vermelho = muita, como a escala RdYlGn_r
          // do original. A cor repete o eixo Y de propósito: é o que a leitura
          // do gráfico pede, e não acrescenta nenhuma variável nova.
          color: (params: unknown) => {
            const l = (params as { data: { linha: LinhaFuroEstrutural } }).data.linha;
            const v = Math.min(1, l['Restrição (Constraint)']);
            return v < 0.5
              ? `rgb(${Math.round(46 + v * 2 * 195)}, ${Math.round(204 - v * 2 * 8)}, ${Math.round(113 - v * 2 * 53)})`
              : `rgb(${Math.round(241)}, ${Math.round(196 - (v - 0.5) * 2 * 120)}, ${Math.round(60 - (v - 0.5) * 2 * 0)})`;
          },
          opacity: 0.8,
        },
      }],
    };
  }, [linhas]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Waypoints size={18} aria-hidden /> Furos Estruturais (Burt)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Rede de orientadores e palavras-chave: quem atravessa vocabulários distintos e quem se concentra em um só.
        </p>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => calcularFuros(docs)} disabled={calculando || docs.length === 0}>
            <RefreshCw size={14} className={calculando ? 'animate-spin' : ''} />
            {linhas.length ? 'Recalcular furos estruturais' : 'Calcular furos estruturais'}
          </button>
          <p className="text-xs text-slate-500">
            A restrição de Burt e o betweenness rodam em segundo plano. Você pode navegar durante o cálculo e interrompê-lo no controle da atividade.
          </p>
        </div>
        <Atividade id="furos-estruturais" />
        {task?.resultado && !corresponde && (
          <Aviso tipo="aviso">O resultado guardado foi calculado para outra base. Calcule de novo para a seleção atual.</Aviso>
        )}
        {corresponde && dados && dados.linhas.length === 0 && (
          <Aviso>Nenhum orientador desta seleção tem palavras-chave registradas, então não há vizinhança a medir.</Aviso>
        )}
      </Card>

      <Expander titulo="O que a restrição de Burt mede — e o que não mede">
        <div className="space-y-3 text-sm text-slate-300">
          <p>A rede tem um nó por orientador e um por palavra-chave, ligados quando o orientador assina um trabalho com aquele termo. <strong>Restrição</strong> é baixa quando a vizinhança do orientador é pouco redundante — quando seus termos não se repetem entre si nos trabalhos de outras pessoas. O modelo original chama isso de <em>broker</em>.</p>
          <p><strong>Diversidade</strong> é o número de palavras-chave distintas ligadas ao orientador, e <strong>betweenness</strong> (o tamanho da bolha) é quanto dos caminhos da rede passa por ele. A leitura proposta pelo original está no canto inferior direito: muita diversidade, pouca restrição, bolha grande.</p>
          <p>Nada disso mede interdisciplinaridade declarada, colaboração real ou qualidade da orientação. Tudo depende das palavras-chave registradas nos metadados desta seleção: cobertura irregular entre coleções desloca posições. Quem tem uma única palavra-chave aparece com restrição baixa por falta de vizinhança, não por atravessar áreas — por isso os destaques abaixo exigem ao menos duas.</p>
          <p>Em redes com mais de 1500 nós o betweenness é estimado por amostragem de pivôs, como no backend original; a restrição é sempre exata para os orientadores.</p>
        </div>
      </Expander>

      {linhas.length > 0 && dados && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Orientadores na rede" valor={linhas.length} />
            <Kpi rotulo="Palavras-chave na rede" valor={dados.totalPalavrasChave} />
            <Kpi rotulo="Conexões" valor={dados.totalArestas} detalhe={`${formatarNumero(dados.totalNos)} nós no total`} />
            <Kpi
              rotulo="Restrição média"
              valor={resumo ? resumo.media.toFixed(4) : '—'}
              detalhe={resumo?.isolados ? `${formatarNumero(resumo.isolados)} com menos de duas palavras-chave` : 'Índice adimensional'}
            />
          </div>

          {resumo && resumo.menores.length > 0 && (
            <Card className="space-y-2">
              <h3 className="text-sm font-semibold">Menor restrição entre quem tem ao menos duas palavras-chave</h3>
              <p className="text-xs text-slate-500">Os cinco primeiros da ordenação por restrição crescente. É a posição que o modelo chama de ponte; confirme nos trabalhos antes de ler como interdisciplinaridade.</p>
              <ul className="space-y-1 text-sm text-slate-300">
                {resumo.menores.map((l) => (
                  <li key={l.Orientador}>
                    <button type="button" className="text-left text-eco-accent underline-offset-2 hover:underline" onClick={() => navegarPara('Orientador', l.Orientador)}>{l.Orientador}</button>
                    {' '}— restrição {l['Restrição (Constraint)'].toFixed(4)} · {formatarNumero(l.Diversidade)} palavras-chave
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <Grafico
              altura={560}
              leitura={{
                titulo: 'Mapa de furos estruturais',
                descricao: `X: palavras-chave distintas do orientador (n). Y: restrição de Burt (índice, menor = vizinhança menos redundante). Tamanho e cor: betweenness e restrição. ${dados.betweennessAproximado ? 'Betweenness estimado por amostragem de pivôs, porque a rede passa de 1500 nós.' : 'Betweenness exato.'} A tabela permite abrir cada orientador por teclado.`,
                linhas: linhas as unknown as Array<Record<string, unknown>>,
                colunas: COLUNAS,
                contexto: { totalNos: dados.totalNos, totalArestas: dados.totalArestas, betweennessAproximado: dados.betweennessAproximado },
                onAbrir: (l) => navegarPara('Orientador', String(l.Orientador)),
              }}
              onEvents={{ click: (p) => { const l = (p as { data?: { linha?: LinhaFuroEstrutural } }).data?.linha; if (l) navegarPara('Orientador', l.Orientador); } }}
              option={option}
            />
          </Card>

          <Card>
            <Tabela
              titulo="Restrição por orientador"
              descricao="Rede completa de orientadores e palavras-chave, em ordem crescente de restrição. Diversidade em palavras-chave distintas; restrição e betweenness são índices adimensionais."
              contexto={{ totalNos: dados.totalNos, totalArestas: dados.totalArestas, betweennessAproximado: dados.betweennessAproximado }}
              altura="max-h-[460px]"
              onAbrir={(l) => navegarPara('Orientador', String(l.Orientador))}
              linhas={linhas as unknown as Array<Record<string, unknown>>}
              colunas={COLUNAS}
            />
          </Card>
        </>
      )}
    </section>
  );
}
