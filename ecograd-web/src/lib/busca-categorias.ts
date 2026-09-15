import { opcoesPorTipo } from './entities';
import { PAPEIS_PESSOA, type IndicesInvertidos, type PapelPessoa, type TipoBusca } from '../types';

/**
 * A busca é organizada em três categorias amplas, e não nos tipos internos: quem
 * procura um nome raramente sabe de antemão se ele consta como autor ou como
 * orientador, nem se um assunto está como palavra-chave ou como macrotema.
 *
 * `Pessoas` usa o tipo unificado, que reúne os papéis numa entidade só.
 * `Temas` NÃO unifica: palavra-chave é vocabulário declarado pelo autor e
 * macrotema é classificação atribuída pela base, e existem rótulos idênticos nos
 * dois com conjuntos de trabalhos diferentes. Aqui eles apenas convivem na mesma
 * lista, separados pela etiqueta.
 */
export const CATEGORIAS = [
  { id: 'tudo', rotulo: 'Tudo', tipos: ['Documento', 'Pessoa', 'Palavra-chave', 'Macrotema'] },
  { id: 'documentos', rotulo: 'Documentos', tipos: ['Documento'] },
  { id: 'pessoas', rotulo: 'Pessoas', tipos: ['Pessoa'] },
  { id: 'temas', rotulo: 'Temas', tipos: ['Palavra-chave', 'Macrotema'] },
] as const satisfies readonly { id: string; rotulo: string; tipos: readonly TipoBusca[] }[];

export type Categoria = typeof CATEGORIAS[number]['id'];

export const TODOS = 'Todos';
/** Subfiltros: recortam a lista sem devolver a escolha do tipo para o usuário. */
export const PAPEIS = [TODOS, ...PAPEIS_PESSOA] as const;
export const ORIGENS = [TODOS, 'Palavra-chave', 'Macrotema'] as const;

export const categoriaPorId = (id: string) => CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[0];
export const idPorRotulo = (rotulo: string): Categoria => CATEGORIAS.find((c) => c.rotulo === rotulo)?.id ?? 'tudo';
export const categoriaTem = (id: Categoria, tipo: TipoBusca) =>
  (categoriaPorId(id).tipos as readonly TipoBusca[]).includes(tipo);

/** Onde este tipo mora, inclusive os papéis que só chegam por link ou atalho. */
export function categoriaDe(tipo: TipoBusca): Categoria {
  if (tipo === 'Documento') return 'documentos';
  if (tipo === 'Palavra-chave' || tipo === 'Macrotema') return 'temas';
  return 'pessoas';
}

/**
 * A etiqueta ao lado do nome. Em pessoas é informativa — a entidade é uma só e
 * os papéis dizem como ela aparece. Em temas é identificadora: dois itens de
 * mesmo nome e origens diferentes são coisas distintas.
 */
export function etiqueta(tipo: TipoBusca, nome: string, indices: IndicesInvertidos): string {
  if (tipo !== 'Pessoa') return tipo;
  const papeis = indices.papeis_pessoa.get(nome);
  return papeis?.size ? [...papeis].join(' · ') : 'Pessoa';
}

export const rotuloDe = (tipo: TipoBusca, nome: string, indices: IndicesInvertidos) =>
  `${nome} (${etiqueta(tipo, nome, indices)})`;

const ordemNome = new Intl.Collator('pt-BR').compare;

/**
 * Rótulo exibido → item real. Os homônimos de temas geram entradas distintas,
 * porque o rótulo carrega a origem.
 */
export function montarCatalogo(
  indices: IndicesInvertidos,
  categoria: Categoria,
  papel: string = TODOS,
  origem: string = TODOS,
): Map<string, { tipo: TipoBusca; nome: string }> {
  const itens: { rotulo: string; tipo: TipoBusca; nome: string }[] = [];
  for (const tipo of categoriaPorId(categoria).tipos as readonly TipoBusca[]) {
    if ((tipo === 'Palavra-chave' || tipo === 'Macrotema') && origem !== TODOS && tipo !== origem) continue;
    for (const nome of opcoesPorTipo(indices, tipo)) {
      if (tipo === 'Pessoa' && papel !== TODOS && !indices.papeis_pessoa.get(nome)?.has(papel as PapelPessoa)) continue;
      itens.push({ rotulo: rotuloDe(tipo, nome, indices), tipo, nome });
    }
  }
  itens.sort((a, b) => ordemNome(a.nome, b.nome) || ordemNome(a.rotulo, b.rotulo));
  return new Map(itens.map((i) => [i.rotulo, { tipo: i.tipo, nome: i.nome }]));
}
