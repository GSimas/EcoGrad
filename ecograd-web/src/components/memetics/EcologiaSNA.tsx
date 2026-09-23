import { useMemo } from 'react';
import { RedeInterativa } from '@/components/ui/RedeInterativa';
import { Network, RefreshCw, Table } from 'lucide-react';
import { Aviso, Card, Expander, Kpi, Tabela } from '@/components/ui/primitives';
import { Atividade } from '@/components/ui/Atividade';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { TrabalhosDoTermo } from '@/components/results/TrabalhosDoTermo';
import { useSessionField } from '@/hooks/useSessionField';
import { useSnaWorker, useAtividade, emExecucao } from '@/hooks/useSnaWorker';
import { formatarNumero } from '@/lib/utils';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { CabecalhoBloco } from '@/components/ui/BlocoEmJanela';
import { Carrossel } from '@/components/ui/Carrossel';
import { Dica } from '@/components/ui/Dica';

/** Mesmos rótulos da propagação: as duas abas falam da mesma fonte de termos. */
const OPCOES_FONTE = [
  'Palavras-chave e Títulos (Tradicional)',
  'Artefatos Extraídos pela IA (Ontologia)',
] as const;

/**
 * Ecologia Memética (SNA) — rede de coocorrência entre memes.
 * Transcrição do bloco de `pages/1_Avançado.py:1485-1565`: métricas de redes
 * complexas, ecologia profunda, grafo interativo e tabela de centralidade.
 *
 * A fonte dos termos é a mesma da propagação e mora no store, mas o seletor se
 * repete aqui: as duas análises vivem em abas diferentes, e uma delas não pode
 * depender de a pessoa ter passado pela outra para escolher sobre o que olha.
 */
