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

export type MetodoFusao = 'normalizacao' | 'abreviacao';
export interface FusaoCanonica { grafia: string; canonico: string; metodo: MetodoFusao }

/** Sobrenome (antes da vírgula) e prenomes, já sem acento, caixa, pontuação e partículas. */
function partesDoNome(nome: string) {
  const [antes, ...depois] = nome.split(',');
  const sobrenome = [...tokensDeNome(antes)].join(' ');
  const prenomes = depois.length ? [...tokensDeNome(depois.join(' '))] : [];
  return { sobrenome, prenomes, chave: `${sobrenome}|${prenomes.join(' ')}` };
}

/**
 * Unificação automática **conservadora** do acervo inteiro (ADR 004). Funde só
 * o que dificilmente é outra pessoa, e cada fusão sai com o método para a
 * curadoria humana revisar depois:
 *
 * - `normalizacao`: grafias idênticas depois de tirar acento, caixa, pontuação e
 *   partículas — "Dal Ri Jr., Arno" e "Dal Ri. Jr., Arno".
 * - `abreviacao`: a grafia curta tem o mesmo sobrenome e o mesmo primeiro
 *   prenome da longa, todos os seus prenomes estão na longa, as duas aparecem
 *   em ao menos uma coleção em comum, e existe **uma única** grafia longa
 *   compatível. Havendo duas ("Silva, Ana Maria" e "Silva, Ana Paula" para
 *   "Silva, Ana"), não funde: ambiguidade é decisão humana.
 *
 * Nome sem vírgula, com mais de uma pessoa na grafia, ou só com sobrenome e
 * iniciais, fica como está.
 * O canônico é a grafia mais frequente da forma mais completa.
 */
export function unificacaoConservadora(ocorrencias: Iterable<{ nome: string; colecao: string }>): FusaoCanonica[] {
  const grafias = new Map<string, { frequencia: number; colecoes: Set<string> }>();
  for (const { nome, colecao } of ocorrencias) {
    const g = nome.trim();
    if (!g) continue;
    const e = grafias.get(g) ?? { frequencia: 0, colecoes: new Set<string>() };
    e.frequencia += 1;
    e.colecoes.add(colecao);
    grafias.set(g, e);
  }

  // 1. Normalização: um grupo por chave, representado pela grafia mais frequente.
  const grupos = new Map<string, { sobrenome: string; prenomes: string[]; grafias: string[]; frequencia: number; colecoes: Set<string> }>();
  for (const [g, e] of grafias) {
    // Sem vírgula não há como separar sobrenome; com ";" ou duas vírgulas, a
    // grafia junta mais de uma pessoa ("Radunz, Vera; Souza, Ana") e não funde.
    if ((g.match(/,/g) ?? []).length !== 1 || g.includes(';')) continue;
    const p = partesDoNome(g);
    if (!p.sobrenome || !p.prenomes.length) continue;
    const grupo = grupos.get(p.chave) ?? { ...p, grafias: [], frequencia: 0, colecoes: new Set<string>() };
    grupo.grafias.push(g);
    grupo.frequencia += e.frequencia;
    e.colecoes.forEach((c) => grupo.colecoes.add(c));
    grupos.set(p.chave, grupo);
  }
  const representante = (grupo: { grafias: string[] }) =>
    [...grupo.grafias].sort((a, b) => grafias.get(b)!.frequencia - grafias.get(a)!.frequencia || b.length - a.length || a.localeCompare(b))[0];

  // 2. Abreviação: dentro do mesmo sobrenome, a chave curta aponta para a única longa compatível.
  const porSobrenome = new Map<string, string[]>();
  for (const [chave, g] of grupos) porSobrenome.set(g.sobrenome, [...(porSobrenome.get(g.sobrenome) ?? []), chave]);
  const destino = new Map<string, string>();
  for (const chaves of porSobrenome.values()) {
    for (const curta of chaves) {
      const c = grupos.get(curta)!;
      const compativeis = chaves.filter((longa) => {
        if (longa === curta) return false;
        const l = grupos.get(longa)!;
        return l.prenomes.length > c.prenomes.length && l.prenomes[0] === c.prenomes[0]
          && c.prenomes.every((t) => l.prenomes.includes(t));
      });
      // Só as maximais: "Ana Maria" ⊂ "Ana Maria Souza" não conta como segunda opção para "Ana".
      const maximais = compativeis.filter((a) => !compativeis.some((b) => b !== a && grupos.get(b)!.prenomes.length > grupos.get(a)!.prenomes.length
        && grupos.get(a)!.prenomes.every((t) => grupos.get(b)!.prenomes.includes(t))));
      if (maximais.length !== 1) continue;
      const alvo = grupos.get(maximais[0])!;
      if (![...c.colecoes].some((col) => alvo.colecoes.has(col))) continue;
      destino.set(curta, maximais[0]);
    }
  }

  const fusoes: FusaoCanonica[] = [];
  for (const [chave, grupo] of grupos) {
    const alvoChave = destino.get(chave);
    const canonico = representante(grupos.get(alvoChave ?? chave)!);
    for (const g of grupo.grafias) {
      if (g === canonico) continue;
      fusoes.push({ grafia: g, canonico, metodo: alvoChave ? 'abreviacao' : 'normalizacao' });
    }
  }
  return fusoes.sort((a, b) => a.grafia.localeCompare(b.grafia));
}
