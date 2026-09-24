import { useEffect, useRef, useState } from 'react';
import { useAtividades } from '@/hooks/useSnaWorker';

const DESFECHO = { concluida: 'concluída', erro: 'falhou', cancelada: 'cancelada' } as const;

/**
 * Anuncia a leitores de tela quando uma atividade de fundo termina: o
 * carregamento das coleções, a rede global, o bootstrap, o Grid Search.
 *
 * Quem enxerga vê o painel de atividades sumir e os resultados aparecerem; sem
 * este aviso, quem ouve não sabia que o cálculo tinha acabado — nem que tinha
 * falhado. Fica montado fora das páginas, para o aviso sobreviver à troca da
 * apresentação pelo Dashboard. Invisível e fora do fluxo (`sr-only`).
 */
export function AvisosDeAtividade() {
  const tarefas = useAtividades();
  const vistas = useRef(new Map<string, string>());
  const iniciado = useRef(false);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    const novos: string[] = [];
    for (const t of tarefas) {
      const desfecho = DESFECHO[t.status as keyof typeof DESFECHO];
      if (!desfecho) { vistas.current.delete(t.id); continue; }
      const marca = `${t.executionId ?? ''}:${t.status}`;
      if (vistas.current.get(t.id) === marca) continue;
      vistas.current.set(t.id, marca);
      // O que já estava terminado ao abrir a página (sessão recuperada) não é novidade.
      if (iniciado.current) novos.push(`Atividade “${t.titulo}” ${desfecho}.${t.status === 'erro' && t.erro ? ` ${t.erro}` : ''}`);
    }
    iniciado.current = true;
    if (novos.length) setAviso(novos.join(' '));
  }, [tarefas]);
  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{aviso}</div>;
}
