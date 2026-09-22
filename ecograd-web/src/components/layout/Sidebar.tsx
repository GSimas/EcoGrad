import { PAGE_LABELS, rotaVisivel } from '@/lib/navigation';
import { navigatePage, useNavigation } from '@/services/navigation';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { BookOpen, Dna, Globe2, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Radar, Search, X } from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { AtalhosEcoGrad } from './AtalhosEcoGrad';
import { OfertaDeExemplo, useTourGuiado } from './TourGuiado';
import { ExportarRelatorio } from './ExportarRelatorio';
import { FundoDinamico } from './FundoDinamico';
import { BotaoPanoramaUfsc } from './BotaoPanoramaUfsc';
import { cn } from '@/lib/utils';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import { RecorteAtivo } from './RecorteAtivo';
import type { Rota } from '@/types';

const TODAS: Array<{ rota: Rota; rotulo: string; icone: typeof LayoutDashboard }> = [
  { rota: 'dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { rota: 'busca', rotulo: 'Motor de Busca', icone: Search },
  { rota: 'exploracao', rotulo: 'Exploração Global', icone: Globe2 },
  { rota: 'foresight', rotulo: 'Foresight', icone: Radar },
  { rota: 'memetica', rotulo: 'Memética e Ontologia', icone: Dna },
];
/** Só o que está visível agora chega ao menu (`ROTAS_VISIVEIS`, em `lib/navigation`). */
const ITENS = TODAS.filter(({ rota }) => rotaVisivel(rota));

/** Cabeçalho do celular: ali o tutorial não tem o rodapé da lateral para morar. */
export function AcessosAjuda({ compacto = false }: { compacto?: boolean }) {
  return <>
    <TutorialModal><button type="button" className="btn min-h-11" aria-label="Ajuda e tutorial" title="Ajuda e tutorial"><BookOpen size={18} />{!compacto && 'Ajuda e tutorial'}</button></TutorialModal>
    <BotaoPanoramaUfsc compacto={compacto} />
  </>;
}

function Navegacao({ compacto, aoNavegar, tour }: { compacto: boolean; aoNavegar?: () => void; tour: ReturnType<typeof useTourGuiado> }) {
  const state = useEcoGradStore();
  const page = useNavigation((s) => s.page);
  // A badge lista todas as coleções; o limite de altura evita empurrar a navegação para fora da tela.
  const colecoesAtivas = [...state.programasSelecionados, ...state.cursosTccSelecionados];
  const botao = cn('btn min-h-11', compacto ? 'w-11 px-0' : 'w-full justify-start');
  return <>
    {state.dadosCarregados && <>
      {!compacto && <div className="eco-analise-ativa rounded-lg border border-eco-accent/40 bg-eco-accent/10 p-3 text-sm">
        <p className="text-xs text-slate-300">Análise ativa</p>
        {colecoesAtivas.length === 0
          ? <p className="mt-1 break-words text-eco-accent">{rotuloAnaliseAtiva(state)}</p>
          : <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto overscroll-contain pr-1">
            {colecoesAtivas.map((nome) => <li key={nome} className="break-words text-eco-accent">{nome}</li>)}
          </ul>}
        <p className="mt-2 text-xs text-slate-400">
          {colecoesAtivas.length > 0 && <>{colecoesAtivas.length.toLocaleString('pt-BR')} {colecoesAtivas.length === 1 ? 'coleção' : 'coleções'} · </>}
          {state.docs.length.toLocaleString('pt-BR')} documentos
        </p>
        <RecorteAtivo compacto />
      </div>}
      <nav aria-label="Análise" className="space-y-1">
        {ITENS.map(({ rota, rotulo, icone: Icone }) => <button key={rota} type="button"
          onClick={() => { navigatePage(rota); aoNavegar?.(); }}
          aria-label={rotulo} title={rotulo} aria-current={page === rota ? 'page' : undefined}
          className={cn(botao, page === rota && 'border-eco-accent/40 bg-eco-accent/15 text-eco-accent')}>
          <Icone size={18} className="shrink-0" />{!compacto && rotulo}
        </button>)}
      </nav>
    </>}
    {!state.dadosCarregados && !compacto && <p className="text-sm leading-relaxed text-slate-400">Escolha coleções para explorar trabalhos, pesquisadores e temas. O panorama institucional e a ajuda estão disponíveis a qualquer momento.</p>}
    <div className="flex flex-col gap-2 border-t border-eco-border pt-3">
      <BotaoPanoramaUfsc compacto={compacto} />
      <ExportarRelatorio compacto={compacto} />
    </div>
    {/* Chips do rodapé da apresentação, aqui só com o ícone: a lateral é estreita
        e os três nomes ocupariam duas linhas. Créditos e repositório ficam no
        "Sobre" e no rodapé da apresentação, sem repetição aqui. */}
    <AtalhosEcoGrad somenteIcone empilhado={compacto} className="mt-auto border-t border-eco-border pt-3"
      aoFazerTour={() => { aoNavegar?.(); tour.comecar(); }} />
  </>;
}

export function Sidebar() {
  // O tour vive aqui, e não dentro de `Navegacao`: no celular a gaveta se
  // fecha ao começar o tour, e um tour preso ao componente que fecha morreria
  // no mesmo instante. A barra lateral fica montada o tempo todo.
  const tour = useTourGuiado();
  const recolhida = useEcoGradStore((s) => s.sidebarRecolhida);
  const alternar = useEcoGradStore((s) => s.alternarSidebar);
  const page = useNavigation((s) => s.page);
  const revision = useNavigation((n) => n.revision);
  const [menu, setMenu] = useState(false);
  const navegou = useRef(false);
  useEffect(() => { setMenu(false); }, [revision]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const ajustar = () => { if (desktop.matches) setMenu(false); };
    desktop.addEventListener('change', ajustar);
    return () => desktop.removeEventListener('change', ajustar);
  }, []);
  return <>
    <aside aria-label="Navegação principal" className={cn('eco-sidebar relative hidden h-full shrink-0 flex-col border-r border-eco-border bg-eco-panel/40 lg:flex', recolhida ? 'w-16' : 'w-72')}>
      {/* O canvas fica fora do container que rola; senão a decoração subiria com o conteúdo. */}
      <FundoDinamico className="absolute inset-0" />
      <div className={cn('relative z-10 flex h-full min-h-0 flex-col gap-3 overflow-y-auto', recolhida ? 'p-2' : 'p-4')}>
      <button type="button" onClick={() => navigatePage('inicio')} className={cn('eco-brand-home flex min-h-12 items-center gap-3 rounded-lg text-left', recolhida ? 'w-12 justify-center' : 'w-full px-2')} aria-label="Voltar à apresentação do EcoGrad" title="Voltar à apresentação">
        <img src="/ecograd-logo.png" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />{!recolhida && <strong className="text-eco-accent">EcoGrad · UFSC</strong>}
      </button>
      <button type="button" className="btn min-h-11" onClick={alternar} aria-expanded={!recolhida} aria-label={recolhida ? 'Expandir painel lateral' : 'Recolher painel lateral'} title={recolhida ? 'Expandir painel lateral' : 'Recolher painel lateral'}>
        {recolhida ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> Recolher painel</>}
      </button>
        <Navegacao compacto={recolhida} tour={tour} />
      </div>
    </aside>
    <header className="flex shrink-0 items-center gap-2 border-b border-eco-border bg-eco-panel px-2 py-2 lg:hidden">
      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Trigger asChild><button className="btn h-11 w-11 shrink-0 px-0" aria-label="Abrir menu de navegação"><Menu size={20} /></button></Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay className="eco-dialog-overlay fixed inset-0 z-40 bg-black/70 lg:hidden" />
          <Dialog.Content className="eco-drawer-content fixed inset-y-0 left-0 z-50 flex w-[min(20rem,90vw)] flex-col gap-3 overflow-y-auto overscroll-contain border-r border-eco-border bg-eco-bg p-4 lg:hidden"
            onCloseAutoFocus={(event) => { if (navegou.current) { event.preventDefault(); navegou.current = false; document.getElementById('conteudo-principal')?.focus(); } }}>
            <div className="flex items-center justify-between gap-2"><Dialog.Title className="font-semibold text-eco-accent">Menu EcoGrad</Dialog.Title><Dialog.Close className="btn h-11 w-11 px-0" aria-label="Fechar menu de navegação"><X size={20} /></Dialog.Close></div>
            <Dialog.Description className="sr-only">Navegue pela análise, edite as coleções ou abra a ajuda e os dados CAPES.</Dialog.Description>
            <Navegacao compacto={false} tour={tour} aoNavegar={() => { navegou.current = true; setMenu(false); }} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* Mesma marca da lateral do desktop: no celular ela é o único caminho de volta à apresentação. */}
      <button type="button" onClick={() => navigatePage('inicio')} className="eco-brand-home flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left" aria-label="Voltar à apresentação do EcoGrad" title="Voltar à apresentação">
        <img src="/ecograd-logo.png" alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-eco-accent">EcoGrad</span><span className="block truncate text-xs text-slate-400">{PAGE_LABELS[page]}</span></span>
      </button>
      <AcessosAjuda compacto />
    </header>
    <OfertaDeExemplo tour={tour} />
  </>;
}
