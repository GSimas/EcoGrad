import { ArrowRight, BookOpen, Github, Info } from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { BuscaGlobal } from './BuscaGlobal';
import { UFSCaoAcervo } from '@/components/chat/UFSCaoAcervo';
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
        <div className="w-full">{modo === 'Conversar' ? <UFSCaoAcervo /> : <BuscaGlobal />}</div>
        {carregada && <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary px-6 py-3 disabled:opacity-60" disabled={carregando} onClick={() => navigatePage(rota)}>Continuar análise atual <ArrowRight size={16} /></button>
        </div>}
      </header>

      <nav aria-label="Atalhos do EcoGrad" className="mt-auto flex flex-wrap justify-center gap-2 pt-16">
        <TutorialModal><button type="button" className={CHIP} disabled={carregando}><BookOpen size={14} className="shrink-0" /> Ver tutorial</button></TutorialModal>

        <Janela titulo="Sobre" descricao="De onde vem o acervo, como o EcoGrad funciona e os limites do que os dados mostram." larga
          trigger={<button type="button" className={CHIP} disabled={carregando}><Info size={14} className="shrink-0" /> Sobre</button>}>
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-eco-accent">De onde vêm os dados</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                Tudo o que o EcoGrad mostra vem do <a href="http://repositorio.ufsc.br/" target="_blank" rel="noopener noreferrer" className="text-eco-accent underline">Repositório Institucional da UFSC</a>, o acervo público onde teses, dissertações e TCCs da universidade são depositados. O EcoGrad não produz dado novo: ele reorganiza o que já está lá, e cada trabalho mantém o link para a página original, que é sempre a fonte a conferir.
              </p>
            </section>
            <section className="space-y-3 border-t border-eco-border pt-5">
              <h3 className="text-base font-semibold text-eco-accent">Como funciona, por baixo</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                <strong className="text-slate-200">Coleta.</strong> O repositório roda <strong>DSpace</strong>, que expõe os metadados de cada depósito por uma interface de coleta padronizada. Uma rotina semanal percorre as coleções, traz os registros novos e normaliza o que chega — nomes grafados de formas diferentes, anos, níveis e palavras-chave.
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                <strong className="text-slate-200">Dados.</strong> O acervo consolidado é publicado como arquivos compactados que o seu navegador baixa só quando você escolhe uma coleção — nada é carregado antes de você confirmar. Em paralelo, um índice <strong>Postgres</strong> guarda o acervo inteiro com o texto dos resumos indexado, o que permite responder panorama de um tema sem baixar coleção nenhuma. Esse índice é derivado e reconstruível: os arquivos publicados continuam sendo a fonte.
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                <strong className="text-slate-200">Análise.</strong> Contagens, séries por ano e métricas de rede entre pessoas e temas são calculadas no seu navegador, sobre o recorte que você escolheu. Nenhum número da tela vem de estimativa de IA.
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                <strong className="text-slate-200">UFSCão.</strong> O consultor usa um <strong>modelo de linguagem (LLM)</strong> do provedor que você configurar, com a sua chave de API — ela fica apenas no seu navegador e vai direto ao provedor, sem passar pelos servidores do EcoGrad. O modelo só escreve o texto: o recorte e os números são apurados antes, pelo índice ou pelo aplicativo, e toda afirmação sobre um trabalho leva a citação da obra que a sustenta.
              </p>
            </section>
            <section className="space-y-3 border-t border-eco-border pt-5">
              <h3 className="text-base font-semibold text-eco-accent">Da pergunta à fonte</h3>
              <ol className="grid gap-4 md:grid-cols-3">{PASSOS.map(([titulo, texto]) => <li key={titulo} className="card"><h3 className="font-semibold">{titulo}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{texto}</p></li>)}</ol>
            </section>
            <section className="space-y-3 border-t border-eco-border pt-5">
              <h3 className="text-base font-semibold text-eco-accent">O que os dados permitem saber</h3>
              <p className="text-sm leading-relaxed text-slate-300">O EcoGrad analisa um recorte local do repositório, com lacunas de metadados e possíveis sobreposições. Ele não representa toda a produção atual da UFSC. O Panorama CAPES é uma consulta institucional independente; dados de um programa só são atribuídos a uma coleção quando há vínculo documentado por código.</p>
              <p className="text-sm leading-relaxed text-slate-300">O UFSCão, consultor de IA, responde sobre o acervo inteiro em Conversar, na tela inicial, e sobre as coleções carregadas no botão do canto inferior direito. Nos dois casos usa a chave de API do provedor que você escolher. Ele é uma inteligência artificial generativa: recebe contexto limitado da análise e pode errar, inclusive inventando trabalhos e nomes. Explore as fontes para confirmar suas respostas. Textos e resultados permanecem na sessão; consulte o estado de recuperação no topo da página.</p>
            </section>
            <section className="space-y-2 border-t border-eco-border pt-5">
              <h3 className="text-base font-semibold text-eco-accent">Créditos</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                Desenvolvido por <a href="https://gustavosimas.com" target="_blank" rel="noopener noreferrer" className="text-eco-accent underline">Gustavo Simas</a>.
              </p>
              <a href="https://github.com/GSimas/EcoGrad/tree/main" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-eco-accent underline">
                <Github size={14} className="shrink-0" aria-hidden /> github.com/GSimas/EcoGrad
              </a>
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
