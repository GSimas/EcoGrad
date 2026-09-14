import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcaoSelect { valor: string; rotulo: string; desabilitada?: boolean }

// Radix reserva o valor vazio para "sem seleção"; o vazio da aplicação vira este sentinela.
const VAZIO = '__vazio__';
const interno = (v: string) => (v === '' ? VAZIO : v);

/** Seleção única com a estética do EcoGrad, no lugar do `<select>` nativo do sistema. */
export function Select({ valor, onChange, opcoes, id, className, disabled, 'aria-label': ariaLabel, 'aria-describedby': describedBy }: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: readonly OpcaoSelect[];
  id?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  return <SelectPrimitive.Root value={interno(valor)} onValueChange={(v) => onChange(v === VAZIO ? '' : v)} disabled={disabled}>
    <SelectPrimitive.Trigger id={id} aria-label={ariaLabel} aria-describedby={describedBy} className={cn('input select-trigger flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed', className)}>
      <span className="min-w-0 truncate"><SelectPrimitive.Value /></span>
      <SelectPrimitive.Icon asChild><ChevronDown size={16} className="select-chevron shrink-0 text-slate-400" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={4} className="select-content z-[60] max-h-[min(var(--radix-select-content-available-height),20rem)] min-w-[var(--radix-select-trigger-width)] max-w-[min(36rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-eco-border bg-eco-panel shadow-xl">
        <SelectPrimitive.Viewport className="p-1">
          {opcoes.map((o) => <SelectPrimitive.Item key={o.valor} value={interno(o.valor)} disabled={o.desabilitada}
            className="select-item relative flex min-h-11 cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm text-slate-200 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:text-slate-500 data-[state=checked]:text-eco-accent data-[highlighted]:bg-eco-accent/10 data-[highlighted]:text-eco-accent">
            <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex"><Check size={14} /></SelectPrimitive.ItemIndicator>
            <SelectPrimitive.ItemText><span className="break-words">{o.rotulo}</span></SelectPrimitive.ItemText>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
