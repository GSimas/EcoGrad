import { useMemo } from 'react';
import { relacionados } from '@/lib/resultados';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { ChevronRight, FileText, GraduationCap, Handshake, Layers3, Tag, UserRound, UsersRound } from 'lucide-react';
import type { Documento, TipoBusca } from '@/types';
export function Relacoes({ docs, tipo, titulo }: { docs: readonly Documento[]; tipo: TipoBusca; titulo: string }) {
  const itens = useMemo(() => relacionados(docs, tipo), [docs, tipo]);
  const navegar = useEcoGradStore((s) => s.navegarPara);
  const Icone = {
    Documento: FileText,
    Pessoa: UsersRound,
    Autor: UserRound,
    Orientador: GraduationCap,
    'Co-orientador': Handshake,
    'Palavra-chave': Tag,
    Macrotema: Layers3,
  }[tipo];
  return <section className="card space-y-4" aria-label={titulo}>
    <header className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-accent/12 text-eco-accent"><Icone size={18} aria-hidden="true" /></span>
      <div className="min-w-0"><h3 className="text-base font-semibold">{titulo}</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">Até 8 nomes com mais registros neste conjunto. A frequência descreve o recorte e não representa qualidade ou disponibilidade para orientar.</p></div>
    </header>
    {itens.length ? <ul className="grid gap-2 xl:grid-cols-2">{itens.slice(0, 8).map(([nome, n]) => <li key={nome} className="min-w-0"><button type="button" className="eco-entity-link group flex h-full min-h-14 w-full items-center gap-2.5 rounded-lg border border-eco-border bg-eco-bg/40 px-3 py-2.5 text-left" onClick={() => navegar(tipo, nome)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-eco-accent/10 text-eco-accent"><Icone size={15} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-100">{nome}</span>
      <span className="shrink-0 rounded-full border border-eco-border bg-eco-panel px-2 py-1 text-[.68rem] font-semibold tabular-nums text-slate-300">{n} reg.</span>
      <ChevronRight size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
    </button></li>)}</ul> : <p className="rounded-lg border border-dashed border-eco-border p-4 text-sm text-slate-300">Nenhum nome preenchido neste conjunto.</p>}
  </section>;
}
