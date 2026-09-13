import { useMemo } from 'react';
import { relacionados } from '@/lib/resultados';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Documento, TipoBusca } from '@/types';
export function Relacoes({ docs, tipo, titulo }: { docs: readonly Documento[]; tipo: TipoBusca; titulo: string }) {
  const itens = useMemo(() => relacionados(docs, tipo), [docs, tipo]);
  const navegar = useEcoGradStore((s) => s.navegarPara);
  return <section className="card space-y-3" aria-label={titulo}>
    <h3 className="text-base font-semibold">{titulo}</h3>
    <p className="text-xs text-slate-400">Até 8 nomes com mais registros neste conjunto. Frequência não indica qualidade ou disponibilidade para orientar.</p>
    {itens.length ? <ul className="space-y-1">{itens.slice(0, 8).map(([nome, n]) => <li key={nome}><button type="button" className="flex min-h-11 w-full items-start justify-between gap-3 rounded px-2 py-2 text-left text-sm text-eco-accent hover:bg-white/5" onClick={() => navegar(tipo, nome)}><span className="min-w-0 break-words">{nome}</span><span className="shrink-0 text-xs text-slate-300">{n} reg.</span></button></li>)}</ul> : <p className="text-sm text-slate-300">Nenhum nome preenchido neste conjunto.</p>}
  </section>;
}
