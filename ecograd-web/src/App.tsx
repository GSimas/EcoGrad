import { NavigationHistory, UnknownPage } from '@/components/layout/NavigationHistory';
import type { Page } from '@/lib/navigation';
import { useNavigation } from '@/services/navigation';
import { useNavigationPosition } from '@/hooks/useNavigationPosition';
import { SessionStatus } from '@/components/layout/SessionStatus';
import { Suspense, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Apresentacao } from '@/components/layout/Apresentacao';
import { FundoDinamico } from '@/components/layout/FundoDinamico';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { AtividadesIA } from '@/components/ui/AtividadesIA';
import { PainelAtividades } from '@/components/ui/Atividade';
import { LimiteDeErro } from '@/components/ui/LimiteDeErro';
import { calcularSna } from '@/services/calculos';
import { preguicoso } from '@/lib/preguicoso';
import type { Rota } from '@/types';

// Cada página de análise é um pedaço próprio do bundle: quem abre o EcoGrad e
// só busca na apresentação não baixa nem avalia o código das telas de análise.
const PAGINAS: Record<Rota, ReturnType<typeof preguicoso<object>>> = {
  dashboard: preguicoso(() => import('@/components/dashboard/Dashboard').then((m) => m.Dashboard)),
  busca: preguicoso(() => import('@/components/search-engine/MotorBusca').then((m) => m.MotorBusca)),
  avancada: preguicoso(() => import('@/components/advanced/AnaliseAvancada').then((m) => m.AnaliseAvancada)),
};
const CONSULTOR = preguicoso(() => import('@/components/chat/ConsultorIA').then((m) => m.ConsultorFlutuante));
const NOMES_PAGINA: Record<Rota, string> = { dashboard: 'o Dashboard', busca: 'o Motor de Busca', avancada: 'a Análise Avançada' };

export default function App() {
  const page = useNavigation((s) => s.page);
  const dadosCarregados = useEcoGradStore((s) => s.dadosCarregados);
  const rota = page;
  const docs = useEcoGradStore((s) => s.docs);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  const carregando = useEcoGradStore((s) => s.carregando);
  useEffect(() => {
    if (docs.length && statusSNA === 'ocioso') calcularSna(docs);
  }, [docs, statusSNA]);
  // Enquanto a coleção baixa vêm os destinos prováveis e leves — o Dashboard, o
  // Motor de Busca (onde abre o dossiê de um item) e o botão do UFSCão —, para a
  // página montar sem espera quando o download terminar. A Análise Avançada,
  // bem maior, espera a página ficar ociosa: avaliar o código dela no meio do
  // carregamento disputaria a main thread com a montagem da análise.
  useEffect(() => {
    if (carregando || dadosCarregados) { PAGINAS.dashboard.precarregar(); PAGINAS.busca.precarregar(); CONSULTOR.precarregar(); }
    if (!dadosCarregados) return;
    // Com a análise na tela: o código da Análise Avançada e o catálogo padrão do
    // Motor de Busca, montado em fatias, para o primeiro clique não pagar por ele.
    const depoisDaCarga = () => {
      PAGINAS.avancada.precarregar();
      void Promise.all([import('@/hooks/useDadosDerivados'), import('@/lib/busca-categorias')])
        .then(([{ derivadosDe }, { aquecerCatalogo }]) => aquecerCatalogo(derivadosDe(useEcoGradStore.getState().docs).indices))
        .catch(() => { /* o Motor de Busca monta o catálogo quando abrir */ });
    };
    if (typeof window.requestIdleCallback !== 'function') {
      const t = window.setTimeout(depoisDaCarga, 1500);
      return () => window.clearTimeout(t);
    }
    const id = window.requestIdleCallback(depoisDaCarga, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }, [carregando, dadosCarregados]);
  const conteudoRef = useNavigationPosition();

  // A apresentação ocupa a tela inteira e é onde as coleções são escolhidas: sem
  // base carregada não há o que a sidebar mostre. `selecao` é uma rota aposentada
  // que sobrevive só para não quebrar links antigos.
  if (page === 'inicio' || page === 'selecao' || (!dadosCarregados && page !== 'nao-encontrada')) {
    return (
      // Coluna flex: a apresentação cresce para ocupar a altura livre, o que
      // mantém os atalhos ancorados no rodapé sem criar rolagem artificial.
      <main ref={conteudoRef} tabIndex={-1} aria-label="Conteúdo principal" className="relative flex h-screen flex-col overflow-y-auto">
        {/* `fixed`: a apresentação rola dentro do próprio main, e um fundo absoluto
            rolaria junto, descolando do enquadramento. */}
        <FundoDinamico className="fixed inset-0" />
        <PainelAtividades />
        <AtividadesIA />
        <LimiteDeErro rotulo="a apresentação"><Apresentacao /></LimiteDeErro>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <a href="#conteudo-principal" onClick={(e) => { e.preventDefault(); conteudoRef.current?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-eco-action focus:p-3 focus:text-eco-on-action">Pular para o conteúdo</a>
      <Sidebar />
      {/* `relative` contém os textos sr-only (absolutos) na rolagem do main; sem isso eles esticam a página e sobra fundo vazio. */}
      <main id="conteudo-principal" tabIndex={-1} aria-label="Conteúdo principal" ref={conteudoRef} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
        <SessionStatus />
        <PainelAtividades />
        <AtividadesIA />
        <NavigationHistory />
        {page === 'nao-encontrada' ? <UnknownPage /> : (
          // `min-h-full` (e não `h-full`): com altura fixa em 100%, o conteúdo
          // que transborda escapa da caixa e o `padding-bottom` fica desenhado
          // uma tela acima do fim real — o respiro simplesmente não aparece.
          // `pb-24` também deixa o fim da página livre do botão do UFSCão.
          <div key={rota} className="eco-page-enter mx-auto min-h-full w-full min-w-0 max-w-[1400px] px-3 pb-24 pt-4 sm:px-6 lg:px-8 lg:pt-8">
            <PaginaDeAnalise rota={rota} />
          </div>
        )}
      </main>
      {dadosCarregados && <LimiteDeErro rotulo="o UFSCão" aoTentarDeNovo={CONSULTOR.renovar}>
        {/* Sem fallback: o botão flutuante aparece quando o pedaço chega (em geral já chegou). */}
        <Suspense fallback={null}><CONSULTOR.Componente /></Suspense>
      </LimiteDeErro>}
    </div>
  );
}

/**
 * A página de análise da rota, isolada num limite de erro: se ela quebrar (ou
 * o pedaço dela não baixar), a lateral, o histórico e a sessão continuam de pé.
 */
function PaginaDeAnalise({ rota }: { rota: Page }) {
  if (rota !== 'dashboard' && rota !== 'busca' && rota !== 'avancada') return null;
  const pagina = PAGINAS[rota];
  return <LimiteDeErro rotulo={NOMES_PAGINA[rota]} aoTentarDeNovo={pagina.renovar}>
    <Suspense fallback={<p role="status" className="text-sm text-slate-400">Abrindo {NOMES_PAGINA[rota]}…</p>}>
      <pagina.Componente />
    </Suspense>
  </LimiteDeErro>;
}
