/** Execução independente dos componentes. Uma instância de worker por atividade. */
export interface WorkerPort {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}
export type TaskStatus = 'fila' | 'executando' | 'concluida' | 'cancelada' | 'erro';
export interface Task<Request, Result> {
  id: string;
  titulo: string;
  executionId?: string;
  pedido: Request;
  status: TaskStatus;
  progresso: number | null;
  texto: string;
  erro?: string;
  resultado?: Result;
  pedidoResultado?: Request;
}
type WorkerMessage<Result> = Result | { type: 'progress'; value?: number | null; text: string } | { type: 'error'; message: string };
interface Run<Request, Result> {
  task: Task<Request, Result>;
  worker?: WorkerPort;
  concluir?: (result: Result) => void;
}

export class WorkerTasks<Request extends { type: string }, Result extends { type: string }> {
  private runs = new Map<string, Run<Request, Result>>();
  private listeners = new Set<() => void>();
  private snapshot: Task<Request, Result>[] = [];
  constructor(private factory: (request: Request) => WorkerPort, private limite = 2) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  get = (id: string) => this.runs.get(id)?.task;
  private publish() {
    this.snapshot = [...this.runs.values()].map((run) => run.task);
    this.listeners.forEach((listener) => listener());
  }
  start(id: string, titulo: string, pedido: Request, concluir?: (result: Result) => void) {
    const anterior = this.runs.get(id);
    if (anterior && this.busy(anterior.task)) return false;
    this.runs.set(id, { task: { id, titulo, pedido, executionId: crypto.randomUUID(), status: 'fila', progresso: null,
      texto: 'Aguardando outra atividade terminar...', resultado: anterior?.task.resultado,
      pedidoResultado: anterior?.task.pedidoResultado }, concluir });
    this.publish();
    this.pump();
    return true;
  }
  private busy(task: Task<Request, Result>) { return task.status === 'fila' || task.status === 'executando'; }
  private pump() {
    for (const run of this.runs.values()) {
      if ([...this.runs.values()].filter((r) => r.task.status === 'executando').length >= this.limite) break;
      if (run.task.status !== 'fila') continue;
      run.task = { ...run.task, status: 'executando', texto: 'Iniciando atividade...' };
      try {
        const worker = this.factory(run.task.pedido);
        run.worker = worker;
        worker.onmessage = (event) => {
          // Mensagens atrasadas de workers encerrados nunca alteram uma nova execução.
          if (this.runs.get(run.task.id) !== run || run.task.status !== 'executando') return;
          const msg = event.data as WorkerMessage<Result>;
          if (msg.type === 'progress') {
            const p = msg as { value?: number | null; text: string };
            run.task = { ...run.task, progresso: typeof p.value === 'number' && Number.isFinite(p.value) ? Math.max(0, Math.min(100, p.value)) : null, texto: p.text };
            this.publish();
          } else if (msg.type === 'error') {
            this.finish(run, 'erro', (msg as { message: string }).message);
          } else if (msg.type !== (run.task.pedido.type === 'carregar' ? 'pronto' : run.task.pedido.type)) {
            this.finish(run, 'erro', 'Resposta inesperada do cálculo. Tente novamente.');
          } else {
            run.task = { ...run.task, resultado: msg as Result, pedidoResultado: run.task.pedido };
            this.finish(run, 'concluida');
            if (this.runs.get(run.task.id) === run) run.concluir?.(msg as Result);
          }
        };
        worker.onerror = (event) => {
          event.preventDefault?.();
          if (this.runs.get(run.task.id) === run && run.task.status === 'executando') this.finish(run, 'erro', event.message || 'O cálculo foi interrompido por uma falha.');
        };
        worker.onmessageerror = () => {
          if (this.runs.get(run.task.id) === run && run.task.status === 'executando') this.finish(run, 'erro', 'Não foi possível ler o resultado do cálculo.');
        };
        this.publish();
        worker.postMessage(run.task.pedido);
      } catch (e) { this.finish(run, 'erro', e instanceof Error ? e.message : String(e)); }
    }
  }
  private finish(run: Run<Request, Result>, status: TaskStatus, erro?: string) {
    run.worker?.terminate();
    run.worker = undefined;
    run.task = { ...run.task, status, erro, progresso: status === 'concluida' ? 100 : null,
      texto: status === 'concluida' ? 'Concluída.' : status === 'cancelada' ? 'Cancelada. Você pode reiniciar esta atividade.' : 'Falha na atividade.' };
    this.publish();
    this.pump();
  }
  cancel = (id: string) => {
    const run = this.runs.get(id);
    if (run && this.busy(run.task)) this.finish(run, 'cancelada');
  };
  retry = (id: string) => {
    const run = this.runs.get(id);
    if (run && !this.busy(run.task)) this.start(id, run.task.titulo, run.task.pedido, run.concluir);
  };
  /** A reload interrupts computation; restoring never dispatches work. */
  restore(tasks: Task<Request, Result>[], callback: (task: Task<Request, Result>) => Run<Request, Result>['concluir']) {
    for (const run of this.runs.values()) run.worker?.terminate();
    this.runs.clear();
    for (const saved of tasks) {
      const interrupted = this.busy(saved);
      const task = interrupted ? { ...saved, status: 'cancelada' as const, progresso: null,
        texto: 'Interrompida pelo recarregamento. Reinicie quando desejar.' } : saved;
      this.runs.set(task.id, { task, concluir: callback(task) });
    }
    this.publish();
  }
  /** Invalidação atômica: não inicia tarefas da fila durante a limpeza. */
  clear(predicate: (task: Task<Request, Result>) => boolean = () => true) {
    for (const [id, run] of this.runs) if (predicate(run.task)) {
      run.worker?.terminate();
      this.runs.delete(id);
    }
    this.publish();
    this.pump();
  }
}
