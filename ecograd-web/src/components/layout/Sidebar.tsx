import {
  BotMessageSquare,
  Dna,
  Github,
  LayoutDashboard,
  Radar,
  RotateCcw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { rotuloAnaliseAtiva, useEcoGradStore } from '@/stores/useEcoGradStore';

export type Rota = 'dashboard' | 'busca' | 'foresight' | 'memetica' | 'chat';

const ITENS: Array<{ rota: Rota; rotulo: string; icone: typeof LayoutDashboard }> = [
  { rota: 'dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { rota: 'busca', rotulo: 'Motor de Busca', icone: Search },
  { rota: 'foresight', rotulo: 'Foresight', icone: Radar },
  { rota: 'memetica', rotulo: 'Memética e Ontologia', icone: Dna },
  { rota: 'chat', rotulo: 'Consultor IA', icone: BotMessageSquare },
];

export function Sidebar({ rota, onRota }: { rota: Rota; onRota: (r: Rota) => void }) {
  const dadosCarregados = useEcoGradStore((s) => s.dadosCarregados);
  const novaConsulta = useEcoGradStore((s) => s.novaConsulta);
  const rotulo = useEcoGradStore(rotuloAnaliseAtiva);
  const totalDocs = useEcoGradStore((s) => s.docs.length);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-eco-border bg-eco-panel/40 p-5">
      <div className="flex items-center gap-3">
        <img src="/ecograd-logo.png" alt="EcoGrad" className="h-11 w-11 rounded-lg object-contain" />
        <div>
          <p className="text-base font-bold text-eco-accent">EcoGrad</p>
          <p className="text-[11px] leading-tight text-slate-400">Ecologia do Conhecimento · UFSC</p>
        </div>
      </div>

      {/*
        Com a base carregada, a Sidebar mostra somente a badge de análise ativa
        e o botão de reinício — os seletores voltam para a tela inicial.
      */}
      {dadosCarregados ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-eco-accent/40 bg-eco-accent/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-eco-accent/80">
              Análise Ativa
            </p>
            <p className="mt-0.5 break-words text-sm font-medium text-eco-accent">{rotulo}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {totalDocs.toLocaleString('pt-BR')} documentos
            </p>
          </div>

          <button type="button" className="btn w-full" onClick={novaConsulta}>
            <RotateCcw size={14} /> Nova Consulta
          </button>

          <nav className="space-y-1 pt-2">
            {ITENS.map(({ rota: r, rotulo: nome, icone: Icone }) => (
              <button
                key={r}
                type="button"
                onClick={() => onRota(r)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                  rota === r
                    ? 'bg-eco-accent/15 text-eco-accent'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
              >
                <Icone size={16} />
                {nome}
              </button>
            ))}
          </nav>
        </div>
      ) : (
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
              Os documentos são processados com algoritmos de redes complexas aliados a Inteligência
              Artificial, revelando como pesquisadores, teorias e ferramentas se interconectam.
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
        </div>
      )}

      <footer className="mt-auto border-t border-eco-border pt-4 text-xs text-slate-500">
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
    </aside>
  );
}
