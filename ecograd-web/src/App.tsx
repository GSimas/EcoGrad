import { useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Apresentacao } from '@/components/layout/Apresentacao';
import { SelecaoInicial } from '@/components/layout/SelecaoInicial';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { MotorBusca } from '@/components/search-engine/MotorBusca';
import { RadarForesight } from '@/components/foresight/RadarForesight';
import { Memetica } from '@/components/memetics/Memetica';
import { ConsultorIA } from '@/components/chat/ConsultorIA';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { cn } from '@/lib/utils';

export default function App() {
  const apresentacaoVista = useEcoGradStore((s) => s.apresentacaoVista);
  const dadosCarregados = useEcoGradStore((s) => s.dadosCarregados);
  const rota = useEcoGradStore((s) => s.rota);
  const buscaTermo = useEcoGradStore((s) => s.buscaTermo);
  const conteudoRef = useRef<HTMLElement>(null);

  // Trocar de aba (inclusive via clique no Dashboard, que abre o Motor de
  // Busca) deve começar do topo — senão o usuário cai no meio da página nova
  // com a rolagem herdada da anterior.
  useEffect(() => {
    conteudoRef.current?.scrollTo({ top: 0 });
  }, [rota, buscaTermo]);

  // A apresentação ocupa a tela inteira: a sidebar só entra a partir da seleção
  if (!apresentacaoVista) {
    return (
      <div className="h-screen overflow-y-auto">
        <Apresentacao />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main ref={conteudoRef} className="flex-1 overflow-y-auto">
        {!dadosCarregados ? (
          <SelecaoInicial />
        ) : (
          // `min-h-full` (e não `h-full`): com altura fixa em 100%, o conteúdo
          // que transborda escapa da caixa e o `padding-bottom` fica desenhado
          // uma tela acima do fim real — o respiro simplesmente não aparece.
          // O chat é a exceção: precisa de altura definida para ancorar o campo
          // de entrada no rodapé, e por isso mantém `h-full`.
          <div
            className={cn(
              'mx-auto max-w-[1400px] px-6 pt-6 lg:px-8 lg:pt-8',
              rota === 'chat' ? 'h-full pb-6 lg:pb-8' : 'min-h-full pb-24',
            )}
          >
            {rota === 'dashboard' && <Dashboard />}
            {rota === 'busca' && <MotorBusca />}
            {rota === 'foresight' && <RadarForesight />}
            {rota === 'memetica' && <Memetica />}
            {rota === 'chat' && <ConsultorIA />}
          </div>
        )}
      </main>
    </div>
  );
}
