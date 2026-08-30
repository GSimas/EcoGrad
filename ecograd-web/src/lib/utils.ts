import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatarNumero(v: number): string {
  return new Intl.NumberFormat('pt-BR').format(v);
}

export function formatarDecimal(v: number, casas = 4): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Converte linhas em CSV com escape de aspas e BOM para abrir bem no Excel. */
export function paraCSV(
  linhas: ReadonlyArray<Record<string, unknown>>,
  colunas?: readonly string[],
): string {
  if (linhas.length === 0) return '';
  const cols = colunas ?? Object.keys(linhas[0]);
  const escapar = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = linhas.map((l) => cols.map((c) => escapar(l[c])).join(',')).join('\n');
  return `﻿${cols.join(',')}\n${corpo}`;
}

/** Dispara o download de um texto gerado no cliente. */
export function baixarArquivo(conteudo: string, nome: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Remove acentos e caixa para comparações de busca tolerantes. */
export function chaveBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}
