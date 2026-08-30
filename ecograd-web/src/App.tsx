import { useState } from 'react';
import { Sidebar, type Rota } from '@/components/layout/Sidebar';
import { SelecaoInicial } from '@/components/layout/SelecaoInicial';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { MotorBusca } from '@/components/search-engine/MotorBusca';
import { RadarForesight } from '@/components/foresight/RadarForesight';
import { Memetica } from '@/components/memetics/Memetica';
import { ConsultorIA } from '@/components/chat/ConsultorIA';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

export default function App() {
  const dadosCarregados = useEcoGradStore((s) => s.dadosCarregados);
  const [rota, setRota] = useState<Rota>('dashboard');

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar rota={rota} onRota={setRota} />
      <main className="flex-1 overflow-y-auto">
        {!dadosCarregados ? (
          <SelecaoInicial />
        ) : (
          <div className="mx-auto h-full max-w-[1400px] p-6 lg:p-8">
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
