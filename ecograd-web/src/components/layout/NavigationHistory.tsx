import { useId } from 'react';
import { Select } from '@/components/ui/Select';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { navigateBack, navigateForward, navigatePage, navigateVisit, useNavigation } from '@/services/navigation';
import { visitLabel } from '@/lib/navigation';
export function NavigationHistory() {
  const idHistorico = useId();
  // Só o que o painel mostra: posição de rolagem e revisão mudam a cada navegação e não o afetam.
  const { visits, current, notice, storageError } = useNavigation(useShallow((s) => ({ visits: s.visits, current: s.current, notice: s.notice, storageError: s.storageError })));
  const index = visits.findIndex((v) => v.id === current);
  const previous = visits[index - 1];
  return <nav aria-label="Percurso da análise" className="mx-3 mb-3 space-y-2 rounded-lg border border-eco-border p-2 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn min-h-11" disabled={!previous} onClick={navigateBack} title={previous ? `Voltar para ${visitLabel(previous)}` : 'Nenhuma página anterior nesta análise'} aria-label="Voltar no percurso"><ArrowLeft size={16} />Voltar</button>
      <button type="button" className="btn min-h-11" disabled={index < 0 || index >= visits.length - 1} onClick={navigateForward} aria-label="Avançar no percurso"><ArrowRight size={16} />Avançar</button>
      <label htmlFor={idHistorico} className="flex min-w-0 w-full flex-none flex-col sm:w-auto sm:flex-1 gap-1 text-slate-300">Histórico desta análise
        <Select id={idHistorico} aria-label="Histórico desta análise" className="min-w-0" valor={current ?? ''} onChange={(v) => navigateVisit(v)} opcoes={visits.map((v, i) => ({ valor: v.id, rotulo: `${i + 1}. ${visitLabel(v)}` }))} />
      </label>
    </div>
    {previous && <p className="break-words text-slate-400">Origem: {visitLabel(previous)}</p>}
    {notice && <p role="status" className="text-amber-200">{notice}</p>}
    {storageError && <p role="status" className="text-amber-200">{storageError}</p>}
  </nav>;
}
export function UnknownPage() {
  return <section className="space-y-3 p-6">
    <h1 className="text-2xl font-bold">Página não encontrada</h1>
    <p>Este endereço não corresponde a uma página do EcoGrad. Sua sessão permanece disponível.</p>
    <button type="button" className="btn" onClick={() => navigatePage('dashboard')}>Abrir Dashboard</button>
    <button type="button" className="btn" onClick={() => navigatePage('inicio')}>Ir para o início</button>
  </section>;
}
