import { Activity, RefreshCw } from 'lucide-react';
import { Aviso, Card, Kpi } from '@/components/ui/primitives';
import { Atividade } from '@/components/ui/Atividade';
import { emExecucao, useAtividade, useSnaWorker } from '@/hooks/useSnaWorker';
import { formatarNumero } from '@/lib/utils';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { CabecalhoBloco } from '@/components/ui/BlocoEmJanela';
import { Carrossel } from '@/components/ui/Carrossel';

/**
 * Métricas de redes complexas e de ecologia profunda do grafo *global*.
 * O motor já existia (`calcular_metricas_complexas`, backend.py:1255, e
 * `calcular_maturidade_rede`, backend.py:1423), mas só estava exposto na rede
 * memética. Transcrição do painel de `pages/1_Avançado.py:170-210`.
 *
 * O grafo desta métrica é o do Python: documento ligado a autores, orientador e
 * palavras-chave, sem macrotema. Não é o mesmo grafo da rede memética, que liga
 * termos entre si — os números não são comparáveis entre as duas telas.
 */
export function MetricasGlobais() {
  const docs = useEcoGradStore((s) => s.docs);
  const maturidade = useEcoGradStore((s) => s.maturidade);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const { calcularMetricasComplexas } = useSnaWorker();
  const task = useAtividade('metricas-complexas');
  const calculando = emExecucao(task);
  const pedido = task?.pedidoResultado;
  const corresponde = pedido?.type === 'metricas-complexas' && pedido.docs === docs;
  const metricas = corresponde && task?.resultado?.type === 'metricas-complexas' ? task.resultado.result : null;

  return (
    <section className="space-y-4">
      <CabecalhoBloco titulo="Métricas de redes complexas do grafo global" icone={<Activity size={18} aria-hidden />}>
        <p>Densidade, eficiência, entropia e influência estrutural da rede que liga documentos a autores, orientadores e palavras-chave.</p>
        <p>Eficiência global, PageRank, eigenvector e restrição de Burt rodam em segundo plano. Você pode navegar durante o cálculo.</p>
        <p>A ecologia profunda é calculada junto com a rede global, assim que as coleções são carregadas — não precisa de um botão.</p>
        <div className="space-y-2">
          <p>O grafo é o do modelo original: cada documento ligado aos seus autores, ao orientador e às suas palavras-chave. <strong>Macrotema fica de fora</strong>, e por isso os números diferem dos da rede memética, que liga termos entre si — as duas telas descrevem redes distintas e não devem ser comparadas diretamente.</p>
          <p><strong>Densidade</strong> é a fração das conexões possíveis que existe. <strong>Eficiência global</strong> é a média do inverso das distâncias entre pares; <strong>redundância</strong> é o complemento dela. <strong>Entropia</strong> resume o espalhamento da distribuição de graus, em bits. <strong>Clustering</strong> médio mede quanto os vizinhos de um nó também se ligam entre si.</p>
          <p><strong>PageRank</strong> e <strong>eigenvector</strong> médios descrevem influência estrutural; <strong>restrição de Burt</strong> média, o quanto as vizinhanças são redundantes. Em redes grandes, eficiência e restrição usam amostras determinísticas de nós — os valores são estimativas estáveis, não cálculos exatos.</p>
          <p>Índices descrevem a estrutura observada. Não medem qualidade, inovação ou saúde institucional, não trazem intervalos de confiança nem testes de significância, e mudam com o tamanho e a cobertura do recorte. Compare coleções apenas considerando esses três fatores.</p>
        </div>
      </CabecalhoBloco>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => calcularMetricasComplexas(docs)} disabled={calculando || docs.length === 0}>
            <RefreshCw size={14} className={calculando ? 'animate-spin' : ''} />
            {metricas ? 'Recalcular métricas complexas' : 'Calcular métricas complexas'}
          </button>
        </div>
        <Atividade id="metricas-complexas" />
        {task?.resultado && !corresponde && (
          <Aviso tipo="aviso">O resultado guardado foi calculado para outra base. Calcule de novo para a seleção atual.</Aviso>
        )}
        {corresponde && task?.resultado?.type === 'metricas-complexas' && task.resultado.result === null && (
          <Aviso>A seleção não forma nenhum nó de rede: não há documentos com título válido.</Aviso>
        )}
      </Card>


      {metricas && (
        <>
          <Carrossel rotulo="Indicadores do grafo global">
            <Kpi rotulo="Nós na rede" valor={metricas.n_nos} detalhe={`${formatarNumero(docs.length)} documentos na seleção`} />
            <Kpi rotulo="Densidade da rede" valor={metricas.densidade.toFixed(6)} detalhe="Fração das conexões possíveis" />
            <Kpi rotulo="Eficiência global" valor={metricas.eficiencia.toFixed(4)} detalhe="Média do inverso das distâncias" />
            <Kpi rotulo="Entropia (H)" valor={`${metricas.entropia.toFixed(2)} bits`} detalhe="Espalhamento da distribuição de graus" />
          </Carrossel>

          <Carrossel rotulo="Conectividade (links por nó)">
            <Kpi rotulo="Média de links" valor={metricas.links.media.toFixed(2)} />
            <Kpi rotulo="Desvio padrão" valor={metricas.links.std.toFixed(2)} />
            <Kpi rotulo="Mínimo" valor={metricas.links.min} />
            <Kpi rotulo="Máximo" valor={metricas.links.max} />
          </Carrossel>
          <Carrossel rotulo="Influência e redundância estrutural">
            <Kpi rotulo="PageRank médio" valor={metricas.pagerank_avg.toFixed(6)} />
            <Kpi rotulo="Eigenvector médio" valor={metricas.eigen_avg.toFixed(6)} />
            <Kpi rotulo="Restrição (Burt)" valor={metricas.constraint_avg.toFixed(4)} />
            <Kpi rotulo="Clustering médio" valor={metricas.clustering.toFixed(4)} />
            <Kpi rotulo="Redundância" valor={metricas.redundancia.toFixed(4)} detalhe="1 − eficiência global" />
          </Carrossel>
        </>
      )}

      <div className="space-y-3">
        {!maturidade ? (
          <Aviso tipo="aviso">
            {statusSNA === 'calculando'
              ? 'A maturidade topológica é calculada logo após a rede global. Acompanhe o progresso no painel de atividades.'
              : 'A maturidade topológica não está disponível nesta sessão, porque a rede global não foi calculada.'}
          </Aviso>
        ) : (
          <Carrossel rotulo="Ecologia profunda do grafo global">
            <Kpi rotulo="Lei de Potência (γ)" valor={maturidade.Gamma.toFixed(2)} detalhe="Estimativa sobre os graus; não testa ajuste à lei de potência" />
            <Kpi rotulo="Correlação de Spearman (ρ)" valor={maturidade.Spearman.toFixed(2)} detalhe="Associação entre grau e betweenness (−1 a 1)" />
            <Kpi rotulo="Assortatividade (r)" valor={maturidade.Assortatividade.toFixed(2)} detalhe="Correlação dos graus nas conexões (−1 a 1)" />
            <Kpi rotulo="Coeficiente Rich-Club (Φ)" valor={`${(maturidade.Rich_Club * 100).toFixed(2)}%`} detalhe="Densidade entre nós de alto grau; sem normalização por rede aleatória" />
          </Carrossel>
        )}
      </div>
    </section>
  );
}
