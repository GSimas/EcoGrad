import { useSessionField } from '@/hooks/useSessionField';
import type { ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export interface AbaDef {
  valor: string;
  rotulo: ReactNode;
  conteudo: ReactNode;
}

/** Abas Radix com o visual do EcoGrad (equivalente ao `st.tabs`). */
export function Tabs({
  abas,
  padrao,
  valor,
  onValorChange,
  className,
  chaveSessao,
}: {
  abas: readonly AbaDef[];
  padrao?: string;
  valor?: string;
  onValorChange?: (v: string) => void;
  className?: string;
  /**
   * Identidade estável do grupo de abas. Sem ela a chave vem da lista de
   * valores, e um grupo que oculta abas conforme o recorte trocaria de chave a
   * cada item — perdendo a aba escolhida ao navegar entre dossiês.
   */
  chaveSessao?: string;
}) {
  const [saved, setSaved] = useSessionField('tabs.' + (chaveSessao ?? abas.map((a) => a.valor).join('|')), padrao ?? abas[0]?.valor);
  return (
    <TabsPrimitive.Root
      defaultValue={padrao ?? abas[0]?.valor}
      value={valor ?? (abas.some((a) => a.valor === saved) ? saved : abas[0]?.valor)}
      onValueChange={(v) => { setSaved(v); onValorChange?.(v); }}
      className={cn('eco-tabs w-full', className)}
    >
      <TabsPrimitive.List className="mb-4 flex flex-wrap gap-1 border-b border-eco-border">
        {abas.map((a) => (
          <TabsPrimitive.Trigger
            key={a.valor}
            value={a.valor}
            className="-mb-px inline-flex items-center gap-1.5 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-medium
              text-slate-400 transition hover:text-slate-200
              data-[state=active]:border-eco-accent data-[state=active]:text-eco-accent"
          >
            {a.rotulo}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {abas.map((a) => (
        <TabsPrimitive.Content key={a.valor} value={a.valor} className="eco-tab-content focus:outline-none">
          {a.conteudo}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

/** Grupo de opções horizontais (equivalente ao `st.radio(horizontal=True)`). */
export function GrupoOpcoes<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: readonly T[];
  valor: T;
  onChange: (v: T) => void;
  rotulo?: string;
}) {
  return (
    <div className="space-y-1.5">
      {rotulo && <p className="text-xs uppercase tracking-wide text-slate-400">{rotulo}</p>}
      <div className="flex flex-wrap gap-1 rounded-lg border border-eco-border bg-eco-panel/60 p-1">
        {opcoes.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={o === valor}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              o === valor
                ? 'bg-eco-action text-eco-on-action'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
