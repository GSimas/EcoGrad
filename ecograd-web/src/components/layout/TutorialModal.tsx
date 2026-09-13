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
import { useSessionField } from '@/hooks/useSessionField';
import { cn } from '@/lib/utils';

interface Passo {
  icone: LucideIcon;
  titulo: string;
  corpo: ReactNode;
}

const PASSOS: Passo[] = [
  { icone: LayoutDashboard, titulo: 'Escolher a coleção certa', corpo: <><p>Defina um objetivo na apresentação ou na seleção. Busque pelo nome ou identificador da coleção e confira modalidade, campus e qualificadores. Nomes semelhantes não representam necessariamente o mesmo acervo.</p><p>Antes de marcar, abra <strong>Ver cobertura e fontes</strong>: confira registros, período, tipos e campos disponíveis. Coleção vazia significa ausência de registros no recorte local, não ausência de produção. Os anos reproduzem a base; não indicam quando ela foi atualizada.</p><p>Revise a seleção e só então carregue. São baixados somente os arquivos das coleções selecionadas; confira o volume informado antes de carregar. O Panorama CAPES pode ser consultado sem carregar documentos; o vínculo de uma coleção só é atribuído com evidência documental.</p></> },
  { icone: Search, titulo: 'Encontrar trabalhos e pesquisadores', corpo: <><p>Para encontrar um trabalho, escolha <strong>Documento</strong> no Motor de Busca, digite parte do título e confirme uma opção do catálogo. Abra o dossiê e confira os dados e o link do repositório disponíveis.</p><p>Para investigar pessoas por tema, comece por <strong>Palavra-chave</strong>. Explore os relacionamentos do dossiê e os trabalhos associados. Os botões de entidades abrem outros dossiês; use Voltar para recuperar o ponto anterior.</p><p>A ligação entre pessoa e tema indica uma relação registrada no recorte. Não comprova adequação ao seu projeto nem disponibilidade para orientação.</p></> },
  { icone: LayoutDashboard, titulo: 'Conhecer e comparar a produção', corpo: <><p>O <strong>Dashboard</strong> reúne volumes, temas, pessoas e indicadores das coleções carregadas. Ao reunir coleções, você explora um conjunto de registros: períodos distintos, tipos de documento e sobreposições afetam qualquer comparação.</p><p>A ficha CAPES informa o programa oficial somente quando a relação com a coleção foi documentada. Um nome coincidente, mesmo único, não basta. Consulte a evidência e a data da consulta; a nota não é uma avaliação individual dos trabalhos.</p></> },
  { icone: Radar, titulo: 'Investigar mudanças e conceitos', corpo: <><p>No <strong>Foresight</strong>, confira a dimensão analisada, a janela recente e o critério de corte antes de interpretar o Radar. As classificações dependem dos dados e parâmetros; não garantem tendências futuras. A validação histórica é uma avaliação dentro do recorte disponível.</p><p>Em <strong>Memética e Ontologia</strong>, os indicadores acompanham ocorrências e relações de conceitos nos documentos. Não demonstram que um conceito causou a produção de um trabalho. A extração opcional por IA usa resumos. Confira cada proposta e seu trecho: aceite, corrija ou rejeite com justificativa. Decida todos os termos antes de aplicar; somente aprovações salvas entram no catálogo. Exporte a revisão para conservar propostas e histórico.</p></> },
  { icone: BotMessageSquare, titulo: 'Conversar e conferir as fontes', corpo: <><p>O <strong>Consultor IA</strong> recebe contexto limitado da análise, que pode incluir uma amostra do catálogo. Descreva seu objetivo e confira títulos, pessoas e links nas fontes originais.</p><p>A resposta não substitui a leitura dos trabalhos. Uma informação ausente no contexto enviado à IA não significa que ela inexista no acervo. A conversa e o texto ainda não enviado permanecem na sessão.</p></> },
  { icone: Dna, titulo: 'Retomar sem perder o contexto', corpo: <><p>Use Voltar, Avançar e o histórico para retornar entre páginas e entidades. Filtros e contexto do percurso são locais à aba; copiar a URL compartilha apenas a página.</p><p><strong>Editar seleção</strong> guarda um rascunho e só troca o recorte ao aplicar. <strong>Nova análise</strong> encerra a análise atual após confirmação. Navegar ou abrir a ajuda não interrompe os cálculos.</p><p>Use o painel de atividades para cancelar ou reiniciar. Após recarregar, confira o aviso de recuperação: execuções interrompidas exigem reinício manual. A recuperação depende da versão da base e dos limites de armazenamento exibidos pelo aplicativo.</p></> },
];

/** Tutorial passo a passo, aberto a partir da tela de apresentação. */
export function TutorialModal({ children }: { children: ReactNode }) {
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[min(46rem,92vw)]
            -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl
            border border-eco-border bg-eco-panel shadow-2xl shadow-black/60
            focus:outline-none"
        >
          <header className="flex items-start gap-3 border-b border-eco-border p-3 sm:p-5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-accent/15 text-eco-accent">
              <Icone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-eco-accent">
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

          <div className="markdown flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-slate-300">
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
                    i === passo ? 'bg-eco-action text-black' : 'bg-eco-border hover:bg-slate-600',
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
