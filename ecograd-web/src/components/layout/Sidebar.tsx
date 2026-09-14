import { Aparencia } from './Aparencia';
import { PAGE_LABELS } from '@/lib/navigation';
import { navigatePage, useNavigation } from '@/services/navigation';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { BookOpen, Dna, Github, Landmark, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Radar, Search, X } from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { Janela } from './Janela';
import { PanoramaCapes } from '@/components/dashboard/PanoramaCapes';
import { SelecaoInicial } from './SelecaoInicial';
import { cn } from '@/lib/utils';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Rota } from '@/types';

const ITENS: Array<{ rota: Rota; rotulo: string; icone: typeof LayoutDashboard }> = [
  { rota: 'dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { rota: 'busca', rotulo: 'Motor de Busca', icone: Search },
  { rota: 'foresight', rotulo: 'Foresight', icone: Radar },
  { rota: 'memetica', rotulo: 'Memética e Ontologia', icone: Dna },
];

export function AcessosAjuda({ compacto = false }: { compacto?: boolean }) {
  return <>
    <TutorialModal><button type="button" className="btn min-h-11" aria-label="Ajuda e tutorial" title="Ajuda e tutorial"><BookOpen size={18} />{!compacto && 'Ajuda e tutorial'}</button></TutorialModal>
    <Janela titulo="Panorama CAPES" descricao="Dados institucionais da UFSC, independentes das coleções da sua análise." larga
      trigger={<button type="button" className="btn min-h-11" aria-label="Abrir Panorama CAPES" title="Panorama CAPES"><Landmark size={18} />{!compacto && 'Panorama CAPES'}</button>}>
      <PanoramaCapes />
    </Janela>
  </>;
}

function Navegacao({ compacto, aoNavegar }: { compacto: boolean; aoNavegar?: () => void }) {
  const state = useEcoGradStore();
  const page = useNavigation((s) => s.page);
  const revision = useNavigation((n) => n.revision);
  const [editar, setEditar] = useState(false);
  const [nova, setNova] = useState(false);
  useEffect(() => { setEditar(false); setNova(false); }, [revision]);
  const docsAnteriores = useRef(state.docs);
  useEffect(() => {
    if (state.docs !== docsAnteriores.current) {
      if (editar) { setEditar(false); aoNavegar?.(); }
      docsAnteriores.current = state.docs;
    }
  }, [state.docs]);
  const botao = cn('btn min-h-11', compacto ? 'w-11 px-0' : 'w-full justify-start');
  return <>
    {state.dadosCarregados && <>
      {!compacto && <div className="eco-analise-ativa rounded-lg border border-eco-accent/40 bg-eco-accent/10 p-3 text-sm">
        <p className="text-xs text-slate-300">Análise ativa</p>
        <p className="mt-1 break-words text-eco-accent">{rotuloAnaliseAtiva(state)}</p>
        <p className="mt-1 text-xs text-slate-400">{state.docs.length.toLocaleString('pt-BR')} documentos</p>
      </div>}
      <nav aria-label="Análise" className="space-y-1">
        {ITENS.map(({ rota, rotulo, icone: Icone }) => <button key={rota} type="button"
          onClick={() => { navigatePage(rota); aoNavegar?.(); }}
          aria-label={rotulo} title={rotulo} aria-current={page === rota ? 'page' : undefined}
          className={cn(botao, page === rota && 'border-eco-accent/40 bg-eco-accent/15 text-eco-accent')}>
          <Icone size={18} className="shrink-0" />{!compacto && rotulo}
        </button>)}
      </nav>
      <div className="space-y-2 border-t border-eco-border pt-3">
        <Janela titulo="Editar seleção" descricao="A análise atual permanece disponível até o novo carregamento terminar." aberta={editar} onOpenChange={setEditar} larga
          trigger={<button type="button" className={botao} aria-label="Editar seleção" title="Editar seleção"><Pencil size={18} />{!compacto && 'Editar seleção'}</button>}>
          <SelecaoInicial edicao onVoltar={() => { setEditar(false); aoNavegar?.(); }} />
        </Janela>
        <Janela titulo="Iniciar nova análise" descricao="Esta ação encerra as atividades em andamento e descarta os resultados, rascunhos e a conversa da análise atual. Você voltará à seleção com as coleções desmarcadas." aberta={nova} onOpenChange={setNova}
          trigger={<button type="button" className={botao} aria-label="Nova análise" title="Nova análise"><Plus size={18} />{!compacto && 'Nova análise'}</button>}>
          <div className="flex flex-wrap gap-3">
            <button className="btn" type="button" onClick={() => setNova(false)}>Manter análise atual</button>
            <button className="btn btn-primary" type="button" onClick={() => { setNova(false); state.novaConsulta(); aoNavegar?.(); }}>Encerrar análise e selecionar coleções</button>
          </div>
        </Janela>
      </div>
    </>}
    {!state.dadosCarregados && !compacto && <p className="text-sm leading-relaxed text-slate-400">Escolha coleções para explorar trabalhos, pesquisadores e temas. O panorama institucional e a ajuda estão disponíveis a qualquer momento.</p>}
    <div className="flex flex-col gap-2 border-t border-eco-border pt-3"><AcessosAjuda compacto={compacto} /><Aparencia compacto={compacto} /></div>
    {!compacto && <footer className="mt-auto border-t border-eco-border pt-4 text-xs text-slate-400">
      Desenvolvido por <a href="https://gustavosimas.com" target="_blank" rel="noopener noreferrer" className="text-slate-300 underline hover:text-eco-accent">Gustavo Simas</a>
      <a href="https://github.com/GSimas/EcoGrad/tree/main" target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-8 items-center gap-2 text-eco-accent"><Github size={14} /> GitHub: EcoGrad</a>
    </footer>}
  </>;
}

export function Sidebar() {
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
    <aside aria-label="Navegação principal" className={cn('eco-sidebar hidden h-full shrink-0 flex-col gap-3 overflow-y-auto border-r border-eco-border bg-eco-panel/40 lg:flex', recolhida ? 'w-16 p-2' : 'w-72 p-4')}>
      <button type="button" onClick={() => navigatePage('inicio')} className={cn('eco-brand-home flex min-h-12 items-center gap-3 rounded-lg text-left', recolhida ? 'w-12 justify-center' : 'w-full px-2')} aria-label="Voltar à apresentação do EcoGrad" title="Voltar à apresentação">
        <img src="/ecograd-logo.png" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />{!recolhida && <strong className="text-eco-accent">EcoGrad · UFSC</strong>}
      </button>
      <button type="button" className="btn min-h-11" onClick={alternar} aria-expanded={!recolhida} aria-label={recolhida ? 'Expandir painel lateral' : 'Recolher painel lateral'} title={recolhida ? 'Expandir painel lateral' : 'Recolher painel lateral'}>
        {recolhida ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> Recolher painel</>}
      </button>
      <Navegacao compacto={recolhida} />
    </aside>
    <header className="flex shrink-0 items-center gap-2 border-b border-eco-border bg-eco-panel px-2 py-2 lg:hidden">
      <Dialog.Root open={menu} onOpenChange={setMenu}>
        <Dialog.Trigger asChild><button className="btn h-11 w-11 shrink-0 px-0" aria-label="Abrir menu de navegação"><Menu size={20} /></button></Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay className="eco-dialog-overlay fixed inset-0 z-40 bg-black/70 lg:hidden" />
          <Dialog.Content className="eco-drawer-content fixed inset-y-0 left-0 z-50 flex w-[min(20rem,90vw)] flex-col gap-3 overflow-y-auto overscroll-contain border-r border-eco-border bg-eco-bg p-4 lg:hidden"
            onCloseAutoFocus={(event) => { if (navegou.current) { event.preventDefault(); navegou.current = false; document.getElementById('conteudo-principal')?.focus(); } }}>
            <div className="flex items-center justify-between gap-2"><Dialog.Title className="font-semibold text-eco-accent">Menu EcoGrad</Dialog.Title><Dialog.Close className="btn h-11 w-11 px-0" aria-label="Fechar menu de navegação"><X size={20} /></Dialog.Close></div>
            <Dialog.Description className="sr-only">Navegue pela análise, edite as coleções ou abra a ajuda e os dados CAPES.</Dialog.Description>
            <Navegacao compacto={false} aoNavegar={() => { navegou.current = true; setMenu(false); }} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold text-eco-accent">EcoGrad</p><p className="truncate text-xs text-slate-400">{PAGE_LABELS[page]}</p></div>
      <AcessosAjuda compacto />
    </header>
  </>;
}
