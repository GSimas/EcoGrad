import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Janela({ titulo, descricao, children, trigger, aberta, onOpenChange, larga = false }: {
  titulo: string; descricao: string; children: ReactNode; trigger?: ReactNode;
  aberta?: boolean; onOpenChange?: (value: boolean) => void; larga?: boolean;
}) {
  return <Dialog.Root open={aberta} onOpenChange={onOpenChange}>
    {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
      <Dialog.Content className={`fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-eco-border bg-eco-bg shadow-xl ${larga ? 'max-w-6xl' : 'max-w-lg'}`}>
        <header className="flex shrink-0 items-start gap-3 border-b border-eco-border p-4">
          <div className="min-w-0 flex-1">
            <Dialog.Title className="text-lg font-semibold text-eco-accent">{titulo}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-400">{descricao}</Dialog.Description>
          </div>
          <Dialog.Close className="btn h-11 w-11 shrink-0 px-0" aria-label={`Fechar ${titulo}`}><X size={20} /></Dialog.Close>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
