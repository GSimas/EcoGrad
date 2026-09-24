/**
 * Trabalho longo em fatias curtas: depois de cada `orcamentoMs`, a vez volta à
 * página, que pode pintar um quadro e responder a um clique antes de a conta
 * continuar. Nada aqui muda o resultado — só quando ele fica pronto.
 */

/** Devolve a vez à página: `scheduler.yield` onde existe, `setTimeout` onde não. */
export const cederVez = () => new Promise<void>((ok) => {
  const agendador = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (agendador?.yield) void agendador.yield().then(ok);
  else setTimeout(ok, 0);
});

/**
 * Ordenação estável em fatias (merge sort de baixo para cima). Para o mesmo
 * comparador, uma ordenação estável só tem um resultado possível — o mesmo do
 * `Array.prototype.sort`, que também é estável. Devolve um array novo.
 */
export async function ordenarEmFatias<T>(
  itens: readonly T[],
  comparar: (a: T, b: T) => number,
  ceder: () => Promise<void> = cederVez,
  orcamentoMs = 8,
): Promise<T[]> {
  let origem = itens.slice();
  const n = origem.length;
  if (n < 2) return origem;
  let destino = new Array<T>(n);
  let inicio = performance.now();
  let passos = 0;
  for (let largura = 1; largura < n; largura *= 2) {
    for (let esquerda = 0; esquerda < n; esquerda += 2 * largura) {
      const meio = Math.min(esquerda + largura, n);
      const fim = Math.min(esquerda + 2 * largura, n);
      let i = esquerda;
      let j = meio;
      let k = esquerda;
      // Empate fica com o da esquerda: é isso que torna a ordenação estável.
      while (i < meio && j < fim) destino[k++] = comparar(origem[j], origem[i]) < 0 ? origem[j++] : origem[i++];
      while (i < meio) destino[k++] = origem[i++];
      while (j < fim) destino[k++] = origem[j++];
      passos += fim - esquerda;
      if (passos >= 2048) {
        passos = 0;
        if (performance.now() - inicio > orcamentoMs) { await ceder(); inicio = performance.now(); }
      }
    }
    [origem, destino] = [destino, origem];
  }
  return origem;
}
