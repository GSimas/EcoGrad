import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkerTasks, type WorkerPort } from '../src/lib/worker-tasks';

type Pedido = { type: 'calculo'; base: number; parametro: number };
type Resultado = { type: 'calculo'; valor: number };
class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null;
  onerror: WorkerPort['onerror'] = null;
  onmessageerror: WorkerPort['onmessageerror'] = null;
  encerrado = false;
  pedido?: unknown;
  postMessage(pedido: unknown) { this.pedido = pedido; }
  terminate() { this.encerrado = true; }
  message(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}
const pedido = (base = 1, parametro = 3): Pedido => ({ type: 'calculo', base, parametro });
function ambiente(limite = 2) {
  const workers: FakeWorker[] = [];
  const tasks = new WorkerTasks<Pedido, Resultado>(() => { const w = new FakeWorker(); workers.push(w); return w; }, limite);
  return { workers, tasks };
}

test('trocar de página remove assinaturas sem encerrar execução ou perder resultado', () => {
  const { tasks, workers } = ambiente();
  let atualizacoes = 0;
  const sairDaPagina = tasks.subscribe(() => atualizacoes++);
  tasks.start('rede', 'Rede', pedido());
  sairDaPagina();
  const antes = atualizacoes;
  workers[0].message({ type: 'progress', value: null, text: 'Etapa de rede' });
  assert.equal(workers[0].encerrado, false);
  workers[0].message({ type: 'calculo', valor: 42 });
  assert.equal(atualizacoes, antes);
  assert.equal(tasks.get('rede')?.status, 'concluida');
  assert.deepEqual(tasks.getSnapshot()[0].resultado, { type: 'calculo', valor: 42 });
});

test('cancelamento termina o worker e ignora resultado, erro e progresso atrasados', () => {
  const { tasks, workers } = ambiente();
  let aplicado = false;
  tasks.start('rede', 'Rede', pedido(), () => { aplicado = true; });
  tasks.cancel('rede');
  assert.equal(workers[0].encerrado, true);
  workers[0].message({ type: 'calculo', valor: 42 });
  workers[0].message({ type: 'progress', value: 90, text: 'Atrasado' });
  workers[0].onerror?.({ message: 'Atrasado' } as ErrorEvent);
  assert.equal(tasks.get('rede')?.status, 'cancelada');
  assert.equal(tasks.get('rede')?.progresso, null);
  assert.equal(aplicado, false);
});

test('reinício usa os parâmetros capturados e não recebe resposta da execução anterior', () => {
  const { tasks, workers } = ambiente();
  tasks.start('rede', 'Rede', pedido(1, 7));
  tasks.cancel('rede');
  tasks.retry('rede');
  assert.deepEqual(workers[1].pedido, pedido(1, 7));
  workers[0].message({ type: 'calculo', valor: -1 });
  assert.equal(tasks.get('rede')?.status, 'executando');
  workers[1].message({ type: 'calculo', valor: 42 });
  assert.equal(tasks.get('rede')?.resultado?.valor, 42);
});

test('duplo clique não substitui uma execução ou seu consumidor', () => {
  const { tasks, workers } = ambiente();
  let valor = 0;
  assert.equal(tasks.start('rede', 'Rede', pedido(), () => { valor = 1; }), true);
  assert.equal(tasks.start('rede', 'Outra', pedido(2), () => { valor = 2; }), false);
  assert.equal(workers.length, 1);
  workers[0].message({ type: 'calculo', valor: 42 });
  assert.equal(valor, 1);
});

test('atividades concorrentes mantêm progresso, resultados e falhas independentes', () => {
  const { tasks, workers } = ambiente();
  tasks.start('bootstrap', 'Bootstrap', pedido());
  tasks.start('grid', 'Grid', pedido());
  workers[0].message({ type: 'progress', value: 12, text: '12/100' });
  workers[1].message({ type: 'progress', value: 50, text: '54/108' });
  assert.equal(tasks.get('bootstrap')?.progresso, 12);
  assert.equal(tasks.get('grid')?.progresso, 50);
  workers[0].message({ type: 'error', message: 'Falha específica' });
  workers[1].message({ type: 'calculo', valor: 8 });
  assert.equal(tasks.get('bootstrap')?.erro, 'Falha específica');
  assert.equal(tasks.get('grid')?.resultado?.valor, 8);
});

test('fila respeita o limite, pode ser cancelada e avança após encerrar atividade', () => {
  const { tasks, workers } = ambiente(1);
  tasks.start('a', 'A', pedido());
  tasks.start('b', 'B', pedido());
  tasks.start('c', 'C', pedido());
  assert.equal(workers.length, 1);
  assert.equal(tasks.get('b')?.status, 'fila');
  tasks.cancel('b');
  tasks.cancel('a');
  assert.equal(workers.length, 2);
  assert.equal(tasks.get('c')?.status, 'executando');
});

test('nova base invalida simultaneamente execução, fila e resultados; mensagens antigas são descartadas', () => {
  const { tasks, workers } = ambiente(1);
  let aplicado = false;
  tasks.start('a', 'A', pedido(), () => { aplicado = true; });
  tasks.start('b', 'B', pedido());
  tasks.clear();
  assert.equal(workers[0].encerrado, true);
  assert.equal(workers.length, 1);
  assert.equal(tasks.getSnapshot().length, 0);
  tasks.start('a', 'A', pedido(2));
  workers[0].message({ type: 'calculo', valor: 1 });
  assert.equal(tasks.get('a')?.status, 'executando');
  assert.equal(aplicado, false);
});

