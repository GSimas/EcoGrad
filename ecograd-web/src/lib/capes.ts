/**
 * Identificação conservadora: sem atribuição automática por similaridade.
 */
import type { CatalogoCapes, ProgramaCapes } from '@/types';

/** Normaliza o nome do PPG como no Python: remove prefixos, acentos e caixa. */
export function normalizarNomePPG(nome: string): string {
  return nome.normalize('NFD').replace(/\p{Mn}/gu, '').toUpperCase()
    .replace(/^(?:PROGRAMA DE POS[- ]GRADUACAO(?: EM)?|PPG(?: EM)?)\s+/, '')
    .trim().replace(/\s+/g, ' ');
}

/**
 * Ratcliff-Obershelp — mesma métrica de `difflib.SequenceMatcher.ratio()`.
 * ratio = 2 * caracteres casados / (len(a) + len(b)).
 */
export function razaoSimilaridade(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 1;
  return (2 * casamentosRecursivos(a, b)) / total;
}

function casamentosRecursivos(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  // Maior bloco comum (equivalente a find_longest_match)
  let melhorA = 0;
  let melhorB = 0;
  let melhorTam = 0;
  let anterior = new Int32Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    const atual = new Int32Array(b.length + 1);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        atual[j] = anterior[j - 1] + 1;
        if (atual[j] > melhorTam) {
          melhorTam = atual[j];
          melhorA = i - atual[j];
          melhorB = j - atual[j];
        }
      }
    }
    anterior = atual;
  }

  if (melhorTam === 0) return 0;

  return (
    melhorTam +
    casamentosRecursivos(a.slice(0, melhorA), b.slice(0, melhorB)) +
    casamentosRecursivos(a.slice(melhorA + melhorTam), b.slice(melhorB + melhorTam))
  );
}

export type CorrespondenciaCapes =
  | { status: 'exata'; programa: ProgramaCapes; criterio: 'codigo' | 'nome' }
  | { status: 'ambigua'; candidatos: ProgramaCapes[] }
  | { status: 'nao-encontrada'; sugestoes: ProgramaCapes[] };

/** Homônimos permanecem ambíguos; similaridade serve somente como sugestão. */
export function encontrarFichaCapes(nomePPG: string, catalogo: CatalogoCapes): CorrespondenciaCapes {
  const porCodigo = catalogo.programas[nomePPG.trim()];
  if (porCodigo) return { status: 'exata', programa: porCodigo, criterio: 'codigo' };
  const alvo = normalizarNomePPG(nomePPG);
  const programas = Object.values(catalogo.programas);
  const exatos = programas.filter((p) => normalizarNomePPG(p.Nome) === alvo);
  if (exatos.length === 1) return { status: 'exata', programa: exatos[0], criterio: 'nome' };
  if (exatos.length > 1) return { status: 'ambigua', candidatos: exatos };
  const sugestoes = alvo.length < 3 ? [] : programas
    .map((p) => ({ p, score: razaoSimilaridade(alvo, normalizarNomePPG(p.Nome)) }))
    .filter(({ score }) => score >= 0.65)
    .sort((a, b) => b.score - a.score || a.p.Código.localeCompare(b.p.Código))
    .slice(0, 3).map(({ p }) => p);
  return { status: 'nao-encontrada', sugestoes };
}

export function programaEmFuncionamento(p: ProgramaCapes): boolean {
  return ['EM FUNCIONAMENTO', 'ATIVO'].includes(normalizarNomePPG(p.Situação));
}

export function niveisPrograma(p: ProgramaCapes): string[] {
  const grau = normalizarNomePPG(p['Grau Acadêmico']);
  const niveis = ['Mestrado', 'Doutorado'].filter((nivel) => grau.includes(nivel.toUpperCase()));
  return niveis.length ? niveis : ['Não informado'];
}

export interface FiltrosCapes {
  niveis: readonly string[] | null;
  modalidades: readonly string[] | null;
  notas: readonly string[] | null;
}

/** null = todas as opções; [] = nenhuma. Dentro do campo OR, entre campos AND. */
export function filtrarProgramasCapes(programas: readonly ProgramaCapes[], filtros: FiltrosCapes): ProgramaCapes[] {
  return programas.filter((p) =>
    (filtros.niveis === null || niveisPrograma(p).some((n) => filtros.niveis!.includes(n))) &&
    (filtros.modalidades === null || filtros.modalidades.includes(p.Modalidade)) &&
    (filtros.notas === null || filtros.notas.includes(p.Nota)),
  );
}

function catalogoValido(dados: unknown): dados is CatalogoCapes {
  if (!dados || typeof dados !== 'object') return false;
  const c = dados as CatalogoCapes;
  if (c.versao !== 2 || !c.programas || typeof c.programas !== 'object' || Array.isArray(c.programas) ||
      !c.fonte || typeof c.fonte.url !== 'string' || typeof c.fonte.idIes !== 'string' ||
      typeof c.fonte.consultadoEm !== 'string' || !Number.isFinite(Date.parse(c.fonte.consultadoEm))) return false;
  const entradas = Object.entries(c.programas);
  const campos: (keyof ProgramaCapes)[] = ['Nome', 'Código', 'Nota', 'Grande Área', 'Área de Avaliação',
    'Área de Conhecimento', 'Modalidade', 'Situação', 'Modalidade de Ensino', 'Grau Acadêmico'];
  return entradas.length > 0 && c.fonte.totalProgramas === entradas.length && entradas.every(([codigo, p]) =>
    p && campos.every((campo) => typeof p[campo] === 'string') && p.Código === codigo && !!codigo.trim() && !!p.Nome.trim(),
  );
}

/** Busca o catálogo institucional da CAPES via Netlify Function (sem CORS). */
export async function carregarCatalogoCapes(signal?: AbortSignal): Promise<CatalogoCapes> {
  // Versões anteriores armazenavam até respostas vazias por 24h no navegador.
  // O React Query já mantém o catálogo válido em memória; tentativas de rede
  // precisam consultar o serviço novamente, sem reutilizar esse cache HTTP.
  const r = await fetch('/api/capes-proxy?v=2', { signal, cache: 'no-store' });
  if (!r.headers.get('content-type')?.includes('application/json')) {
    throw new Error('O serviço de consulta à CAPES não está acessível.');
  }
  const dados: unknown = await r.json();
  if (!r.ok) {
    const mensagem = dados && typeof dados === 'object' && 'error' in dados ? dados.error : null;
    throw new Error(typeof mensagem === 'string' ? mensagem : `Falha ao consultar a CAPES (HTTP ${r.status}).`);
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Object.keys(dados).length === 0) {
    throw new Error('A CAPES não retornou programas para a instituição consultada.');
  }
  if (!catalogoValido(dados)) throw new Error('O catálogo CAPES recebido está incompleto ou desatualizado. Atualize a consulta.');
  return dados;
}
