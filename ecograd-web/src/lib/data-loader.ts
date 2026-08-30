/**
 * Carregamento e descompressão das bases.
 * Substitui `carregar_base_consolidada` / `carregar_base_tcc` /
 * `carregar_catalogo_programas` / `carregar_catalogo_tcc_frontend` (backend.py:2410+).
 *
 * Os `.json.gz` ficam em `public/data/` e são descomprimidos no cliente:
 * usa `DecompressionStream('gzip')` (nativo, streaming) quando disponível e
 * cai para `pako` nos navegadores que não o expõem.
 */
import { inflate } from 'pako';
import type { CatalogoProgramas, ColecaoTCC, Documento } from '@/types';

export const CAMINHO_BASE_PPG = '/data/base_consolidada_ufsc.json.gz';
export const CAMINHO_BASE_TCC = '/data/base_tcc_ufsc.json.gz';
export const CAMINHO_CATALOGO_PPG = '/data/programas_ufsc.json';
export const CAMINHO_CATALOGO_TCC = '/data/mapa_colecoes_tcc.json';

/**
 * Transcrição de `_normalizar_documentos` (backend.py:50).
 * Garante tipos consistentes para evitar bugs downstream.
 */
export function normalizarDocumentos(dados: unknown[]): Documento[] {
  const out: Documento[] = [];

  for (const bruto of dados) {
    if (!bruto || typeof bruto !== 'object') continue;
    const d = bruto as Record<string, unknown>;

    let ano: number | null = null;
    const anoRaw = d.ano;
    if (anoRaw !== null && anoRaw !== undefined) {
      const parsed = Number.parseInt(String(anoRaw).trim(), 10);
      ano = Number.isFinite(parsed) ? parsed : null;
    }

    const lista = (chave: string): string[] =>
      Array.isArray(d[chave]) ? (d[chave] as unknown[]).map(String) : [];

    const texto = (chave: string): string => {
      const v = d[chave];
      return v === null || v === undefined ? '' : String(v);
    };

    out.push({
      titulo: texto('titulo'),
      nivel_academico: texto('nivel_academico'),
      autores: lista('autores'),
      orientador: texto('orientador'),
      co_orientadores: lista('co_orientadores'),
      possui_coorientador: Boolean(d.possui_coorientador),
      palavras_chave: lista('palavras_chave').filter((pk) => pk && pk.trim() !== ''),
      macrotema: texto('macrotema'),
      resumo: texto('resumo'),
      programa_origem: texto('programa_origem'),
      url: texto('url'),
      ano,
      pureza_nmf: typeof d.pureza_nmf === 'number' ? d.pureza_nmf : undefined,
      ontologia_ia: (d.ontologia_ia as Documento['ontologia_ia']) ?? undefined,
    });
  }

  return out;
}

/**
 * Baixa um `.json.gz` e devolve o JSON já parseado.
 *
 * O corpo é lido UMA única vez e a compressão é detectada pela assinatura gzip
 * (0x1f 0x8b). Isso é necessário porque servidores de desenvolvimento e CDNs
 * frequentemente servem o arquivo com `Content-Encoding: gzip`, e nesse caso o
 * navegador já o entrega descomprimido — tentar descomprimir de novo falharia
 * com o corpo já consumido, sem chance de fallback.
 */
export async function carregarJsonGz<T>(url: string, signal?: AbortSignal): Promise<T> {
  const resposta = await fetch(url, { signal });
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${resposta.status}`);
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  const estaComprimido = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!estaComprimido) {
    return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T;
  }

  // Descompressão nativa quando disponível (mais rápida e sem cópia intermediária
  // em string); `pako` cobre os navegadores sem DecompressionStream.
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return (await new Response(stream).json()) as T;
  }

  return JSON.parse(inflate(bytes, { to: 'string' })) as T;
}

/** Catálogo leve de PPGs (nome do programa → setSpec do repositório). */
export async function carregarCatalogoProgramas(signal?: AbortSignal): Promise<CatalogoProgramas> {
  const r = await fetch(CAMINHO_CATALOGO_PPG, { signal });
  if (!r.ok) throw new Error(`Catálogo de programas indisponível (HTTP ${r.status}).`);
  return (await r.json()) as CatalogoProgramas;
}

/** Catálogo leve de coleções de TCC. */
export async function carregarCatalogoTCC(signal?: AbortSignal): Promise<ColecaoTCC[]> {
  const r = await fetch(CAMINHO_CATALOGO_TCC, { signal });
  if (!r.ok) return [];
  return (await r.json()) as ColecaoTCC[];
}

/**
 * Carrega e filtra a base consolidada de Pós-Graduação pelos programas escolhidos.
 * Equivalente ao filtro `d.get('programa_origem') in programas_selecionados`.
 */
export async function carregarBasePPG(
  programasSelecionados: readonly string[],
  signal?: AbortSignal,
): Promise<Documento[]> {
  if (programasSelecionados.length === 0) return [];
  const bruto = await carregarJsonGz<unknown[]>(CAMINHO_BASE_PPG, signal);
  const alvo = new Set(programasSelecionados);
  return normalizarDocumentos(
    bruto.filter((d) => alvo.has(String((d as Record<string, unknown>)?.programa_origem ?? ''))),
  );
}

/** Carrega e filtra a base de TCCs pelos cursos escolhidos. */
export async function carregarBaseTCC(
  cursosSelecionados: readonly string[],
  signal?: AbortSignal,
): Promise<Documento[]> {
  if (cursosSelecionados.length === 0) return [];
  const bruto = await carregarJsonGz<unknown[]>(CAMINHO_BASE_TCC, signal);
  const alvo = new Set(cursosSelecionados);
  return normalizarDocumentos(
    bruto.filter((d) => alvo.has(String((d as Record<string, unknown>)?.programa_origem ?? ''))),
  );
}
