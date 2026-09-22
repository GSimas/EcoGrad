import { BookOpen, Github, Info } from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { Janela } from './Janela';
import { Aparencia } from './Aparencia';
import { CHIP } from './atalhos';
import { BotaoPanoramaUfsc } from './BotaoPanoramaUfsc';
import { cn } from '@/lib/utils';

/** Os três passos do fluxo, mostrados no "Sobre". */
const PASSOS: [titulo: string, texto: string][] = [
  ['1. Defina o recorte', 'Busque documentos, pessoas, temas ou coleções inteiras na apresentação. Compare nomes completos, identificadores, períodos e tipos antes de carregar.'],
  ['2. Explore as relações', 'Use busca, Dashboard, Radar e Memética conforme seu objetivo. Ajuda e atividades ficam acessíveis no menu.'],
  ['3. Confira a evidência', 'Abra as fontes originais. Indicadores descrevem o recorte escolhido; sugestões por IA precisam de revisão.'],
];

/**
 * Ver tutorial, Sobre e Configurações — os três atalhos do EcoGrad.
 *
 * Ficam no rodapé da apresentação e no pé do painel lateral. É um componente
 * só porque o "Sobre" carrega o texto que explica a procedência do acervo e os
 * limites da ferramenta: duas cópias dele divergiriam na primeira correção.
 *
 * São dois eixos, e não um: o painel lateral mostra só os ícones em qualquer
 * largura (`somenteIcone`), mas só empilha quando está recolhido, onde não
 * cabem três lado a lado. O nome segue no `title` e no leitor de tela.
 */
export function AtalhosEcoGrad({ somenteIcone = false, empilhado = false, desabilitado = false, comPanorama = false, className, aoFazerTour }: {
  somenteIcone?: boolean;
  empilhado?: boolean;
  desabilitado?: boolean;
  /**
   * Inclui o Panorama UFSC entre os atalhos. Só a apresentação pede: no painel
   * lateral ele já tem lugar próprio na navegação, e apareceria duas vezes.
   */
  comPanorama?: boolean;
  className?: string;
  /** Quando presente, o tutorial oferece o tour guiado no topo. */
  aoFazerTour?: () => void;
}) {
  const classe = cn(CHIP, somenteIcone && 'w-11 justify-center px-0');
  return (
    <nav aria-label="Atalhos do EcoGrad" className={cn('flex gap-2', empilhado ? 'flex-col items-center' : 'flex-wrap justify-center', className)}>
    <TutorialModal aoFazerTour={aoFazerTour}><button type="button" className={classe} disabled={desabilitado} aria-label="Ver tutorial" title="Ver tutorial"><BookOpen size={14} className="shrink-0" />{!somenteIcone && 'Ver tutorial'}</button></TutorialModal>
    {comPanorama && <BotaoPanoramaUfsc compacto={somenteIcone} desabilitado={desabilitado} className={classe} />}

    <Janela titulo="Sobre" descricao="De onde vem o acervo, como o EcoGrad funciona e os limites do que os dados mostram." larga
      trigger={<button type="button" className={classe} disabled={desabilitado} aria-label="Sobre" title="Sobre"><Info size={14} className="shrink-0" />{!somenteIcone && 'Sobre'}</button>}>
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
          <p className="text-sm leading-relaxed text-slate-300">O EcoGrad analisa um recorte local do repositório, com lacunas de metadados e possíveis sobreposições. Ele não representa toda a produção atual da UFSC. O Panorama UFSC traz o acervo inteiro em números e uma consulta institucional independente à CAPES; dados de um programa só são atribuídos a uma coleção quando há vínculo documentado por código.</p>
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
    <Aparencia chip compacto={somenteIcone} desabilitado={desabilitado} />
    </nav>
  );
}
