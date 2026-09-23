import { useState, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Dica "i": junta as instruções de um bloco num só balão, em vez de linhas de
 * letra miúda espalhadas. Abre ao repousar o mouse, ao focar pelo teclado e ao
 * tocar — o toque alterna, porque o Radix Tooltip sozinho não abre no celular.
 * O balão vai para um portal: dentro de uma janela com rolagem ele não é cortado.
 */
export function Dica({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  const [aberta, setAberta] = useState(false);
  return <TooltipPrimitive.Provider delayDuration={150}>
    <TooltipPrimitive.Root open={aberta} onOpenChange={setAberta}>
      <TooltipPrimitive.Trigger asChild>
        {/* `preventDefault` nos dois eventos impede o Radix de fechar o balão no
            clique; quem decide é o `setAberta` do toque. */}
        <button type="button" aria-label={rotulo}
          className={cn('eco-metric-help-trigger inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-eco-border text-slate-400', className)}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => { e.preventDefault(); setAberta((v) => !v); }}>
          <Info size={15} aria-hidden="true" />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side="bottom" align="start" sideOffset={6} collisionPadding={12}
          className="eco-dica z-[70] max-h-[min(70vh,34rem)] max-w-[min(30rem,calc(100vw-2rem))] space-y-2 overflow-y-auto border border-[rgb(var(--control-border))] bg-eco-bg p-3 text-xs leading-relaxed text-slate-200 shadow-xl">
          {children}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  </TooltipPrimitive.Provider>;
}