test('falha ou cancelamento do recálculo preserva último resultado e seus parâmetros', () => {
  const { tasks, workers } = ambiente();
  tasks.start('rede', 'Rede', pedido(1, 3));
  workers[0].message({ type: 'calculo', valor: 30 });
  tasks.start('rede', 'Rede', pedido(1, 7));
  tasks.cancel('rede');
  assert.equal(tasks.get('rede')?.resultado?.valor, 30);
  assert.equal(tasks.get('rede')?.pedidoResultado?.parametro, 3);
  assert.equal(tasks.get('rede')?.pedido.parametro, 7);
  tasks.retry('rede');
  workers[2].onmessageerror?.({} as MessageEvent);
  assert.equal(tasks.get('rede')?.status, 'erro');
  assert.equal(tasks.get('rede')?.resultado?.valor, 30);
});

test('erros nativos e de inicialização sempre produzem estado recuperável', () => {
  const { tasks, workers } = ambiente();
  tasks.start('a', 'A', pedido());
  workers[0].onerror?.({ message: 'Falha nativa' } as ErrorEvent);
  assert.equal(tasks.get('a')?.status, 'erro');
  assert.equal(workers[0].encerrado, true);
  tasks.retry('a');
  assert.equal(tasks.get('a')?.status, 'executando');
  const falha = new WorkerTasks<Pedido, Resultado>(() => { throw new Error('Sem recursos'); });
  falha.start('a', 'A', pedido());
  assert.equal(falha.get('a')?.erro, 'Sem recursos');
});

test('falha no envio e resposta incompatível não são interpretadas como sucesso vazio', () => {
  const w = new FakeWorker();
  w.postMessage = () => { throw new Error('Falha na transferência'); };
  const tasks = new WorkerTasks<Pedido, Resultado>(() => w);
  tasks.start('a', 'A', pedido());
  assert.equal(tasks.get('a')?.status, 'erro');
  assert.equal(w.encerrado, true);
  const normal = ambiente();
  normal.tasks.start('a', 'A', pedido());
  normal.workers[0].message({ type: 'outro', valor: 7 });
  assert.equal(normal.tasks.get('a')?.status, 'erro');
});

test('etapa concluída é preservada quando a etapa seguinte é cancelada', () => {
  const { tasks, workers } = ambiente();
  tasks.start('sna', 'Rede', pedido(), () => tasks.start('maturidade', 'Maturidade', pedido()));
  workers[0].message({ type: 'calculo', valor: 42 });
  tasks.cancel('maturidade');
  assert.equal(tasks.get('sna')?.status, 'concluida');
  assert.equal(tasks.get('sna')?.resultado?.valor, 42);
  assert.equal(tasks.get('maturidade')?.status, 'cancelada');
});

test('invalidação na conclusão impede aplicação de resultado à base que acabou de mudar', () => {
  const { tasks, workers } = ambiente();
  let aplicado = false;
  tasks.start('rede', 'Rede', pedido(), () => { aplicado = true; });
  tasks.subscribe(() => {
    if (tasks.get('rede')?.status === 'concluida') tasks.clear();
  });
  workers[0].message({ type: 'calculo', valor: 42 });
  assert.equal(aplicado, false);
  assert.equal(tasks.getSnapshot().length, 0);
});

test('recovery retains results and captured parameters without creating workers or calling completion', () => {
  const original = ambiente();
  original.tasks.start('rede', 'Rede', pedido(2, 7));
  original.workers[0].message({ type: 'calculo', valor: 42 });
  const recovered = ambiente();
  let applied = 0;
  recovered.tasks.restore(original.tasks.getSnapshot(), () => () => { applied++; });
  assert.equal(recovered.workers.length, 0);
  assert.equal(applied, 0);
  assert.equal(recovered.tasks.get('rede')?.resultado?.valor, 42);
  assert.deepEqual(recovered.tasks.get('rede')?.pedidoResultado, pedido(2, 7));
});

test('reload interrupts running and queued jobs, preserving previous results and manual retry callbacks', () => {
  const original = ambiente(1);
  original.tasks.start('rede', 'Rede', pedido());
  original.workers[0].message({ type: 'calculo', valor: 11 });
  original.tasks.start('rede', 'Rede', pedido(1, 8));
  original.tasks.start('fila', 'Fila', pedido());
  const recovered = ambiente(1);
  let applied = 0;
  recovered.tasks.restore(original.tasks.getSnapshot(), () => (r) => { applied = r.valor; });
  assert.equal(recovered.workers.length, 0);
  assert.equal(recovered.tasks.get('rede')?.status, 'cancelada');
  assert.equal(recovered.tasks.get('fila')?.status, 'cancelada');
  assert.equal(recovered.tasks.get('rede')?.resultado?.valor, 11);
  recovered.tasks.retry('rede');
  assert.deepEqual(recovered.workers[0].pedido, pedido(1, 8));
  recovered.workers[0].message({ type: 'calculo', valor: 99 });
  assert.equal(applied, 99);
  assert.equal(recovered.tasks.get('fila')?.status, 'cancelada');
});

test('new analysis invalidates restored activity and rejects its late messages', () => {
  const original = ambiente();
  original.tasks.start('rede', 'Rede', pedido());
  const recovered = ambiente();
  let applied = false;
  recovered.tasks.restore(original.tasks.getSnapshot(), () => () => { applied = true; });
  recovered.tasks.retry('rede');
  recovered.tasks.clear();
  recovered.workers[0].message({ type: 'calculo', valor: 100 });
  assert.equal(recovered.tasks.getSnapshot().length, 0);
  assert.equal(applied, false);
});
