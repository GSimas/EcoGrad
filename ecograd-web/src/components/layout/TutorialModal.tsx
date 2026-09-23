import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeft,
  ArrowRight,
  Dog,
  Check,
  Compass,
  Dna,
  LayoutDashboard,
  Radar,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useSessionField } from '@/hooks/useSessionField';
import { cn } from '@/lib/utils';

interface Passo {
  icone: LucideIcon;
  titulo: string;
  corpo: ReactNode;
}

const PASSOS: Passo[] = [
  { icone: LayoutDashboard, titulo: 'Comece por uma pergunta e monte o recorte na busca', corpo: <><p><strong>Acompanhe um caso ao longo dos seis passos:</strong> Ana quer descobrir quais temas aparecem na produção do Programa de Pós-Graduação em Engenharia Mecânica, como esses temas mudaram e quais trabalhos e pesquisadores estão ligados a eles. Tudo começa no campo <strong>Pesquise em todo o acervo</strong>, na apresentação: ele encontra tanto itens soltos — um documento, um orientador, uma palavra-chave — quanto coleções inteiras, sem precisar carregar nada antes.</p><p>Ana digita “Engenharia Mecânica”. As coleções aparecem no topo da lista, com a etiqueta <strong>Coleção</strong>, o acervo (Graduação ou Pós-Graduação), o total de registros e o período. Como o catálogo pode trazer a coleção principal, outra com identificador próprio e uma modalidade profissional, ela não escolhe pela semelhança do nome: clica na que procura e, no bloco que surge abaixo, abre <strong>Conferir metadados</strong> para comparar identificador, campos preenchidos e cobertura.</p><p>A escolha é múltipla: cada clique vira uma etiqueta, que o “×” remove. Ana pode somar outras coleções ou um item solto — as coleções de um item entram junto — e o rodapé mostra quantas coleções serão baixadas e o tamanho aproximado. Uma coleção vazia indicaria apenas ausência de registros no recorte local; os anos reproduzem os metadados disponíveis e não informam a data da coleta. Com o recorte conferido, ela clica em <strong>Carregar</strong> e acompanha a barra de progresso até o Dashboard abrir.</p></> },
  { icone: LayoutDashboard, titulo: 'Leia o panorama antes de interpretar os temas', corpo: <><p>No <strong>Dashboard</strong>, Ana começa pela cobertura: observa quantos registros foram carregados, quais anos aparecem e quantos trabalhos têm resumo, palavras-chave, orientação e fonte. Isso evita comparar frequências sem considerar lacunas ou períodos diferentes. Se ela acrescentar outra coleção, usa a comparação apenas depois de conferir se os intervalos e tipos de documentos são compatíveis.</p><p>Em <strong>Fontes e contexto institucional</strong>, ela consulta o vínculo CAPES documentado e distingue informações do programa de características dos trabalhos. Em seguida, percorre os temas, orientadores e cartões de trabalhos para formar uma primeira lista. Se “manufatura aditiva” aparecer entre os temas, por exemplo, Ana o trata como uma pista frequente no recorte, não como prova de qualidade ou tendência.</p><p>Essa leitura inicial produz uma pergunta mais precisa para o próximo passo: quais trabalhos, pessoas e conceitos sustentam o tema escolhido?</p></> },
  { icone: Search, titulo: 'Abra o tema no Motor de Busca e confira os trabalhos', corpo: <><p>Ana abre o <strong>Motor de Busca</strong>, escolhe a categoria <strong>Temas</strong> e procura o termo selecionado no Dashboard. A etiqueta ao lado de cada item diz se aquele assunto é uma <strong>palavra-chave</strong> declarada pelo autor ou um <strong>macrotema</strong> atribuído pela base — rótulos iguais nas duas origens reúnem trabalhos diferentes, e ela confere qual está abrindo — no exemplo, “manufatura aditiva”, caso ele esteja presente nos dados. O dossiê mostra quantos registros estão associados, a cobertura desses registros e as análises disponíveis.</p><p>Nos <strong>Trabalhos associados</strong>, ela lê títulos e resumos, filtra por coleção ou por texto e abre alguns registros representativos. Em cada registro, confere autoria, orientação, ano, tipo acadêmico e o link para a fonte original. Depois seleciona uma pessoa ou outro conceito relacionado para continuar a exploração sem perder o caminho anterior. Em <strong>Pessoas</strong>, cada nome aparece uma vez só, reunindo autoria, orientação e coorientação num dossiê único; o filtro de papel recorta a lista quando ela quer só quem orientou.</p><p>A associação resulta dos metadados do recorte. Ela mostra que nome e tema aparecem ligados por registros, mas não comprova especialização, vínculo institucional atual, disponibilidade para orientação nem relação causal.</p></> },
  { icone: Dna, titulo: 'Use a rede para seguir relações, não para atribuir mérito', corpo: <><p>No dossiê, Ana abre a <strong>Órbita de relacionamentos</strong>, que já começa em movimento. Ela enquadra todos os nós para reconhecer o conjunto e usa os controles com ícones abaixo do gráfico para ampliar, reduzir, mover a câmera, pausar ou retomar o movimento. Ao selecionar um nó, abre o dossiê correspondente e acompanha como trabalhos, autores, orientadores e conceitos se conectam ao tema inicial.</p><p>Quando precisa de valores exatos, Ana alterna para <strong>Nós em tabela</strong> ou <strong>Conexões em tabela</strong>. Distância, posição e tamanho visual ajudam a navegar pelo desenho, mas só representam as regras do layout e os atributos informados; não são avaliações científicas ou de mérito.</p><p>Com alguns conceitos vizinhos e trabalhos centrais identificados, ela já pode investigar se esse vocabulário permaneceu estável ou mudou ao longo do período.</p></> },
  { icone: Radar, titulo: 'Compare a evolução dos temas e revise os conceitos', corpo: <><p>Na <strong>Análise Avançada</strong>, aba <strong>Tempo e tendências</strong>, Ana mantém o mesmo recorte de Engenharia Mecânica e confere a dimensão analisada, a janela recente e o critério de corte. Ela procura o tema inicial e os conceitos vizinhos encontrados na rede, compara primeira e última aparição e observa como a classificação muda quando os parâmetros mudam. O Radar descreve o histórico disponível; não prevê sozinho uma tendência futura.</p><p>Em <strong>Temas e conceitos</strong>, Ana examina ocorrências e longevidade dos conceitos, e vê as coocorrências entre eles na aba <strong>Estrutura da rede</strong>. Se usar a extração opcional por IA, revisa cada proposta junto ao trecho de origem, corrige nomes imprecisos, rejeita relações sem apoio e salva somente as aprovações justificadas. A frequência de um termo não demonstra que ele causou a produção dos trabalhos.</p><p>Ao final, ela tem uma leitura temporal e conceitual para confrontar com os documentos, em vez de uma lista isolada de palavras.</p></> },
  { icone: Dog, titulo: 'Produza uma síntese verificável e preserve o percurso', corpo: <><p>Para organizar o que encontrou, Ana abre o <strong>UFSCão</strong>, o consultor de IA, no canto inferior direito e formula uma pergunta delimitada: “Com base no recorte carregado de Engenharia Mecânica, quais temas recorrentes e recentes aparecem, quais trabalhos exemplificam cada um e quais lacunas dos dados devo considerar?”. O UFSCão é uma IA generativa: recebe contexto limitado, trabalha com uma amostra e pode errar; por isso, Ana confere títulos, pessoas e links nas fontes originais antes de usar a síntese.</p><p>Ela usa <strong>Voltar</strong>, <strong>Avançar</strong> e o histórico para retornar ao tema, à rede e aos trabalhos que fundamentaram a resposta. Se quiser testar outra modalidade de Engenharia Mecânica, clica no logo <strong>EcoGrad · UFSC</strong> no topo do painel lateral para voltar à apresentação e montar uma nova seleção na busca — a análise atual continua intacta até o novo carregamento terminar. Copiar a URL compartilha a página, mas não transfere os dados nem o percurso da sessão.</p><p>Assim, os seis passos formam uma investigação única: pergunta, recorte, panorama, dossiê, rede, evolução e síntese conferida nas fontes. Após recarregar a página, Ana verifica o aviso de recuperação e reinicia manualmente qualquer cálculo que tenha sido interrompido.</p></> },
];

