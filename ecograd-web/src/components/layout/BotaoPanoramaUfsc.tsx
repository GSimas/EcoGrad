import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { Janela } from './Janela';
import { PanoramaUfsc } from '@/components/dashboard/PanoramaUfsc';

/**
 * Abre o Panorama UFSC.
 *
 * Mora em arquivo próprio porque tem dois lugares: a navegação do painel lateral
 * e os atalhos da apresentação. Deixá-lo em `Sidebar` fazia os dois se importarem
 * em círculo.
 */
export function BotaoPanoramaUfsc({ compacto = false, className, desabilitado = false }: {
  compacto?: boolean;
  /** Quando dado, veste o botão como chip da apresentação em vez de item da lateral. */
  className?: string;
  desabilitado?: boolean;
}) {
  // Controlada porque abrir um item do panorama navega para a análise: sem fechar,
  // o diálogo ficaria por cima do que o usuário acabou de pedir para ver.
  const [aberta, setAberta] = useState(false);
  return <Janela aberta={aberta} onOpenChange={setAberta} titulo="Panorama UFSC" descricao="O acervo inteiro em números e os programas de pós-graduação reconhecidos pela CAPES — independentes das coleções da sua análise." larga
    trigger={<button type="button" className={className ?? 'btn min-h-11'} disabled={desabilitado} aria-label="Abrir Panorama UFSC" title="Panorama UFSC">
      <Landmark size={className ? 14 : 18} className="shrink-0" aria-hidden />{!compacto && <span className="eco-chip-rotulo">Panorama UFSC</span>}
    </button>}>
    <PanoramaUfsc aoNavegar={() => setAberta(false)} />
  </Janela>;
}
