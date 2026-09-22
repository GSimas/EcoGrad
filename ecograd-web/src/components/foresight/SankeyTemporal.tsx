import { useMemo } from 'react';
import { Waves } from 'lucide-react';
import { Aviso, Card, Expander } from '@/components/ui/primitives';
import { Grafico, TEMA_GRAFICO } from '@/components/ui/Chart';
import { useSessionField } from '@/hooks/useSessionField';
import { formatarNumero } from '@/lib/utils';
import { periodosPadrao, prepararSankeyTemporal, type PeriodoSankey } from '@/lib/sankey-temporal';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { EChartsOption } from 'echarts';

const ROTULOS = ['Período 1', 'Período 2', 'Período 3'] as const;

/**
 * Sankey Temporal de palavras-chave — a aba "Fluxos" do Streamlit.
 * Transcrição de `pages/1_Avançado.py:846-930` sobre `preparar_sankey_temporal`
 * (backend.py:1091). Vive no Foresight porque no original as duas análises
 * dividiam a mesma aba: são as duas leituras temporais da ferramenta.
 */
export function SankeyTemporal() {
  const docs = useEcoGradStore((s) => s.docs);
  const navegarPara = useEcoGradStore((s) => s.navegarPara);

  const padrao = useMemo(() => periodosPadrao(docs), [docs]);
  const limites = useMemo(() => {
    const anos = docs.map((d) => d.ano).filter((a): a is number => typeof a === 'number' && Number.isFinite(a));
    return anos.length ? { min: Math.min(...anos), max: Math.max(...anos) } : null;
  }, [docs]);

  const [salvos, setSalvos] = useSessionField<[PeriodoSankey, PeriodoSankey, PeriodoSankey] | null>('grafico.sankey.periodos', null);
  const [topN, setTopN] = useSessionField('grafico.sankey.topn', 10);

  // Períodos guardados na sessão podem cair fora da base atual; nesse caso a
  // partição por terços volta a valer, em vez de mostrar um diagrama vazio.
  const periodos = useMemo(() => {
    if (!padrao || !limites) return null;
    if (!salvos) return padrao;
    const dentro = salvos.every((p) => p.inicio >= limites.min && p.fim <= limites.max && p.inicio <= p.fim);
    return dentro ? salvos : padrao;
  }, [salvos, padrao, limites]);

  const sankey = useMemo(
    () => (periodos ? prepararSankeyTemporal(docs, topN, periodos) : null),
    [docs, topN, periodos],
  );

  const alterarPeriodo = (indice: number, campo: 'inicio' | 'fim', valor: number) => {
    if (!periodos) return;
    const proximos = periodos.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)) as [PeriodoSankey, PeriodoSankey, PeriodoSankey];
    // Um período invertido não filtra nada; o limite acompanha a outra ponta.
    const alvo = proximos[indice];
    if (alvo.inicio > alvo.fim) proximos[indice] = campo === 'inicio' ? { ...alvo, fim: valor } : { ...alvo, inicio: valor };
    setSalvos(proximos);
  };

  const option = useMemo<EChartsOption>(() => {
    if (!sankey || sankey.nos.length === 0) return {};
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const dado = p as { dataType: string; name: string; value: number; data?: { ocorrencias?: number } };
          if (dado.dataType === 'edge') return `${dado.name}\nPares pessoa × termo: ${formatarNumero(dado.value)}`;
          return `${dado.name}\nDocumentos do período com o termo: ${formatarNumero(dado.data?.ocorrencias ?? 0)}`;
        },
      },
      series: [{
        type: 'sankey',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'left',
        left: 8,
        right: 8,
        top: 16,
        bottom: 16,
        data: sankey.nos.map((n) => ({
          name: n.nome,
          ocorrencias: n.ocorrencias,
          itemStyle: { color: TEMA_GRAFICO.paleta[n.periodo], borderColor: 'transparent' },
          // O ECharts escreve o rótulo sempre à direita do bloco; na última
          // coluna isso o jogaria para fora do desenho, cortando o termo.
          label: n.periodo === 2 ? { position: 'left' as const } : undefined,
        })),
        links: sankey.links.map((l) => ({ source: l.origem, target: l.destino, value: l.valor })),
        label: { color: TEMA_GRAFICO.texto, fontSize: 11 },
        lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
        cursor: 'pointer',
      }],
    };
  }, [sankey]);

  if (!periodos || !limites || !sankey) {
    return (
      <Card>
        <Aviso tipo="aviso">Nenhum registro da seleção tem ano preenchido, então não há períodos a comparar.</Aviso>
      </Card>
    );
  }

  const linhasTabela = sankey.links.map((l) => ({
    'Termo de origem': l.origem,
    'Termo de destino': l.destino,
    'Pares pessoa × termo': l.valor,
  }));

  const contexto = {
    periodos: periodos.map((p, i) => ({ rotulo: ROTULOS[i], inicio: p.inicio, fim: p.fim })),
    termosPorPeriodo: topN,
    documentosPorPeriodo: sankey.documentosPorPeriodo,
    pesquisadoresEmComum: sankey.pesquisadoresEmComum,
    limiteInterpretacao: 'O fluxo liga termos por pessoas presentes nos dois períodos; não é citação nem herança conceitual.',
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Waves size={18} aria-hidden /> Sankey Temporal de palavras-chave</h2>
        <p className="mt-1 text-sm text-slate-400">
          Acompanha quais termos as mesmas pessoas usaram ao passar de um período ao seguinte.
        </p>
      </div>

      <Card className="space-y-4">
        <p className="text-sm text-slate-300">Base observada: {limites.min}–{limites.max}. Períodos podem se sobrepor; o modelo original também permitia.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {periodos.map((p, i) => (
            <fieldset key={ROTULOS[i]} className="space-y-2 rounded-lg border border-eco-border p-3">
              <legend className="px-1 text-xs uppercase tracking-wide text-slate-400">{ROTULOS[i]}</legend>
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Primeiro ano
                <input type="range" min={limites.min} max={limites.max} step={1} value={p.inicio}
                  aria-valuetext={String(p.inicio)}
                  onChange={(e) => alterarPeriodo(i, 'inicio', Number(e.target.value))}
                  className="w-full accent-eco-accent" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Último ano
                <input type="range" min={limites.min} max={limites.max} step={1} value={p.fim}
                  aria-valuetext={String(p.fim)}
                  onChange={(e) => alterarPeriodo(i, 'fim', Number(e.target.value))}
                  className="w-full accent-eco-accent" />
              </label>
              <p className="text-sm text-eco-accent">{p.inicio}–{p.fim} · {formatarNumero(sankey.documentosPorPeriodo[i])} registros</p>
            </fieldset>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-slate-300">
          Palavras-chave principais por período
          <input type="range" min={3} max={20} step={1} value={topN}
            aria-valuetext={`${topN} termos por período`}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="w-full accent-eco-accent" />
          <span className="text-xs text-eco-accent">{topN} termos por período</span>
        </label>
        <button type="button" className="btn" onClick={() => setSalvos(null)}>Restaurar os três períodos iniciais</button>
      </Card>

      <Expander titulo="O que o fluxo representa — e o que não representa">
        <div className="space-y-3 text-sm text-slate-300">
          <p>Em cada período entram as {topN} palavras-chave mais frequentes daquele intervalo, contadas uma vez por documento. Um termo só aparece num período se estiver entre os primeiros <em>dele</em>: sumir de uma coluna não significa que deixou de ser usado, apenas que saiu do topo.</p>
          <p>Uma ligação existe quando a <strong>mesma pessoa</strong> — orientador ou autor — aparece nos dois períodos vizinhos, cada vez com um desses termos. O peso conta pares pessoa × termo-de-origem × termo-de-destino, então quem publica muito pesa mais que um tema estudado por muita gente diferente. Não é citação, não é herança conceitual e não demonstra que um tema originou o outro.</p>
          <p>Nomes iguais colapsam numa pessoa só e grafias diferentes contam separado, salvo o que você tenha unificado nesta sessão. Registros sem ano ficam fora dos três períodos; registros sem palavra-chave não geram fluxo.</p>
          <p>As transições desta seleção têm {formatarNumero(sankey.pesquisadoresEmComum[0])} {sankey.pesquisadoresEmComum[0] === 1 ? 'pessoa' : 'pessoas'} em comum entre os períodos 1 e 2, e {formatarNumero(sankey.pesquisadoresEmComum[1])} entre os períodos 2 e 3. Poucas pessoas em comum produzem um diagrama esparso, e isso descreve a rotatividade da seleção — não a descontinuidade dos temas.</p>
        </div>
      </Expander>

      {sankey.periodoVazio !== null ? (
        <Aviso tipo="aviso">O {ROTULOS[sankey.periodoVazio - 1].toLowerCase()} não tem nenhuma palavra-chave registrada nos anos escolhidos. Amplie esse intervalo ou reduza o número de termos por período.</Aviso>
      ) : sankey.links.length === 0 ? (
        <Aviso tipo="aviso">Nenhuma pessoa aparece em dois períodos vizinhos com os termos principais de cada um, então não há fluxo a desenhar. Amplie os intervalos ou aumente o número de termos por período.</Aviso>
      ) : (
        <Card>
          <Grafico
            altura={680}
            leitura={{
              titulo: 'Fluxo temporal de palavras-chave',
              descricao: `Três colunas, uma por período, com as ${topN} palavras-chave mais frequentes de cada um. A altura do bloco acompanha o fluxo que passa por ele; a espessura da ligação conta pares pessoa × termo entre períodos vizinhos. Não é citação nem herança conceitual. A tabela traz todas as ligações e seus pesos.`,
              linhas: linhasTabela,
              colunas: [
                { chave: 'Termo de origem', rotulo: 'Termo de origem (com o ano inicial do período)', className: 'max-w-xs' },
                { chave: 'Termo de destino', rotulo: 'Termo de destino (com o ano inicial do período)', className: 'max-w-xs' },
                { chave: 'Pares pessoa × termo', rotulo: 'Peso do fluxo (pares)' },
              ],
              contexto,
            }}
            onEvents={{
              click: (p) => {
                const dado = p as { dataType?: string; data?: { name?: string } };
                if (dado.dataType !== 'node') return;
                const no = sankey.nos.find((n) => n.nome === dado.data?.name);
                if (no) navegarPara('Palavra-chave', no.termo);
              },
            }}
            option={option}
          />
        </Card>
      )}
    </section>
  );
}
