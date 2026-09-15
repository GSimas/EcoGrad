import type { Documento } from '../types';

/** Grafia (com trim) → nome canônico, como `mapaDeGrafias` produz. */
export type MapaGrafias = Map<string, string>;

const canonico = (mapa: MapaGrafias, nome: string) => mapa.get(nome.trim()) ?? nome;

/** Canoniza e remove as repetições que a fusão cria dentro do mesmo campo. */
function lista(mapa: MapaGrafias, nomes: readonly string[]) {
  const saida: string[] = [];
  let mudou = false;
  for (const nome of nomes) {
    const alvo = canonico(mapa, nome);
    if (alvo !== nome) mudou = true;
    // Duas grafias da mesma pessoa no mesmo campo viram uma entrada só.
    if (saida.includes(alvo)) mudou = true;
    else saida.push(alvo);
  }
  return mudou ? saida : (nomes as string[]);
}

/**
 * Reescreve os nomes de pessoa da base com as grafias canônicas escolhidas pelo
 * usuário. É o único ponto em que a unificação entra: como todos os índices,
 * redes e indicadores derivam destes documentos, a fusão vale para a análise
 * inteira sem que cada consumidor precise saber dela.
 *
 * Preserva a identidade do array e dos documentos que não mudam, para não
 * invalidar as memoizações da base ativa à toa.
 */
export function aplicarUnificacao(docs: readonly Documento[], mapa: MapaGrafias): Documento[] {
  if (mapa.size === 0) return docs as Documento[];
  let algumMudou = false;
  const saida = docs.map((d) => {
    const autores = lista(mapa, d.autores);
    const co_orientadores = lista(mapa, d.co_orientadores);
    const orientador = d.orientador ? canonico(mapa, d.orientador) : d.orientador;
    if (autores === d.autores && co_orientadores === d.co_orientadores && orientador === d.orientador) return d;
    algumMudou = true;
    return { ...d, autores, co_orientadores, orientador };
  });
  return algumMudou ? saida : (docs as Documento[]);
}

/** Partículas que não distinguem uma pessoa da outra. */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'la', 'y']);

/** Sobrenomes e prenomes significativos, sem acento, caixa nem pontuação. */
export function tokensDeNome(nome: string): Set<string> {
  const limpo = nome.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return new Set(limpo.split(/\s+/).filter((t) => t.length > 1 && !PARTICULAS.has(t)));
}

/**
 * Se um nome é uma forma abreviada do outro — "Vieira, Paulo Freire" dentro de
 * "Vieira, Paulo Henrique Freire". Comparar as grafias inteiras não serve: é
 * justamente o nome do meio que costuma faltar numa das versões.
 */
export function variacaoDoMesmoNome(a: string, b: string): boolean {
  const ta = tokensDeNome(a);
  const tb = tokensDeNome(b);
  if (!ta.size || !tb.size) return false;
  const [menor, maior] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  return [...menor].every((t) => maior.has(t));
}