/** Tutorial passo a passo, aberto a partir da tela de apresentação. */
export function TutorialModal({ children, aoFazerTour }: { children: ReactNode; aoFazerTour?: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [salvo, setPasso] = useSessionField('tutorial.passo', 0);
  const passo = Number.isInteger(salvo) && salvo >= 0 && salvo < PASSOS.length ? salvo : 0;

  const atual = PASSOS[passo];
  const Icone = atual.icone;
  const ultimo = passo === PASSOS.length - 1;

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);

      }}
    >
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="eco-dialog-overlay fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-modal="true"
          className="eco-dialog-content fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[min(46rem,92vw)]
            -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl
            border border-eco-border bg-eco-panel shadow-2xl shadow-black/60
            focus:outline-none"
        >
          <header className="flex items-start gap-3 border-b border-eco-border p-3 sm:p-5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent">
              <Icone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-slate-100">
                {atual.titulo}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-400">
                Passo {passo + 1} de {PASSOS.length} · Como usar o EcoGrad
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/5 hover:text-slate-200"
              aria-label="Fechar tutorial"
            >
              <X size={18} />
            </Dialog.Close>
          </header>
          {/* O texto longo continua sendo a leitura corrida; quem prefere ser
              conduzido pelas telas reais sai daqui para o tour. */}
          {aoFazerTour && <div className="flex flex-wrap items-center gap-3 border-b border-eco-border bg-eco-accent/5 p-3 text-sm sm:px-5">
            <Compass size={17} className="shrink-0 text-eco-accent" aria-hidden />
            <span className="min-w-0 flex-1 text-slate-300">Prefere ver na prática? O tour guiado percorre as telas reais em 2 minutos.</span>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-primary" onClick={aoFazerTour}>Fazer o tour guiado</button>
            </Dialog.Close>
          </div>}

          <div key={passo} className="eco-step-content markdown flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-slate-300">
            {atual.corpo}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-eco-border p-4">
            <div className="flex w-full gap-1.5 sm:w-auto sm:flex-1">
              {PASSOS.map((p, i) => (
                <button
                  key={p.titulo}
                  type="button"
                  onClick={() => setPasso(i)}
                  aria-label={`Ir para o passo ${i + 1}: ${p.titulo}`}
                  aria-current={i === passo}
                  className={cn(
                    'h-11 min-w-6 flex-1 rounded transition',
                    i === passo ? 'bg-eco-action text-eco-on-action' : 'bg-eco-border hover:bg-slate-600',
                  )}
                >{i + 1}</button>
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
