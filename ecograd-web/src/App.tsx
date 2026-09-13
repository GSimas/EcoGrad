import { Aparencia } from '@/components/layout/Aparencia';
import { NavigationHistory, UnknownPage } from '@/components/layout/NavigationHistory';
import { useNavigation, navigatePage } from '@/services/navigation';
import { useNavigationPosition } from '@/hooks/useNavigationPosition';
import { SessionStatus } from '@/components/layout/SessionStatus';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Apresentacao } from '@/components/layout/Apresentacao';
import { SelecaoInicial } from '@/components/layout/SelecaoInicial';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { MotorBusca } from '@/components/search-engine/MotorBusca';
import { RadarForesight } from '@/components/foresight/RadarForesight';
import { Memetica } from '@/components/memetics/Memetica';
import { ConsultorFlutuante } from '@/components/chat/ConsultorIA';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { AtividadesIA } from '@/components/ui/AtividadesIA';
import { PainelAtividades } from '@/components/ui/Atividade';
import { calcularSna } from '@/services/calculos';

export default function App() {
  const page = useNavigation((s) => s.page);
  const dadosCarregados = useEcoGradStore((s) => s.dadosCarregados);
  const rota = page;
  const docs = useEcoGradStore((s) => s.docs);
  const statusSNA = useEcoGradStore((s) => s.statusSNA);
  useEffect(() => {
    if (docs.length && statusSNA === 'ocioso') calcularSna(docs);
  }, [docs, statusSNA]);
  const conteudoRef = useNavigationPosition();

  // A apresentação ocupa a tela inteira: a sidebar só entra a partir da seleção
  if (page === 'inicio') {
    return (
      <main ref={conteudoRef} tabIndex={-1} aria-label="Conteúdo principal" className="relative h-screen overflow-y-auto">
        <SessionStatus />
        <PainelAtividades />
        <AtividadesIA />
        <NavigationHistory />
        <div className="mx-auto flex max-w-6xl justify-end px-4 pt-2"><Aparencia /></div>
        <Apresentacao />
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <a href="#conteudo-principal" onClick={(e) => { e.preventDefault(); conteudoRef.current?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-eco-action focus:p-3 focus:text-black">Pular para o conteúdo</a>
      <Sidebar />
      {/* `relative` contém os textos sr-only (absolutos) na rolagem do main; sem isso eles esticam a página e sobra fundo vazio. */}
      <main id="conteudo-principal" tabIndex={-1} aria-label="Conteúdo principal" ref={conteudoRef} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
        <SessionStatus />
        <PainelAtividades />
        <AtividadesIA />
        <NavigationHistory />
        {page === 'nao-encontrada' ? <UnknownPage /> : !dadosCarregados || page === 'selecao' ? (
          <div className="px-3 py-4 sm:px-6"><SelecaoInicial edicao={dadosCarregados} onVoltar={() => navigatePage('dashboard')} /></div>
        ) : (
          // `min-h-full` (e não `h-full`): com altura fixa em 100%, o conteúdo
          // que transborda escapa da caixa e o `padding-bottom` fica desenhado
          // uma tela acima do fim real — o respiro simplesmente não aparece.
          // `pb-24` também deixa o fim da página livre do botão do Consultor IA.
          <div className="mx-auto min-h-full w-full min-w-0 max-w-[1400px] px-3 pb-24 pt-4 sm:px-6 lg:px-8 lg:pt-8">
            {rota === 'dashboard' && <Dashboard />}
            {rota === 'busca' && <MotorBusca />}
            {rota === 'foresight' && <RadarForesight />}
            {rota === 'memetica' && <Memetica />}
          </div>
        )}
      </main>
      {dadosCarregados && <ConsultorFlutuante />}
    </div>
  );
}
