import { useSessionField } from '@/hooks/useSessionField';
import type { ReactNode } from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn, formatarNumero } from '@/lib/utils';

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

export function Kpi({
  rotulo,
  valor,
  detalhe,
  className,
}: {
  rotulo: string;
  valor: number | string;
  detalhe?: string;
  className?: string;
}) {
  return (
    <div className={cn('kpi', className)}>
      <span className="kpi-rotulo">{rotulo}</span>
      <span className="kpi-valor">{typeof valor === 'number' ? formatarNumero(valor) : valor}</span>
      {detalhe && <span className="text-xs text-slate-400">{detalhe}</span>}
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
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button type="button" className="btn-chip" onClick={onClick} title={title}>
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
}: {
  titulo: string;
  children: ReactNode;
  aberto?: boolean;
  lazy?: boolean;
}) {
  const [expanded, setExpanded] = useSessionField('expander.' + titulo, aberto);
  return (
    <details className="rounded-lg border border-eco-border bg-eco-panel/50" open={expanded} onToggle={(event) => { if (event.currentTarget.open !== expanded) setExpanded(event.currentTarget.open); }}>
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-slate-300 hover:text-eco-accent">
        {titulo}
      </summary>
      <div className="border-t border-eco-border px-4 py-3">{!lazy || expanded ? children : null}</div>
    </details>
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
