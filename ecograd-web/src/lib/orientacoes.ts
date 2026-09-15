/**
 * Orientações de uma pessoa em todo o acervo, não só nas coleções carregadas.
 * O índice é gerado no `sync:data` por `scripts/orientacoes-index.mjs`.
 */
import type { Documento } from '@/types';
import { carregarJsonGz } from './data-loader';
import { carregarManifestoColecoes } from './collection-loader';

/** Papel 0 = orientador, 1 = coorientador. */
export interface IndiceOrientacoes {
  schema: 1;
  colecoes: string[];
  /** Ausente em índices gerados antes do nível entrar no arquivo. */
  niveis?: string[];
  pessoas: Record<string, Array<[orientando: string, colecao: number, ano: number | null, papel: 0 | 1, nivel?: number]>>;
}

export interface OrientandoNoAcervo {
  nome: string;
  orientou: number;
  coorientou: number;
  colecoes: string[];
  /** Tipos registrados dos trabalhos, separados por "; ". */
  niveis: string;
  periodo: string;
  ultimoAno: number | null;
}

const CAMINHO = /^\/data\/orientacoes-[a-f0-9]{64}\.json\.gz$/;

export async function carregarIndiceOrientacoes(signal?: AbortSignal): Promise<IndiceOrientacoes> {
  const manifest = await carregarManifestoColecoes(signal) as { orientacoes?: { path?: unknown } };
  const path = manifest.orientacoes?.path;
  if (typeof path !== 'string' || !CAMINHO.test(path)) throw new Error('Índice de orientações indisponível nesta versão da base.');
  const indice = await carregarJsonGz<IndiceOrientacoes>(path, signal);
  if (indice?.schema !== 1 || !Array.isArray(indice.colecoes) || !indice.pessoas || typeof indice.pessoas !== 'object') {
    throw new Error('Índice de orientações inválido.');
  }
  return indice;
}

/** `hasOwnProperty`, e não `in`: um nome como "constructor" não pode casar com o protótipo. */
export function temOrientacoes(indice: IndiceOrientacoes, pessoa: string): boolean {
  return Object.prototype.hasOwnProperty.call(indice.pessoas, pessoa);
}

/** Uma linha por orientando, do mais recente ao mais antigo. */
export function orientacoesDe(indice: IndiceOrientacoes, pessoa: string): OrientandoNoAcervo[] {
  const mapa = new Map<string, { orientou: number; coorientou: number; colecoes: Set<string>; niveis: Set<string>; anos: number[] }>();
  for (const [nome, colecao, ano, papel, nivel] of temOrientacoes(indice, pessoa) ? indice.pessoas[pessoa] : []) {
    const o = mapa.get(nome) ?? { orientou: 0, coorientou: 0, colecoes: new Set<string>(), niveis: new Set<string>(), anos: [] };
    o.niveis.add((nivel === undefined ? '' : indice.niveis?.[nivel]) || 'Não informado');
    if (papel === 0) o.orientou++;
    else o.coorientou++;
    o.colecoes.add(indice.colecoes[colecao] || 'Coleção não informada');
    if (ano !== null) o.anos.push(ano);
    mapa.set(nome, o);
  }
  return [...mapa].map(([nome, o]) => {
    const ini = o.anos.length ? Math.min(...o.anos) : null;
    const fim = o.anos.length ? Math.max(...o.anos) : null;
    return {
      nome,
      orientou: o.orientou,
      coorientou: o.coorientou,
      colecoes: [...o.colecoes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      niveis: [...o.niveis].sort((a, b) => a.localeCompare(b, 'pt-BR')).join('; '),
      periodo: ini === null ? 'Não informado' : ini === fim ? String(ini) : `${ini}–${fim}`,
      ultimoAno: fim,
    };
  }).sort((a, b) => (b.ultimoAno ?? -Infinity) - (a.ultimoAno ?? -Infinity) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * O mesmo formato do índice, só com as coleções carregadas e só para `pessoa`.
 * Espelha `scripts/orientacoes-index.mjs`; vale enquanto o índice do acervo baixa ou se ele falhar.
 */
export function orientacoesLocais(docs: readonly Documento[], pessoa: string): IndiceOrientacoes {
  const colecoes: string[] = [];
  const niveis: string[] = [];
  const entradas: IndiceOrientacoes['pessoas'][string] = [];
  const posicao = (lista: string[], valor: string) => {
    const i = lista.indexOf(valor);
    return i >= 0 ? i : lista.push(valor) - 1;
  };
  for (const d of pessoa ? docs : []) {
    const orientador = d.orientador.trim();
    const coorientadores = new Set(d.co_orientadores.map((c) => c.trim()));
    coorientadores.delete(orientador);
    const papel = orientador === pessoa ? 0 : coorientadores.has(pessoa) ? 1 : -1;
    if (papel < 0) continue;
    for (const autor of new Set(d.autores.map((a) => a.trim()).filter(Boolean))) {
      if (autor !== pessoa) entradas.push([autor, posicao(colecoes, d.programa_origem.trim()), d.ano, papel as 0 | 1, posicao(niveis, d.nivel_academico.trim() || 'Não informado')]);
    }
  }
  return { schema: 1, colecoes, niveis, pessoas: entradas.length ? { [pessoa]: entradas } : {} };
}
