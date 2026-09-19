import { useSessionField } from '@/hooks/useSessionField';
import { useId, useRef, useState, type ReactNode } from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { ChevronDown, Info, ChevronRight } from 'lucide-react';
import { cn, formatarNumero } from '@/lib/utils';
import { classeDoTipo } from '@/lib/tipos-cor';
import type { AnaliseOculta } from '@/lib/relevancia';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function Secao({ children, icone }: { children: ReactNode; icone?: ReactNode }) {
  return (
    <h2 className="secao">
      {icone}
      {children}
    </h2>
  );
}

/**
 * Nome de entidade com invólucro de botão, que abre o dossiê — o mesmo das
 * tabelas de orientandos. `tipo` pinta o botão na cor da família do item
 * (trabalho, pessoa ou tema), a mesma usada no resto do EcoGrad.
 */
export function BotaoEntidade({ nome, onClick, icone, tipo }: { nome: string; onClick: () => void; icone?: ReactNode; tipo?: string }) {
  return (
    <button type="button" className={cn('eco-entity-link group flex min-h-11 w-full min-w-48 items-center gap-2 rounded-lg border border-eco-border bg-eco-bg/40 px-3 py-2 text-left', classeDoTipo(tipo))} onClick={onClick}>
      {icone}
      <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-100">{nome}</span>
      <ChevronRight size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
    </button>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  ajuda,
  className,
  children,
}: {
  rotulo: string;
  valor: number | string;
  detalhe?: string;
  ajuda?: string;
  className?: string;
  /** Conteúdo abaixo do valor, como uma lista que detalha o número. */
  children?: ReactNode;
}) {
  const ajudaId = useId();
  return (
    <div className={cn('kpi', className)}>
      <span className="kpi-rotulo flex items-start justify-between gap-2">
        <span>{rotulo}</span>
        {ajuda && <span className="eco-metric-help relative inline-flex shrink-0">
          <button type="button" className="eco-metric-help-trigger inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400" aria-label={`Informações sobre ${rotulo}`} aria-describedby={ajudaId}>
            <Info size={15} aria-hidden="true" />
          </button>
          <span id={ajudaId} role="tooltip" className="eco-metric-tooltip">{ajuda}</span>
        </span>}
      </span>
      <span className="kpi-valor">{typeof valor === 'number' ? formatarNumero(valor) : valor}</span>
      {detalhe && <span className="text-xs text-slate-400">{detalhe}</span>}
      {children}
    </div>
  );
}

export function Progresso({ valor, texto }: { valor: number | null; texto?: string }) {
  return (
    <div className="space-y-2">
      {texto && <p role="status" className="text-sm text-slate-400">{texto}{valor !== null ? ` (${Math.round(valor)}%)` : ''}</p>}
      <ProgressPrimitive.Root
        value={valor}
        aria-label={texto ?? 'Progresso da atividade'}
        className="h-2 w-full overflow-hidden rounded-full bg-eco-border"
      >
        <ProgressPrimitive.Indicator
          className={cn("h-full bg-eco-accent transition-transform duration-300", valor === null && "w-1/3 motion-safe:animate-pulse")}
          style={{ transform: `translateX(-${valor === null ? 0 : 100 - Math.min(Math.max(valor, 0), 100)}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}

export function Aviso({ children, tipo = 'info' }: { children: ReactNode; tipo?: 'info' | 'aviso' | 'erro' | 'sucesso' }) {
  const classe = { info: 'info', aviso: 'aviso', erro: 'erro', sucesso: 'sucesso' }[tipo];
  return <div className={classe}>{children}</div>;
}

export function Chip({
  children,
  onClick,
  title,
  tipo,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  /** Família do item (trabalho, pessoa ou tema), que decide a cor. */
  tipo?: string;
}) {
  return (
    <button type="button" className={cn('btn-chip', classeDoTipo(tipo))} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

/** Bloco recolhível equivalente ao `st.expander`. */
export function Expander({
  titulo,
  children,
  aberto = false,
  lazy = false,
  icone,
  persistir = true,
}: {
  titulo: string;
  children: ReactNode;
  aberto?: boolean;
  lazy?: boolean;
  icone?: ReactNode;
  persistir?: boolean;
}) {
  const [expandedPersistido, setExpandedPersistido] = useSessionField('expander.' + titulo, aberto);
  const [expandedLocal, setExpandedLocal] = useState(aberto);
  const expanded = persistir ? expandedPersistido : expandedLocal;
  const contentId = useId();
  const carregado = useRef(expanded);
  if (expanded) carregado.current = true;
  const alternar = () => {
    if (persistir) setExpandedPersistido((valor) => !valor);
    else setExpandedLocal((valor) => !valor);
  };
  return (
    <div className="eco-expander rounded-lg border border-eco-border bg-eco-panel/50" data-state={expanded ? 'open' : 'closed'}>
      <button type="button" className="eco-expander-trigger flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm font-medium text-slate-300 hover:text-eco-accent"
        aria-expanded={expanded} aria-controls={contentId} onClick={alternar}>
        <span className="flex min-w-0 items-center gap-2">{icone}<span className="min-w-0 break-words">{titulo}</span></span><ChevronDown size={17} className="eco-expander-chevron shrink-0" aria-hidden="true" />
      </button>
      <div id={contentId} className="eco-expander-region" aria-hidden={!expanded}>
        <div className="eco-expander-content">
          <div className="eco-expander-body border-t border-eco-border px-4 py-3">{!lazy || carregado.current ? children : null}</div>
        </div>
      </div>
    </div>
  );
}

export { Tabela, type ColunaTabela } from './Tabela';

export function Carregando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3 py-6 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-eco-border border-t-eco-accent" />
      {texto}
    </div>
  );
}

/**
 * Nota das análises ocultas.
 *
 * Esconder um gráfico degenerado (uma barra só, uma fatia de 100%, uma nuvem em
 * que tudo vale 1) limpa a tela, mas em silêncio parece defeito. A nota diz o
 * que sumiu e por quê, no mesmo tom das demais ressalvas da ferramenta.
 */
export function AnalisesOcultas({ itens }: { itens: readonly AnaliseOculta[] }) {
  if (itens.length === 0) return null;
  return (
    <p className="text-xs leading-relaxed text-slate-400">
      Análises ocultas neste recorte, por não descreverem nada que já não esteja acima:{' '}
      {itens.map((i) => `${i.nome} (${i.motivo})`).join('; ')}. Ocultar é decisão de exibição:
      nenhum registro foi excluído dos cálculos.
    </p>
  );
}