export function EcologiaSNA() {
  const docs = useEcoGradStore((s) => s.docs);
  const fonte = useEcoGradStore((s) => s.fonteMemes);
  const setFonte = useEcoGradStore((s) => s.setFonteMemes);
  const fonteRotulo = fonte === 'Artefatos Extraídos' ? OPCOES_FONTE[1] : OPCOES_FONTE[0];
  const setFonteRotulo = (rotulo: string) => setFonte(rotulo.includes('IA') ? 'Artefatos Extraídos' : 'Palavras-chave');
  const [termoVisual, setTermoVisual] = useSessionField<string | null>('grafico.memes.termo-rede', null);
  const onSelecionarTermo = (nome: string) => setTermoVisual(nome);
  const { calcularEcologiaMemes } = useSnaWorker();
  const minCoocorrencia = useEcoGradStore((s) => s.minCoocorrencia);
  const setMinCoocorrencia = useEcoGradStore((s) => s.setMinCoocorrencia);
  const task = useAtividade('ecologia-memes');
  const calculando = emExecucao(task);
  const pedidoResultado = task?.pedidoResultado;
  const corresponde = pedidoResultado?.type === 'ecologia-memes' && pedidoResultado.fonte === fonte && pedidoResultado.minCoocorrencia === minCoocorrencia;
  const dados = corresponde && task?.resultado?.type === 'ecologia-memes' ? task.resultado.result : null;
  const calcular = () => calcularEcologiaMemes(docs, minCoocorrencia, fonte);

  const linhasTabela = useMemo(
    () =>
      (dados?.centralidade ?? []).map((l) => ({
        Termo: l.Termo,
        'Grau Absoluto': l['Grau Absoluto'],
        'Grau (Degree)': l['Grau (Degree)'],
        Betweenness: l.Betweenness,
        Closeness: l.Closeness,
        'Documentos Associados': l['Documentos Associados'],
      })),
    [dados],
  );

  const ehIA = fonte === 'Artefatos Extraídos';

  return (
    <section className="space-y-4">
      <CabecalhoBloco titulo={ehIA ? 'Ecologia dos Artefatos Ontológicos (SNA)' : 'Ecologia Memética Tradicional (SNA)'} icone={<Network size={18} aria-hidden />}>
        <p>{ehIA
          ? 'Conexões da rede formada exclusivamente pelos artefatos extraídos pela IA.'
          : 'Conexões da rede formada pelas palavras-chave e pelos termos isolados dos títulos.'}</p>
        <p>Construa a rede para abrir os termos e seus trabalhos. Você pode navegar durante o cálculo e interrompê-lo no controle da atividade.</p>
      </CabecalhoBloco>

      <Card className="space-y-3">
        <GrupoOpcoes rotulo="Fonte dos termos" opcoes={OPCOES_FONTE} valor={fonteRotulo} onChange={setFonteRotulo} />
        <p className="text-sm text-slate-300">Corte visual atual: {minCoocorrencia} coocorrências. As métricas e a tabela usam a rede completa.</p>
        <Expander titulo="Configuração avançada do recorte da rede">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            Coocorrência mínima para desenhar uma conexão
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={minCoocorrencia}
            onChange={(e) => setMinCoocorrencia(Number(e.target.value))}
            className="w-full accent-eco-accent"
          />
          <span className="text-sm text-eco-accent">
            {minCoocorrencia} {minCoocorrencia === 1 ? 'coocorrência' : 'coocorrências'}
          </span>
        </label>
        <p className="mt-2 text-sm text-slate-300">O corte filtra somente as conexões desenhadas entre até 400 nós de maior grau. Não elimina termos das métricas globais. Alterar o corte exige reconstruir a rede ou restaurar os parâmetros anteriores.</p>
        </Expander>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void calcular()}
            disabled={calculando || docs.length === 0}
          >
            <RefreshCw size={14} className={calculando ? 'animate-spin' : ''} />
            {dados ? 'Recalcular rede' : 'Construir rede memética'}
          </button>
        </div>

        <Atividade id="ecologia-memes" />
        {task?.resultado && !corresponde && <Aviso tipo="aviso">Os parâmetros foram alterados. Construa a rede para a seleção atual ou restaure os parâmetros do resultado anterior.
          <button type="button" className="btn ml-2" onClick={() => {
            if (pedidoResultado?.type === 'ecologia-memes') {
              setMinCoocorrencia(pedidoResultado.minCoocorrencia);
              useEcoGradStore.getState().setFonteMemes(pedidoResultado.fonte);
            }
          }}>Restaurar parâmetros do resultado</button>
        </Aviso>}
        {dados?.centralidade.length === 0 && <Aviso>A rede não contém termos conectados nesta fonte. Experimente palavras-chave e títulos, verifique o catálogo ou amplie as coleções. Reduzir o corte visual não cria conexões na rede completa.</Aviso>}
      </Card>

      {!dados && !task?.resultado && !calculando && <Aviso>A rede ainda não foi construída para esta análise. Use Construir rede memética; a propagação dos mesmos termos, na aba Temas e conceitos, já pode ser explorada.</Aviso>}
      {dados && (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Network size={16} aria-hidden /> Grafo Interativo</h3>
              <Dica rotulo="Como ler: grafo interativo"><p>
                {formatarNumero(dados.nodes.length)} de {formatarNumero(dados.totalNos)} memes e{' '}
                {formatarNumero(dados.links.length)} conexões em exibição. As métricas avançadas usam a
                rede completa; o recorte visual aplica o filtro de coocorrência e mantém os memes de
                maior grau.
              </p></Dica>
            </div>
            <RedeInterativa id={`memetica.${fonte}`} titulo="Rede memética" nodes={dados.nodes} links={dados.links} descricao="Até 400 nós de maior grau. Nós são termos do extrator, incluindo tokens de títulos na fonte tradicional; o tipo na rede não comprova palavra-chave autoral. Tamanho segue o grau. Espessura das arestas representa coocorrências no desenho. O recorte visual não muda as métricas da rede completa." contexto={{fonteMemes:fonte,minCoocorrencia,totalNos:dados.totalNos,limiteVisualNos:400}} onSelecionar={(n)=>onSelecionarTermo(n.id)} />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200">
                  <Table size={16} aria-hidden className="mr-1.5 inline-block align-text-bottom" />Tabela de Centralidade Global
                </h3>
                <Dica rotulo="Como ler: tabela de centralidade"><p>Conectividade e intermediação de cada termo na rede completa; valores maiores não indicam qualidade científica.</p></Dica>
              </div>

            </div>
            <Tabela
              titulo="Centralidade memética"
              contexto={{fonteMemes:fonte,minCoocorrencia,totalNos:dados.totalNos,limiteVisualNos:400}}
              descricao="Rede completa. Grau absoluto: conexões (n); demais centralidades: índices adimensionais. Lista de títulos associados, sem truncamento ou corte de 500 linhas."
              onAbrir={(l)=>onSelecionarTermo(String(l.Termo))}
              altura="max-h-[420px]"
              linhas={linhasTabela}
              colunas={[
                { chave: 'Termo', rotulo: dados.rotuloTermo, className: 'max-w-xs truncate' },
                { chave: 'Grau Absoluto', rotulo: 'Grau Absoluto' },
                { chave: 'Grau (Degree)', rotulo: 'Grau (Degree)' },
                { chave: 'Betweenness', rotulo: 'Betweenness' },
                { chave: 'Closeness', rotulo: 'Closeness' },
                {
                  chave: 'Documentos Associados',
                  rotulo: 'Documentos Associados',
                  render: (l)=><details><summary className="cursor-pointer min-h-11 text-eco-accent">Ver títulos associados</summary><p className="whitespace-pre-line">{String(l['Documentos Associados'])}</p></details>,
                  className: 'max-w-md truncate',
                },
              ]}
            />
          </div>
          <Expander titulo="Indicadores estruturais e interpretação avançada">
            <div className="mb-4"><Dica rotulo="Como ler: indicadores estruturais"><p>Índices descrevem a estrutura observada, não qualidade, inovação ou saúde institucional. Não há intervalos de confiança ou testes de significância apresentados. Redes pequenas, isoladas ou sem variação podem gerar índices indefinidos; alguns cálculos usam zero como fallback, inclusive Rich-Club quando não calculável. Compare coleções considerando tamanho, cobertura e fonte dos termos.</p></Dica></div>
          <div className="space-y-3">
            <Carrossel rotulo="Métricas de redes complexas">
              <Kpi rotulo="Densidade da Rede" valor={dados.metricas.densidade.toFixed(5)} />
              <Kpi rotulo="Eficiência Global" valor={dados.metricas.eficiencia.toFixed(4)} />
              <Kpi rotulo="Entropia (H)" valor={`${dados.metricas.entropia.toFixed(2)} bits`} />
              <Kpi rotulo="Clustering Médio" valor={dados.metricas.clustering.toFixed(4)} />
            </Carrossel>

            <Expander titulo="Estatísticas de Conectividade e Influência (médias)">
              <div className="space-y-6">
                <Carrossel rotulo="Conectividade (links por nó)">
                  <Kpi rotulo="Média de Links" valor={dados.metricas.links_mean.toFixed(2)} />
                  <Kpi rotulo="Desvio Padrão" valor={dados.metricas.links_std.toFixed(2)} />
                  <Kpi rotulo="Mínimo" valor={dados.metricas.links_min} />
                  <Kpi rotulo="Máximo" valor={dados.metricas.links_max} />
                </Carrossel>
                <Carrossel rotulo="Influência estrutural">
                  <Kpi rotulo="PageRank Médio" valor={dados.metricas.pr_avg.toFixed(6)} />
                  <Kpi rotulo="Eigenvector Médio" valor={dados.metricas.ev_avg.toFixed(6)} />
                  <Kpi rotulo="Restrição (Burt)" valor={dados.metricas.constraint_avg.toFixed(4)} />
                  <Kpi rotulo="Redundância" valor={dados.metricas.redundancia.toFixed(4)} />
                </Carrossel>
              </div>
            </Expander>
          </div>

          <div className="space-y-3">
            <Carrossel rotulo="Ecologia profunda (SNA avançado)">
              <Kpi
                rotulo="Lei de Potência (γ)"
                valor={dados.maturidade.gamma.toFixed(2)}
                detalhe={'Estimativa sobre os graus; não testa ajuste à lei de potência'}
              />
              <Kpi
                rotulo="Correlação de Spearman (ρ)"
                valor={dados.maturidade.spearman.toFixed(2)}
                detalhe={'Associação entre grau e betweenness (−1 a 1)'}
              />
              <Kpi
                rotulo="Assortatividade (r)"
                valor={dados.maturidade.assortatividade.toFixed(2)}
                detalhe={'Correlação dos graus nas conexões (−1 a 1)'}
              />
              <Kpi
                rotulo="Coeficiente Rich-Club (Φ)"
                valor={`${(dados.maturidade.rich_club * 100).toFixed(2)}%`}
                detalhe={'Densidade entre nós de alto grau; sem normalização por rede aleatória'}
              />
            </Carrossel>
          </div>

          </Expander>
        </>
      )}
      <TrabalhosDoTermo termo={termoVisual} fonteMemes={fonte} redeMemetica onFechar={() => setTermoVisual(null)} />
    </section>
  );
}
