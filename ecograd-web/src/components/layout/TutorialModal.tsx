import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeft,
  ArrowRight,
  BotMessageSquare,
  Check,
  Dna,
  LayoutDashboard,
  Radar,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Passo {
  icone: LucideIcon;
  titulo: string;
  corpo: ReactNode;
}

const PASSOS: Passo[] = [
  {
    icone: LayoutDashboard,
    titulo: '1. Escolha as coleções e veja o panorama',
    corpo: (
      <>
        <p>
          Você começa selecionando um ou mais <strong>Programas de Pós-Graduação</strong> e/ou
          cursos de <strong>Graduação (TCC)</strong>. Pode combinar quantos quiser — a análise passa
          a tratar tudo como um só ecossistema, e um comparativo entre os programas aparece
          automaticamente.
        </p>
        <p>
          O <strong>Dashboard</strong> traz os números da base, a ficha oficial da CAPES, uma
          síntese do perfil de pesquisa escrita por IA e os indicadores de maturidade da rede
          (assortatividade, rich-club, expoente γ).
        </p>
      </>
    ),
  },
  {
    icone: Search,
    titulo: '2. Clique em qualquer nome para abrir o dossiê',
    corpo: (
      <>
        <p>
          Todo nome que aparece no Dashboard é clicável — orientadores, coorientadores, autores,
          palavras-chave, macrotemas e títulos. Um clique leva direto ao{' '}
          <strong>Motor de Busca</strong> com o dossiê daquela entidade já aberto.
        </p>
        <p>O dossiê reúne cinco visões:</p>
        <ul>
          <li>
            <strong>Raio-X de Especialização</strong> — peculiaridade temática, densidade local na
            rede e raridade do vocabulário.
          </li>
          <li>
            <strong>Evolução Histórica</strong> — produção ano a ano, com opção cumulativa.
          </li>
          <li>
            <strong>Lexicometria</strong> — nuvem de palavras de conceitos, títulos ou resumos.
          </li>
          <li>
            <strong>Órbita</strong> — grafo animado das conexões, com player temporal.
          </li>
          <li>
            <strong>Itens Semelhantes</strong> — recomendação por Índice de Jaccard.
          </li>
        </ul>
      </>
    ),
  },
  {
    icone: Radar,
    titulo: '3. Prospecte tendências no Radar de Foresight',
    corpo: (
      <>
        <p>
          O Radar cruza <strong>Momentum Temporal</strong> (o quanto um termo acelerou nos últimos
          anos) com <strong>Novidade Estrutural</strong> (o quanto ele conecta áreas distantes da
          rede), separando os termos em quatro quadrantes:
        </p>
        <ul>
          <li>
            <span style={{ color: '#2ECC71' }}>↗️ Tendências</span> — bursts já validados pela rede.
          </li>
          <li>
            <span style={{ color: '#F1C40F' }}>↖️ Sinais Fracos</span> — pivôs raros, ainda pouco
            usados: é onde a prospecção rende mais.
          </li>
          <li>
            <span style={{ color: '#3498DB' }}>↘️ Mainstream</span> — temas consolidados em
            expansão.
          </li>
          <li>
            <span style={{ color: '#E74C3C' }}>↙️ Base/Declínio</span> — vocabulário estrutural ou
            em desuso.
          </li>
        </ul>
        <p>
          O <strong>Grid Search</strong> testa 108 configurações do modelo contra a história real da
          base e mostra qual delas acertou mais.
        </p>
      </>
    ),
  },
  {
    icone: Dna,
    titulo: '4. Acompanhe a genética das ideias',
    corpo: (
      <>
        <p>
          Em <strong>Memética e Ontologia</strong> cada conceito é tratado como um meme que se
          replica: quantos trabalhos ele gerou (fecundidade), quantos morreram na primeira aparição
          (mortalidade infantil) e por quantos anos sobreviveram (longevidade).
        </p>
        <p>
          Você também pode pedir à IA que leia os resumos e extraia as{' '}
          <strong>teorias, métodos e ferramentas</strong> realmente usados — indo além das
          palavras-chave genéricas. O catálogo pode ser exportado em CSV e recarregado depois, sem
          gastar cota da API de novo.
        </p>
      </>
    ),
  },
  {
    icone: BotMessageSquare,
    titulo: '5. Converse com o Consultor Acadêmico',
    corpo: (
      <>
        <p>
          O <strong>Consultor IA</strong> recebe o dossiê completo do programa: as métricas de rede,
          o mapa de especialidades de cada docente e o catálogo de trabalhos com os links do
          repositório.
        </p>
        <p>
          Descreva sua ideia de projeto e ele indica orientadores compatíveis e teses para ler — com
          os títulos já como links clicáveis. Como toda IA, pode errar: confira as recomendações
          antes de decidir.
        </p>
      </>
    ),
  },
];

/** Tutorial passo a passo, aberto a partir da tela de apresentação. */
export function TutorialModal({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);

  const atual = PASSOS[passo];
  const Icone = atual.icone;
  const ultimo = passo === PASSOS.length - 1;

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        // Reinicia no primeiro passo sempre que o tutorial é reaberto
        if (!v) setPasso(0);
      }}
    >
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(46rem,92vw)]
            -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl
            border border-eco-border bg-eco-panel shadow-2xl shadow-black/60
            focus:outline-none"
        >
          <header className="flex items-start gap-3 border-b border-eco-border p-5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent">
              <Icone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-eco-accent">
                {atual.titulo}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500">
                Passo {passo + 1} de {PASSOS.length} · Como usar o EcoGrad
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
              aria-label="Fechar tutorial"
            >
              <X size={18} />
            </Dialog.Close>
          </header>

          <div className="markdown flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-slate-300">
            {atual.corpo}
          </div>

          <footer className="flex items-center gap-3 border-t border-eco-border p-4">
            <div className="flex flex-1 gap-1.5">
              {PASSOS.map((p, i) => (
                <button
                  key={p.titulo}
                  type="button"
                  onClick={() => setPasso(i)}
                  aria-label={`Ir para o passo ${i + 1}`}
                  aria-current={i === passo}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition',
                    i === passo ? 'bg-eco-accent' : 'bg-eco-border hover:bg-slate-600',
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              className="btn"
              onClick={() => setPasso((p) => Math.max(0, p - 1))}
              disabled={passo === 0}
            >
              <ArrowLeft size={14} /> Anterior
            </button>

            {ultimo ? (
              <Dialog.Close className="btn btn-primary">
                <Check size={14} /> Entendi
              </Dialog.Close>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPasso((p) => Math.min(PASSOS.length - 1, p + 1))}
              >
                Próximo <ArrowRight size={14} />
              </button>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
