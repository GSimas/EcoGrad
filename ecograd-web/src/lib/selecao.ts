export interface SelecaoColecoes { programas: string[]; cursosTcc: string[] }
export function mesmaSelecao(a: SelecaoColecoes, b: SelecaoColecoes): boolean {
  const iguais = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  return iguais(a.programas, b.programas) && iguais(a.cursosTcc, b.cursosTcc);
}
