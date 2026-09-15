import { ArrowRight, BookOpen, Github, Route } from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { BuscaGlobal } from './BuscaGlobal';
import { ConversaAcervo } from './ConversaAcervo';
import { GrupoOpcoes } from '@/components/ui/Tabs';
import { useSessionField } from '@/hooks/useSessionField';
import { Janela } from './Janela';
import { Aparencia } from './Aparencia';
import { CHIP } from './atalhos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { navigatePage } from '@/services/navigation';

/** A busca é o padrão; conversar é o caminho para pergunta em vez de item. */
const MODOS = ['Buscar', 'Conversar'] as const;

const PASSOS: [titulo: string, texto: string][] = [
  ['1. Defina o recorte', 'Busque documentos, pessoas, temas ou coleções inteiras na apresentação. Compare nomes completos, identificadores, períodos e tipos antes de carregar.'],
  ['2. Explore as relações', 'Use busca, Dashboard, Radar e Memética conforme seu objetivo. Ajuda e atividades ficam acessíveis no menu.'],
  ['3. Confira a evidência', 'Abra as fontes originais. Indicadores descrevem o recorte escolhido; sugestões por IA precisam de revisão.'],
];

export function Apresentacao() {
  const [modo, setModo] = useSessionField<typeof MODOS[number]>('inicio.modo', 'Buscar');
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
        <div className="w-full">{modo === 'Conversar' ? <ConversaAcervo /> : <BuscaGlobal />}</div>
        {carregada && <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary px-6 py-3 disabled:opacity-60" disabled={carregando} onClick={() => navigatePage(rota)}>Continuar análise atual <ArrowRight size={16} /></button>
        </div>}
      </header>

      <nav aria-label="Atalhos do EcoGrad" className="mt-auto flex flex-wrap justify-center gap-2 pt-16">
        <TutorialModal><button type="button" className={CHIP} disabled={carregando}><BookOpen size={14} className="shrink-0" /> Ver tutorial</button></TutorialModal>

        <Janela titulo="Da pergunta à fonte" descricao="O percurso até a evidência original e os limites do que os dados mostram." larga
          trigger={<button type="button" className={CHIP} disabled={carregando}><Route size={14} className="shrink-0" /> Da pergunta à fonte</button>}>
          <div className="space-y-6">
            <ol className="grid gap-4 md:grid-cols-3">{PASSOS.map(([titulo, texto]) => <li key={titulo} className="card"><h3 className="font-semibold">{titulo}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{texto}</p></li>)}</ol>
            <section className="space-y-3 border-t border-eco-border pt-5">
              <h3 className="text-base font-semibold text-eco-accent">O que os dados permitem saber</h3>
              <p className="text-sm leading-relaxed text-slate-300">O EcoGrad analisa um recorte local do repositório, com lacunas de metadados e possíveis sobreposições. Ele não representa toda a produção atual da UFSC. O Panorama CAPES é uma consulta institucional independente; dados de um programa só são atribuídos a uma coleção quando há vínculo documentado por código.</p>
              <p className="text-sm leading-relaxed text-slate-300">O Consultor IA fica no botão do canto inferior direito e usa a chave de API do provedor que você escolher. Ele recebe contexto limitado da análise. Explore as fontes para confirmar suas respostas. Textos e resultados permanecem na sessão; consulte o estado de recuperação no topo da página.</p>
            </section>
          </div>
        </Janela>
        <Aparencia chip desabilitado={carregando} />
      </nav>

      <footer className="mt-8 flex flex-col items-center gap-2 text-xs text-slate-300">
        <span>Desenvolvido por <a href="https://gustavosimas.com" target="_blank" rel="noopener noreferrer" className="text-slate-300 underline">Gustavo Simas</a></span>
        <a href="https://github.com/GSimas/EcoGrad/tree/main" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-eco-accent"><Github size={13} /> github.com/GSimas/EcoGrad</a>
      </footer>
    </div>
  );
}
