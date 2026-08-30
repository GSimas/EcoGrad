import {
  ArrowRight,
  BookOpen,
  BotMessageSquare,
  Dna,
  Github,
  Network,
  Radar,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { useEcoGradStore } from '@/stores/useEcoGradStore';

interface Recurso {
  icone: LucideIcon;
  titulo: string;
  texto: string;
}

const RECURSOS: Recurso[] = [
  {
    icone: Network,
    titulo: 'Redes complexas',
    texto:
      'Documentos, autores, orientadores, conceitos e macrotemas viram um único grafo. Centralidade de grau, intermediação, proximidade e comunidades de Louvain revelam quem lidera, quem faz ponte entre áreas e onde estão os clusters.',
  },
  {
    icone: Search,
    titulo: 'Dossiê por entidade',
    texto:
      'Cada pessoa ou conceito ganha uma ficha completa: especialização temática, evolução histórica, nuvem de palavras, órbita animada de relacionamentos e trabalhos semelhantes por Índice de Jaccard.',
  },
  {
    icone: Radar,
    titulo: 'Prospecção de tendências',
    texto:
      'O Radar de Foresight cruza aceleração temporal com novidade estrutural para separar tendências consolidadas de sinais fracos — e valida o próprio modelo contra a história real da base.',
  },
  {
    icone: Dna,
    titulo: 'Memética e ontologia',
    texto:
      'As ideias são tratadas como memes que se replicam: fecundidade, mortalidade infantil e tempo de meia-vida. A IA lê os resumos e extrai as teorias, métodos e ferramentas realmente utilizados.',
  },
  {
    icone: BotMessageSquare,
    titulo: 'Consultor acadêmico',
    texto:
      'Um assistente que conhece a topologia da rede e o catálogo inteiro do programa, para sugerir orientadores compatíveis com sua ideia e indicar teses para ler, com link direto para o repositório.',
  },
  {
    icone: Sparkles,
    titulo: 'Dados oficiais',
    texto:
      'A produção do repositório da UFSC é cruzada com a ficha oficial da Plataforma Sucupira (CAPES): conceito, área de avaliação, modalidade e situação de cada programa.',
  },
];

const ETAPAS = [
  {
    numero: '01',
    titulo: 'Selecione as coleções',
    texto: 'Escolha um ou mais programas de pós-graduação e cursos de graduação para analisar.',
  },
  {
    numero: '02',
    titulo: 'A rede é construída',
    texto: 'Os documentos viram um grafo e as métricas de rede são calculadas no seu navegador.',
  },
  {
    numero: '03',
    titulo: 'Explore o ecossistema',
    texto: 'Navegue pelo dashboard, abra dossiês, prospecte tendências e converse com a IA.',
  },
];

/**
 * Tela de apresentação — a primeira coisa que o usuário vê.
 * Explica o que é o EcoGrad, oferece o tutorial em modal e dá acesso à
 * seleção de coleções.
 */
export function Apresentacao() {
  const concluirApresentacao = useEcoGradStore((s) => s.concluirApresentacao);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-24 pt-12 lg:px-10 lg:pt-20">
      <header className="flex flex-col items-center text-center">
        <img
          src="/ecograd-logo.png"
          alt=""
          aria-hidden="true"
          className="h-20 w-20 rounded-2xl object-contain"
        />
        <h1 className="mt-6 text-4xl font-bold tracking-tight lg:text-5xl">EcoGrad</h1>
        <p className="mt-2 text-lg text-slate-300">Ecologia do Conhecimento · UFSC</p>
        <p className="mt-6 max-w-2xl text-balance leading-relaxed text-slate-400">
          Uma plataforma analítica que mapeia as redes de produção acadêmica da Universidade Federal
          de Santa Catarina. Teses, dissertações e trabalhos de conclusão viram um ecossistema
          navegável — onde dá para ver como pesquisadores, teorias e ferramentas se conectam, quais
          temas estão emergindo e quem sustenta cada área do conhecimento.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary px-6 py-3" onClick={concluirApresentacao}>
            Começar análise <ArrowRight size={16} />
          </button>
          <TutorialModal>
            <button type="button" className="btn px-6 py-3">
              <BookOpen size={16} /> Ver tutorial
            </button>
          </TutorialModal>
        </div>
      </header>

      <section className="mt-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
          Como funciona
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {ETAPAS.map((e) => (
            <li key={e.numero} className="card">
              <span className="text-2xl font-bold text-eco-accent/40 tabular-nums">{e.numero}</span>
              <h3 className="mt-1 text-base font-semibold text-slate-100">{e.titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{e.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
          O que você encontra
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <article key={titulo} className="card">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent">
                <Icone size={18} />
              </span>
              <h3 className="mt-3 text-base font-semibold text-slate-100">{titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 flex flex-col items-center gap-4 rounded-2xl border border-eco-border bg-eco-panel/50 px-6 py-10 text-center">
        <h2 className="text-xl font-semibold text-slate-100">Pronto para explorar?</h2>
        <p className="max-w-xl text-sm leading-relaxed text-slate-400">
          Na próxima tela você escolhe quais programas e cursos quer analisar. Enquanto decide, o
          panorama institucional da UFSC na CAPES já fica visível.
        </p>
        <button type="button" className="btn btn-primary px-6 py-3" onClick={concluirApresentacao}>
          Ir para a seleção de coleções <ArrowRight size={16} />
        </button>
      </section>

      <footer className="mt-12 flex flex-col items-center gap-1 text-xs text-slate-500">
        <span>
          Desenvolvido por <span className="text-slate-300">Gustavo Simas</span>
        </span>
        <a
          href="https://github.com/GSimas"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-eco-accent hover:text-amber-300"
        >
          <Github size={13} /> github.com/GSimas
        </a>
      </footer>
    </div>
  );
}
