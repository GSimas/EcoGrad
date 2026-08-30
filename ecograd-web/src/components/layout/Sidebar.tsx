import {
  BookOpen,
  BotMessageSquare,
  ChevronLeft,
  Dna,
  Github,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  RotateCcw,
  Search,
} from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { cn } from '@/lib/utils';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';
import type { Rota } from '@/types';

const ITENS: Array<{ rota: Rota; rotulo: string; icone: typeof LayoutDashboard }> = [
  { rota: 'dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { rota: 'busca', rotulo: 'Motor de Busca', icone: Search },
  { rota: 'foresight', rotulo: 'Foresight', icone: Radar },
  { rota: 'memetica', rotulo: 'Memética e Ontologia', icone: Dna },
  { rota: 'chat', rotulo: 'Consultor IA', icone: BotMessageSquare },
];

export function Sidebar() {
  const dadosCarregados = useEcoGradStore((s) => s.dadosCarregados);
  const novaConsulta = useEcoGradStore((s) => s.novaConsulta);
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);
  const totalDocs = useEcoGradStore((s) => s.docs.length);
  // A rota vive no store para que `navegarPara` (usado pelos cliques do
  // Dashboard) consiga abrir o Motor de Busca junto com a entidade.
  const rota = useEcoGradStore((s) => s.rota);
  const onRota = useEcoGradStore((s) => s.setRota);
  const voltarParaApresentacao = useEcoGradStore((s) => s.voltarParaApresentacao);
  const recolhida = useEcoGradStore((s) => s.sidebarRecolhida);
  const alternarSidebar = useEcoGradStore((s) => s.alternarSidebar);

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col gap-4 overflow-y-auto overflow-x-hidden border-r border-eco-border bg-eco-panel/40 transition-[width] duration-200',
        recolhida ? 'w-16 items-center p-2' : 'w-72 p-5',
      )}
    >
      <div className={cn('flex w-full items-center gap-3', recolhida && 'justify-center')}>
        <img
          src="/ecograd-logo.png"
          alt="EcoGrad"
          className={cn('rounded-lg object-contain', recolhida ? 'h-9 w-9' : 'h-11 w-11')}
        />
        {!recolhida && (
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-eco-accent">EcoGrad</p>
            <p className="truncate text-[11px] leading-tight text-slate-400">
              Ecologia do Conhecimento · UFSC
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={alternarSidebar}
        title={recolhida ? 'Expandir painel lateral' : 'Recolher painel lateral'}
        aria-label={recolhida ? 'Expandir painel lateral' : 'Recolher painel lateral'}
        aria-expanded={!recolhida}
        className={cn('btn', recolhida ? 'w-11 justify-center px-0' : 'w-full')}
      >
        {recolhida ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={14} />}
        {!recolhida && 'Recolher painel'}
      </button>

      {/*
        Com a base carregada, a Sidebar mostra somente a badge de análise ativa,
        o botão de reinício e a navegação — os seletores voltam para a tela inicial.
      */}
      {dadosCarregados ? (
        <div className={cn('w-full', recolhida ? 'space-y-2' : 'space-y-3')}>
          {!recolhida && (
            <div className="rounded-lg border border-eco-accent/40 bg-eco-accent/10 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-eco-accent/80">
                Análise Ativa
              </p>
              <p className="mt-0.5 break-words text-sm font-medium text-eco-accent">{rotulo}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {totalDocs.toLocaleString('pt-BR')} documentos
              </p>
            </div>
          )}

          <button
            type="button"
            className={cn('btn', recolhida ? 'w-11 justify-center px-0' : 'w-full')}
            onClick={novaConsulta}
            title="Nova Consulta"
            aria-label="Nova Consulta"
          >
            <RotateCcw size={14} />
            {!recolhida && 'Nova Consulta'}
          </button>

          <nav className={cn('pt-1', recolhida ? 'space-y-1.5' : 'space-y-1')}>
            {ITENS.map(({ rota: r, rotulo: nome, icone: Icone }) => (
              <button
                key={r}
                type="button"
                onClick={() => onRota(r)}
                title={nome}
                aria-label={nome}
                aria-current={rota === r ? 'page' : undefined}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition',
                  recolhida ? 'h-11 w-11 justify-center' : 'w-full gap-2.5 px-3 py-2',
                  rota === r
                    ? 'bg-eco-accent/15 text-eco-accent'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
              >
                <Icone size={16} />
                {!recolhida && nome}
              </button>
            ))}
          </nav>
        </div>
      ) : (
        !recolhida && (
          <div className="space-y-4 text-sm text-slate-400">
            <section>
              <h3 className="mb-1 text-sm font-semibold text-eco-accent">🎓 Sobre o EcoGrad</h3>
              <p className="text-xs leading-relaxed">
                Plataforma analítica que mapeia e visualiza as redes de produção acadêmica da
                Pós-Graduação (Teses e Dissertações) e da Graduação (TCCs).
              </p>
            </section>
            <section>
              <h3 className="mb-1 text-sm font-semibold text-eco-accent">⚙️ Como Funciona</h3>
              <p className="text-xs leading-relaxed">
                Os documentos são processados com algoritmos de redes complexas aliados a
                Inteligência Artificial, revelando como pesquisadores, teorias e ferramentas se
                interconectam.
              </p>
            </section>
            <section>
              <h3 className="mb-1 text-sm font-semibold text-eco-accent">🧭 Como Utilizar</h3>
              <ol className="list-inside list-decimal space-y-1 text-xs leading-relaxed">
                <li>Selecione os cursos e origens na tela principal.</li>
                <li>Navegue pelos Dashboards e visualize perfis no Motor de Busca.</li>
                <li>Explore um Autor, Orientador ou Conceito.</li>
                <li>Acesse Foresight e Memética para métricas avançadas.</li>
              </ol>
            </section>

            <div className="space-y-2 pt-1">
              <TutorialModal>
                <button type="button" className="btn w-full">
                  <BookOpen size={14} /> Ver tutorial
                </button>
              </TutorialModal>
              <button type="button" className="btn w-full" onClick={voltarParaApresentacao}>
                <ChevronLeft size={14} /> Voltar à apresentação
              </button>
            </div>
          </div>
        )
      )}

      {!recolhida && (
        <footer className="mt-auto w-full border-t border-eco-border pt-4 text-xs text-slate-500">
          Desenvolvido por <span className="text-slate-300">Gustavo Simas</span>
          <a
            href="https://github.com/GSimas"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5 text-eco-accent hover:text-amber-300"
          >
            <Github size={13} /> GitHub: GSimas
          </a>
        </footer>
      )}
    </aside>
  );
}
