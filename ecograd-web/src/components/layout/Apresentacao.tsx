import { ArrowRight, BookOpen, Github } from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { useSessionField } from '@/hooks/useSessionField';
import { OBJETIVOS } from '@/lib/objetivos';
import { navigatePage } from '@/services/navigation';

export function Apresentacao() {
  const carregada = useEcoGradStore((s) => s.dadosCarregados);
  const rota = useEcoGradStore((s) => s.rota);
  const [, setObjetivo] = useSessionField('entrada.objetivo', 'panorama');
  return (
    <div className="apresentacao mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <header className="flex flex-col items-center text-center">
        <img src="/ecograd-logo.png" alt="" aria-hidden="true" className="intro-logo h-20 w-20 rounded-2xl object-contain" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight lg:text-5xl">EcoGrad</h1>
        <p className="mt-2 text-lg text-slate-300">Ecologia do Conhecimento · UFSC</p>
        <p className="mt-5 max-w-2xl leading-relaxed text-slate-300">Encontre trabalhos para ler, explore pesquisadores e investigue temas na produção acadêmica da UFSC. Comece pela pergunta que você quer responder.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary px-6 py-3" onClick={() => navigatePage(carregada ? rota : 'selecao')}>{carregada ? 'Continuar análise atual' : 'Escolher coleções'} <ArrowRight size={16} /></button>
          <TutorialModal><button type="button" className="btn px-6 py-3"><BookOpen size={16} /> Ver tutorial</button></TutorialModal>
        </div>
      </header>
      <section className="mt-10 space-y-4" aria-labelledby="objetivos-inicio">
        <h2 id="objetivos-inicio" className="text-xl font-semibold">O que você quer descobrir?</h2>
        {carregada && <p className="text-sm text-slate-300">Os atalhos usam as coleções da análise atual. Para mudar o recorte, use “Editar seleção”.</p>}
        <div className="grid gap-4 sm:grid-cols-2">{OBJETIVOS.map((o) => <button key={o.id} type="button" className="card intro-block space-y-2 text-left" onClick={() => { setObjetivo(o.id); navigatePage(carregada ? o.rota : 'selecao'); }}>
          <span className="block text-base font-semibold text-eco-accent">{o.titulo}</span><span className="block text-sm leading-relaxed text-slate-300">{o.descricao}</span><span className="flex items-center gap-2 text-xs text-slate-400">{carregada ? 'Explorar análise atual' : 'Escolher coleções para este objetivo'} <ArrowRight size={14} /></span>
        </button>)}</div>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">Da pergunta à fonte</h2>
        <ol className="grid gap-4 md:grid-cols-3">{[
          ['1. Defina o recorte', 'Compare nomes completos, identificadores, períodos e tipos de documentos antes de carregar.'],
          ['2. Explore as relações', 'Use busca, Dashboard, Radar e Memética conforme seu objetivo. Ajuda e atividades ficam acessíveis no menu.'],
          ['3. Confira a evidência', 'Abra as fontes originais. Indicadores descrevem o recorte escolhido; sugestões por IA precisam de revisão.'],
        ].map(([titulo, texto]) => <li key={titulo} className="card intro-block"><h3 className="font-semibold">{titulo}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{texto}</p></li>)}</ol>
      </section>
      <section className="card intro-block mt-10 space-y-3">
        <h2 className="text-lg font-semibold">O que os dados permitem saber</h2>
        <p className="text-sm leading-relaxed text-slate-300">O EcoGrad analisa um recorte local do repositório, com lacunas de metadados e possíveis sobreposições. Ele não representa toda a produção atual da UFSC. O Panorama CAPES é uma consulta institucional independente; dados de um programa só são atribuídos a uma coleção quando há vínculo documentado por código.</p>
        <p className="text-sm leading-relaxed text-slate-300">O Consultor IA recebe contexto limitado da análise. Explore as fontes para confirmar suas respostas. Textos e resultados permanecem na sessão; consulte o estado de recuperação no topo da página.</p>
        <button type="button" className="btn" onClick={() => navigatePage('selecao')}>{carregada ? 'Editar seleção de coleções' : 'Conferir coleções e Panorama CAPES'} <ArrowRight size={16} /></button>
      </section>
      <footer className="mt-12 flex flex-col items-center gap-2 text-xs text-slate-400">
        <span>Desenvolvido por <a href="https://gustavosimas.com" target="_blank" rel="noopener noreferrer" className="text-slate-300 underline">Gustavo Simas</a></span>
        <a href="https://github.com/GSimas/EcoGrad/tree/main" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-eco-accent"><Github size={13} /> github.com/GSimas/EcoGrad</a>
      </footer>
    </div>
  );
}
