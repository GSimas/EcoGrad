import { ArrowRight, Github } from 'lucide-react';
import { AtalhosEcoGrad } from './AtalhosEcoGrad';
import { ConviteDoTour, OfertaDeExemplo, useTourGuiado } from './TourGuiado';
import { BuscaGlobal } from './BuscaGlobal';
import { UFSCaoAcervo } from '@/components/chat/UFSCaoAcervo';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { useSessionField } from '@/hooks/useSessionField';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { navigatePage } from '@/services/navigation';

/** A busca é o padrão; conversar é o caminho para pergunta em vez de item. */
const MODOS = ['Buscar', 'Conversar'] as const;


export function Apresentacao() {
  const [modo, setModo] = useSessionField<typeof MODOS[number]>('inicio.modo', 'Buscar');
  const tour = useTourGuiado();
  const carregada = useEcoGradStore((s) => s.dadosCarregados);
  const rota = useEcoGradStore((s) => s.rota);
  // Enquanto uma coleção é carregada, a tela inteira fica inerte: sair daqui no
  // meio do download deixaria o usuário numa página sem a base que ele pediu.
  const carregando = useEcoGradStore((s) => s.carregando);
  return (
    <div className="apresentacao mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 pt-10 sm:px-6">
      <header className="flex flex-col items-center text-center">
        <img src="/ecograd-logo.png" alt="" aria-hidden="true" className="intro-logo h-20 w-20 rounded-2xl object-contain" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight lg:text-5xl">EcoGrad</h1>
        <p className="mt-2 text-lg text-slate-300">Ecologia do Conhecimento · UFSC</p>
        <p className="mt-5 max-w-2xl leading-relaxed text-slate-300">Encontre trabalhos para ler, explore pesquisadores e investigue temas na produção acadêmica da UFSC. Pesquise qualquer item do acervo ou escolha as coleções que quer analisar.</p>

        {/* Dois caminhos para o mesmo acervo: escolher itens ou perguntar. A busca
            segue sendo o padrão — é determinística e instantânea. */}
        <div className="mt-6 w-full max-w-md self-center sm:w-auto">
          <GrupoOpcoes opcoes={MODOS} valor={modo} onChange={setModo} />
        </div>
        <div className="w-full">{modo === 'Conversar' ? <UFSCaoAcervo /> : <BuscaGlobal />}</div>
        {/* O convite some depois de aceito ou dispensado; volta em Configurações. */}
        <ConviteDoTour aoComecar={tour.comecar} />
        {carregada && <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary px-6 py-3 disabled:opacity-60" disabled={carregando} onClick={() => navigatePage(rota)}>Continuar análise atual <ArrowRight size={16} /></button>
        </div>}
      </header>

      <AtalhosEcoGrad desabilitado={carregando} className="mt-auto pt-16" aoFazerTour={tour.comecar} />
      <OfertaDeExemplo tour={tour} />

      <footer className="mt-8 flex flex-col items-center gap-2 text-xs text-slate-300">
        <span>Desenvolvido por <a href="https://gustavosimas.com" target="_blank" rel="noopener noreferrer" className="text-slate-300 underline">Gustavo Simas</a></span>
        <a href="https://github.com/GSimas/EcoGrad/tree/main" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-eco-accent"><Github size={13} /> github.com/GSimas/EcoGrad</a>
      </footer>
    </div>
  );
}
