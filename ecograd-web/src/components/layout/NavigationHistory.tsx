import { ArrowLeft, ArrowRight } from 'lucide-react';
import { navigateBack, navigateForward, navigatePage, navigateVisit, useNavigation } from '@/services/navigation';
import { visitLabel } from '@/lib/navigation';
export function NavigationHistory() {
  const { visits, current, notice, storageError } = useNavigation();
  const index = visits.findIndex((v) => v.id === current);
  const previous = visits[index - 1];
  return <nav aria-label="Percurso da análise" className="mx-3 mb-3 space-y-2 rounded-lg border border-eco-border p-2 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn min-h-11" disabled={!previous} onClick={navigateBack} title={previous ? `Voltar para ${visitLabel(previous)}` : 'Nenhuma página anterior nesta análise'} aria-label="Voltar no percurso"><ArrowLeft size={16} />Voltar</button>
      <button type="button" className="btn min-h-11" disabled={index < 0 || index >= visits.length - 1} onClick={navigateForward} aria-label="Avançar no percurso"><ArrowRight size={16} />Avançar</button>
      <label className="flex min-w-0 w-full flex-none flex-col sm:w-auto sm:flex-1 gap-1 text-slate-300">Histórico desta análise
        <select className="input min-w-0 w-full" value={current} onChange={(e) => navigateVisit(e.target.value)}>
          {visits.map((v, i) => <option key={v.id} value={v.id}>{i + 1}. {visitLabel(v)}</option>)}
        </select>
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
