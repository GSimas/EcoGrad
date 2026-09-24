import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatarNumero(v: number): string {
  return new Intl.NumberFormat('pt-BR').format(v);
}

/** Faixa de tempo em segundos, como o usuário lê antes de mandar ler os resumos. */
export function formatarDuracao([min, max]: readonly [number, number]): string {
  return max < 60 ? 'menos de 1 minuto' : `cerca de ${Math.max(1, Math.round(min / 60))} a ${Math.ceil(max / 60)} minutos`;
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

/** Termos da consulta, sem acento e caixa; espaço, vírgula e ponto e vírgula separam. */
export function termosBusca(consulta: string): string[] {
  return chaveBusca(consulta).split(/[\s,;]+/).filter(Boolean);
}

/**
 * Todos os termos aparecem no texto, em qualquer ordem: "Richard Demo", "Demo Richard",
 * "Demo" e "Richard" encontram "Souza, Richard Demo". Consulta vazia corresponde a tudo.
 */
export function correspondeBusca(texto: string, consulta: string | readonly string[]): boolean {
  const termos = typeof consulta === 'string' ? termosBusca(consulta) : consulta;
  if (!termos.length) return true;
  const chave = chaveBusca(texto);
  return termos.every((t) => chave.includes(t));
}

const SEPARADOR_PALAVRA = /[\s,.;:()/-]/;

function ocorreComoPalavra(chave: string, termo: string, inteira: boolean): boolean {
  for (let p = chave.indexOf(termo); p >= 0; p = chave.indexOf(termo, p + 1)) {
    const inicio = p === 0 || SEPARADOR_PALAVRA.test(chave[p - 1]);
    const fim = !inteira || p + termo.length === chave.length || SEPARADOR_PALAVRA.test(chave[p + termo.length]);
    if (inicio && fim) return true;
  }
  return false;
}

/**
 * Relevância de `chave` (já passada por `chaveBusca`), ou -1 se falta algum termo.
 * 0 frase igual ao texto; 1 todos os termos como palavras inteiras ("demo" em
 * "souza, richard demo", não em "democracia"); 2 texto começa com a frase;
 * 3 todos os termos em início de palavra; 4 termos em qualquer trecho.
 */
export function nivelBusca(chave: string, termos: readonly string[]): number {
  if (!termos.length || !termos.every((t) => chave.includes(t))) return -1;
  const frase = termos.join(' ');
  const compacta = chave.replace(/[\s,;]+/g, ' ').trim();
  if (compacta === frase) return 0;
  if (termos.every((t) => ocorreComoPalavra(chave, t, true))) return 1;
  if (compacta.startsWith(frase)) return 2;
  return termos.every((t) => ocorreComoPalavra(chave, t, false)) ? 3 : 4;
}

/**
 * Chaves de busca de uma lista de opções, por identidade da lista. Os seletores
 * filtram a mesma lista a cada tecla; normalizar dezenas de milhares de nomes
 * de novo a cada tecla era o grosso do custo da digitação.
 */
const chavesDasOpcoes = new WeakMap<readonly string[], string[]>();
function chavesDe(opcoes: readonly string[]): string[] {
  let chaves = chavesDasOpcoes.get(opcoes);
  if (!chaves) { chaves = opcoes.map(chaveBusca); chavesDasOpcoes.set(opcoes, chaves); }
  return chaves;
}

/** Opções que correspondem à consulta, das mais relevantes às menos; empates mantêm a ordem original. */
export function filtrarPorRelevancia(opcoes: readonly string[], consulta: string, limite = Infinity): string[] {
  const termos = termosBusca(consulta);
  if (!termos.length) return opcoes.slice(0, limite);
  const chaves = chavesDe(opcoes);
  const achados: Array<[nivel: number, i: number]> = [];
  // A presença de todos os termos é conferida antes, num laço simples: quase
  // nenhuma opção passa, e `nivelBusca` devolve -1 justamente quando falta um.
  proxima: for (let i = 0; i < chaves.length; i++) {
    const chave = chaves[i];
    for (let t = 0; t < termos.length; t++) if (!chave.includes(termos[t])) continue proxima;
    achados.push([nivelBusca(chave, termos), i]);
  }
  return achados.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limite).map(([, i]) => opcoes[i]);
}
