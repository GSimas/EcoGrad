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

export function Progresso({ valor, texto }: { valor: number; texto?: string }) {
  return (
    <div className="space-y-2">
      {texto && <p className="text-sm text-slate-400">{texto}</p>}
      <ProgressPrimitive.Root
        value={valor}
        className="h-2 w-full overflow-hidden rounded-full bg-eco-border"
      >
        <ProgressPrimitive.Indicator
          className="h-full bg-eco-accent transition-transform duration-300"
          style={{ transform: `translateX(-${100 - Math.min(Math.max(valor, 0), 100)}%)` }}
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
}: {
  titulo: string;
  children: ReactNode;
  aberto?: boolean;
}) {
  return (
    <details className="rounded-lg border border-eco-border bg-eco-panel/50" open={aberto}>
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-slate-300 hover:text-eco-accent">
        {titulo}
      </summary>
      <div className="border-t border-eco-border px-4 py-3">{children}</div>
    </details>
  );
}

export interface ColunaTabela<T> {
  chave: string;
  rotulo: string;
  render?: (linha: T) => ReactNode;
  className?: string;
  /** Renderiza a célula como barra de progresso (equivalente ao ProgressColumn). */
  barra?: { max: number };
}

export function Tabela<T extends Record<string, unknown>>({
  colunas,
  linhas,
  altura = 'max-h-96',
  vazio = 'Sem dados para exibir.',
}: {
  colunas: ReadonlyArray<ColunaTabela<T>>;
  linhas: readonly T[];
  altura?: string;
  vazio?: string;
}) {
  if (linhas.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{vazio}</p>;
  }
  return (
    <div className={cn('overflow-auto rounded-lg border border-eco-border', altura)}>
      <table className="tabela">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} className={c.className}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i}>
              {colunas.map((c) => {
                const bruto = linha[c.chave];
                if (c.render) return <td key={c.chave} className={c.className}>{c.render(linha)}</td>;
                if (c.barra) {
                  const v = Number(bruto) || 0;
                  const pct = c.barra.max > 0 ? (v / c.barra.max) * 100 : 0;
                  return (
                    <td key={c.chave} className={c.className}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-eco-border">
                          <div className="h-full bg-eco-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="tabular-nums">{formatarNumero(v)}</span>
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={c.chave} className={c.className}>
                    {typeof bruto === 'number' ? formatarNumero(bruto) : String(bruto ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Carregando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3 py-6 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-eco-border border-t-eco-accent" />
      {texto}
    </div>
  );
}
