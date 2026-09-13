import { atividades } from '@/services/calculos';
import { emExecucao, useAtividade, useAtividades } from '@/hooks/useSnaWorker';
import { Progresso } from './primitives';

export function Atividade({ id }: { id: string }) {
  const task = useAtividade(id);
  if (!task) return null;
  const ativa = emExecucao(task);
  return (
    <div className="space-y-2 rounded-lg border border-eco-border p-3" aria-label={task.titulo}>
      <p className="text-sm font-semibold">{task.titulo}</p>
      {ativa ? <Progresso valor={task.progresso} texto={task.texto} /> : (
        <p role="status" className="text-sm text-slate-300">{task.erro ?? task.texto}</p>
      )}
      {ativa && <p className="text-xs text-slate-400">Você pode navegar entre páginas. A atividade continua nesta sessão.</p>}
      {task.resultado && task.status !== 'concluida' && <p className="text-xs text-slate-400">O último resultado concluído foi preservado.</p>}
      {ativa ? (
        <button type="button" className="btn" onClick={() => atividades.cancel(id)} aria-label={`Cancelar ${task.titulo}`}>Cancelar atividade</button>
      ) : task.status !== 'concluida' ? (
        <>
          <p className="text-xs text-slate-400">Reiniciar executa esta atividade desde o início, com os mesmos parâmetros. Etapas já concluídas são preservadas.</p>
          <button type="button" className="btn" onClick={() => atividades.retry(id)} aria-label={`Reiniciar ${task.titulo}`}>Reiniciar atividade</button>
        </>
      ) : null}
    </div>
  );
}

/** Visível fora da página de origem, inclusive para recuperar falhas/cancelamentos. */
export function PainelAtividades() {
  const tasks = useAtividades();
  const pendentes = tasks.filter((t) => t.status !== 'concluida');
  if (!pendentes.length) return null;
  return (
    <details className="m-4 rounded-lg border border-eco-border bg-eco-panel p-3">
      <summary className="cursor-pointer text-sm font-medium">Atividades da sessão ({pendentes.length}) — {pendentes.filter(emExecucao).length} em andamento ou na fila</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{pendentes.map((t) => <Atividade key={t.id} id={t.id} />)}</div>
    </details>
  );
}
